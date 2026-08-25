-- ═══════════════════════════════════════════════════════════════
-- Deux défauts de appliquer_distinctions_suggerees, trouvés en approuvant
-- une VRAIE suggestion gelée dans une transaction annulée.
--
-- ── DÉFAUT 1 — le badge naissait sans auteur ────────────────────
-- La fonction prenait v_coach_id, que apply_approved_suggestion dérive de
-- athletes.coach_id avec repli sur athlete_suggestions.coach_id. Or pour
-- les 24 suggestions en attente, LES DEUX SONT NULL — vérifié : 24/24,
-- 16 athlètes sur 16. attribue_par serait donc NULL, avec deux suites :
--   · la policy de retrait exige `attribue_par = auth.uid() OR is_admin()`,
--     donc PERSONNE hors admin n'aurait pu retirer le badge ;
--   · le remplacement comparait `attribue_par = p_coach_id`, jamais vrai
--     face à NULL : chaque approbation aurait empilé au lieu de remplacer.
--
-- Le bon auteur n'est de toute façon ni l'un ni l'autre : c'est CELUI QUI
-- APPROUVE, qui engage sa responsabilité en validant. auth.uid() le donne,
-- et reste lisible sous SECURITY DEFINER (le rôle change, pas le JWT).
-- Si aucun auteur n'est déterminable, on REFUSE : un badge que personne ne
-- peut retirer est pire qu'une approbation qui échoue en le disant.
--
-- ── DÉFAUT 2 — le remplacement mordait trop large ───────────────
-- Scoper sur l'auteur signifiait qu'une suggestion approuvée par le
-- directeur ne remplaçait pas celle approuvée par le coach. Et surtout :
-- une suggestion d'ATHLÈTE pouvait retirer un badge posé par un COACH dans
-- le picker. La suggestion dit « voici ma liste » — elle n'a autorité que
-- sur ce qui vient d'elle. Le remplacement est donc borné à
-- origine='suggestion' : les badges du picker ('saisie') et ceux repris de
-- l'ancien format ('transposition') ne bougent pas.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.appliquer_distinctions_suggerees(
  p_athlete_id uuid, p_coach_id uuid, p_entrees jsonb, p_remplacer boolean)
  returns void language plpgsql
  security definer set row_security to 'off' set search_path to 'public'
as $fn$
declare v_inconnus text; v_auteur uuid;
begin
  -- Celui qui approuve d'abord ; le coach de l'athlète en repli.
  v_auteur := coalesce(auth.uid(), p_coach_id);
  if v_auteur is null then
    raise exception
      'NEXUS: impossible de déterminer qui attribue ce badge (ni session authentifiée, ni coach rattaché à l''athlète). Approbation refusée — un badge sans auteur ne pourrait plus être retiré.';
  end if;

  -- Aucun effacement silencieux : un code sans équivalent au catalogue
  -- (`progression`) ferait retirer les badges existants sans en poser aucun.
  select string_agg(distinct e->>'badge', ', ')
    into v_inconnus
  from jsonb_array_elements(coalesce(p_entrees, '[]'::jsonb)) e
  where public.code_badge_catalogue(e->>'badge') is null;

  if v_inconnus is not null then
    raise exception
      'NEXUS: distinction(s) sans équivalent au catalogue : %. Cette suggestion date d''avant le nouveau catalogue et ne peut pas être approuvée telle quelle. Demandez à l''athlète de la resoumettre.', v_inconnus;
  end if;

  -- Retrait de ce qui n'est plus proposé, borné aux badges ISSUS DE
  -- SUGGESTIONS. Retrait DOUX (retire_le), jamais DELETE.
  if p_remplacer then
    update public.athlete_badges ab
       set retire_le = now(), retire_par = v_auteur
      from public.badges b
     where b.id = ab.badge_id
       and ab.athlete_id = p_athlete_id
       and ab.origine = 'suggestion'
       and ab.retire_le is null
       and not exists (
         select 1 from jsonb_array_elements(coalesce(p_entrees, '[]'::jsonb)) e
          where public.code_badge_catalogue(e->>'badge') = b.code
            and nullif(btrim(coalesce(e->>'detail', '')), '') is not distinct from ab.contexte
       );
  end if;

  -- Pose de ce qui manque. Les lignes déjà présentes et identiques ne sont
  -- pas réécrites : leur created_at reste la vraie date d'attribution,
  -- celle montrée aux partenaires.
  insert into public.athlete_badges
    (athlete_id, badge_id, contexte, attribue_par, origine)
  select p_athlete_id, b.id,
         nullif(btrim(coalesce(e->>'detail', '')), ''),
         v_auteur, 'suggestion'
  from jsonb_array_elements(coalesce(p_entrees, '[]'::jsonb)) e
  join public.badges b on b.code = public.code_badge_catalogue(e->>'badge')
  on conflict (athlete_id, badge_id, contexte) where retire_le is null
  do nothing;
end;
$fn$;

revoke all on function public.appliquer_distinctions_suggerees(uuid, uuid, jsonb, boolean)
  from public, anon, authenticated;