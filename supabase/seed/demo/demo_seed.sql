-- =============================================================================
-- NEXUS DEMO SEED  —  demo_seed.sql
-- =============================================================================
-- Populates a fully-active-looking app for (1) marketing screenshots and
-- (2) a closed beta. Every demo row is anchored on an email pattern so teardown
-- is ONE predicate. Pairs with demo_teardown.sql (run that to revert cleanly).
--
-- ANCHOR:      every demo user has email LIKE 'demo+%@nexussports.ca'.
--              This is the ONLY tag. No is_demo column. No demo school.
--
-- PORTABILITY: email-anchored (not UUID-anchored) => identical file runs local
--              and on OVH, EXCEPT photo URLs which bake in the host. That host
--              is the single :photo_host var below. Change ONE line for OVH.
--
-- TRIGGER CONTRACT (audited) — dictates the insert order:
--   trg_sync_global_status (recruiter_pipeline) -> athletes.recruitment_status,
--   ONLY for pro/all_star recruiters. Stage map:
--     ENGAGE/LETTRE_SIGNEE -> RECRUTE (+committed_school_id)
--     EN_DISCUSSION/VISITE_PLANIFIEE -> EN_PROCESSUS
--     IDENTIFIE/CONTACTE/other -> OUVERT
--   Never downgrades a manual override. trg_pipeline_recruiter_role REJECTS a
--   pipeline row whose recruiter_id is not a RECRUTEUR.
--
-- ORDER: users -> subscriptions(all_star) -> athletes(bare) -> evaluations +
--        badges -> recruiter_pipeline (cascade SETS status) -> favorites ->
--        explicit status UPDATE on QUIET (no-pipeline) athletes only.
--
-- SAFETY: one transaction. Any error => nothing commits.
-- =============================================================================

\set ON_ERROR_STOP on

-- ---- THE ONE LINE YOU CHANGE FOR OVH ----------------------------------------
--   Local Docker:  http://localhost:54321   (check `supabase status` for port)
--   OVH:           https://<your-supabase-domain>
\set photo_host 'http://localhost:54321'

BEGIN;

-- =============================================================================
-- 0. CONFIG — resolve football sport + admin uid (by name/email => portable).
-- =============================================================================
CREATE TEMP TABLE _cfg ON COMMIT DROP AS
SELECT
  (SELECT id FROM sports WHERE nom ILIKE 'football' AND nom NOT ILIKE '%flag%' LIMIT 1) AS football_sport_id,
  (SELECT id FROM users  WHERE email = 'bpdesfosses@gmail.com' LIMIT 1)                 AS admin_uid;

DO $$
DECLARE v uuid;
BEGIN
  SELECT football_sport_id INTO v FROM _cfg;
  IF v IS NULL THEN RAISE EXCEPTION 'Football sport row not found — aborting.'; END IF;
END $$;

