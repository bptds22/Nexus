-- Partner public promo page foundation:
-- (1) new columns for the page (3 socials + a separate free-text box)
-- (2) pin status/show_on_homepage so partners self-editing their page can't
--     self-approve or self-promote to the homepage (same hole class as the
--     users Piece 1 pin) — via a SECURITY DEFINER helper to avoid recursion
-- (3) widen public read so every APPROVED partner has a reachable page
--
-- media_partners.status is plain text (not an enum), so the helper param is
-- text. Original policies captured 2026-05-20: "Partners update own profile"
-- (UPDATE, roles {public}) and "Public read approved homepage partners"
-- (SELECT, roles {public}) — both re-created TO public.

-- 1. New columns. instagram_handle/tiktok_handle store handles; facebook_url
--    stores a URL. The 3 new socials follow facebook — full *_url. about_text
--    is the free-text box, separate from the short `description`.
ALTER TABLE public.media_partners
  ADD COLUMN IF NOT EXISTS x_url text,
  ADD COLUMN IF NOT EXISTS youtube_url text,
  ADD COLUMN IF NOT EXISTS linkedin_url text,
  ADD COLUMN IF NOT EXISTS about_text text;

-- 2. Recursion-safe helper: are the privileged columns unchanged vs stored?
--    A plain subquery on media_partners inside a media_partners policy would
--    recurse ("infinite recursion detected") — SECURITY DEFINER + row_security
--    = off so the internal read does NOT re-enter the policies.
CREATE OR REPLACE FUNCTION public.partner_privileged_cols_unchanged(
  p_status text,
  p_show_on_homepage boolean
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET row_security = off
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.media_partners
    WHERE user_id = auth.uid()
      AND status IS NOT DISTINCT FROM p_status
      AND show_on_homepage IS NOT DISTINCT FROM p_show_on_homepage
  );
$$;

-- 3. Re-create the partner self-update policy with the pin. user_id is NOT
--    pinned — a partner legitimately owns their row.
DROP POLICY IF EXISTS "Partners update own profile" ON public.media_partners;
CREATE POLICY "Partners update own profile"
  ON public.media_partners
  FOR UPDATE
  TO public
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND public.partner_privileged_cols_unchanged(status, show_on_homepage)
  );

-- 4. Widen public read: every APPROVED partner (not just homepage) gets a
--    reachable page. The homepage carousel filters show_on_homepage in app
--    code. TO public so anon (logged-out) visitors can load a promo page.
DROP POLICY IF EXISTS "Public read approved homepage partners" ON public.media_partners;
CREATE POLICY "Public read approved partners"
  ON public.media_partners
  FOR SELECT
  TO public
  USING (status = 'APPROVED');
