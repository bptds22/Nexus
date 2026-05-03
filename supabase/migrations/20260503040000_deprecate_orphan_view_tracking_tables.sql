-- ═══════════════════════════════════════════════════════════════
-- Soft-deprecate orphan view-tracking tables.
--
-- Both `profile_views` and `athlete_views` were superseded by
-- `recruiter_athlete_views` long ago. The three views that still
-- read from `profile_views` (athlete_visibility_stats,
-- athlete_view_details, athlete_views_weekly) were repointed
-- earlier today in
-- 20260503030000_repoint_athlete_visibility_views_to_canonical_source.sql.
--
-- Rename instead of drop:
--   - Data is preserved (both tables are 0 rows but pattern stays
--     production-safe for tables that aren't empty)
--   - Any forgotten consumer surfaces immediately as
--     "table not found" instead of silently reading empty data
--   - Reversible with a single ALTER TABLE RENAME if a regression
--     surfaces during smoke testing
--
-- Pre-flight (2026-05-03):
--   - Application code: zero whole-word references to either
--     table. Substring hits are all canonical names like
--     recruiter_athlete_views / partner_profile_views.
--   - SQL snippets in supabase/snippets/ reference profile_views
--     for inert hand-run RLS scripts (admin_rls_bypass,
--     coach_analytics_rls). These are non-production; if anyone
--     ever runs them, they'll need updating to the canonical
--     table — that's intentional surfacing.
--   - DB views, functions, app code: zero live references.
--   - Triggers attached to the tables migrate with the rename
--     (trg_notify_profile_viewed stays attached but stays
--     dormant — nothing writes to the renamed table).
--
-- Drop deferred to a future migration after 3+ months of zero
-- activity (target: August 2026). See P3.1 in
-- docs/post-launch-bugs.md.
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE IF EXISTS public.profile_views
  RENAME TO _deprecated_profile_views_2026_05;

ALTER TABLE IF EXISTS public.athlete_views
  RENAME TO _deprecated_athlete_views_2026_05;

COMMENT ON TABLE public._deprecated_profile_views_2026_05 IS
  'DEPRECATED 2026-05-03. Original orphan after canonical migration to recruiter_athlete_views. Three views (athlete_visibility_stats, athlete_view_details, athlete_views_weekly) were repointed before this rename. Drop after 3+ months of confirmed zero usage (target August 2026).';

COMMENT ON TABLE public._deprecated_athlete_views_2026_05 IS
  'DEPRECATED 2026-05-03. Original orphan after canonical migration to recruiter_athlete_views. Drop after 3+ months of confirmed zero usage (target August 2026).';
