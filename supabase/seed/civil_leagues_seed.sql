-- ═══════════════════════════════════════════════════════════════
-- Phase 6.1.d — Civil leagues deterministic seed
--
-- Re-runnable seed pour les ligues civiles post-Phase 6 unification.
-- Tous les UUIDs sont déterministes (md5-based) pour stabilité
-- entre runs. Idempotent : DELETE/UPDATE en ordre inverse FKs avant
-- INSERT, puis ON CONFLICT pour les re-runs.
--
-- Adaptations vs spec original :
--   - sports n'a pas de `is_active` ni `slug` → 16 sports tous
--     traités comme actifs ; slug dérivé de lower(regexp_replace(
--     nom, '[^a-zA-Z0-9]+', '_', 'g')).
--   - schools.city/region sont nullable → laissés NULL.
--   - public.users n'a PAS de FK vers auth.users → INSERT direct OK
--     (les seed users n'auront pas de login fonctionnel jusqu'à
--     création manuelle dans Supabase Studio si besoin de signin).
--   - athletes n'a que first_name+last_name comme NOT NULL critiques
--     (autres NOT NULL ont des defaults).
--
-- Run locally:
--   docker exec -i supabase_db_Nexus psql -U postgres -d postgres \
--     < supabase/seed/civil_leagues_seed.sql
--
-- ⚠️ DEV ONLY — DO NOT RUN IN PRODUCTION ⚠️
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ────────────────────────────────────────────────────────────────
-- 1. Cleanup en ordre inverse FKs (idempotent re-run)
-- ────────────────────────────────────────────────────────────────

-- 1.a — team_invitations sur teams civiles
DELETE FROM team_invitations
WHERE team_id IN (
  SELECT t.id FROM teams t
  JOIN schools s ON s.id = t.school_id
  WHERE s.type = 'LIGUE_CIVILE'
);

-- 1.b — team_athletes sur teams civiles
DELETE FROM team_athletes
WHERE team_id IN (
  SELECT t.id FROM teams t
  JOIN schools s ON s.id = t.school_id
  WHERE s.type = 'LIGUE_CIVILE'
);

-- 1.c — team_coaches sur teams civiles
DELETE FROM team_coaches
WHERE team_id IN (
  SELECT t.id FROM teams t
  JOIN schools s ON s.id = t.school_id
  WHERE s.type = 'LIGUE_CIVILE'
);

-- 1.d — school_coaches sur schools civiles
DELETE FROM school_coaches
WHERE school_id IN (
  SELECT id FROM schools WHERE type = 'LIGUE_CIVILE'
);

-- 1.e — Reset les athletes seed (id déterministes)
UPDATE athletes
SET school_id = NULL, coach_id = NULL
WHERE id IN (
  '00000000-0000-4000-a000-000000000001'::uuid,
  '00000000-0000-4000-a000-000000000002'::uuid
);

-- 1.f — teams civiles
DELETE FROM teams
WHERE school_id IN (
  SELECT id FROM schools WHERE type = 'LIGUE_CIVILE'
);

-- 1.g — schools LIGUE_CIVILE
DELETE FROM schools WHERE type = 'LIGUE_CIVILE';

-- ────────────────────────────────────────────────────────────────
-- 2. Seed schools LIGUE_CIVILE — 1 par sport (16 au total)
-- ────────────────────────────────────────────────────────────────

INSERT INTO schools (id, name, type, city, region, created_at)
SELECT
  md5('civil_league_' || lower(regexp_replace(s.nom, '[^a-zA-Z0-9]+', '_', 'g')))::uuid,
  'Ligue Civile ' || s.nom,
  'LIGUE_CIVILE',
  NULL,
  'Québec',
  now()
FROM sports s
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name, type = EXCLUDED.type;

-- ────────────────────────────────────────────────────────────────
-- 3. Seed teams — 2 par ligue (U17 AAA M + U15 AA F) pour variété
-- ────────────────────────────────────────────────────────────────

-- 3.a — Teams U17 AAA Masculin
INSERT INTO teams (id, school_id, sport_id, name, age_group, division, season, gender, is_active, created_at)
SELECT
  md5('civil_team_' || lower(regexp_replace(s.nom, '[^a-zA-Z0-9]+', '_', 'g')) || '_u17')::uuid,
  md5('civil_league_' || lower(regexp_replace(s.nom, '[^a-zA-Z0-9]+', '_', 'g')))::uuid,
  s.id,
  'Test Team ' || s.nom || ' U17',
  'U17',
  'AAA',
  '2025-2026',
  'M',
  true,
  now()
FROM sports s
ON CONFLICT ON CONSTRAINT teams_identity_unique DO NOTHING;

