-- ═══════════════════════════════════════════════════════════════
-- appliquer_badges_saisie — l'administrateur retire TOUTE origine.
--
-- ── LE DÉFAUT CONSTATÉ (test device, 2026-08-26) ────────────────
-- Sur Gabriel Mandziuk, un badge « Leadership » (code `capitaine`) apparaît
-- dans « Attribués par quelqu'un d'autre » et refuse de se désélectionner.
-- Sa ligne :
--     origine      = 'transposition'
--     attribue_par = a0000000-…-a3  (Nexus Coach Civil)
--     created_at   = 2026-08-05
--
-- Deux verrous se cumulaient, et le second était invisible :
--   1. `attribue_par` ≠ le coach connecté — verrou VOULU (partition par
--      auteur), et correctement expliqué à l'écran.
--   2. `origine = 'transposition'` — verrou NON VOULU à ce degré : la clause
--      `and ab.origine = 'saisie'` du retrait excluait ces lignes pour TOUT
--      LE MONDE. Ni leur auteur d'origine, ni un administrateur ne pouvaient
--      les retirer par le picker. Un badge repris de l'ancien format était
--      donc INDÉLÉBILE par l'interface, sans que rien ne le dise.
--
-- ── LA DÉCISION (BP, 2026-08-26) ────────────────────────────────
-- `is_admin()` peut retirer TOUT badge, quelle qu'en soit l'origine
-- ('saisie', 'suggestion', 'transposition') et quel qu'en soit l'auteur.
-- Un administrateur est le recours quand plus personne d'autre ne peut agir ;
-- une donnée montrée aux recruteurs ne doit jamais devenir irréparable.
-- La partition par auteur reste ENTIÈRE pour les coachs : un coach ne touche
-- que ses propres badges de saisie. Rien ne change pour lui.
--
-- ── CE QUI N'A PAS BESOIN DE CHANGER, ET POURQUOI ───────────────
-- La policy `athlete_badges retrait` autorise DÉJÀ l'administrateur sur
-- n'importe quelle ligne :
--     using (attribue_par = auth.uid() or is_admin())
-- Vérifié en prod avant d'écrire ce fichier. Elle n'entre de toute façon pas
-- en jeu ici : la fonction est SECURITY DEFINER avec `row_security = off`,
-- donc sa propre clause WHERE est le SEUL garde. C'est bien elle, et elle
-- seule, qu'il faut corriger — toucher à la policy serait un contresens.
--
-- ── ⚠ CONSÉQUENCE POUR L'APPELANT ADMINISTRATEUR ────────────────
-- Le périmètre du remplacement s'élargit, donc l'exigence sur `p_entrees`
-- s'élargit avec lui : un administrateur doit désormais envoyer TOUS les
-- badges de l'athlète qu'il veut conserver, y compris ceux d'origine
-- 'suggestion' et 'transposition'. S'il n'envoie que les badges de saisie,
-- CE FICHIER LUI FAIT PERDRE LES AUTRES.
-- `chargerBadgesAthlete` (lib/queries/shared/athleteBadges.ts) est modifié
-- dans le même lot pour verser toutes les origines dans `miens` quand
-- l'appelant est administrateur. Les deux vont ENSEMBLE — appliquer cette
-- migration sans ce changement de client est une perte de données.
--
-- Un badge conservé garde son origine : il figure dans `p_entrees`, donc le
-- `not exists` du retrait l'épargne, et l'INSERT retombe sur le
-- `on conflict … do nothing`. Il ne se fait pas requalifier en 'saisie'.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.appliquer_badges_saisie(
  p_athlete_id uuid, p_entrees jsonb)
  returns void language plpgsql
  security definer set row_security to 'off' set search_path to 'public', 'pg_temp'
as $fn$
declare
  v_auteur uuid;
  v_admin  boolean;
  v_inconnus text;
