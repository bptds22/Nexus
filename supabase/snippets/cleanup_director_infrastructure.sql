-- Remove all remaining director DB infrastructure.
-- Director roles were already merged into COACH/RECRUTEUR + is_school_admin flag
-- by remove_director_roles.sql. These objects are now orphans.

BEGIN;

-- RLS policies on users and school_directors
DROP POLICY IF EXISTS "directors_read_same_school_users" ON users;
DROP POLICY IF EXISTS "directors_own_school"             ON school_directors;

-- Functions
DROP FUNCTION IF EXISTS get_my_school_director_peers();
DROP FUNCTION IF EXISTS director_takeover() CASCADE;

-- Tables (CASCADE clears any remaining FKs from director_invitations/school_directors)
DROP TABLE IF EXISTS director_invitations CASCADE;
DROP TABLE IF EXISTS school_directors     CASCADE;

-- Column on school_registry
ALTER TABLE school_registry DROP COLUMN IF EXISTS director_id;

COMMIT;
