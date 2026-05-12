-- ═══════════════════════════════════════════════════════════════
-- Phase 6.1.f — Smoke test SQL post-unification
--
-- Validation que le modèle unifié civil/école fonctionne après
-- Bloc 1 (6.1.a/b/c) + Bloc 2 (6.1.d/e). Les tables legacy ne sont
-- PAS encore droppées — ça viendra en Phase 6.3.
--
-- Runnable :
--   docker exec -i supabase_db_Nexus psql -U postgres -d postgres \
--     < supabase/tests/phase_6_smoke_test.sql
--
-- Tous les checks sont SELECT-only ou DO $$ blocks avec cleanup.
-- TEST 8 (Flow A simulé) INSERT + UPDATE + DELETE en cycle complet
-- avec cleanup à la fin → idempotent.
-- ═══════════════════════════════════════════════════════════════

\echo '====================================================='
\echo 'Phase 6.1 Smoke Test'
\echo '====================================================='

-- ────────────────────────────────────────────────────────────────
-- TEST 1 : Schools LIGUE_CIVILE existent
-- ────────────────────────────────────────────────────────────────
\echo ''
\echo 'TEST 1: LIGUE_CIVILE schools exist'

DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM schools WHERE type = 'LIGUE_CIVILE';
  IF v_count < 1 THEN
    RAISE EXCEPTION 'FAIL: no LIGUE_CIVILE schools';
  END IF;
  RAISE NOTICE 'PASS: % LIGUE_CIVILE schools found', v_count;
END $$;

-- ────────────────────────────────────────────────────────────────
-- TEST 2 : Alex test seed fully anchored (school_id + team_athletes)
-- ────────────────────────────────────────────────────────────────
\echo ''
\echo 'TEST 2: Alex test athlete fully anchored'

DO $$
DECLARE
  v_school_id uuid;
  v_team_athletes_count int;
BEGIN
  SELECT school_id INTO v_school_id
  FROM athletes
  WHERE id = '00000000-0000-4000-a000-000000000001'::uuid;

  IF v_school_id IS NULL THEN
    RAISE EXCEPTION 'FAIL: Alex school_id is NULL';
  END IF;

  SELECT COUNT(*) INTO v_team_athletes_count
  FROM team_athletes
  WHERE athlete_id = '00000000-0000-4000-a000-000000000001'::uuid;

  IF v_team_athletes_count = 0 THEN
    RAISE EXCEPTION 'FAIL: Alex not in team_athletes';
  END IF;

  RAISE NOTICE 'PASS: Alex school_id=%, team_athletes_count=%', v_school_id, v_team_athletes_count;
END $$;

-- ────────────────────────────────────────────────────────────────
-- TEST 3 : Sophie reste PENDING (pas anchored)
-- ────────────────────────────────────────────────────────────────
\echo ''
\echo 'TEST 3: Sophie still PENDING (not anchored)'

DO $$
DECLARE
  v_school_id uuid;
  v_status text;
BEGIN
  SELECT school_id INTO v_school_id
  FROM athletes
  WHERE id = '00000000-0000-4000-a000-000000000002'::uuid;

  SELECT status INTO v_status
  FROM team_invitations
  WHERE id = md5('civil_inv_sophie')::uuid;

  IF v_school_id IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: Sophie school_id should be NULL (got %)', v_school_id;
  END IF;

  IF v_status <> 'PENDING' THEN
    RAISE EXCEPTION 'FAIL: Sophie invitation should be PENDING (got %)', v_status;
  END IF;

  RAISE NOTICE 'PASS: Sophie correctly NULL school_id + PENDING invitation';
END $$;

-- ────────────────────────────────────────────────────────────────
-- TEST 4 : Legacy tables vides
-- ────────────────────────────────────────────────────────────────
\echo ''
\echo 'TEST 4: Legacy tables empty'

DO $$
DECLARE
  v_total int;
BEGIN
  SELECT (SELECT COUNT(*) FROM leagues)
       + (SELECT COUNT(*) FROM league_coaches)
       + (SELECT COUNT(*) FROM league_teams)
       + (SELECT COUNT(*) FROM league_team_athletes)
  INTO v_total;

  IF v_total > 0 THEN
    RAISE EXCEPTION 'FAIL: legacy tables not empty (total: %)', v_total;
  END IF;

  RAISE NOTICE 'PASS: all 4 legacy tables empty';
END $$;

-- ────────────────────────────────────────────────────────────────
-- TEST 5 : Coaches civils dans school_coaches + team_coaches
-- ────────────────────────────────────────────────────────────────
\echo ''
\echo 'TEST 5: Civil coaches in unified tables'

DO $$
DECLARE
  v_school_coaches_civil int;
  v_team_coaches_civil int;
BEGIN
  SELECT COUNT(*) INTO v_school_coaches_civil
  FROM school_coaches sc
  JOIN users u ON u.id = sc.coach_id
  WHERE u.context = 'ligue_civile';

  SELECT COUNT(*) INTO v_team_coaches_civil
  FROM team_coaches tc
  JOIN users u ON u.id = tc.coach_id
  WHERE u.context = 'ligue_civile';

  IF v_school_coaches_civil < 1 THEN
    RAISE EXCEPTION 'FAIL: no civil coaches in school_coaches';
  END IF;

  IF v_team_coaches_civil < 1 THEN
    RAISE EXCEPTION 'FAIL: no civil coaches in team_coaches';
  END IF;

  RAISE NOTICE 'PASS: % school_coaches + % team_coaches civils',
    v_school_coaches_civil, v_team_coaches_civil;