begin
  v_auteur := auth.uid();
  if v_auteur is null then
    raise exception 'NEXUS: aucune session authentifiée — impossible d''attribuer un badge sans auteur.';
  end if;

  /* AUTORISATION EXPLICITE. Cette fonction est SECURITY DEFINER avec
     row_security off : les policies de athlete_badges ne la protègent PAS.
     Sans ce test, tout compte connecté poserait des badges sur n'importe
     quel athlète en appelant /rest/v1/rpc/. coach_can_award_badge exige
     is_coach(), donc un admin y échouerait — d'où la disjonction. */
  v_admin := public.is_admin();
  if not (v_admin or public.coach_can_award_badge(p_athlete_id)) then
    raise exception
      'NEXUS: vous n''avez pas le droit d''attribuer des badges à cet athlète.';
  end if;

  /* Accepte les deux formes de clés : {code, contexte} — la forme native du
     picker et de athlete_badges — et {badge, detail}, l'ancienne forme jsonb,
     pour qu'un appelant pas encore migré ne casse pas. */
  select string_agg(distinct coalesce(e->>'code', e->>'badge'), ', ')
    into v_inconnus
  from jsonb_array_elements(coalesce(p_entrees, '[]'::jsonb)) e
  where public.code_badge_catalogue(coalesce(e->>'code', e->>'badge')) is null;

  if v_inconnus is not null then
    raise exception 'NEXUS: badge(s) inconnu(s) au catalogue : %.', v_inconnus;
  end if;

  -- ── Retrait de ce qui n'est plus demandé ──
  -- Retrait DOUX (retire_le), jamais DELETE : l'historique d'attribution
  -- reste lisible.
  --
  -- LA PORTÉE EST LA SEULE CHOSE QUI CHANGE DANS CE FICHIER :
  --   · administrateur → toute origine, tout auteur ;
  --   · coach          → ses propres badges d'origine 'saisie', comme avant.
  -- L'ancienne clause `and ab.origine = 'saisie'` s'appliquait AUSSI à
  -- l'administrateur : c'est elle qui rendait 'transposition' indélébile.
  update public.athlete_badges ab
     set retire_le = now(), retire_par = v_auteur
    from public.badges b
   where b.id = ab.badge_id
     and ab.athlete_id = p_athlete_id
     and ab.retire_le is null
     and (
           v_admin
        or (ab.origine = 'saisie' and ab.attribue_par = v_auteur)
     )
     and not exists (
       select 1 from jsonb_array_elements(coalesce(p_entrees, '[]'::jsonb)) e
        where public.code_badge_catalogue(coalesce(e->>'code', e->>'badge')) = b.code
          and nullif(btrim(coalesce(e->>'contexte', e->>'detail', '')), '')
              is not distinct from ab.contexte
     );

  -- ── Pose de ce qui manque ──
  -- Une ligne déjà présente ET identique n'est pas réécrite : son created_at
  -- reste la vraie date d'attribution, celle montrée aux partenaires.
  -- L'index unique partiel arbitre le reste.
  --
  -- badge_contexte_requis s'applique ICI dans toute sa rigueur : origine
  -- vaut 'saisie', donc un honneur sans contexte fait ÉCHOUER l'appel. C'est
  -- voulu — le picker est le seul chemin qui PEUT demander le contexte, donc
  -- le seul auquel on a le droit de l'imposer.
  insert into public.athlete_badges
    (athlete_id, badge_id, contexte, attribue_par, origine)
  select p_athlete_id, b.id,
         nullif(btrim(coalesce(e->>'contexte', e->>'detail', '')), ''),
         v_auteur, 'saisie'
  from jsonb_array_elements(coalesce(p_entrees, '[]'::jsonb)) e
  join public.badges b on b.code = public.code_badge_catalogue(coalesce(e->>'code', e->>'badge'))
  on conflict (athlete_id, badge_id, contexte) where retire_le is null
  do nothing;
end;
$fn$;

revoke all on function public.appliquer_badges_saisie(uuid, jsonb) from public, anon;
grant execute on function public.appliquer_badges_saisie(uuid, jsonb) to authenticated, service_role;

comment on function public.appliquer_badges_saisie(uuid, jsonb) is
$c$Remplace, EN UNE TRANSACTION, le jeu de badges d'un athlète.

Appelée par le picker (écrans coach et admin). Le chemin « suggestion
athlète » passe par appliquer_distinctions_suggerees.

Portée du remplacement :
  · COACH — ses propres badges d'origine 'saisie'. Ne touche jamais à ceux
    d'un autre coach, ni à 'suggestion', ni à 'transposition'.
  · ADMINISTRATEUR — TOUS les badges de l'athlète, toute origine et tout
    auteur confondus (décision BP du 2026-08-26 : l'administrateur est le
    recours quand plus personne ne peut agir).

p_entrees : tableau jsonb de {code, contexte} (ou {badge, detail}). Il doit
contenir EXACTEMENT les badges que l'appelant veut CONSERVER dans son
périmètre — pour un administrateur, cela signifie désormais TOUS les badges
de l'athlète, 'transposition' et 'suggestion' compris. En envoyer moins les
retire.

N'écrit PAS evaluations.distinctions : c'est une colonne dérivée, que le
miroir reconstruit depuis athlete_badges.$c$;
