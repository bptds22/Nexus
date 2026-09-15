-- ═══════════════════════════════════════════════════════════════════════════
-- M9 — appliquer_badges_saisie : l'origine 'systeme' sort du remplacement.
--
-- ⚠ CETTE MIGRATION N'ÉTAIT PAS AU PLAN DES HUIT. Elle s'est imposée en
-- écrivant M2, et la taire aurait coûté un badge.
--
-- ── LE DÉFAUT QU'ELLE ÉVITE ─────────────────────────────────────────────
-- appliquer_badges_saisie retire TOUT ce que l'appelant n'a pas renvoyé dans
-- `p_entrees`, dans la limite de sa portée. Or pour un ADMINISTRATEUR cette
-- portée est « toute origine, tout auteur » depuis le 2026-08-26. Un badge
-- d'origine 'systeme' y tomberait donc : le premier enregistrement du picker
-- admin retirerait le badge Ambassadeur d'un athlète, sans le montrer, sans
-- le dire, et sans que l'admin l'ait voulu.
--
-- C'est exactement le piège payé le 26 août (transposition) puis le 27
-- (coach) — la troisième fois, on le voit venir.
--
-- ── POURQUOI ON NE LE RÉSOUT PAS CÔTÉ CLIENT ────────────────────────────
-- Le réflexe était de laisser 'systeme' dans `miens` pour qu'il fasse
-- l'aller-retour par `p_entrees` et survive. Ça marche AUJOURD'HUI — le
-- `horsSport` de BadgePicker conserve dans `value` les codes qu'il ne peut
-- pas proposer — mais ça repose sur un détail d'implémentation d'un
-- composant partagé par sept surfaces, et sur un badge en actif = false que
-- l'écran affiche comme s'il était éditable. Une garde qui dépend d'un effet
-- de bord n'est pas une garde.
--
-- ── CONTRAT SOLIDAIRE ───────────────────────────────────────────────────
-- lib/queries/shared/athleteBadges.ts verse 'systeme' dans `autres` (verrouillé,
-- raison « Badge automatique — programme Ambassadeur »). Les deux vont
-- ENSEMBLE : ce fichier empêche le retrait, le client empêche de croire qu'on
-- peut le cocher. L'un sans l'autre laisse un mensonge à l'écran.
--
-- Il RESTE visible dans le picker et COMPTE au plafond — c'est voulu. Le
-- taire donnerait « 4/5 » quand badge_plafond en voit 5, puis un
-- enregistrement qui échoue sans explication : le défaut corrigé le
-- 2026-08-26 sur horsSport, dans l'autre sens.
--
-- ── ⚠ TENSION ASSUMÉE AVEC LA DÉCISION DU 2026-08-26 ────────────────────
-- Cette décision-là dit : « l'administrateur est le recours quand plus
-- personne ne peut agir ; une donnée montrée aux recruteurs ne doit jamais
-- devenir irréparable. » On en retire ici un cas — le picker admin ne peut
-- plus retirer un badge 'systeme'.
--
-- Ce n'est PAS irréparable, et c'est ce qui rend l'exception acceptable :
--   · l'ATHLÈTE le retire lui-même à tout moment
--     (ambassadeur_basculer_badge(false)) — c'est son badge, sur sa ligne ;
--   · l'ADMINISTRATEUR garde un chemin direct : la policy
--     `athlete_badges retrait` l'autorise déjà sur n'importe quelle ligne
--     (`using (attribue_par = auth.uid() or is_admin())`), donc un UPDATE
--     depuis la fiche admin fonctionne sans rien ajouter.
-- Ce qui disparaît, c'est le retrait PAR LE PICKER, et uniquement lui.
-- À rouvrir si BP juge la nuance trop fine — il suffit de retirer la clause.
--
-- Seule la clause du retrait change. Ni l'INSERT, ni l'autorisation d'entrée,
-- ni les droits, ni la policy.
-- ═══════════════════════════════════════════════════════════════════════════

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
     row_security off : les policies de athlete_badges ne la protègent PAS. */
  v_admin := public.is_admin();
  if not (v_admin or public.coach_can_award_badge(p_athlete_id)) then
    raise exception
      'NEXUS: vous n''avez pas le droit d''attribuer des badges à cet athlète.';
  end if;

  select string_agg(distinct coalesce(e->>'code', e->>'badge'), ', ')
    into v_inconnus
  from jsonb_array_elements(coalesce(p_entrees, '[]'::jsonb)) e
  where public.code_badge_catalogue(coalesce(e->>'code', e->>'badge')) is null;

  if v_inconnus is not null then
    raise exception 'NEXUS: badge(s) inconnu(s) au catalogue : %.', v_inconnus;
  end if;

  -- ── Retrait de ce qui n'est plus demandé ──
  update public.athlete_badges ab
     set retire_le = now(), retire_par = v_auteur
    from public.badges b
   where b.id = ab.badge_id
     and ab.athlete_id = p_athlete_id
     and ab.retire_le is null
     -- ← LA SEULE LIGNE QUI CHANGE DANS CE FICHIER.
     -- Un badge de plateforme n'est pas un badge de saisie : il ne se
     -- retire pas par le picker, quel qu'en soit l'appelant.
     and ab.origine <> 'systeme'
     and (
           v_admin
        or (ab.origine = 'saisie' and ab.attribue_par = v_auteur)
        or ab.origine = 'transposition'
     )
     and not exists (
       select 1 from jsonb_array_elements(coalesce(p_entrees, '[]'::jsonb)) e
        where public.code_badge_catalogue(coalesce(e->>'code', e->>'badge')) = b.code
          and nullif(btrim(coalesce(e->>'contexte', e->>'detail', '')), '')
              is not distinct from ab.contexte
     );

  -- ── Pose de ce qui manque ──
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

Portée du remplacement :
  · COACH — ses propres badges 'saisie', plus les 'transposition' de
    l'athlète (2026-08-27).
  · ADMINISTRATEUR — tous les badges, toute origine et tout auteur
    (2026-08-26)… SAUF 'systeme'.
  · 'systeme' — HORS DE PORTÉE DE TOUS (2026-09-15). C'est le badge
    Ambassadeur : l'athlète le porte et le retire par
    ambassadeur_basculer_badge(), un admin par un UPDATE direct (la policy
    `athlete_badges retrait` l'autorise déjà). Il reste visible dans le
    picker et compte au plafond.

p_entrees doit contenir EXACTEMENT les badges que l'appelant veut CONSERVER
dans sa portée. En envoyer moins les retire — 'systeme' excepté.$c$;

do $$
declare v_src text;
begin
  select pg_get_functiondef(p.oid) into v_src
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'appliquer_badges_saisie';
  if v_src not like '%ab.origine <> ''systeme''%' then
    raise exception 'NEXUS: la clause d''exclusion de l''origine systeme n''est pas en place — le picker admin retirerait le badge Ambassadeur.';
  end if;
  raise notice 'NEXUS: origine systeme exclue du remplacement par le picker.';
end $$;
