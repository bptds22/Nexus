-- =============================================================================
-- seed-optimizer-demo.sql  —  MOCK DATA TEMPORAIRE, DOCKER LOCAL SEULEMENT
-- =============================================================================
-- But : alimenter le Calendrier de recrutement recruteur
--       (/recruteur/calendrier) pour un screenshot, avec un « money shot » :
--       12 oct 2026 — St-Jean-Vianney vs Jean-Eudes — 7 cibles.
--
-- ⚠️  NE JAMAIS exécuter sur le cloud (nrloizyemulbhujrqhgx). Ce fichier vit
--     dans scripts/, PAS dans supabase/migrations/ — il ne doit jamais partir
--     dans une migration.
--
-- COMPTE CIBLE : recruteur@local.test / Test1234!  (tier pro, admin_grant)
--                uid 9b60f1df-3391-4de4-bfb5-f6a375f18856
--
-- TAGS (un DELETE avant chaque INSERT => rejouable à l'infini) :
--   games.game_no      LIKE 'DEMO-OPT-%'
--   athletes.email     LIKE '%@demo.nexus'
--   uuid fixes         dec0de01..dec0de06-…  (équipes, rseq, athlètes, matchs)
--
-- CHAÎNE DE DONNÉES (auditée dans lib/queries/recruiter/useRecruitingCalendar.ts) :
--   cibles (pipeline ∪ favoris ∪ membres de listes)
--     -> athletes -> team_athletes -> teams.rseq_team_id
--     -> games.home_rseq_team_id / games.visitor_rseq_team_id
--   ⚠️ La jointure passe par les colonnes *_rseq_team_id, JAMAIS par
--      games.home_team_id / visitor_team_id. Celles-ci restent NULL ici :
--      les remplir ne changerait rien, le hook ne les lit pas.
--
-- SÉCURITÉ CLOUD : athletes.parent_email reste NULL sur les 10 athlètes.
--   Le trigger trg_notify_parent_on_minor fait un net.http_post vers
--   https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/send-parent-notice
--   pour tout athlète de 14-17 ans AYANT un parent_email. pg_net est installé
--   localement, donc l'appel partirait pour vrai. parent_email NULL = garde
--   en tête de fonction => sortie immédiate, aucun octet vers le cloud.
--
-- RÉVERSIBILITÉ : les cibles préexistantes du recruteur sont DÉPLACÉES dans
--   demo_opt_pipeline_backup / demo_opt_favorites_backup, pas détruites.
--   scripts/seed-optimizer-demo-cleanup.sql les restaure et droppe les tables.
--
-- SAFETY : une seule transaction. La moindre erreur => rien ne commit.
-- =============================================================================

\set ON_ERROR_STOP on

BEGIN;

-- =============================================================================
-- 0. GARDE-FOUS + RÉSOLUTION DES RÉFÉRENCES RÉELLES
--    Tout est résolu par nom/email (portable), sauf les uuid de démo qui sont
--    fixes pour rester idempotents.
-- =============================================================================
CREATE TEMP TABLE _cfg ON COMMIT DROP AS
SELECT
  (SELECT id FROM users
    WHERE email = 'recruteur@local.test' AND role = 'RECRUTEUR')            AS recruiter_id,
  (SELECT id FROM sports
    WHERE nom ILIKE 'football' AND nom NOT ILIKE '%flag%' LIMIT 1)          AS football_id,
  (SELECT id FROM schools
    WHERE name = 'Collège St-Jean-Vianney' AND type = 'SECONDAIRE' LIMIT 1) AS sch_cajv,
  (SELECT id FROM schools
    WHERE name = 'Collège Jean-Eudes' AND type = 'SECONDAIRE' LIMIT 1)      AS sch_je,
  (SELECT id FROM schools
    WHERE name = 'Dragons de Laval' AND type = 'LIGUE_CIVILE' LIMIT 1)      AS sch_dragons;

DO $$
DECLARE c record;
BEGIN
  SELECT * INTO c FROM _cfg;
  IF c.recruiter_id IS NULL THEN
    RAISE EXCEPTION 'Compte recruteur@local.test introuvable (ou rôle ≠ RECRUTEUR).';
  END IF;
  IF c.football_id IS NULL THEN RAISE EXCEPTION 'Sport Football introuvable.'; END IF;
  IF c.sch_cajv    IS NULL THEN RAISE EXCEPTION 'École « Collège St-Jean-Vianney » introuvable.'; END IF;
  IF c.sch_je      IS NULL THEN RAISE EXCEPTION 'École « Collège Jean-Eudes » introuvable.'; END IF;
  IF c.sch_dragons IS NULL THEN RAISE EXCEPTION 'Club « Dragons de Laval » introuvable.'; END IF;

  -- Le tier free renvoie <FreeWall/> et ne lance AUCUNE requête : sans pro,
  -- le seed serait invisible. On échoue fort plutôt que de livrer un écran vide.
  --
  -- ⚠️ On lit subscriptions directement, PAS public.user_has_pro(uuid) : cette
  --    fonction IGNORE son argument et délègue à get_user_tier(), qui lit
  --    auth.uid(). Sous psql, auth.uid() est NULL => elle renvoie toujours
  --    false, quel que soit l'uuid passé. (Même piège dans
  --    sync_global_recruitment_status — voir §5.)
  PERFORM 1 FROM subscriptions s
    WHERE s.user_id = c.recruiter_id
      AND s.tier IN ('pro', 'all_star')
      AND s.status = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'recruteur@local.test n''est pas pro/all_star actif — le calendrier afficherait le mur Free.';
  END IF;
