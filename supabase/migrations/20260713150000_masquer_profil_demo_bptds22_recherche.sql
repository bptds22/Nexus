-- =====================================================================
-- MASQUER LE PROFIL DEMO "Bruno-Philippe Simard" (bptds22) DE LA
-- RECHERCHE RECRUTEUR -- nexus-prod
-- =====================================================================
-- Objectif : profil de demo conserve en base, compte ADMIN toujours
-- connectable, mais la fiche ne doit plus apparaitre dans
-- /recruteur/recherche.
--
-- Meme mecanisme que 20260713140000 (Test Android) :
--   La policy RLS "recruiters read active athletes" sur public.athletes
--   vaut : status = 'ACTIF' AND is_recruiter().
--   Passer status a 'EN_ATTENTE' exclut la ligne pour TOUT recruteur au
--   niveau base -- pas seulement dans l'UI. Le filtre client
--   .eq("status","ACTIF") de useAthleteSearch.ts:118 le confirme cote code.
--
-- Pourquoi le login ADMIN n'est PAS casse :
--   athletes.status et users.status sont DEUX colonnes distinctes.
--   - Le login + DeactivationGuard lisent users.status (= ACTIF, inchange).
--   - users.role = ADMIN et users.is_platform_admin = true : inchanges.
--   - Le portail athlete (layout.tsx:98, dashboard/page.tsx:92, profil)
--     filtre sur user_id UNIQUEMENT, sans aucun filtre de statut.
--   => le compte se connecte et voit son profil normalement.
--
-- Reversible : UPDATE ... SET status = 'ACTIF' sur le meme UUID.
--
-- Ciblage : par la PK de la ligne public.athletes, en dur.
--   PK fiche : 0684b5ff-c5f8-4c77-b442-b26cfe41d7fa
--   user_id  : f51384b5-a2c2-4827-9137-8aa8d29a1fe0  (assertion, PAS la cible)
--   email    : bptds22@gmail.com                     (assertion, PAS la cible)
--
-- HORS SCOPE : aucune autre ligne, aucune policy RLS, aucune colonne,
--              aucun changement frontend.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. GARDE-FOUS
--
--     REJOUABILITE (ajout 2026-08-25) -- le contenu enregistre dans
--     supabase_migrations.schema_migrations n'est PAS modifie par cette
--     edition : seul le depot bouge. La prod a execute la version d'origine
--     le 2026-07-13 et n'y repassera jamais.
--
--     Cette migration cible UNE fiche relevee par un audit de PRODUCTION.
--     Sur une base recreee (supabase db reset) elle n'existe pas, et la
--     version d'origine levait -- rendant tout rejeu impossible. Desormais :
--     fiche absente -> NO-OP annonce par RAISE NOTICE ; fiche presente ->
--     comportement d'origine, garde-fous inchanges (user_id, email et status
--     toujours verifies) ; etat inattendu -> EXCEPTION.
--     UUID et trace d'audit intacts.
-- ---------------------------------------------------------------------
CREATE TEMP TABLE _masque_mode (actif boolean NOT NULL) ON COMMIT DROP;

DO $$
DECLARE
  v_athlete_id  CONSTANT uuid := '0684b5ff-c5f8-4c77-b442-b26cfe41d7fa';
  v_user_id     CONSTANT uuid := 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0';
  v_email       CONSTANT text := 'bptds22@gmail.com';
  v_row         public.athletes%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.athletes WHERE id = v_athlete_id;

  IF NOT FOUND THEN
    INSERT INTO _masque_mode (actif) VALUES (false);
    RAISE NOTICE 'MASQUAGE IGNORE : athlete % absent (base recreee) -- no-op.', v_athlete_id;
    RETURN;
  END IF;

  INSERT INTO _masque_mode (actif) VALUES (true);

  -- La fiche doit bien etre celle du compte auth annonce.
  IF v_row.user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'GARDE-FOU: user_id % attendu, % trouve -- ARRET', v_user_id, v_row.user_id;
  END IF;

  IF lower(v_row.email) IS DISTINCT FROM v_email THEN
    RAISE EXCEPTION 'GARDE-FOU: email % attendu, % trouve -- ARRET', v_email, v_row.email;
  END IF;

  -- On part bien d'un etat ACTIF (sinon la base a change depuis l'audit).
  IF v_row.status <> 'ACTIF' THEN
    RAISE EXCEPTION 'GARDE-FOU: status attendu ACTIF, % trouve -- ARRET', v_row.status;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2. Le changement : une seule ligne, une seule colonne.
-- ---------------------------------------------------------------------
UPDATE public.athletes
SET    status = 'EN_ATTENTE'
WHERE  id = '0684b5ff-c5f8-4c77-b442-b26cfe41d7fa'
  AND  (SELECT actif FROM _masque_mode);

-- ---------------------------------------------------------------------
-- 3. VERIFICATION FINALE. Sinon, rollback.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_status     text;
  v_user_id    uuid;
  v_collateral int;
BEGIN
  IF NOT (SELECT actif FROM _masque_mode) THEN
    RAISE NOTICE 'VERIFICATION IGNOREE : masquage en mode no-op.';
    RETURN;
  END IF;

  SELECT status, user_id INTO v_status, v_user_id
  FROM public.athletes WHERE id = '0684b5ff-c5f8-4c77-b442-b26cfe41d7fa';

  IF v_status <> 'EN_ATTENTE' THEN
    RAISE EXCEPTION 'VERIF: status = % au lieu de EN_ATTENTE -- ROLLBACK', v_status;
  END IF;

  -- Le lien vers le compte auth doit etre INTACT (sinon le login ADMIN casse).
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'VERIF: user_id perdu -- ROLLBACK';
  END IF;

  -- Aucune autre ligne ne doit avoir quitte le statut ACTIF.
  -- Avant : 5 athletes = 3 ACTIF + 1 EN_ATTENTE (Test Android) + 1 SUPPRIME.
  -- Apres : 5 athletes = 2 ACTIF + 2 EN_ATTENTE            + 1 SUPPRIME.
  SELECT count(*) INTO v_collateral FROM public.athletes WHERE status = 'ACTIF';
  IF v_collateral <> 2 THEN
    RAISE EXCEPTION 'VERIF: % athletes ACTIF au lieu de 2 -- ROLLBACK', v_collateral;
  END IF;

  RAISE NOTICE 'OK : profil demo bptds22 passe en EN_ATTENTE, compte ADMIN intact.';
END $$;

COMMIT;
