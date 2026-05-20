-- Admin bypass for avatars bucket: lets platform admins upload/replace
-- athlete photos at paths keyed to the athlete record id (not the admin's uid).
-- Additive only — the existing owner-scoped policies (athlete self-upload) are
-- untouched, so normal athlete uploads continue to work unchanged.
-- Covers BOTH INSERT and UPDATE because the admin handler uses upsert:true:
-- replacing an athlete-owned photo is an UPDATE on storage.objects, which the
-- owner-scoped UPDATE policy would otherwise reject (owner = athlete ≠ admin).

DROP POLICY IF EXISTS "Admins upload to avatars" ON storage.objects;
CREATE POLICY "Admins upload to avatars"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND public.is_admin());

DROP POLICY IF EXISTS "Admins update avatars" ON storage.objects;
CREATE POLICY "Admins update avatars"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars' AND public.is_admin())
  WITH CHECK (bucket_id = 'avatars' AND public.is_admin());
