-- =====================================================================
-- PURGE DES ATHLETES DE TEST -- nexus-prod
-- =====================================================================
-- Contexte : 12 lignes public.athletes creees pendant les tests
-- d'onboarding (juillet 2026). Aucune n'a de compte auth.users associe :
-- ce sont des athletes creees par un coach, jamais reclames.
-- Aucune suppression dans auth.users n'est requise ni effectuee ici.
--
-- Backup prealable :
--   nexus-backups/backup-athletes-test_20260712-220003.sql
--   (55 INSERT, 16 athletes + toutes dependances, restaurable via psql -f)
--
-- Ciblage : par UUID explicite UNIQUEMENT. Aucun pattern sur nom/email.
--
-- HORS SCOPE -- explicitement conserves (validation Bruno, 2026-07-12) :
--   fc8a848c-c80e-4d77-9969-a9e51082b9b5  privaterelay.appleid.com (possible mineur reel)
--   95ff43de-0506-41c3-83c4-fbacfefed213  "Mathieu royal" (possible personne reelle)
--   f89beb81-d9d5-4e8e-a2bd-fb1b5a40da8d  tombstone [supprime] (preuve Loi 25)
--   0684b5ff-c5f8-4c77-b442-b26cfe41d7fa  profil athlete de bptds22 (compte admin)
--   28b60cc8 Cardin Ndokay / 473878d6 Louis-Thomas Tremblay / fbf03493 Test Android
--   storage.objects (avatars) -- chantier separe
--
-- Attendu : public.athletes passe de 19 a 7 lignes.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Liste de travail : les 12 UUID cibles, en dur.
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _purge_cibles (athlete_id uuid PRIMARY KEY) ON COMMIT DROP;

INSERT INTO _purge_cibles (athlete_id) VALUES
  ('f99b4b72-16b5-4d23-8db9-67c76530249c'), -- "sd dsad"                / 6@gmail.com
  ('d85d2308-88b2-453b-9591-e9884478278e'), -- "dsds dasd"              / test-civil-cas1@nexustest.ca
  ('00572ec4-4d38-4927-bacc-6f932d8b6396'), -- "dasd sada"              / tco4ss@gmail.com
  ('05eb365b-0567-4abb-9018-26aa6ed25916'), -- "dsadcvcvxcv asdasd"     / sadsadasfgdsafdfs@gmail.com
  ('83223486-7a50-4d81-82c1-24275e89e9a8'), -- "dasdsadwsdsd asdasdas"  / sadsadasdasdasdfgdsafdfs@gmail.com
  ('03ff8a93-c2fb-4767-ab2b-02b17be3c0e2'), -- "sadsad sadasd"          / dasdsda@gmail.com
  ('bd5f9e62-00ab-4532-8fff-9593695b7bc5'), -- "sdsad dsasdsa"          / testandroind@gmail.com
  ('fb65fd04-cee2-4654-94b7-e982e8505167'), -- "Bruno-Philippe Simard"  / bpdesdadsa@gmail.com
  ('ae73c6d3-8559-40f5-b01b-335c1e2c38fa'), -- "Bruno-Philippe Simard"  / bptds17@gmail.com
  ('b6c46253-b969-48df-9803-ac3f154d36ab'), -- "Bruno-Philippe Simard"  / bptds17@gmail.com
  ('19aca67f-7c83-4d8e-8525-87cb3718bd18'), -- "Bruno-Philippe Simard"  / mathieuroyal196@gmail.com
  ('8a90951c-8592-4c53-962a-815ea064dc33'); -- "Bruno-Philippe Simard"  / bpdesfosses@gmail.com

-- ---------------------------------------------------------------------
-- 1. GARDE-FOUS
--
--     REJOUABILITE (ajout 2026-08-25) -- le contenu enregistre dans
--     supabase_migrations.schema_migrations n'est PAS modifie par cette
--     edition : seul le depot bouge. La prod a deja execute la version
--     d'origine le 2026-07-12 et n'y repassera jamais.
--
--     Cette migration ciblait 12 UUID releves par un audit de PRODUCTION.
--     Sur une base recreee de zero (supabase db reset), ces 12 lignes
--     n'existent pas : la version d'origine levait, ce qui rendait TOUT
--     rejeu impossible -- le depot ne pouvait plus reconstruire une base
--     locale, et les 142 migrations suivantes restaient inatteignables.
--
--     Trois cas, desormais :
--       12 trouves -> purge normale, garde-fous d'origine inchanges
--        0 trouve   -> NO-OP annonce par RAISE NOTICE (base neuve : la
--                      purge n'a rien a faire, son role historique est
--                      rempli en prod)
--       autre       -> EXCEPTION. C'est le cas qui doit alerter : une
--                      purge partielle signale une vraie anomalie.
--
--     Les 12 UUID et les 7 lignes protegees restent en dur, intacts,
--     pour la trace d'audit.
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _purge_mode (actif boolean NOT NULL) ON COMMIT DROP;

DO $$
DECLARE
  v_cibles     int;
  v_existants  int;
  v_avec_compte int;
  v_proteges   int;
