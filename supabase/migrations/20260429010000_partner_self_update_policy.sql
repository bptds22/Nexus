-- Allow approved partners to update their own profile fields
-- (organization name, contact, social handles, description, logo).
-- Status, approved_at, approved_by, show_on_homepage, homepage_order
-- are not blocked at the column level — they're admin-controlled by
-- convention. The /partenaire/profil editor only writes the
-- non-admin fields. A future migration can lock down via column
-- privileges or a stricter WITH CHECK if a partner ever attempts
-- to mutate admin fields.

DROP POLICY IF EXISTS "Partners update own profile" ON media_partners;

CREATE POLICY "Partners update own profile"
  ON media_partners FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