-- =============================================================================
-- 1. USERS — 4 recruiters + 3 coaches + 30 athletes.
--    TRIGGER-NATIVE PATTERN (validated on batch test against handle_new_auth_user):
--    public.users.id REFERENCES auth.users(id), and trigger on_auth_user_created
--    auto-creates the public.users row from auth metadata. So we insert ONLY
--    auth.users, packing role/first_name/last_name into raw_user_meta_data.
--    The trigger then creates fully-populated public.users rows (role, status
--    ACTIF, names). NO direct public.users insert.
-- =============================================================================
CREATE TEMP TABLE _seed_users (email text, role text, fn text, ln text) ON COMMIT DROP;
INSERT INTO _seed_users VALUES
  ('demo+rec01@nexussports.ca', 'RECRUTEUR', 'Sylvain',  'Tremblay'),
  ('demo+rec02@nexussports.ca', 'RECRUTEUR', 'Marie',    'Gagnon'),
  ('demo+rec03@nexussports.ca', 'RECRUTEUR', 'Patrick',  'Roy'),
  ('demo+rec04@nexussports.ca', 'RECRUTEUR', 'Caroline', 'Bergeron'),
  ('demo+coach01@nexussports.ca', 'COACH', 'Daniel',    'Côté'),
  ('demo+coach02@nexussports.ca', 'COACH', 'Mélanie',   'Lavoie'),
  ('demo+coach03@nexussports.ca', 'COACH', 'Jean-Phil', 'Bouchard'),
  ('demo+ath01@nexussports.ca', 'ATHLETE', 'Marc-Antoine', 'Tremblay'),
  ('demo+ath02@nexussports.ca', 'ATHLETE', 'Olivier',      'Nadeau'),
  ('demo+ath03@nexussports.ca', 'ATHLETE', 'Jacob',        'Plante'),
  ('demo+ath04@nexussports.ca', 'ATHLETE', 'Nathan',       'Boucher'),
  ('demo+ath05@nexussports.ca', 'ATHLETE', 'Alexis',       'Gauthier'),
  ('demo+ath06@nexussports.ca', 'ATHLETE', 'William',      'Fortin'),
  ('demo+ath07@nexussports.ca', 'ATHLETE', 'Jérémy',       'Lavoie'),
  ('demo+ath08@nexussports.ca', 'ATHLETE', 'Félix',        'Gagnon-Roy'),
  ('demo+ath09@nexussports.ca', 'ATHLETE', 'Adam',         'Rioux'),
  ('demo+ath10@nexussports.ca', 'ATHLETE', 'Thomas',       'Carrier-Brault'),
  ('demo+ath11@nexussports.ca', 'ATHLETE', 'Xavier',       'Lapointe'),
  ('demo+ath12@nexussports.ca', 'ATHLETE', 'Mathis',       'Dufresne'),
  ('demo+ath13@nexussports.ca', 'ATHLETE', 'Noah',         'Tremblay'),
  ('demo+ath14@nexussports.ca', 'ATHLETE', 'Raphaël',      'Bergeron'),
  ('demo+ath15@nexussports.ca', 'ATHLETE', 'Samuel',       'Côté'),
  ('demo+ath16@nexussports.ca', 'ATHLETE', 'William',      'Ouellet'),
  ('demo+ath17@nexussports.ca', 'ATHLETE', 'Mathieu',      'Bélanger'),
  ('demo+ath18@nexussports.ca', 'ATHLETE', 'Zachary',      'Thibault'),
  ('demo+ath19@nexussports.ca', 'ATHLETE', 'Étienne',      'Simard'),
  ('demo+ath20@nexussports.ca', 'ATHLETE', 'Benjamin',     'Caron'),
  ('demo+ath21@nexussports.ca', 'ATHLETE', 'Arnaud',       'Cloutier'),
  ('demo+ath22@nexussports.ca', 'ATHLETE', 'Noah',         'Simard'),
  ('demo+ath23@nexussports.ca', 'ATHLETE', 'Léo',          'Bédard'),
  ('demo+ath24@nexussports.ca', 'ATHLETE', 'Gabriel',      'Lemieux'),
  ('demo+ath25@nexussports.ca', 'ATHLETE', 'Antoine',      'Pelletier'),
  ('demo+ath26@nexussports.ca', 'ATHLETE', 'Émile',        'Girard'),
  ('demo+ath27@nexussports.ca', 'ATHLETE', 'Loïc',         'Demers'),
  ('demo+ath28@nexussports.ca', 'ATHLETE', 'Vincent',      'Morin'),
  ('demo+ath29@nexussports.ca', 'ATHLETE', 'Charles',      'Lévesque'),
  ('demo+ath30@nexussports.ca', 'ATHLETE', 'Tristan',      'Fournier');

INSERT INTO auth.users (
  id, instance_id, aud, role, email, created_at, updated_at, raw_user_meta_data
)
SELECT
  gen_random_uuid(), '00000000-0000-0000-0000-000000000000',
  'authenticated', 'authenticated', email, now(), now(),
  jsonb_build_object('role', role, 'first_name', fn, 'last_name', ln)