END $$;

-- Positions football, par abréviation (portable, pas d'uuid en dur).
CREATE TEMP TABLE _pos ON COMMIT DROP AS
SELECT p.abreviation AS abbr, p.id
FROM positions p, _cfg c
WHERE p.sport_id = c.football_id;

-- =============================================================================
-- 1. TEARDOWN DU RUN PRÉCÉDENT — ordre dicté par les FK NO ACTION.
--    recruiter_pipeline / recruiter_favorites / recruiter_notes /
--    recruiter_athlete_views ne cascadent PAS depuis athletes : à purger avant.
-- =============================================================================
CREATE TEMP TABLE _demo_athletes ON COMMIT DROP AS
SELECT id FROM athletes WHERE email LIKE '%@demo.nexus';

DELETE FROM recruiter_pipeline       WHERE athlete_id IN (SELECT id FROM _demo_athletes);
DELETE FROM recruiter_favorites      WHERE athlete_id IN (SELECT id FROM _demo_athletes);
DELETE FROM recruiter_notes          WHERE athlete_id IN (SELECT id FROM _demo_athletes);
DELETE FROM recruiter_athlete_views  WHERE athlete_id IN (SELECT id FROM _demo_athletes);

-- La liste de démo (cascade sur ses membres).
DELETE FROM recruiter_lists WHERE id = 'dec0de06-0000-4000-8000-000000000001';

-- Athlètes : le reste (team_athletes, evaluations, activity log…) cascade.
DELETE FROM athletes WHERE email LIKE '%@demo.nexus';

-- Matchs de démo, par le tag demandé.
DELETE FROM games WHERE game_no LIKE 'DEMO-OPT-%';

-- Équipes de démo (uuid fixes).
DELETE FROM teams WHERE id IN (
  'dec0de01-0000-4000-8000-000000000001',
  'dec0de01-0000-4000-8000-000000000002',
  'dec0de01-0000-4000-8000-000000000003'
);

-- =============================================================================
-- 2. MISE DE CÔTÉ DES CIBLES PRÉEXISTANTES DU RECRUTEUR
--    Choix validé : seules les 10 cibles de démo doivent apparaître dans le
--    classement. On DÉPLACE, on ne détruit pas. LIKE ... INCLUDING ALL copie
--    pkey + contrainte unique (donc ON CONFLICT marche) mais PAS les FK —
--    la sauvegarde survit donc à la suppression des athlètes.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.demo_opt_pipeline_backup
  (LIKE public.recruiter_pipeline INCLUDING ALL);
CREATE TABLE IF NOT EXISTS public.demo_opt_favorites_backup
  (LIKE public.recruiter_favorites INCLUDING ALL);

-- Une liste préexistante ajouterait des cibles au bassin (union) et
-- polluerait le classement. On refuse de deviner quoi en faire.
DO $$
DECLARE c record; n int;
BEGIN
  SELECT * INTO c FROM _cfg;
  SELECT count(*) INTO n FROM recruiter_lists
   WHERE recruiter_id = c.recruiter_id
     AND id <> 'dec0de06-0000-4000-8000-000000000001';
  IF n > 0 THEN
    RAISE EXCEPTION
      'Le recruteur possède % liste(s) préexistante(s) : leurs membres pollueraient le classement. Traite-les à la main avant de rejouer.', n;
  END IF;
END $$;

INSERT INTO public.demo_opt_pipeline_backup
SELECT p.* FROM recruiter_pipeline p, _cfg c WHERE p.recruiter_id = c.recruiter_id
ON CONFLICT DO NOTHING;

INSERT INTO public.demo_opt_favorites_backup
SELECT f.* FROM recruiter_favorites f, _cfg c WHERE f.recruiter_id = c.recruiter_id
ON CONFLICT DO NOTHING;

DELETE FROM recruiter_pipeline  p USING _cfg c WHERE p.recruiter_id = c.recruiter_id;
DELETE FROM recruiter_favorites f USING _cfg c WHERE f.recruiter_id = c.recruiter_id;

-- =============================================================================
-- 3. ÉQUIPES DE DÉMO — 3, sous de vraies écoles du réseau.
--    Dédup : teams_identity_unique(school_id, sport_id, name, age_group,
--    division, gender, season). Les équipes déjà présentes pour ces écoles
--    s'appellent « Collège St-Jean-Vianney » / « Collège Jean-Eudes » en
--    saison 2025-2026 — aucune collision avec les noms courts ci-dessous.
--    Si le registre dérive, on échoue fort plutôt que de réutiliser en
--    silence une équipe sans rseq_team_id (= calendrier vide).
--
--    rseq_team_id est LA clé de jointure aux matchs. Sans elle, la cible
--    n'a aucun calendrier (cf. useRecruitingCalendar.ts, garde `if (!rseq)`).
-- =============================================================================
CREATE TEMP TABLE _teams (
  team_id uuid, rseq_id uuid, school_id uuid, name text
) ON COMMIT DROP;

INSERT INTO _teams
SELECT 'dec0de01-0000-4000-8000-000000000001'::uuid,
       'dec0de02-0000-4000-8000-000000000001'::uuid, c.sch_cajv,    'St-Jean-Vianney' FROM _cfg c
UNION ALL
SELECT 'dec0de01-0000-4000-8000-000000000002'::uuid,
       'dec0de02-0000-4000-8000-000000000002'::uuid, c.sch_je,      'Jean-Eudes'       FROM _cfg c
UNION ALL
SELECT 'dec0de01-0000-4000-8000-000000000003'::uuid,
       'dec0de02-0000-4000-8000-000000000003'::uuid, c.sch_dragons, 'Dragons de Laval' FROM _cfg c;

DO $$
DECLARE t record; c record; n int;
BEGIN
  SELECT * INTO c FROM _cfg;
  FOR t IN SELECT * FROM _teams LOOP
    SELECT count(*) INTO n FROM teams
     WHERE school_id = t.school_id AND sport_id = c.football_id AND name = t.name
       AND age_group = 'Juvénile' AND division = 'D1' AND gender = 'Masculin'
       AND season = '2026-2027';
    IF n > 0 THEN
      RAISE EXCEPTION 'Une équipe non-démo occupe déjà l''identité « % » (2026-2027).', t.name;
    END IF;
  END LOOP;
END $$;

INSERT INTO teams (id, school_id, sport_id, name, division, age_group, gender, season, league, rseq_team_id, is_active)
SELECT t.team_id, t.school_id, c.football_id, t.name,
       'D1', 'Juvénile', 'Masculin', '2026-2027', 'RSEQ Montréal', t.rseq_id, true
FROM _teams t, _cfg c;

-- =============================================================================
-- 4. 10 ATHLÈTES FICTIFS — noms inventés, aucun vrai athlète.
--    Répartition : 4 St-Jean-Vianney / 3 Jean-Eudes / 3 Dragons de Laval.
--    Sec. 5 -> promotion 2027 (né 2009) ; sec. 4 -> promotion 2028 (né 2010).
--    parent_email VOLONTAIREMENT NULL (cf. en-tête : garde anti-cloud).
--    cote plafonnée à 4.5 : un 5.0 déclencherait emit_five_star_newsroom_event.
-- =============================================================================
CREATE TEMP TABLE _ath (
  n int, id uuid, fn text, ln text, pos text, promo int, dob date,
  team_slot int, jersey text, cote numeric, gpa numeric,
  verified boolean, video boolean, pieds int, pouces int, lbs numeric
) ON COMMIT DROP;

INSERT INTO _ath VALUES
  -- ── St-Jean-Vianney (4) ────────────────────────────────────────────────
  ( 1,'dec0de03-0000-4000-8000-000000000001','Émile',   'Charbonneau','QB', 2027,'2009-03-14',1,'12',4.5,88.0,true ,true ,6, 1,190),
  ( 2,'dec0de03-0000-4000-8000-000000000002','Thomas',  'Lévesque',   'WR', 2027,'2009-07-02',1,'84',4.0,81.5,true ,true ,6, 0,175),
  ( 3,'dec0de03-0000-4000-8000-000000000003','Anthony', 'Bourgeois',  'LB', 2028,'2010-01-25',1,'55',3.5,76.0,false,false,5,11,205),
  ( 4,'dec0de03-0000-4000-8000-000000000004','Félix',   'Ouellette',  'OT', 2027,'2009-11-08',1,'76',4.0,79.0,true ,false,6, 4,268),
  -- ── Jean-Eudes (3) ─────────────────────────────────────────────────────
  ( 5,'dec0de03-0000-4000-8000-000000000005','Gabriel', 'Marcoux',    'RB', 2027,'2009-05-19',2,'22',4.5,84.0,true ,true ,5,10,188),
  ( 6,'dec0de03-0000-4000-8000-000000000006','Olivier', 'Provencher', 'DE', 2028,'2010-04-03',2,'91',3.5,72.5,false,false,6, 2,225),
  ( 7,'dec0de03-0000-4000-8000-000000000007','Samuel',  'Deschamps',  'CB', 2027,'2009-09-27',2,'21',4.0,90.5,true ,true ,5, 9,168),
  -- ── Dragons de Laval (3) ───────────────────────────────────────────────
  ( 8,'dec0de03-0000-4000-8000-000000000008','Nathan',  'Rousseau',   'S',  2027,'2009-02-11',3,'33',4.0,77.0,true ,false,6, 0,182),
  ( 9,'dec0de03-0000-4000-8000-000000000009','Zachary', 'Beaulieu',   'TE', 2028,'2010-08-16',3,'87',3.5,83.0,false,true ,6, 3,215),
  (10,'dec0de03-0000-4000-8000-000000000010','Loïc',    'Ferland',    'DT', 2027,'2009-12-01',3,'99',4.5,74.5,true ,false,6, 1,252);

INSERT INTO athletes (
  id, first_name, last_name, date_naissance, genre, email,
  school_id, sport_id, position_id, numero_jersey,
  annee_diplomation, moyenne_generale, cote_globale_entraineur,
  verified, status, taille_pieds, taille_pouces, poids_lbs,
  video_faits_saillants_url, bio
)
SELECT
  a.id, a.fn, a.ln, a.dob, 'M',
  lower(translate(a.fn || '.' || a.ln, 'ÉÈÊËÀÂÎÏÔÛÙÇéèêëàâîïôûùç', 'EEEEAAIIOUUCeeeeaaiiouuc')) || '@demo.nexus',
  t.school_id, c.football_id, p.id, a.jersey,
  a.promo, a.gpa, a.cote,
  a.verified, 'ACTIF', a.pieds, a.pouces, a.lbs,
  CASE WHEN a.video THEN 'https://example.invalid/demo/highlights-' || a.n ELSE NULL END,
  'Profil de démonstration — données fictives (seed-optimizer-demo).'
FROM _ath a
JOIN _teams t ON t.team_id = ('dec0de01-0000-4000-8000-00000000000' || a.team_slot)::uuid
JOIN _pos   p ON p.abbr = a.pos
CROSS JOIN _cfg c;

-- Rattachement aux équipes. team_athletes.sport_id est de toute façon
-- réécrit par team_athletes_set_sport_id_trg ; on le passe explicitement.
INSERT INTO team_athletes (team_id, athlete_id, sport_id, jersey_number)
SELECT ('dec0de01-0000-4000-8000-00000000000' || a.team_slot)::uuid, a.id, c.football_id, a.jersey
FROM _ath a CROSS JOIN _cfg c;

-- =============================================================================
-- 5. PIPELINE DU RECRUTEUR — les 10, stages variés, 2 flagged.
--    Rappel : le Calendrier ne lit QUE `stage`. flagged / next_action_at /
--    visit_at sont là pour la page Pipeline, pas pour ce screenshot.
--
--    trg_sync_global_status NE propagera PAS ENGAGE/LETTRE_SIGNEE vers
--    athletes.recruitment_status ici : sa première ligne est
--    `IF NOT user_has_pro(NEW.recruiter_id) THEN RETURN NEW`, et cette
--    fonction ignore son argument pour lire auth.uid() — NULL sous psql.
--    Conséquence : aucun effet de bord sur les athlètes, et rien à défaire
--    au rollback. Via l'app (auth.uid() réel), le même geste propagerait.
-- =============================================================================
INSERT INTO recruiter_pipeline
  (recruiter_id, athlete_id, stage, flagged, next_action_at, next_action_note, visit_at, notes, moved_at)
SELECT c.recruiter_id, a.id, v.stage, v.flagged, v.next_action_at, v.next_action_note, v.visit_at, v.notes, now()
FROM _cfg c
CROSS JOIN (VALUES
  ( 1,'ENGAGE',          true , DATE '2026-10-13','Confirmer l''offre avec le coordonnateur', NULL::timestamptz, 'Engagement verbal — priorité numéro un'),
  ( 2,'EN_DISCUSSION',   false, DATE '2026-10-14','Relancer après le match du 12',            NULL,              'Vitesse en ligne droite au-dessus de la moyenne'),
  ( 3,'IDENTIFIE',       false, NULL,             NULL,                                       NULL,              NULL),
  ( 4,'CONTACTE',        false, DATE '2026-10-20','Envoyer la trousse du programme',          NULL,              'Premier courriel envoyé au coach'),
  ( 5,'VISITE_PLANIFIEE',true , DATE '2026-10-21','Préparer la visite du campus',             TIMESTAMPTZ '2026-10-22 18:00-04', 'Visite confirmée avec les parents'),
  ( 6,'IDENTIFIE',       false, NULL,             NULL,                                       NULL,              NULL),
  ( 7,'CONTACTE',        false, NULL,             NULL,                                       NULL,              'Excellent dossier académique'),
  ( 8,'EN_DISCUSSION',   false, DATE '2026-10-19','Rappeler le coach des Dragons',            NULL,              'Hésite entre nous et un programme de Québec'),
  ( 9,'IDENTIFIE',       false, NULL,             NULL,                                       NULL,              NULL),
  (10,'LETTRE_SIGNEE',   false, NULL,             NULL,                                       NULL,              'Lettre signée — dossier clos')
) AS v(n, stage, flagged, next_action_at, next_action_note, visit_at, notes)
JOIN _ath a ON a.n = v.n;

-- Quelques favoris, pour que le bassin exerce bien l'union des trois sources.
INSERT INTO recruiter_favorites (recruiter_id, athlete_id)
SELECT c.recruiter_id, a.id FROM _cfg c JOIN _ath a ON a.n IN (1, 5, 7, 10);

-- =============================================================================
-- 6. LISTE « Espoirs 2027 » — 5 athlètes (filtre « Mes listes », panneau avancé).
-- =============================================================================
INSERT INTO recruiter_lists (id, recruiter_id, name, description, color)
SELECT 'dec0de06-0000-4000-8000-000000000001', c.recruiter_id,
       'Espoirs 2027', 'Cohorte 2027 à suivre cette saison', '#E63946'
FROM _cfg c;

INSERT INTO recruiter_list_members (list_id, athlete_id)
SELECT 'dec0de06-0000-4000-8000-000000000001', a.id
FROM _ath a WHERE a.n IN (1, 2, 5, 7, 8);

-- =============================================================================
-- 7. MATCHS À VENIR — 5, tous en Football juvénile D1 masculin.
--
--    Décompte par match = cibles du recruteur sur l'équipe hôte + celles sur
--    l'équipe visiteuse. Une équipe adverse SANS rseq_team_id de démo
--    n'apporte aucune cible : c'est ainsi qu'on obtient les petits chiffres.
--
--    ┌────────────┬─────────────────────────────────────────┬────────┐
--    │ 12 oct Lun │ St-Jean-Vianney (4) vs Jean-Eudes (3)   │ 7  ★   │  ← money shot
--    │ 16 oct Ven │ Dragons (3) vs Jean-Eudes (3)           │ 6      │
--    │ 17 oct Sam │ St-Jean-Vianney (4) vs Diablos (0)      │ 4      │
--    │ 24 oct Sam │ Phénix (0) vs Jean-Eudes (3)            │ 3  ★   │
--    │ 31 oct Sam │ Dragons (3) vs Cheetahs (0)             │ 3  ★   │
--    └────────────┴─────────────────────────────────────────┴────────┘
--
--    ★ = « Match à fort potentiel ». markHotMatches() marque le match le plus
--    dense de SA semaine ISO (plancher 2 cibles). Les 12/16/17 oct partagent
--    la semaine du 12 : seul le 7-cibles est marqué. Les 24 et 31 oct sont
--    seuls dans leur semaine, donc marqués aussi — comportement normal du
--    feature, pas un artefact du seed. Trier par « densité » met le 7 en tête.
--
--    home_team_id / visitor_team_id restent NULL : le hook ne les lit jamais.
-- =============================================================================
INSERT INTO games (
  id, rseq_game_id, game_no, season, phase, game_date, game_time,
  home_rseq_team_id, visitor_rseq_team_id, home_name_raw, visitor_name_raw,
  venue, sport, division, category, sex_type, league_name,
  is_played, is_released
)
VALUES
  ('dec0de04-0000-4000-8000-000000000001','dec0de05-0000-4000-8000-000000000001',
   'DEMO-OPT-01','2026-2027','regular', DATE '2026-10-12','13:00',
   'dec0de02-0000-4000-8000-000000000001','dec0de02-0000-4000-8000-000000000002',
   'St-Jean-Vianney','Jean-Eudes',
   'Complexe sportif Claude-Robillard, Montréal',
   'Football','D1','Juvénile','Masculin','RSEQ Montréal', false, true),

  ('dec0de04-0000-4000-8000-000000000002','dec0de05-0000-4000-8000-000000000002',
   'DEMO-OPT-02','2026-2027','regular', DATE '2026-10-16','19:30',
   'dec0de02-0000-4000-8000-000000000003','dec0de02-0000-4000-8000-000000000002',
   'Dragons de Laval','Jean-Eudes',
   'Stade du Collège Letendre, Laval',
   'Football','D1','Juvénile','Masculin','RSEQ Montréal', false, true),

  ('dec0de04-0000-4000-8000-000000000003','dec0de05-0000-4000-8000-000000000003',
   'DEMO-OPT-03','2026-2027','regular', DATE '2026-10-17','14:00',
   'dec0de02-0000-4000-8000-000000000001', NULL,
   'St-Jean-Vianney','Diablos du Richelieu',
   'Terrain du Collège St-Jean-Vianney, Montréal',
   'Football','D1','Juvénile','Masculin','RSEQ Montréal', false, true),

  ('dec0de04-0000-4000-8000-000000000004','dec0de05-0000-4000-8000-000000000004',
   'DEMO-OPT-04','2026-2027','regular', DATE '2026-10-24','12:30',
   NULL,'dec0de02-0000-4000-8000-000000000002',
   'Phénix André-Grasset','Jean-Eudes',
   'Stade André-Grasset, Montréal',
   'Football','D1','Juvénile','Masculin','RSEQ Montréal', false, true),

  ('dec0de04-0000-4000-8000-000000000005','dec0de05-0000-4000-8000-000000000005',
   'DEMO-OPT-05','2026-2027','regular', DATE '2026-10-31','11:00',
   'dec0de02-0000-4000-8000-000000000003', NULL,
   'Dragons de Laval','Cheetahs Curé-Antoine-Labelle',
   'Centre sportif Bois-de-Boulogne, Laval',
   'Football','D1','Juvénile','Masculin','RSEQ Montréal', false, true);

-- =============================================================================
-- 8. AUTOCONTRÔLE — on rejoue EXACTEMENT la chaîne du hook et on exige 7/6/4/3/3.
--    Un seed qui commit mais n'affiche rien est pire qu'un seed qui échoue.
-- =============================================================================
DO $$
DECLARE c record; r record; expected int[] := ARRAY[7,6,4,3,3]; got int[] := '{}';
BEGIN
  SELECT * INTO c FROM _cfg;
  FOR r IN
    WITH tgt AS (
      SELECT athlete_id FROM recruiter_pipeline  WHERE recruiter_id = c.recruiter_id
      UNION
      SELECT athlete_id FROM recruiter_favorites WHERE recruiter_id = c.recruiter_id
      UNION
      SELECT rlm.athlete_id FROM recruiter_list_members rlm
        JOIN recruiter_lists rl ON rl.id = rlm.list_id AND rl.recruiter_id = c.recruiter_id
    ),
    rs AS (
      SELECT DISTINCT tm.rseq_team_id
      FROM tgt JOIN athletes a ON a.id = tgt.athlete_id AND a.status = 'ACTIF'
               JOIN team_athletes ta ON ta.athlete_id = a.id
               JOIN teams tm ON tm.id = ta.team_id
      WHERE tm.rseq_team_id IS NOT NULL
    ),
    per_team AS (
      SELECT tm.rseq_team_id, count(DISTINCT a.id) AS n
      FROM tgt JOIN athletes a ON a.id = tgt.athlete_id AND a.status = 'ACTIF'
               JOIN team_athletes ta ON ta.athlete_id = a.id
               JOIN teams tm ON tm.id = ta.team_id
      WHERE tm.rseq_team_id IS NOT NULL
      GROUP BY 1
    )
    SELECT g.game_no, g.game_date,
           coalesce(h.n,0) + coalesce(v.n,0) AS cibles
    FROM games g
    LEFT JOIN per_team h ON h.rseq_team_id = g.home_rseq_team_id
    LEFT JOIN per_team v ON v.rseq_team_id = g.visitor_rseq_team_id
    WHERE g.game_date >= CURRENT_DATE
      AND (g.home_rseq_team_id IN (SELECT rseq_team_id FROM rs)
        OR g.visitor_rseq_team_id IN (SELECT rseq_team_id FROM rs))
    ORDER BY cibles DESC, g.game_date
  LOOP
    got := got || r.cibles;
    RAISE NOTICE '  % (%) -> % cibles', r.game_no, r.game_date, r.cibles;
  END LOOP;

  IF got <> expected THEN
    RAISE EXCEPTION 'Autocontrôle échoué : classement attendu %, obtenu %.', expected, got;
  END IF;
  RAISE NOTICE 'OK — money shot à 7 cibles confirmé, classement 7/6/4/3/3.';
END $$;

COMMIT;

-- =============================================================================
-- APRÈS COMMIT
--   URL     : http://localhost:3002/recruteur/calendrier
--   Compte  : recruteur@local.test / Test1234!
--   Rollback: scripts/seed-optimizer-demo-cleanup.sql
-- =============================================================================