-- 3.b — Teams U15 AA Féminin
INSERT INTO teams (id, school_id, sport_id, name, age_group, division, season, gender, is_active, created_at)
SELECT
  md5('civil_team_' || lower(regexp_replace(s.nom, '[^a-zA-Z0-9]+', '_', 'g')) || '_u15')::uuid,
  md5('civil_league_' || lower(regexp_replace(s.nom, '[^a-zA-Z0-9]+', '_', 'g')))::uuid,
  s.id,
  'Test Team ' || s.nom || ' U15',
  'U15',
  'AA',
  '2025-2026',
  'F',
  true,
  now()
FROM sports s
ON CONFLICT ON CONSTRAINT teams_identity_unique DO NOTHING;

-- ────────────────────────────────────────────────────────────────
-- 4. Seed auth.users + public.users (4 comptes test civils)
-- public.users.id → auth.users.id CASCADE — donc INSERT auth.users
-- d'abord. Le trigger on_auth_user_created auto-INSERT une row
-- dans public.users, qu'on UPSERT ensuite pour set role/context.
-- ────────────────────────────────────────────────────────────────

-- 4.a — auth.users (minimal fields ; pas de mot de passe → pas de
-- login fonctionnel, suffisant pour les tests SQL)
INSERT INTO auth.users (id, email, is_sso_user, is_anonymous, created_at, updated_at)
VALUES
  ('00000000-0000-4000-b000-000000000001'::uuid, 'civil.coach.1@nexus-test.local', false, false, now(), now()),
  ('00000000-0000-4000-b000-000000000002'::uuid, 'civil.coach.2@nexus-test.local', false, false, now(), now()),
  ('00000000-0000-4000-a000-000000000001'::uuid, 'civil.athlete.1@nexus-test.local', false, false, now(), now()),
  ('00000000-0000-4000-a000-000000000002'::uuid, 'civil.athlete.2@nexus-test.local', false, false, now(), now())
ON CONFLICT (id) DO NOTHING;

-- 4.b — public.users (UPSERT car le trigger on_auth_user_created
-- a peut-être déjà créé la row avec des defaults)
INSERT INTO public.users (id, email, role, status, is_platform_admin, context)
VALUES
  ('00000000-0000-4000-b000-000000000001'::uuid, 'civil.coach.1@nexus-test.local', 'COACH', 'ACTIF', false, 'ligue_civile'),
  ('00000000-0000-4000-b000-000000000002'::uuid, 'civil.coach.2@nexus-test.local', 'COACH', 'ACTIF', false, 'ligue_civile'),
  ('00000000-0000-4000-a000-000000000001'::uuid, 'civil.athlete.1@nexus-test.local', 'ATHLETE', 'ACTIF', false, 'ligue_civile'),
  ('00000000-0000-4000-a000-000000000002'::uuid, 'civil.athlete.2@nexus-test.local', 'ATHLETE', 'ACTIF', false, 'ligue_civile')
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  context = EXCLUDED.context;

-- ────────────────────────────────────────────────────────────────
-- 5. Seed athletes test (2 athletes civils, school_id NULL initial)
-- school_id sera set par le trigger après l'acceptance de
-- l'invitation (cf. section 8).
-- ────────────────────────────────────────────────────────────────

INSERT INTO athletes (id, user_id, first_name, last_name, school_id, coach_id)
VALUES
  ('00000000-0000-4000-a000-000000000001'::uuid,
   '00000000-0000-4000-a000-000000000001'::uuid,
   'Alex', 'Test',
   NULL, NULL),
  ('00000000-0000-4000-a000-000000000002'::uuid,
   '00000000-0000-4000-a000-000000000002'::uuid,
   'Sophie', 'Test',
   NULL, NULL)
ON CONFLICT (id) DO UPDATE
SET
  first_name = EXCLUDED.first_name,
  last_name = EXCLUDED.last_name,
  school_id = NULL,
  coach_id = NULL;

-- ────────────────────────────────────────────────────────────────
-- 6. Seed school_coaches (institution-level pour Ligue Civile Hockey)
-- Coach 1 = DIRECTEUR ; Coach 2 = COACH
-- Hockey slug = 'hockey' (depuis nom='Hockey')
-- ────────────────────────────────────────────────────────────────

INSERT INTO school_coaches (id, school_id, coach_id, role, approved_at, approved_by, created_at)
VALUES
  (md5('civil_sc_1')::uuid,
   md5('civil_league_hockey')::uuid,
   '00000000-0000-4000-b000-000000000001'::uuid,
   'DIRECTEUR'::coach_school_role,
   now(), NULL, now()),
  (md5('civil_sc_2')::uuid,
   md5('civil_league_hockey')::uuid,
   '00000000-0000-4000-b000-000000000002'::uuid,
   'COACH'::coach_school_role,
   now(), NULL, now())