FROM _seed_users;
-- public.users rows now exist for all 37 (created by the trigger).

-- =============================================================================
-- 2. SUBSCRIPTIONS — all 4 recruiters all_star so the status cascade fires.
--    UPSERT (subscriptions has UNIQUE(user_id)).
-- =============================================================================
INSERT INTO subscriptions (user_id, tier, status)
SELECT id, 'all_star', 'active'
FROM users WHERE email LIKE 'demo+rec%@nexussports.ca'
ON CONFLICT (user_id) DO UPDATE
  SET tier = EXCLUDED.tier, status = 'active', updated_at = now();

-- =============================================================================
-- 3. ATHLETES (bare). recruitment_status left to default; driven later.
--    Attributes (position abbrev, physicals, grad year) come from a VALUES
--    list keyed by athlete number N (parsed from demo+athNN). School spread
--    across the resolved SECONDAIRE set, cycling by N.
-- =============================================================================

-- Position lookup for football, by abbreviation.
CREATE TEMP TABLE _pos ON COMMIT DROP AS
SELECT abreviation, id FROM positions
WHERE sport_id = (SELECT football_sport_id FROM _cfg);

-- School spread: try named schools first; if none match, take first 8 SECONDAIRE.
CREATE TEMP TABLE _sch ON COMMIT DROP AS
SELECT row_number() OVER (ORDER BY name) AS rn, id
FROM schools
WHERE type='SECONDAIRE' AND name IN (
  'É.S. Saint-Jean-Eudes','É.S. De Mortagne','É.S. de Rochebelle','É.S. Roger-Comtois',
  'É.S. Charles-Gravel','É.S. les Etchemins','É.S. Mont-Saint-Sacrement','É.S. de la Seigneurie'
);
INSERT INTO _sch (rn, id)
SELECT row_number() OVER (ORDER BY name), id
FROM schools WHERE type='SECONDAIRE'
  AND NOT EXISTS (SELECT 1 FROM _sch)
LIMIT 8;