BEGIN
  SELECT count(*) INTO v_cibles FROM _purge_cibles;
  IF v_cibles <> 12 THEN
    RAISE EXCEPTION 'GARDE-FOU: % UUID cibles au lieu de 12', v_cibles;
  END IF;

  -- Combien des 12 cibles sont reellement presentes ?
  SELECT count(*) INTO v_existants
  FROM public.athletes a JOIN _purge_cibles c ON c.athlete_id = a.id;

  IF v_existants = 0 THEN
    -- Base recreee : rien a purger. On l'annonce et on sort.
    INSERT INTO _purge_mode (actif) VALUES (false);
    RAISE NOTICE 'PURGE IGNOREE : aucune des 12 cibles de l''audit 2026-07-12 n''est presente. Base recreee ou purge deja effectuee -- no-op.';
    RETURN;
  END IF;

  IF v_existants <> 12 THEN
    RAISE EXCEPTION 'GARDE-FOU: % athletes cibles trouves au lieu de 12 ou 0 -- purge PARTIELLE, anomalie reelle, ARRET', v_existants;
  END IF;

  INSERT INTO _purge_mode (actif) VALUES (true);

  -- Aucune cible ne doit avoir de compte auth : ce sont des orphelins coach.
  SELECT count(*) INTO v_avec_compte
  FROM public.athletes a JOIN _purge_cibles c ON c.athlete_id = a.id
  WHERE a.user_id IS NOT NULL;
  IF v_avec_compte <> 0 THEN
    RAISE EXCEPTION 'GARDE-FOU: % athlete(s) cible(s) possede(nt) un compte auth -- ARRET', v_avec_compte;
  END IF;

  -- Aucune ligne explicitement protegee ne doit se trouver dans la liste.
  SELECT count(*) INTO v_proteges
  FROM _purge_cibles
  WHERE athlete_id IN (
    'fc8a848c-c80e-4d77-9969-a9e51082b9b5', -- privaterelay Apple
    '95ff43de-0506-41c3-83c4-fbacfefed213', -- Mathieu royal
    'f89beb81-d9d5-4e8e-a2bd-fb1b5a40da8d', -- tombstone Loi 25
    '0684b5ff-c5f8-4c77-b442-b26cfe41d7fa', -- profil athlete bptds22
    '28b60cc8-eef3-4da5-878c-f1e95c8573cd', -- Cardin Ndokay
    '473878d6-e178-478f-84a2-7977766eccb3', -- Louis-Thomas Tremblay
    'fbf03493-03e7-4fc6-8f34-12a661440401'  -- Test Android (nexus.athc)
  );
  IF v_proteges <> 0 THEN
    RAISE EXCEPTION 'GARDE-FOU: % ligne(s) protegee(s) presente(s) dans la liste de purge -- ARRET', v_proteges;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2. Purge des 4 tables en ON DELETE NO ACTION.
--    Sans ca, le DELETE de l'etape 3 echoue sur violation de FK.
--    Concerne surtout ae73c6d3 et 8a90951c (favoris + pipeline + vue).
--    Ces lignes appartiennent au recruteur nexus.recruteur (compte reel) :
--    on retire seulement SON lien vers un faux athlete, pas son compte.
-- ---------------------------------------------------------------------
DELETE FROM public.recruiter_favorites      WHERE athlete_id IN (SELECT athlete_id FROM _purge_cibles);
DELETE FROM public.recruiter_pipeline       WHERE athlete_id IN (SELECT athlete_id FROM _purge_cibles);
DELETE FROM public.recruiter_athlete_views  WHERE athlete_id IN (SELECT athlete_id FROM _purge_cibles);
DELETE FROM public.recruiter_notes          WHERE athlete_id IN (SELECT athlete_id FROM _purge_cibles);

-- ---------------------------------------------------------------------
-- 3. Suppression des 12 athletes.
--    Les 22 tables enfants en ON DELETE CASCADE suivent automatiquement :
--    evaluations, activities, athlete_invitations, athlete_notifications,
--    athlete_suggestions, newsroom_events, team_athletes, team_invitations,
--    recruiter_activity_log, recruiter_list_members, parental_consents,
--    consent_audit_trail, profile_changes, custom_distinctions, etc.
-- ---------------------------------------------------------------------
DELETE FROM public.athletes WHERE id IN (SELECT athlete_id FROM _purge_cibles);

-- ---------------------------------------------------------------------
-- 4. VERIFICATION FINALE : 19 - 12 = 7. Sinon, rollback.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_restants int;
  v_zombies  int;
BEGIN
  -- En mode no-op, les comptes d'origine (19 -> 7) n'ont aucun sens.
  IF NOT (SELECT actif FROM _purge_mode) THEN
    RAISE NOTICE 'VERIFICATION IGNOREE : purge en mode no-op.';
    RETURN;
  END IF;

  SELECT count(*) INTO v_restants FROM public.athletes;
  IF v_restants <> 7 THEN
    RAISE EXCEPTION 'VERIF: % athletes restants au lieu de 7 -- ROLLBACK', v_restants;
  END IF;

  SELECT count(*) INTO v_zombies
  FROM public.athletes a JOIN _purge_cibles c ON c.athlete_id = a.id;
  IF v_zombies <> 0 THEN
    RAISE EXCEPTION 'VERIF: % athlete(s) cible(s) survivant(s) -- ROLLBACK', v_zombies;
  END IF;

  RAISE NOTICE 'PURGE OK : 12 athletes de test supprimes, 7 athletes conserves.';
END $$;

COMMIT;
