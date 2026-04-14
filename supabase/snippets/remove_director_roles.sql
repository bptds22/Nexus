-- ════════════════════════════════════════════════════════════════
-- remove_director_roles.sql
-- Drops DIRECTEUR_SECONDAIRE and DIRECTEUR_CEGEP from user_role enum.
-- After this migration, only 4 roles exist: ADMIN, COACH, RECRUTEUR, ATHLETE.
-- Director status is tracked exclusively via users.is_school_admin (boolean).
-- Whether the admin is "school" vs "CÉGEP" is inferred from role:
--   role = 'COACH'     + is_school_admin = true → school admin
--   role = 'RECRUTEUR' + is_school_admin = true → CÉGEP admin
--
-- Verified via information_schema: only users.role depends on user_role.
-- No views / other tables reference this enum.
-- ════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Promote existing directors to coach/recruteur with is_school_admin flag
UPDATE users
   SET role = 'COACH', is_school_admin = true
 WHERE role = 'DIRECTEUR_SECONDAIRE';

UPDATE users
   SET role = 'RECRUTEUR', is_school_admin = true
 WHERE role = 'DIRECTEUR_CEGEP';

-- 2. Drop dependencies that reference users.role
--    (trigger uses WHEN clause; 5 RLS policies cast role::text for comparison)
DROP TRIGGER IF EXISTS trigger_backfill_athletes_coach ON users;
DROP POLICY IF EXISTS "Recruiters manage own favorites" ON recruiter_favorites;
DROP POLICY IF EXISTS "Recruiters manage own pipeline"  ON recruiter_pipeline;
DROP POLICY IF EXISTS "Recruiters manage own notes"     ON recruiter_notes;
DROP POLICY IF EXISTS "Recruiters manage own views"     ON recruiter_athlete_views;
DROP POLICY IF EXISTS "Recruiters see teams"            ON teams;

-- 3. Rewrite the user_role enum without the two director values
ALTER TYPE user_role RENAME TO user_role__old;
CREATE TYPE user_role AS ENUM ('ADMIN', 'COACH', 'RECRUTEUR', 'ATHLETE');

-- 4. Swap the users.role column to the new enum type
ALTER TABLE users
  ALTER COLUMN role TYPE user_role
  USING role::text::user_role;

-- 5. Drop the old type
DROP TYPE user_role__old;

-- 6. Recreate the backfill trigger against the new enum
CREATE TRIGGER trigger_backfill_athletes_coach
AFTER INSERT OR UPDATE ON public.users
FOR EACH ROW
WHEN ((new.role = 'COACH'::user_role) AND (new.school_id IS NOT NULL))
EXECUTE FUNCTION backfill_athletes_on_coach_join();

-- 7. Recreate RLS policies — same rules, using the new enum comparison
CREATE POLICY "Recruiters manage own favorites" ON recruiter_favorites FOR ALL
  USING ((auth.uid() = recruiter_id) AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'RECRUTEUR'))
  WITH CHECK ((auth.uid() = recruiter_id) AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'RECRUTEUR'));

CREATE POLICY "Recruiters manage own pipeline" ON recruiter_pipeline FOR ALL
  USING ((auth.uid() = recruiter_id) AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'RECRUTEUR'))
  WITH CHECK ((auth.uid() = recruiter_id) AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'RECRUTEUR'));

CREATE POLICY "Recruiters manage own notes" ON recruiter_notes FOR ALL
  USING ((auth.uid() = recruiter_id) AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'RECRUTEUR'))
  WITH CHECK ((auth.uid() = recruiter_id) AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'RECRUTEUR'));

CREATE POLICY "Recruiters manage own views" ON recruiter_athlete_views FOR ALL
  USING ((auth.uid() = recruiter_id) AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'RECRUTEUR'))
  WITH CHECK ((auth.uid() = recruiter_id) AND EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'RECRUTEUR'));

CREATE POLICY "Recruiters see teams" ON teams FOR SELECT
  USING (EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role = 'RECRUTEUR'));

COMMIT;
