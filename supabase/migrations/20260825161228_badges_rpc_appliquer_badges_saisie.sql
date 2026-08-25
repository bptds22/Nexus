-- ═══════════════════════════════════════════════════════════════
-- appliquer_badges_saisie — le chemin d'écriture DIRECTE du picker.
--
-- Jumelle de appliquer_distinctions_suggerees, qui sert le chemin
-- « suggestion athlète ». Celle-ci sert les écrans coach et admin.
--
-- ── POURQUOI UNE TRANSACTION, ET NON DEUX APPELS CLIENT ─────────
-- Remplacer un jeu de badges demande de RETIRER puis d'INSÉRER, et l'ordre
-- n'est pas libre : un coach au plafond (5 badges plafonnés) qui échange un
-- badge de sport contre un autre verrait badge_plafond REJETER l'insertion
-- s'il insérait d'abord — 6 plafonnés. Il faut donc retirer d'abord.
--
-- Mais alors, deux appels client séparés : si le second échoue (réseau,
-- session expirée), le coach a perdu un badge sans en gagner un, en
-- silence, sur une donnée montrée à des recruteurs. La transaction n'est
-- pas un confort, c'est ce qui rend l'opération sûre.
--
-- ── PORTÉE DU REMPLACEMENT ──────────────────────────────────────
-- Elle épouse EXACTEMENT ce que la policy UPDATE de athlete_badges
-- autorise (`attribue_par = auth.uid() OR is_admin()`) :
--   · un coach ne remplace QUE les badges qu'il a lui-même attribués ;
--   · un admin remplace tous les badges de saisie de l'athlète.
-- Les badges d'un AUTRE coach ne bougent jamais sous la main d'un coach.
-- Ceux issus d'une suggestion ('suggestion') et ceux repris de l'ancien
-- format ('transposition') ne bougent pas non plus : ce chemin n'a autorité
-- que sur ce qu'il a produit.
--
-- ⚠ CONSÉQUENCE POUR L'APPELANT (étape (b)) : `p_entrees` doit contenir
-- EXACTEMENT les badges que ce chemin gère, pas tous ceux de l'athlète.
-- Passer ceux d'un autre coach ne les retirerait pas — et l'écran mentirait
-- en laissant croire que la case décochée a eu un effet. Les badges des
-- autres se montrent, ils ne s'éditent pas.
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
  update public.athlete_badges ab
     set retire_le = now(), retire_par = v_auteur
    from public.badges b
   where b.id = ab.badge_id
     and ab.athlete_id = p_athlete_id
     and ab.origine = 'saisie'
     and ab.retire_le is null
     and (v_admin or ab.attribue_par = v_auteur)
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
$c$Remplace, EN UNE TRANSACTION, le jeu de badges de saisie d'un athlète.

Appelée par le picker (écrans coach et admin). Le chemin « suggestion
athlète » passe par appliquer_distinctions_suggerees.

Portée : les badges origine='saisie' attribués par l'appelant — ou tous les
badges de saisie si l'appelant est admin. Miroir exact de la policy UPDATE
de athlete_badges. Ne touche jamais aux badges d'un autre coach, ni à ceux
d'origine 'suggestion' ou 'transposition'.

p_entrees : tableau jsonb de {code, contexte} (ou {badge, detail}). Il doit
contenir EXACTEMENT les badges que ce chemin gère — pas tous ceux de
l'athlète.

N'écrit PAS evaluations.distinctions : c'est une colonne dérivée, que le
miroir reconstruit depuis athlete_badges.$c$;