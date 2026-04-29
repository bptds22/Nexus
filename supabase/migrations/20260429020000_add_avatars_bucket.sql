-- Create the `avatars` storage bucket used by the signup
-- onboarding wizard's PhotoUpload component
-- (app/onboarding/page.tsx). The component uploads to
-- "avatars/onboarding/${user.id}_${timestamp}.${ext}" but the
-- bucket didn't exist, so every signup photo upload threw
-- "StorageApiError: Bucket not found".
--
-- Conventions, modeled on the existing `Ath Photos` bucket:
-- - public read (avatars are visible across the platform)
-- - authenticated users can upload (no folder constraint —
--   the app's path scheme already namespaces by user_id)
-- - update/delete restricted to the owner (storage.objects.owner)

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Public read
DROP POLICY IF EXISTS "Public avatar read" ON storage.objects;
CREATE POLICY "Public avatar read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- Any authenticated user can upload
DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
CREATE POLICY "Authenticated users can upload avatars"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'avatars' AND auth.uid() IS NOT NULL);

-- Owner can update their own uploads (covers upsert path too)
DROP POLICY IF EXISTS "Users can update own avatars" ON storage.objects;
CREATE POLICY "Users can update own avatars"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'avatars' AND owner = auth.uid());

-- Owner can delete their own uploads
DROP POLICY IF EXISTS "Users can delete own avatars" ON storage.objects;
CREATE POLICY "Users can delete own avatars"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'avatars' AND owner = auth.uid());