ON CONFLICT (school_id, coach_id) DO UPDATE
SET role = EXCLUDED.role, approved_at = EXCLUDED.approved_at;

-- ────────────────────────────────────────────────────────────────
-- 7. Seed team_coaches (team-level pour Test Team Hockey U17)
-- Coach 1 = head_coach ; Coach 2 = assistant
-- ────────────────────────────────────────────────────────────────

INSERT INTO team_coaches (id, team_id, coach_id, role, created_at)
VALUES
  (md5('civil_tc_1')::uuid,
   md5('civil_team_hockey_u17')::uuid,
   '00000000-0000-4000-b000-000000000001'::uuid,
   'head_coach',
   now()),
  (md5('civil_tc_2')::uuid,
   md5('civil_team_hockey_u17')::uuid,
   '00000000-0000-4000-b000-000000000002'::uuid,
   'assistant',
   now())
ON CONFLICT (team_id, coach_id) DO UPDATE
SET role = EXCLUDED.role;

-- ────────────────────────────────────────────────────────────────
-- 8. Seed team_invitations
-- 8.a — Alex : INSERT PENDING puis UPDATE → ACCEPTED (déclenche
--       le trigger apply_team_invitation_acceptance qui INSERT
--       team_athletes + set athletes.school_id).
-- 8.b — Sophie : reste PENDING (smoke test du Flow A pending).
-- ────────────────────────────────────────────────────────────────

-- 8.a — Alex invitation : PENDING d'abord
INSERT INTO team_invitations (id, team_id, athlete_id, invited_by_coach_id, status, expires_at, created_at)
VALUES
  (md5('civil_inv_alex')::uuid,
   md5('civil_team_hockey_u17')::uuid,
   '00000000-0000-4000-a000-000000000001'::uuid,
   '00000000-0000-4000-b000-000000000001'::uuid,
   'PENDING',
   now() + interval '30 days',
   now())
ON CONFLICT (id) DO UPDATE
SET status = 'PENDING', responded_at = NULL;

-- 8.a (suite) — UPDATE → ACCEPTED déclenche le trigger
UPDATE team_invitations
SET status = 'ACCEPTED', responded_at = now()
WHERE id = md5('civil_inv_alex')::uuid;

-- 8.b — Sophie invitation : reste PENDING
INSERT INTO team_invitations (id, team_id, athlete_id, invited_by_coach_id, status, expires_at, created_at)
VALUES
  (md5('civil_inv_sophie')::uuid,
   md5('civil_team_hockey_u17')::uuid,
   '00000000-0000-4000-a000-000000000002'::uuid,
   '00000000-0000-4000-b000-000000000001'::uuid,
   'PENDING',
   now() + interval '30 days',
   now())
ON CONFLICT (id) DO UPDATE
SET status = 'PENDING', responded_at = NULL;

-- ────────────────────────────────────────────────────────────────
-- 9. Sanity check post-seed
-- ────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_schools_count int;
  v_teams_count int;
  v_alex_school_id uuid;
  v_alex_in_team_athletes int;
BEGIN
  SELECT COUNT(*) INTO v_schools_count FROM schools WHERE type = 'LIGUE_CIVILE';
  IF v_schools_count <> 16 THEN
    RAISE EXCEPTION 'Expected 16 LIGUE_CIVILE schools, got %', v_schools_count;
  END IF;

  SELECT COUNT(*) INTO v_teams_count
  FROM teams t JOIN schools s ON s.id = t.school_id
  WHERE s.type = 'LIGUE_CIVILE';
  IF v_teams_count <> 32 THEN
    RAISE EXCEPTION 'Expected 32 civil teams (16 sports x 2 age groups), got %', v_teams_count;
  END IF;

  -- Alex school_id doit être set par le trigger
  SELECT school_id INTO v_alex_school_id
  FROM athletes WHERE id = '00000000-0000-4000-a000-000000000001'::uuid;
  IF v_alex_school_id IS NULL THEN
    RAISE EXCEPTION 'Alex school_id NULL — trigger apply_team_invitation_acceptance did not fire';
  END IF;

  -- Alex doit être dans team_athletes via le trigger
  SELECT COUNT(*) INTO v_alex_in_team_athletes
  FROM team_athletes WHERE athlete_id = '00000000-0000-4000-a000-000000000001'::uuid;
  IF v_alex_in_team_athletes <> 1 THEN
    RAISE EXCEPTION 'Alex team_athletes count = % (expected 1)', v_alex_in_team_athletes;
  END IF;

  RAISE NOTICE 'Seed validated: 16 schools, 32 teams, Alex anchored to %', v_alex_school_id;
END $$;

COMMIT;
