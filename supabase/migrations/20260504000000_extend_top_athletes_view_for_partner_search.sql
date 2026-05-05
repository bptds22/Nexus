-- ═══════════════════════════════════════════════════════════════
-- Extend top_athletes_view for partner search filters.
--
-- Per the partner athletes search scope (2026-05-04), partners can
-- filter on `withSportBadge` (sport distinctions) and
-- `withVideoOnly` (highlight video presence). Both filter targets
-- are already visible to partners on the profile page (no
-- isPartner gate around the hero distinctions or the Faits
-- saillants video section), so adding them as filterable columns
-- here is safe.
--
-- Adds four columns to top_athletes_view:
--   distinctions                — jsonb, from latest evaluation
--   video_faits_saillants_url   — text, from athletes
--   video_match_complet_url     — text, from athletes
--   video_entrainement_url      — text, from athletes
--
-- Distinctions live on `evaluations`, one-to-many with athletes.
-- A LATERAL join pulls the most recent row's distinctions per
-- athlete (matches the recruiter recherche page's read pattern,
-- which embeds `evaluations(distinctions)` and uses the first
-- row).
--
-- Existing consumers (both `SELECT *` with structural type casts):
--   - app/partenaire/athletes/page.tsx
--   - app/partenaire/classements/page.tsx
-- Adding columns is safe for both — the type casts ignore the new
-- fields at compile time and the runtime data carries them.
--
-- WHERE predicate, FROM joins, and ORDER BY preserved exactly.
-- ═══════════════════════════════════════════════════════════════

DROP VIEW IF EXISTS public.top_athletes_view;

CREATE VIEW public.top_athletes_view AS
SELECT
  a.id,
  a.first_name,
  a.last_name,
  a.cote_globale_entraineur,
  a.annee_diplomation,
  sch.region,
  a.sport_id,
  a.position_id,
  a.school_id,
  a.photo_url,
  s.nom AS sport_name,
  p.nom AS position_name,
  sch.name AS school_name,
  e.distinctions,
  a.video_faits_saillants_url,
  a.video_match_complet_url,
  a.video_entrainement_url
FROM athletes a
LEFT JOIN sports s ON s.id = a.sport_id
LEFT JOIN positions p ON p.id = a.position_id
LEFT JOIN schools sch ON sch.id = a.school_id
LEFT JOIN LATERAL (
  SELECT distinctions
  FROM evaluations
  WHERE evaluations.athlete_id = a.id
  ORDER BY created_at DESC
  LIMIT 1
) e ON true
WHERE is_partner_eligible_athlete(a.id)
ORDER BY a.cote_globale_entraineur DESC;

GRANT SELECT ON public.top_athletes_view TO authenticated;
