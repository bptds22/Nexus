-- =====================================================================
-- PURGE DE 2 FICHES ATHLETES SUPPLEMENTAIRES -- nexus-prod
-- =====================================================================
-- Contexte : suite a la migration 20260712220000 (19 -> 7 athletes),
-- Bruno confirme (2026-07-13) la suppression de 2 des 7 lignes restantes.
-- Ces 2 fiches etaient conservees "par prudence" lors du premier passage
-- (possible personne reelle) ; la decision est maintenant prise.
--
-- Aucune des 2 n'a de compte auth.users associe (verifie : athletes.user_id
-- IS NULL, et aucune ligne auth.users pour ces 2 emails).
-- AUCUNE suppression dans auth.users n'est requise ni effectuee ici.
--
-- Backup prealable :
--   nexus-backups/backup-athletes-2fiches_20260713.sql
--   (2 athletes + 3 lignes dependantes, restaurable via psql -f)
--
-- Ciblage : par UUID explicite UNIQUEMENT. Aucun pattern sur nom/email.
--
-- HORS SCOPE -- explicitement conserves (validation Bruno, 2026-07-13) :
--   28b60cc8-eef3-4da5-878c-f1e95c8573cd  Cardin Ndokay
--   473878d6-e178-478f-84a2-7977766eccb3  Louis-Thomas Tremblay
--   0684b5ff-c5f8-4c77-b442-b26cfe41d7fa  profil athlete de bptds22 (compte admin)
--   fbf03493-03e7-4fc6-8f34-12a661440401  Test Android (soumission Android a venir)
--   f89beb81-d9d5-4e8e-a2bd-fb1b5a40da8d  tombstone [supprime] (preuve Loi 25)
--   storage.objects (avatars) -- chantier separe
--
-- Attendu : public.athletes passe de 7 a 5 lignes.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Liste de travail : les 2 UUID cibles, en dur.
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _purge_cibles (athlete_id uuid PRIMARY KEY) ON COMMIT DROP;

INSERT INTO _purge_cibles (athlete_id) VALUES
  ('fc8a848c-c80e-4d77-9969-a9e51082b9b5'), -- nom vide / tzf2t487t5@privaterelay.appleid.com
  ('95ff43de-0506-41c3-83c4-fbacfefed213'); -- "Mathieu royal" / mathieuroyal196@gmail.com

-- ---------------------------------------------------------------------
-- 1. GARDE-FOUS
--
--     REJOUABILITE (ajout 2026-08-25) -- le contenu enregistre dans
--     supabase_migrations.schema_migrations n'est PAS modifie par cette
--     edition : seul le depot bouge. La prod a execute la version d'origine
--     le 2026-07-13 et n'y repassera jamais.
--
--     Cette migration cible des lignes relevees par un audit de PRODUCTION.
--     Sur une base recreee (supabase db reset) elles n'existent pas, et la
--     version d'origine levait -- rendant tout rejeu impossible. Desormais :
--     cible absente -> NO-OP annonce par RAISE NOTICE ; cible presente ->
--     comportement d'origine, garde-fous inchanges ; etat inattendu ->
--     EXCEPTION, car c'est la le vrai signal d'anomalie.
--     UUID et trace d'audit intacts.
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _purge_mode (actif boolean NOT NULL) ON COMMIT DROP;

DO $$
DECLARE
  v_cibles      int;
  v_existants   int;
  v_avec_compte int;
  v_proteges    int;
