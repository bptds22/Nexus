-- Admin carve-out for media_partners: platform admins can SELECT all
-- partner rows (so /admin/partenaires lists them) and UPDATE them (so
-- changeStatus / toggleHomepage work). Additive — existing owner-scoped
-- and public-homepage policies are untouched. No DELETE: partner removal
-- uses status=REVOKED, preserving the audit trail (Loi 25).

DROP POLICY IF EXISTS "Admins read all partners" ON public.media_partners;
CREATE POLICY "Admins read all partners"
  ON public.media_partners
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins update all partners" ON public.media_partners;
CREATE POLICY "Admins update all partners"
  ON public.media_partners
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
