-- ═══════════════════════════════════════════════════════════════════════════
-- proof-directeur-roster.sql — sondes du correctif « le DIRECTEUR voit 0
-- athlète dans Mes athlètes » (app/coach/athletes/page.tsx).
--
-- Rejoue la logique EXACTE de la page, sous le JWT de chaque profil :
--   pool            = .from("athletes").eq(school_id, users.school_id).eq(status,'ACTIF')
--   mes_athletes    = pool où coach_id = moi                      (« Mes athlètes »)
--   a_reclamer      = pool où coach_id IS NULL                    (onglet « À réclamer »)
--   section_ecole   = pool où coach_id NOT NULL et ≠ moi
--                     ET id ∈ get_coach_athletes(false)           (section directeur)
--   is_director     = school_coaches.role ∈ DIRECTEUR/DIRECTEUR_INTERIM
--
-- ATTENDU (prod, fixtures Nexus) :
--   1. directeur Nexus Secondaire : mes=0 · à_réclamer=0 · école=1 (Athlete Nexus) · dir=true
--   2. coach     Nexus Secondaire : mes=1 (Athlete Nexus) · école=0 · dir=false   ← témoin inchangé
--   3. directeur Nexus CIVIL      : école=1 (Gabriel Mandziuk) · Athlete Nexus ABSENT
--                                   du pool ET du scope                          ← périmètre école
--
-- Lecture seule (BEGIN/ROLLBACK, aucun écrit).
-- ═══════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

-- ── SONDE 1 — directeur Nexus Secondaire : voit Athlete Nexus ──────────────
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"e28059d3-58da-4c28-a16e-6fc538080c85","role":"authenticated"}', true);
WITH me AS (SELECT auth.uid() AS uid),
pool AS (
  SELECT a.id, a.first_name, a.last_name, a.coach_id
  FROM public.athletes a, me
  WHERE a.school_id = (SELECT u.school_id FROM public.users u, me WHERE u.id = me.uid)
    AND a.status = 'ACTIF'),
scope AS (SELECT athlete_id FROM public.get_coach_athletes(false))
SELECT
  'SONDE 1 — directeur Nexus Secondaire' AS sonde,
  (SELECT count(*) FROM pool, me WHERE pool.coach_id = me.uid)                      AS mes_athletes,
  (SELECT count(*) FROM pool WHERE pool.coach_id IS NULL)                           AS a_reclamer,
  (SELECT count(*) FROM pool, me WHERE pool.coach_id IS NOT NULL
     AND pool.coach_id <> me.uid AND pool.id IN (SELECT athlete_id FROM scope))     AS section_ecole,
  (SELECT string_agg(pool.first_name||' '||pool.last_name, ', ') FROM pool, me
     WHERE pool.coach_id IS NOT NULL AND pool.coach_id <> me.uid
       AND pool.id IN (SELECT athlete_id FROM scope))                               AS noms_section_ecole,
  EXISTS (SELECT 1 FROM public.school_coaches sc, me
          WHERE sc.coach_id = me.uid
            AND sc.role::text IN ('DIRECTEUR','DIRECTEUR_INTERIM'))                 AS is_director;
ROLLBACK;

-- ── SONDE 2 — coach Nexus Secondaire : roster STRICTEMENT inchangé ─────────
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"a0000000-0000-4000-8000-0000000000a2","role":"authenticated"}', true);
WITH me AS (SELECT auth.uid() AS uid),
pool AS (
  SELECT a.id, a.first_name, a.last_name, a.coach_id
  FROM public.athletes a, me
  WHERE a.school_id = (SELECT u.school_id FROM public.users u, me WHERE u.id = me.uid)
    AND a.status = 'ACTIF'),
scope AS (SELECT athlete_id FROM public.get_coach_athletes(false))
SELECT
  'SONDE 2 — coach Nexus Secondaire (temoin)' AS sonde,
  (SELECT count(*) FROM pool, me WHERE pool.coach_id = me.uid)                      AS mes_athletes,
  (SELECT string_agg(pool.first_name||' '||pool.last_name, ', ') FROM pool, me
     WHERE pool.coach_id = me.uid)                                                  AS noms_roster,
  (SELECT count(*) FROM pool WHERE pool.coach_id IS NULL)                           AS a_reclamer,
  (SELECT count(*) FROM pool, me WHERE pool.coach_id IS NOT NULL
     AND pool.coach_id <> me.uid AND pool.id IN (SELECT athlete_id FROM scope))     AS section_ecole_calculee,
  EXISTS (SELECT 1 FROM public.school_coaches sc, me
          WHERE sc.coach_id = me.uid
            AND sc.role::text IN ('DIRECTEUR','DIRECTEUR_INTERIM'))                 AS is_director;
ROLLBACK;

-- ── SONDE 3 — directeur d'une AUTRE ecole : le perimetre ecole tient ───────
BEGIN;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims',
  '{"sub":"651dc157-9be1-4831-bbc8-e58117ae6807","role":"authenticated"}', true);
WITH me AS (SELECT auth.uid() AS uid),
pool AS (
  SELECT a.id, a.first_name, a.last_name, a.coach_id
  FROM public.athletes a, me
  WHERE a.school_id = (SELECT u.school_id FROM public.users u, me WHERE u.id = me.uid)
    AND a.status = 'ACTIF'),
scope AS (SELECT athlete_id FROM public.get_coach_athletes(false))
SELECT
  'SONDE 3 — directeur Nexus CIVIL (perimetre)' AS sonde,
  (SELECT count(*) FROM pool, me WHERE pool.coach_id = me.uid)                      AS mes_athletes,
  (SELECT count(*) FROM pool, me WHERE pool.coach_id IS NOT NULL
     AND pool.coach_id <> me.uid AND pool.id IN (SELECT athlete_id FROM scope))     AS section_ecole,
  (SELECT string_agg(pool.first_name||' '||pool.last_name, ', ') FROM pool, me
     WHERE pool.coach_id IS NOT NULL AND pool.coach_id <> me.uid
       AND pool.id IN (SELECT athlete_id FROM scope))                               AS noms_section_ecole,
  -- Athlete Nexus (Nexus Secondaire) doit etre ABSENT du pool ET du scope
  (SELECT count(*) FROM pool  WHERE pool.id         = 'd4cd6432-1c45-47bc-8498-071075e4ae7c') AS athlete_nexus_dans_pool,
  (SELECT count(*) FROM scope WHERE scope.athlete_id = 'd4cd6432-1c45-47bc-8498-071075e4ae7c') AS athlete_nexus_dans_scope;
ROLLBACK;
