-- ════════════════════════════════════════════════════════════════════════════
-- Coach verification tier — derived from school_coaches, not a state table.
--
-- Architectural decision 2026-05-04 (replaces the reverted Phase 2
-- coach_verifications table from commits a289286 + 5438dbe):
--
--   A coach is BLUE iff they have a school_coaches row with
--   role <> 'PENDING'. Any other state (no row, or PENDING-only) is GREY.
--
-- Why derived instead of stored:
--   - Zero desync risk — the tier IS school_coaches's truth, not a
--     mirror of it
--   - No backfill, no elevation/degradation triggers, no admin queue
--   - Coach joining a school auto-promotes to BLUE on next read
--   - Coach removed from school auto-demotes to GREY on next read
--   - Civil-league coaches stay GREY by absence — no special-case row
--
-- The school_coaches.role enum is {DIRECTEUR_INTERIM, DIRECTEUR, COACH,
-- PENDING}. "Approved" is anything <> 'PENDING'.
--
-- STABLE because the value can change between transactions (admin
-- approves a school_coaches row, etc.) but does not change within a
-- single SQL statement. SECURITY DEFINER so callers don't need
-- SELECT on school_coaches — keeps the helper safe to use from
-- recruteur and athlete-facing pages where school_coaches read RLS
-- might restrict access.
--
-- Civil-league acquisition strategy (option B, decided 2026-05-04):
--   No review queue. All coaches enter, civil ones default GREY by
--   derivation. Recruteur filters by tier; admin intervenes by
--   exception via signaling, not by default.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.coach_verification_tier(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.school_coaches
      WHERE coach_id = p_user_id AND role <> 'PENDING'
    ) THEN 'BLUE'
    ELSE 'GREY'
  END;
$$;

COMMENT ON FUNCTION public.coach_verification_tier(uuid) IS
  'Derives a coach''s verification tier from school_coaches. '
  'Returns ''BLUE'' if the coach has any school_coaches row with role <> ''PENDING'', '
  'otherwise ''GREY''. Civil-league coaches and pending-only coaches return GREY. '
  'No state table — see the 2026-05-04 revert of coach_verifications for the design rationale.';

GRANT EXECUTE ON FUNCTION public.coach_verification_tier(uuid) TO authenticated;
