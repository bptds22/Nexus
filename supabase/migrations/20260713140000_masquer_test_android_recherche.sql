-- =====================================================================
-- MASQUER "Test Android" DE LA RECHERCHE RECRUTEUR -- nexus-prod
-- =====================================================================
-- Objectif : la fiche doit rester en base et le compte doit rester
-- connectable (validation du build Android), mais ne plus apparaitre
-- dans /recruteur/recherche.
--
-- Mecanisme (aucun hack, aucun nouveau champ) :
--   La policy RLS "recruiters read active athletes" sur public.athletes
--   vaut : status = 'ACTIF' AND is_recruiter().
--   Passer status a 'EN_ATTENTE' exclut donc la ligne pour TOUT recruteur
--   au niveau de la base -- pas seulement dans l'UI. Le filtre client
--   .eq("status","ACTIF") de useAthleteSearch.ts:118 le confirme cote code.
--
-- Pourquoi le login n'est PAS casse :
--   athletes.status et users.status sont DEUX colonnes distinctes.
--   - Le login + DeactivationGuard lisent users.status (inchange ici).
--   - Le portail athlete (layout.tsx:98, dashboard/page.tsx:92, profil)
--     filtre sur user_id UNIQUEMENT, sans aucun filtre de statut.
--   => le compte se connecte et voit son profil normalement.
--
-- Effet de bord assume : le roster coach filtre school_id + status='ACTIF'.
--   La fiche disparait donc du roster du club "Nexus Civil" (LIGUE_CIVILE,
--   1 coach rattache, dont Test Android est le seul athlete actif).
--   Sans consequence sur un compte de test.
--
-- Reversible : UPDATE ... SET status = 'ACTIF' sur le meme UUID.
--
-- Ciblage : par UUID de la ligne public.athletes, en dur.
--   ATTENTION : c6c679b1-7842-4907-9797-e05eefc32aad est le user_id (auth),
--   PAS l'id de la fiche. La fiche est fbf03493-03e7-4fc6-8f34-12a661440401.
--   Les garde-fous ci-dessous verifient que les deux correspondent bien.
--
-- HORS SCOPE : aucune autre ligne, aucune policy RLS, aucune colonne,
--              aucun changement frontend.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. GARDE-FOUS (avortent la transaction si la cible n'est pas la bonne)
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_athlete_id  CONSTANT uuid := 'fbf03493-03e7-4fc6-8f34-12a661440401';
  v_user_id     CONSTANT uuid := 'c6c679b1-7842-4907-9797-e05eefc32aad';
  v_email       CONSTANT text := 'nexus.athc@nexussports.ca';
  v_row         public.athletes%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.athletes WHERE id = v_athlete_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'GARDE-FOU: athlete % introuvable -- ARRET', v_athlete_id;
  END IF;

  -- La fiche doit bien etre celle du compte auth annonce.
  IF v_row.user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'GARDE-FOU: user_id % attendu, % trouve -- ARRET', v_user_id, v_row.user_id;
  END IF;

  IF lower(v_row.email) IS DISTINCT FROM v_email THEN
    RAISE EXCEPTION 'GARDE-FOU: email % attendu, % trouve -- ARRET', v_email, v_row.email;
  END IF;

  -- On part bien d'un etat ACTIF (sinon la base a change depuis le diagnostic).
  IF v_row.status <> 'ACTIF' THEN
    RAISE EXCEPTION 'GARDE-FOU: status attendu ACTIF, % trouve -- ARRET', v_row.status;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2. Le changement : une seule ligne, une seule colonne.
-- ---------------------------------------------------------------------
UPDATE public.athletes
SET    status = 'EN_ATTENTE'
WHERE  id = 'fbf03493-03e7-4fc6-8f34-12a661440401';

-- ---------------------------------------------------------------------
-- 3. VERIFICATION FINALE. Sinon, rollback.
-- ---------------------------------------------------------------------
DO $$
DECLARE
  v_status    text;
  v_user_id   uuid;
  v_collateral int;
BEGIN
  SELECT status, user_id INTO v_status, v_user_id
  FROM public.athletes WHERE id = 'fbf03493-03e7-4fc6-8f34-12a661440401';

  IF v_status <> 'EN_ATTENTE' THEN
    RAISE EXCEPTION 'VERIF: status = % au lieu de EN_ATTENTE -- ROLLBACK', v_status;
  END IF;

  -- Le lien vers le compte auth doit etre INTACT (sinon le login casse).
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'VERIF: user_id perdu -- ROLLBACK';
  END IF;

  -- Aucune autre ligne ne doit avoir quitte le statut ACTIF.
  -- Avant : 5 athletes = 4 ACTIF + 1 SUPPRIME (tombstone Loi 25).
  -- Apres : 5 athletes = 3 ACTIF + 1 EN_ATTENTE + 1 SUPPRIME.
  SELECT count(*) INTO v_collateral
  FROM public.athletes
  WHERE status = 'ACTIF';
  IF v_collateral <> 3 THEN
    RAISE EXCEPTION 'VERIF: % athletes ACTIF au lieu de 3 -- ROLLBACK', v_collateral;
  END IF;

  RAISE NOTICE 'OK : Test Android passe en EN_ATTENTE, compte auth intact.';
END $$;

COMMIT;
