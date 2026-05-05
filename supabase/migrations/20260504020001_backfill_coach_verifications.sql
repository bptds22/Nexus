-- ════════════════════════════════════════════════════════════════════════════
-- Phase 2 backfill: school-coaches with approved school_coaches.role → BLUE.
--
-- Phase 0 enum classification (school_coaches.role):
--   {DIRECTEUR_INTERIM, DIRECTEUR, COACH, PENDING}
--   "approved" = anything <> 'PENDING'
--
-- Backfill expected (validated 2026-05-04 against local DB):
--   total COACH users:    6
--   BLUE inserted:        1   (school_coaches with role <> 'PENDING')
--   absent → GREY later:  5   (no school_coaches row, or only PENDING)
--
-- The 5 non-school coaches identified for post-Phase-3 manual review:
--   test-coach@gmail.com         (4bc731ff-12be-488f-b18c-79b39bc54049)
--   CoachMarketing@gmail.com     (d22968f7-1639-4f17-8044-962a9f6c09ca)
--   ddg@gmail.com                (4b1cbb85-bd0e-4742-a6f4-51276a8bdd9f)
--   Marketiddddng@gmail.com      (9be86b9a-4bd4-4901-8223-2467ae34f433)
--   test-ligue@gmail.com         (bceaa730-085e-4bb9-a4d7-7574e9630def)
--
-- They stay absent from coach_verifications until they either
-- self-request verification (Phase 3+ flow) or an admin manually
-- creates a row for them. SELECT-without-row UI must default to
-- "GREY" semantics.
--
-- verified_by = NULL signals "system backfill" — distinguishable from
-- admin-elevated rows where verified_by holds the admin's UUID.
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO public.coach_verifications (user_id, status, verified_at, verified_by)
SELECT DISTINCT
  sc.coach_id,
  'BLUE',
  now(),
  NULL::uuid  -- system backfill marker (explicit cast — bare NULL infers as text)
FROM public.school_coaches sc
WHERE sc.role <> 'PENDING'
ON CONFLICT (user_id) DO NOTHING;
