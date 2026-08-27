-- ═══════════════════════════════════════════════════════════════
-- appliquer_badges_saisie — 'transposition' passe sous la main du coach.
--
-- ── LA DÉCISION (BP, 2026-08-27) ────────────────────────────────
-- Un badge d'origine 'transposition' devient GÉRABLE par tout coach du
-- périmètre de l'athlète, en plus de l'administrateur.
--
-- LE MOTIF EST DANS LA NATURE DE LA DONNÉE, pas dans un assouplissement des
-- droits. Un badge 'transposition' n'a PAS d'auteur au sens où en a un badge
-- 'saisie' : c'est une ligne reprise de l'ancien format lors de la bascule
-- voie 2. Son `attribue_par` désigne le compte qui a servi de porteur à la
-- migration — pas un coach qui aurait pris une décision. Le traiter comme
-- « le badge d'un collègue » demandait donc de respecter un choix que
-- personne n'a fait, et laissait le coach rattaché devant une ligne qu'il
-- voyait, savait fausse, et ne pouvait pas corriger.
--
-- ── CE QUI NE BOUGE PAS, ET C'EST L'ESSENTIEL ───────────────────
-- La partition par AUTEUR reste ENTIÈRE pour origine = 'saisie'. Le badge
-- qu'un autre coach a posé délibérément reste verrouillé, et le reste pour
-- exactement la même raison qu'avant : c'est sa décision, pas la nôtre.
-- 'suggestion' ne bouge pas non plus — son chemin est
-- appliquer_distinctions_suggerees.
--
-- Ce fichier ne change donc QU'UNE chose : la portée du retrait pour un
-- appelant coach. Rien d'autre — ni l'INSERT, ni l'autorisation d'entrée, ni
-- les droits, ni la policy.
--
-- ── POURQUOI « COACH DU PÉRIMÈTRE » N'A PAS BESOIN D'ÊTRE RETESTÉ ──
-- La fonction s'ouvre déjà sur :
--     if not (v_admin or public.coach_can_award_badge(p_athlete_id)) then …
-- Un appelant NON-admin qui atteint le UPDATE a donc déjà prouvé qu'il est
-- coach ET dans le périmètre (coach direct, `coach_can_manage_athlete`, ou
-- même école — vérifié en prod avant d'écrire ce fichier). Réécrire ce test
-- dans la clause du UPDATE en ferait une seconde implémentation du périmètre,
-- libre de diverger de la première au prochain élargissement. Le `or
-- ab.origine = 'transposition'` suffit, et il est juste PARCE QUE la porte
-- d'entrée est déjà gardée. Toucher à cette porte, c'est toucher à ceci.
--
-- ── ⚠ CONSÉQUENCE POUR L'APPELANT COACH (le même piège que pour l'admin) ──
-- Le périmètre du remplacement s'élargit pour le coach, donc l'exigence sur
-- `p_entrees` s'élargit avec lui : un coach doit désormais renvoyer les
-- badges 'transposition' qu'il veut CONSERVER. S'il n'envoie que ses propres
-- badges de saisie, CE FICHIER LUI FAIT PERDRE les 'transposition'.
-- `chargerBadgesAthlete` (lib/queries/shared/athleteBadges.ts) est modifié
-- dans le même lot pour verser 'transposition' dans `miens` en mode 'saisie',
-- pour TOUT appelant et non plus pour le seul administrateur. Les deux vont
-- ENSEMBLE — appliquer cette migration sans ce changement de client est une
-- perte de données, exactement comme le 2026-08-26.
--
-- Un badge conservé garde son origine : il figure dans `p_entrees`, donc le
-- `not exists` du retrait l'épargne, et l'INSERT retombe sur le
-- `on conflict … do nothing`. Un 'transposition' conservé ne se fait donc pas
-- requalifier en 'saisie'. En revanche, un 'transposition' RETIRÉ puis
-- RECOCHÉ revient bien en 'saisie' : la ligne d'origine porte `retire_le`,
-- l'index unique partiel ne la voit plus, et l'INSERT crée une ligne neuve
-- dont le coach est cette fois le véritable auteur. C'est le sens de
-- « le reprendre ».
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
     is_coach(), donc un admin y échouerait — d'où la disjonction.

     ⚠ C'EST AUSSI LA PREUVE DU PÉRIMÈTRE pour le retrait des
     'transposition' plus bas : passé ce point, un appelant non-admin EST un
     coach du périmètre. Ne pas affaiblir ce test sans relire le UPDATE. */
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
  -- Retrait DOUX (retire_le), jamais DELETE : l'historique reste lisible.
  --
  -- PORTÉE — la seule chose que ce fichier modifie, et seulement sa 3e ligne :
  --   · administrateur → toute origine, tout auteur (2026-08-26) ;
  --   · coach          → ses propres badges 'saisie' … ET les
  --                      'transposition' de l'athlète (2026-08-27), ceux-ci
  --                      n'ayant pas d'auteur véritable à respecter ;
  --   · 'saisie' d'un AUTRE coach → toujours hors de portée. C'est la
  --     partition par auteur, et elle n'est pas entamée ici.
  update public.athlete_badges ab
     set retire_le = now(), retire_par = v_auteur
    from public.badges b
   where b.id = ab.badge_id
     and ab.athlete_id = p_athlete_id
     and ab.retire_le is null
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
  · COACH DU PÉRIMÈTRE — ses propres badges d'origine 'saisie', PLUS tous les
    badges d'origine 'transposition' de l'athlète (décision BP du
    2026-08-27 : un badge repris de l'ancien format n'a pas d'auteur à
    respecter ; le coach rattaché doit pouvoir le reprendre ou le retirer).
    Ne touche jamais au 'saisie' d'un autre coach, ni à 'suggestion'.
  · ADMINISTRATEUR — TOUS les badges de l'athlète, toute origine et tout
    auteur confondus (décision BP du 2026-08-26).

p_entrees : tableau jsonb de {code, contexte} (ou {badge, detail}). Il doit
contenir EXACTEMENT les badges que l'appelant veut CONSERVER dans son
périmètre — 'transposition' compris pour un coach depuis le 2026-08-27, et
toute origine pour un administrateur. En envoyer moins les retire.

N'écrit PAS evaluations.distinctions : c'est une colonne dérivée, que le
miroir reconstruit depuis athlete_badges.$c$;
