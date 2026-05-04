-- ═══════════════════════════════════════════════════════════════
-- Block signed-URL incursions in athletes.photo_url.
--
-- Background: Both storage buckets (`Ath Photos`, `avatars`) are
-- public-read; all 8 app upload sites use `getPublicUrl()` which
-- returns clean `/object/public/...` URLs that never expire. The
-- only way a signed URL has historically landed in `photo_url` is
-- via Supabase Studio's "Get URL" button, which defaults to a
-- signed URL with ~7-day expiry even on public buckets. Bouchard's
-- 2026-05-02 manual NULL fix was the symptom — see P3 entry in
-- docs/post-launch-bugs.md.
--
-- This migration:
--   1. NULLs any existing signed URLs (initials fallback renders
--      cleanly). Diagnostic on 2026-05-03 found zero rows currently
--      affected — the sweep is defensive against history we don't
--      have visibility into and against staging/prod state at
--      apply time.
--   2. Adds a CHECK constraint preventing future signed URLs from
--      landing. The Studio loophole is now closed at the DB layer
--      rather than relying on procedural memory.
--
-- Constraint is idempotent via DROP IF EXISTS so this migration
-- can re-run if a future revision needs to relax the LIKE pattern.
-- ═══════════════════════════════════════════════════════════════

UPDATE public.athletes
SET photo_url = NULL
WHERE photo_url LIKE '%/sign/%';

ALTER TABLE public.athletes
  DROP CONSTRAINT IF EXISTS photo_url_not_signed;

ALTER TABLE public.athletes
  ADD CONSTRAINT photo_url_not_signed
  CHECK (photo_url IS NULL OR photo_url NOT LIKE '%/sign/%');