BEGIN
  SELECT count(*) INTO v_cibles FROM _purge_cibles;
  IF v_cibles <> 2 THEN
    RAISE EXCEPTION 'GARDE-FOU: % UUID cibles au lieu de 2', v_cibles;
  END IF;

  -- Les 2 doivent tous exister (sinon la base a change depuis l'audit).
  SELECT count(*) INTO v_existants
  FROM public.athletes a JOIN _purge_cibles c ON c.athlete_id = a.id;

  IF v_existants = 0 THEN
    INSERT INTO _purge_mode (actif) VALUES (false);
    RAISE NOTICE 'PURGE IGNOREE : aucune des 2 cibles de l''audit 2026-07-13 n''est presente. Base recreee ou purge deja effectuee -- no-op.';
    RETURN;
  END IF;

  IF v_existants <> 2 THEN
    RAISE EXCEPTION 'GARDE-FOU: % athletes cibles trouves au lieu de 2 ou 0 -- purge PARTIELLE, anomalie reelle, ARRET', v_existants;
  END IF;

  INSERT INTO _purge_mode (actif) VALUES (true);

  -- Aucune cible ne doit avoir de compte auth : ce sont des orphelins.
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
    '28b60cc8-eef3-4da5-878c-f1e95c8573cd', -- Cardin Ndokay
    '473878d6-e178-478f-84a2-7977766eccb3', -- Louis-Thomas Tremblay
    '0684b5ff-c5f8-4c77-b442-b26cfe41d7fa', -- profil athlete bptds22
    'fbf03493-03e7-4fc6-8f34-12a661440401', -- Test Android (nexus.athc)
    'f89beb81-d9d5-4e8e-a2bd-fb1b5a40da8d'  -- tombstone Loi 25
  );
  IF v_proteges <> 0 THEN
    RAISE EXCEPTION 'GARDE-FOU: % ligne(s) protegee(s) presente(s) dans la liste de purge -- ARRET', v_proteges;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2. Purge des 4 tables en ON DELETE NO ACTION.
--    Sans ca, le DELETE de l'etape 3 echoue sur violation de FK.
--    Etat au 2026-07-13 : seule recruiter_athlete_views a 1 ligne
--    (vue du profil fc8a848c par le recruteur nexus.recruteur).
--    On retire seulement SON lien vers la fiche, pas son compte.
-- ---------------------------------------------------------------------
DELETE FROM public.recruiter_favorites      WHERE athlete_id IN (SELECT athlete_id FROM _purge_cibles);
DELETE FROM public.recruiter_pipeline       WHERE athlete_id IN (SELECT athlete_id FROM _purge_cibles);
DELETE FROM public.recruiter_athlete_views  WHERE athlete_id IN (SELECT athlete_id FROM _purge_cibles);
DELETE FROM public.recruiter_notes          WHERE athlete_id IN (SELECT athlete_id FROM _purge_cibles);

-- ---------------------------------------------------------------------
-- 3. Suppression des 2 athletes.
--    Les 22 tables enfants en ON DELETE CASCADE suivent automatiquement.
--    Concretement au 2026-07-13, 2 lignes tombent en cascade :
--      team_invitations        1 (invitation PENDING de 95ff43de)
--      recruiter_activity_log  1 (PROFILE_VIEWED sur fc8a848c)
--    coach_reviews.athlete_id est en ON DELETE SET NULL (0 ligne concernee).
-- ---------------------------------------------------------------------
DELETE FROM public.athletes WHERE id IN (SELECT athlete_id FROM _purge_cibles);

-- ---------------------------------------------------------------------
-- 4. VERIFICATION FINALE : 7 - 2 = 5. Sinon, rollback.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_restants int;
  v_zombies  int;
BEGIN
  IF NOT (SELECT actif FROM _purge_mode) THEN
    RAISE NOTICE 'VERIFICATION IGNOREE : purge en mode no-op.';
    RETURN;
  END IF;

  SELECT count(*) INTO v_restants FROM public.athletes;
  IF v_restants <> 5 THEN
    RAISE EXCEPTION 'VERIF: % athletes restants au lieu de 5 -- ROLLBACK', v_restants;
  END IF;

  SELECT count(*) INTO v_zombies
  FROM public.athletes a JOIN _purge_cibles c ON c.athlete_id = a.id;
  IF v_zombies <> 0 THEN
    RAISE EXCEPTION 'VERIF: % athlete(s) cible(s) survivant(s) -- ROLLBACK', v_zombies;
  END IF;

  RAISE NOTICE 'PURGE OK : 2 fiches athletes supprimees, 5 athletes conserves.';
END $$;

COMMIT;