-- Per-athlete attribute table.
-- taille_pieds = FEET, taille_pouces = INCHES (separate columns, app shows X'Y").
-- numero_jersey is text. weight numeric. moyenne = academic avg (numeric %).
-- prog = programme_cegep_vise value (MUST match app CEGEP_PROGRAMS list, accented).
CREATE TEMP TABLE _ath_attr (n int, ab text, ft int, inch int, weight int, grad int, jersey text, moyenne numeric, prog text) ON COMMIT DROP;
INSERT INTO _ath_attr VALUES
  (1,'QB',5,11,185,2026,'12',88.5,'Sciences de la nature'),(2,'QB',6,0,190,2026,'7',82.0,'Sciences humaines'),(3,'QB',6,2,200,2026,'9',79.5,'Administration'),
  (4,'RB',5,9,195,2026,'28',85.0,'Sciences humaines'),(5,'RB',5,10,205,2026,'32',77.5,'DEC général'),(6,'WR',6,1,180,2026,'80',90.0,'Sciences de la nature'),
  (7,'WR',6,0,175,2026,'84',86.5,'Techniques policières'),(8,'WR',5,11,178,2027,'11',81.0,'Sciences humaines'),(9,'TE',6,4,225,2026,'88',83.5,'Administration'),
  (10,'TE',6,3,230,2026,'89',84.0,'Techniques informatiques'),(11,'OL',6,4,280,2026,'65',76.0,'DEC général'),(12,'OL',6,5,295,2026,'72',78.5,'Administration'),
  (13,'OL',6,3,285,2027,'77',80.0,'Sciences humaines'),(14,'DL',6,2,265,2026,'90',75.5,'Techniques policières'),(15,'DL',6,4,270,2026,'94',82.5,'Sciences de la nature'),
  (16,'DL',6,1,255,2027,'99',74.0,'DEC général'),(17,'LB',6,0,220,2026,'52',87.0,'Sciences humaines'),(18,'LB',6,1,225,2026,'55',83.0,'Techniques policières'),
  (19,'LB',5,11,215,2027,'44',79.0,'Administration'),(20,'DB',5,11,185,2026,'21',91.5,'Sciences de la nature'),(21,'DB',6,0,190,2026,'24',80.5,'Sciences humaines'),
  (22,'DB',5,10,180,2027,'29',77.0,'DEC général'),(23,'CB',5,9,170,2026,'2',73.5,'Arts'),(24,'CB',5,10,175,2026,'5',85.5,'Sciences de la nature'),
  (25,'S',6,0,195,2026,'33',81.5,'Techniques informatiques'),(26,'S',6,1,200,2027,'8',78.0,'Sciences humaines'),(27,'WR',5,10,172,2028,'15',84.5,'Administration'),
  (28,'RB',5,8,190,2028,'26',82.0,'Sciences humaines'),(29,'K',5,11,165,2026,'3',88.0,'Sciences de la nature'),(30,'OL',6,6,300,2028,'76',76.5,'DEC général');

INSERT INTO athletes (
  id, user_id, sport_id, position_id, school_id,
  first_name, last_name, annee_diplomation, numero_jersey,
  taille_pieds, taille_pouces, poids_lbs, moyenne_generale,
  programme_cegep_vise, mentions_academiques,
  photo_url, parcours_readiness, created_at
)
SELECT
  gen_random_uuid(), u.id,
  (SELECT football_sport_id FROM _cfg),
  (SELECT id FROM _pos WHERE abreviation = a.ab LIMIT 1),
  (SELECT id FROM _sch WHERE rn = ((a.n - 1) % GREATEST((SELECT count(*) FROM _sch),1)) + 1),
  u.first_name, u.last_name, a.grad, a.jersey, a.ft, a.inch, a.weight, a.moyenne,
  -- programme_cegep_vise: single-value jsonb array (app uses selectSingleArray)
  jsonb_build_array(a.prog),
  -- mentions_academiques: honor on high achievers (>=85%), else empty array
  CASE WHEN a.moyenne >= 85 THEN '["Mention d''honneur"]'::jsonb ELSE '[]'::jsonb END,
  CASE WHEN a.n <= 15
       THEN :'photo_host' || '/storage/v1/object/public/avatars/demo-ath-' || lpad(a.n::text,2,'0') || '.jpg'
       ELSE NULL END,
  '{}'::jsonb, now()
FROM users u
JOIN _ath_attr a ON a.n = (regexp_replace(u.email, '\D', '', 'g'))::int
WHERE u.email LIKE 'demo+ath%@nexussports.ca';

-- =============================================================================
-- 4. EVALUATIONS + BADGES — drive blue checks + ratings.
--    evaluations hard-req: coach_id, athlete_id. We add cote_globale (1-5 star)
--    and the 8 detailed criteria on a SUBSET to show both rating modes.
--    Blue check: athletes.verified is flipped by setting it directly here AFTER
--    an eval exists (coach-verified). ~half verified.
--    Coach Élite (coach01) does most evals (15+); coach02 a few; coach03 none.
-- =============================================================================

-- Map: which coach evaluates, simple vs detailed, star rating, verified?
-- ath01..ath15 (photographed) skew verified + higher rated for marketing.
CREATE TEMP TABLE _eval_plan (n int, coach_email text, detailed bool, cote numeric, verified bool) ON COMMIT DROP;
INSERT INTO _eval_plan VALUES
  (1 ,'demo+coach01@nexussports.ca', true , 5.0, true ),
  (2 ,'demo+coach01@nexussports.ca', true , 4.5, true ),
  (3 ,'demo+coach01@nexussports.ca', false, 4.0, true ),
  (4 ,'demo+coach01@nexussports.ca', true , 4.0, true ),
  (5 ,'demo+coach01@nexussports.ca', false, 3.5, true ),
  (6 ,'demo+coach01@nexussports.ca', true , 4.5, true ),
  (7 ,'demo+coach01@nexussports.ca', true , 5.0, true ),
  (8 ,'demo+coach01@nexussports.ca', false, 4.0, true ),
  (9 ,'demo+coach01@nexussports.ca', true , 4.0, true ),
  (10,'demo+coach01@nexussports.ca', true , 4.5, true ),
  (11,'demo+coach01@nexussports.ca', false, 3.5, true ),
  (12,'demo+coach01@nexussports.ca', true , 4.0, true ),
  (13,'demo+coach02@nexussports.ca', false, 3.0, true ),
  (14,'demo+coach02@nexussports.ca', true , 3.5, true ),
  (15,'demo+coach02@nexussports.ca', false, 4.0, true ),
  (16,'demo+coach02@nexussports.ca', false, 3.0, false),
  (17,'demo+coach02@nexussports.ca', true , 3.5, true ),
  (18,'demo+coach02@nexussports.ca', false, 3.0, false),
  (20,'demo+coach01@nexussports.ca', true , 5.0, true ),
  (24,'demo+coach01@nexussports.ca', false, 4.0, true ),
  (25,'demo+coach02@nexussports.ca', false, 3.5, false);
-- Athletes 19,21,22,23,26,27,28,29,30 get NO eval => unrated + gray (realistic).

-- Insert evaluations. Detailed ones fill the real 8 criteria (integer 1-5) plus
-- a couple of physical numerics; simple ones set only cote_globale (star rating).
INSERT INTO evaluations (
  id, coach_id, athlete_id, cote_globale,
  leadership, discipline, coachabilite, intelligence_jeu,
  competitivite, esprit_equipe, resilience, attitude_mentalite,
  vitesse_explosivite, force_puissance,
  rapport_entraineur, created_at
)
SELECT
  gen_random_uuid(), cu.id, ath.id, p.cote,
  -- 8 standardized criteria (integer 1-5), only when detailed
  CASE WHEN p.detailed THEN LEAST(5, GREATEST(1, round(p.cote)::int))       END,
  CASE WHEN p.detailed THEN LEAST(5, GREATEST(1, round(p.cote - 0.5)::int)) END,
  CASE WHEN p.detailed THEN LEAST(5, GREATEST(1, round(p.cote)::int))       END,
  CASE WHEN p.detailed THEN LEAST(5, GREATEST(1, round(p.cote + 0.5)::int)) END,
  CASE WHEN p.detailed THEN LEAST(5, GREATEST(1, round(p.cote)::int))       END,
  CASE WHEN p.detailed THEN LEAST(5, GREATEST(1, round(p.cote)::int))       END,
  CASE WHEN p.detailed THEN LEAST(5, GREATEST(1, round(p.cote - 0.5)::int)) END,
  CASE WHEN p.detailed THEN LEAST(5, GREATEST(1, round(p.cote + 0.5)::int)) END,
  -- a couple of physical numerics for flavor (numeric), only when detailed
  CASE WHEN p.detailed THEN round(p.cote, 1) END,
  CASE WHEN p.detailed THEN round(p.cote, 1) END,
  CASE WHEN p.detailed THEN 'Joueur fiable, bonne éthique de travail.' ELSE NULL END,
  now()
FROM _eval_plan p
JOIN users au ON au.email LIKE 'demo+ath' || lpad(p.n::text,2,'0') || '@nexussports.ca'
JOIN athletes ath ON ath.user_id = au.id
JOIN users cu ON cu.email = p.coach_email;

-- Flip verified + set the global coach rating on athletes per the plan.
UPDATE athletes a
SET verified = p.verified,
    cote_globale_entraineur = p.cote,
    verified_by = (SELECT id FROM users WHERE email = p.coach_email),
    last_profile_validation = now()
FROM _eval_plan p
JOIN users au ON au.email LIKE 'demo+ath' || lpad(p.n::text,2,'0') || '@nexussports.ca'
WHERE a.user_id = au.id;

-- Coach badges: free-text column with a CHECK constraint limiting values to
-- EVALUE / RECOMMANDE / COACH_ELITE / PLACEUR. Timestamp column is earned_at.
INSERT INTO coach_badges (id, coach_id, badge, earned_at)
SELECT gen_random_uuid(), u.id, b.badge, now()
FROM users u
JOIN (VALUES
  ('demo+coach01@nexussports.ca','COACH_ELITE'),
  ('demo+coach01@nexussports.ca','PLACEUR'),
  ('demo+coach02@nexussports.ca','RECOMMANDE')
) AS b(email, badge) ON b.email = u.email;

-- =============================================================================
-- 5. RECRUITER_PIPELINE — the kanban. THIS fires trg_sync_global_status and
--    SETS athletes.recruitment_status as a side effect (recruiters are all_star).
--    rec01 = the "primary" recruiter: full kanban across all 6 stages.
--    rec02/03/04 = lighter, creating multi-recruiter overlap on hot athletes.
--    stage strings must be EXACTLY the 6 validated values (uppercase).
-- =============================================================================
CREATE TEMP TABLE _pipe (rec_email text, ath_n int, stage text, flagged bool, note text) ON COMMIT DROP;
INSERT INTO _pipe VALUES
  -- rec01 primary, full funnel
  ('demo+rec01@nexussports.ca', 1,'LETTRE_SIGNEE', true , 'Lettre signée — bienvenue au programme'),
  ('demo+rec01@nexussports.ca', 2,'ENGAGE',        true , 'Engagement verbal confirmé'),
  ('demo+rec01@nexussports.ca', 7,'VISITE_PLANIFIEE', true,'Visite du campus le 22 mars'),
  ('demo+rec01@nexussports.ca', 9,'EN_DISCUSSION', false, 'Le coach dit qu''il hésite entre nous et Garneau'),
  ('demo+rec01@nexussports.ca', 6,'EN_DISCUSSION', false, 'Excellent QI football'),
  ('demo+rec01@nexussports.ca',10,'CONTACTE',      false, 'Premier message envoyé au coach'),
  ('demo+rec01@nexussports.ca',17,'CONTACTE',      false, 'Relancer — pas de réponse'),
  ('demo+rec01@nexussports.ca', 4,'IDENTIFIE',     false, NULL),
  ('demo+rec01@nexussports.ca',11,'IDENTIFIE',     false, 'Capitaine de son équipe'),
  ('demo+rec01@nexussports.ca',14,'IDENTIFIE',     false, NULL),
  -- (athlete 22 is "retired": not in any active pipeline; RETIRE status set below)
  -- rec02 overlaps on hot athletes 1, 7
  ('demo+rec02@nexussports.ca', 1,'EN_DISCUSSION', true , 'Top prospect — prioriser'),
  ('demo+rec02@nexussports.ca', 7,'VISITE_PLANIFIEE', true,'Visite confirmée'),
  ('demo+rec02@nexussports.ca', 5,'CONTACTE',      false, NULL),
  ('demo+rec02@nexussports.ca',12,'IDENTIFIE',     false, NULL),
  ('demo+rec02@nexussports.ca',20,'EN_DISCUSSION', false, 'Très intéressé par le programme'),
  -- rec03 light
  ('demo+rec03@nexussports.ca', 3,'CONTACTE',      false, NULL),
  ('demo+rec03@nexussports.ca', 8,'IDENTIFIE',     false, NULL),
  ('demo+rec03@nexussports.ca',24,'IDENTIFIE',     false, NULL),
  -- rec04 light, overlaps on 2
  ('demo+rec04@nexussports.ca', 2,'CONTACTE',      false, 'Plan B solide'),
  ('demo+rec04@nexussports.ca',25,'IDENTIFIE',     false, NULL);

INSERT INTO recruiter_pipeline (id, recruiter_id, athlete_id, stage, flagged, notes, moved_at, created_at)
SELECT
  gen_random_uuid(), ru.id, ath.id, pp.stage, pp.flagged, pp.note, now(), now()
FROM _pipe pp
JOIN users ru ON ru.email = pp.rec_email
JOIN users au ON au.email LIKE 'demo+ath' || lpad(pp.ath_n::text,2,'0') || '@nexussports.ca'
JOIN athletes ath ON ath.user_id = au.id;

-- =============================================================================
-- 6. RECRUITER_FAVORITES — favorites lists differ per recruiter.
--    NOTE (audited): recruiter_favorites.recruiter_id has NO FK/trigger guard,
--    so we are disciplined: only ever real demo recruiter ids.
-- =============================================================================
CREATE TEMP TABLE _fav (rec_email text, ath_n int) ON COMMIT DROP;
INSERT INTO _fav VALUES
  ('demo+rec01@nexussports.ca',1),('demo+rec01@nexussports.ca',2),('demo+rec01@nexussports.ca',7),
  ('demo+rec01@nexussports.ca',9),('demo+rec01@nexussports.ca',20),
  ('demo+rec02@nexussports.ca',1),('demo+rec02@nexussports.ca',7),('demo+rec02@nexussports.ca',5),
  ('demo+rec03@nexussports.ca',3),('demo+rec03@nexussports.ca',24),
  ('demo+rec04@nexussports.ca',2),('demo+rec04@nexussports.ca',25);

INSERT INTO recruiter_favorites (id, recruiter_id, athlete_id, created_at)
SELECT gen_random_uuid(), ru.id, ath.id, now()
FROM _fav f
JOIN users ru ON ru.email = f.rec_email
JOIN users au ON au.email LIKE 'demo+ath' || lpad(f.ath_n::text,2,'0') || '@nexussports.ca'
JOIN athletes ath ON ath.user_id = au.id;

-- =============================================================================
-- 7. QUIET ATHLETES — those with NO pipeline row never got a cascade, so their
--    status is still the default. Set explicit OUVERT for most, RETIRE for one,
--    to show the full status range in athlete-facing + search views.
--    We set recruitment_status_changed_by = admin so it reads as deliberate.
--    Piped athletes are intentionally skipped (cascade owns their status).
-- =============================================================================
UPDATE athletes a
SET recruitment_status = (CASE WHEN au.email LIKE '%ath22%' OR au.email LIKE '%ath23%' THEN 'RETIRE' ELSE 'OUVERT' END)::recruitment_status,
    recruitment_status_changed_by = (SELECT admin_uid FROM _cfg),
    recruitment_status_changed_at = now()
FROM users au
WHERE a.user_id = au.id
  AND au.email LIKE 'demo+ath%@nexussports.ca'
  AND NOT EXISTS (
    SELECT 1 FROM recruiter_pipeline rp WHERE rp.athlete_id = a.id
  );

COMMIT;

-- =============================================================================
-- POST-SEED VERIFICATION (read-only; run after COMMIT to eyeball coherence)
-- =============================================================================
-- \echo 'Demo users by role:'
-- SELECT role, count(*) FROM users WHERE email LIKE 'demo+%@nexussports.ca' GROUP BY role;
-- \echo 'Athlete status spread (should show RECRUTE/EN_PROCESSUS/OUVERT/RETIRE):'
-- SELECT a.recruitment_status, count(*) FROM athletes a JOIN users u ON u.id=a.user_id
--   WHERE u.email LIKE 'demo+ath%' GROUP BY a.recruitment_status;
-- \echo 'Verified (blue) vs gray:'
-- SELECT verified, count(*) FROM athletes a JOIN users u ON u.id=a.user_id
--   WHERE u.email LIKE 'demo+ath%' GROUP BY verified;
-- \echo 'Pipeline rows per recruiter:'
-- SELECT u.email, count(*) FROM recruiter_pipeline rp JOIN users u ON u.id=rp.recruiter_id
--   WHERE u.email LIKE 'demo+rec%' GROUP BY u.email;
