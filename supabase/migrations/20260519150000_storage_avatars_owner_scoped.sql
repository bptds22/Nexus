-- Tighten avatars bucket INSERT policy: users may only write to
-- their own folder (path must start with their auth.uid()). Closes
-- a hole where any authenticated user could write to any path
-- under avatars regardless of ownership.
--
-- Idempotent: drops the legacy permissive policy if present, and
-- also drops any prior version of the new policy so re-runs / fresh
-- DBs / DBs where someone hand-applied the policy via Studio all
-- converge on the same end-state.

DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users upload to own folder under avatars" ON storage.objects;

CREATE POLICY "Users upload to own folder under avatars"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