END $$;

-- ────────────────────────────────────────────────────────────────
-- TEST 6 : Triggers attachés aux nouvelles tables
-- ────────────────────────────────────────────────────────────────
\echo ''
\echo 'TEST 6: Triggers on new tables'

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_table = 'team_invitations'
      AND trigger_name = 'apply_team_invitation_acceptance_trigger'
  ) THEN
    RAISE EXCEPTION 'FAIL: apply_team_invitation_acceptance_trigger not on team_invitations';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE event_object_table = 'team_athletes'
      AND trigger_name = 'reset_athlete_anchor_on_team_remove'
  ) THEN
    RAISE EXCEPTION 'FAIL: reset_athlete_anchor_on_team_remove not on team_athletes';
  END IF;

  RAISE NOTICE 'PASS: triggers attached to new tables';
END $$;

-- ────────────────────────────────────────────────────────────────
-- TEST 7 : RLS externes ne référencent plus league_coaches
-- ────────────────────────────────────────────────────────────────
\echo ''
\echo 'TEST 7: External RLS policies do not reference league_coaches'

DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE tablename NOT IN ('league_coaches', 'leagues', 'league_teams', 'league_team_athletes')
    AND (qual::text ILIKE '%league_coaches%' OR with_check::text ILIKE '%league_coaches%');

  IF v_count > 0 THEN
    RAISE EXCEPTION 'FAIL: % external policies still reference league_coaches', v_count;
  END IF;

  RAISE NOTICE 'PASS: 0 external policies reference league_coaches';
END $$;

-- ────────────────────────────────────────────────────────────────
-- TEST 8 : Flow A end-to-end simulation (idempotent)
-- ────────────────────────────────────────────────────────────────
-- Simule un nouveau cycle invitation pour Sophie (qui est PENDING) :
-- INSERT PENDING → UPDATE ACCEPTED → vérifier trigger → cleanup.
\echo ''
\echo 'TEST 8: Flow A end-to-end (simulated invitation cycle)'

DO $$
DECLARE
  v_test_inv_id uuid := md5('smoke_test_inv_' || now()::text)::uuid;
  v_test_team_id uuid;
  v_test_school_id uuid;
  v_athlete_id uuid := '00000000-0000-4000-a000-000000000002'::uuid;
  v_athlete_school_before uuid;
  v_athlete_school_after uuid;
BEGIN
  -- État initial Sophie
  SELECT school_id INTO v_athlete_school_before
  FROM athletes WHERE id = v_athlete_id;

  IF v_athlete_school_before IS NOT NULL THEN
    RAISE NOTICE 'SKIP: Sophie already anchored (school_id=%), test idempotent skip', v_athlete_school_before;
    RETURN;
  END IF;

  -- Pick une team civile pour le test
  SELECT t.id, t.school_id INTO v_test_team_id, v_test_school_id
  FROM teams t
  JOIN schools s ON s.id = t.school_id
  WHERE s.type = 'LIGUE_CIVILE'
  LIMIT 1;

  -- INSERT invitation PENDING
  INSERT INTO team_invitations (id, team_id, athlete_id, invited_by_coach_id, status, expires_at, created_at)
  VALUES (v_test_inv_id, v_test_team_id, v_athlete_id,
          '00000000-0000-4000-b000-000000000001'::uuid, 'PENDING',
          now() + interval '1 day', now());

  -- UPDATE → ACCEPTED (fires apply_team_invitation_acceptance_trigger)
  UPDATE team_invitations SET status = 'ACCEPTED', responded_at = now()
  WHERE id = v_test_inv_id;

  -- Verify trigger did its job
  SELECT school_id INTO v_athlete_school_after
  FROM athletes WHERE id = v_athlete_id;

  IF v_athlete_school_after IS NULL THEN
    RAISE EXCEPTION 'FAIL: trigger did not set athlete school_id';
  END IF;

  IF v_athlete_school_after <> v_test_school_id THEN
    RAISE EXCEPTION 'FAIL: trigger set wrong school_id (% vs expected %)',
      v_athlete_school_after, v_test_school_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM team_athletes
    WHERE team_id = v_test_team_id AND athlete_id = v_athlete_id
  ) THEN
    RAISE EXCEPTION 'FAIL: trigger did not INSERT team_athletes';
  END IF;

  RAISE NOTICE 'PASS: Flow A end-to-end works (Sophie anchored to %, team_athletes row created)', v_athlete_school_after;

  -- Cleanup pour idempotence du test
  DELETE FROM team_athletes WHERE team_id = v_test_team_id AND athlete_id = v_athlete_id;
  DELETE FROM team_invitations WHERE id = v_test_inv_id;
  UPDATE athletes SET school_id = NULL WHERE id = v_athlete_id;
END $$;

\echo ''
\echo '====================================================='
\echo 'Smoke test complete — all 8 tests PASS expected'
\echo '====================================================='
