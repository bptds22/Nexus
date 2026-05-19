DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;

CREATE POLICY "Users upload to own folder under avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);