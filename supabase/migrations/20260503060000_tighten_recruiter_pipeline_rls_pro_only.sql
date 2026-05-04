-- ═══════════════════════════════════════════════════════════════
-- Tighten recruiter_pipeline INSERT + UPDATE to user_has_pro() only.
--
-- The previous WITH CHECK clauses on both policies carried a
-- carve-out allowing Free-tier recruiters to write rows at
-- IDENTIFIE / CONTACTE stages:
--
--   ((get_user_tier() = 'free' AND stage IN ('IDENTIFIE','CONTACTE'))
--    OR user_has_pro())
--
-- That carve-out was prepped for a $9.99/mo Starter tier that
-- was specced into an early CLAUDE.md draft but never made it
-- into the product. Live pricing (verified 2026-05-03) is
-- Free / Pro $19.99 / All Star $29.99 — Starter does not exist.
-- See P2 entry in docs/post-launch-bugs.md for the model
-- mismatch history.
--
-- Resolution path (a): align DB with live product. Pipeline is
-- Pro+. The frontend already gates pipeline UI on
-- canUsePipeline = (tier === 'pro' || tier === 'all_star') —
-- v0.14.0-recruiter-tier-clarity. After this migration the DB
-- and code agree.
--
-- Scope is contained to recruiter_pipeline. The other two
-- policies that reference get_user_tier() —
-- recruiter_favorites_insert (10-favorite cap) and
-- athletes_insert (30-athlete cap) — are live Free-tier
-- business rules matching the pricing page; they stay.
-- ═══════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS recruiter_pipeline_insert ON public.recruiter_pipeline;
DROP POLICY IF EXISTS recruiter_pipeline_update ON public.recruiter_pipeline;

-- INSERT: same role + ownership checks as before; tier check now
-- requires Pro+ unconditionally (carve-out removed).
CREATE POLICY recruiter_pipeline_insert ON public.recruiter_pipeline
FOR INSERT
WITH CHECK (
  recruiter_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND users.role = 'RECRUTEUR'::user_role
  )
  AND user_has_pro()
);

-- UPDATE: USING clause unchanged from the original (row visibility
-- gated on ownership + RECRUTEUR role). WITH CHECK tightened to
-- require Pro+ unconditionally; the recruiter_id self-check stays
-- so a recruiter can never UPDATE another recruiter's row even
-- with Pro.
CREATE POLICY recruiter_pipeline_update ON public.recruiter_pipeline
FOR UPDATE
USING (
  recruiter_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.users
    WHERE users.id = auth.uid()
      AND users.role = 'RECRUTEUR'::user_role
  )
)
WITH CHECK (
  recruiter_id = auth.uid()
  AND user_has_pro()
);
