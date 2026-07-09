-- ════════════════════════════════════════════════════════════════════════
--  delete_my_account — Suppression de compte (Loi 25, option B : anonymisation
--  sur place de la fiche athlète + conservation de la preuve de consentement).
--
--  L'appelant supprime TOUJOURS son propre compte : la RPC est keyée sur
--  auth.uid() à l'intérieur, sans paramètre user_id.
--
--  NE PAS exécuter sur la prod. À valider puis tester sur branche preview.
-- ════════════════════════════════════════════════════════════════════════

-- PRÉREQUIS : la valeur d'enum account_status.'SUPPRIME' (référencée par la
-- fonction créée plus bas) est ajoutée par la migration ANTÉRIEURE
-- 20260626115900_account_status_suppr.sql. Comme cette valeur est commitée et
-- visible avant ce fichier, CREATE FUNCTION peut valider 'SUPPRIME'::account_status
-- normalement — pas besoin de SET check_function_bodies = off ici.

-- ═══════════════════════ PARTIE 1 — DDL (2 changements) ═══════════════════

-- (1a — ADD VALUE 'SUPPRIME' — déplacé dans 20260626115900_account_status_suppr.sql)

-- 1b. deletion_requests.user_id : nullable + ON DELETE SET NULL.
--     Garde l'audit Loi 25 (qui/quoi/quand) après suppression du compte :
--     la ligne survit avec user_id=NULL au lieu de bloquer (RESTRICT) ou
--     d'être supprimée. Cohérent avec completed_by (déjà nullable + SET NULL).
ALTER TABLE public.deletion_requests
  ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.deletion_requests
  DROP CONSTRAINT deletion_requests_user_id_fkey;
ALTER TABLE public.deletion_requests
  ADD CONSTRAINT deletion_requests_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- 1c. parental_consents.coach_id : nullable + ON DELETE SET NULL.
--     Un coach qui se supprime ne doit PAS détruire les consentements
--     attestés (preuve des ATHLÈTES). On détache le coach, on garde la preuve.
--     Cohérent avec consent_audit_trail.coach_id (déjà nullable + SET NULL).
ALTER TABLE public.parental_consents
  ALTER COLUMN coach_id DROP NOT NULL;
ALTER TABLE public.parental_consents
  DROP CONSTRAINT parental_consents_coach_id_fkey;
ALTER TABLE public.parental_consents
  ADD CONSTRAINT parental_consents_coach_id_fkey
  FOREIGN KEY (coach_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- ═══════════════════════ PARTIE 2 — RPC delete_my_account ═════════════════

CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_athlete_id uuid;
BEGIN
  -- Garde : on supprime TOUJOURS l'appelant. Jamais de paramètre user_id.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'delete_my_account: aucun utilisateur authentifié (auth.uid() est NULL)';
  END IF;

  -- Fiche athlète liée à l'appelant. NULL pour un coach/recruteur, ou un
  -- athlète créé par un coach (jamais réclamé). Toute la branche B/C est gardée.
  SELECT id INTO v_athlete_id FROM athletes WHERE user_id = v_uid;

  -- ───────────────────────────────────────────────────────────────────────
  -- A. Audit Loi 25 : marquer la demande de suppression COMPLETED AVANT purge.
  --    Grâce à 1b, user_id passera en SET NULL au DELETE final → la ligne
  --    d'audit survit, anonymisée (scope/status/dates conservés).
  -- ───────────────────────────────────────────────────────────────────────
  UPDATE deletion_requests
     SET status = 'COMPLETED', completed_at = now(), updated_at = now()
   WHERE user_id = v_uid;

  IF v_athlete_id IS NOT NULL THEN
    -- ─────────────────────────────────────────────────────────────────────
    -- B. Appelant ATHLÈTE : purge des FK NO ACTION → athletes AVANT l'UPDATE.
    --    Débloque les FK ET évite que log_athlete_update (déclenché par le
    --    scrub de video_faits_saillants_url) insère des lignes parasites
    --    chez les recruteurs ayant favorisé (le SELECT ... FROM
    --    recruiter_favorites renverra alors 0 ligne).
    -- ─────────────────────────────────────────────────────────────────────
    DELETE FROM recruiter_favorites     WHERE athlete_id = v_athlete_id;
    DELETE FROM recruiter_notes         WHERE athlete_id = v_athlete_id;
    DELETE FROM recruiter_pipeline      WHERE athlete_id = v_athlete_id;
    DELETE FROM recruiter_athlete_views WHERE athlete_id = v_athlete_id;

    -- ─────────────────────────────────────────────────────────────────────
    -- C. ANONYMISER la fiche athlète SUR PLACE (pas de DELETE : la preuve de
    --    consentement cascade depuis athletes, il faut donc garder la ligne).
    --
    --    partner_visibility_opt_in=false neutralise emit_five_star_on_eligibility_flip
    --    (is_partner_eligible_athlete → false) → AUCUN événement newsroom, même
    --    avec date_naissance modifiée.
    --
    --    NE PAS toucher : verified*, cote_globale_entraineur, recruitment_status*,
    --    consent_id, consentement_parental* (preuve), sport_id/position_id/equipe/
    --    ligue (structurel, non-PII) — pour ne déclencher aucun trigger newsroom.
    -- ─────────────────────────────────────────────────────────────────────
    UPDATE athletes SET
      -- Identité (first/last NOT NULL → placeholder ; le reste → NULL)
      first_name = '[supprimé]',
      last_name  = '[supprimé]',
      date_naissance = NULL,
      genre = NULL,
      email = NULL,                 -- bloque aussi l'orphan-claim (RLS email match)
      telephone = NULL,
      photo_url = NULL,
      bio = NULL,
      -- Parent / tuteur
      nom_parent = NULL,
      telephone_parent = NULL,
      parent_first_name = NULL,
      parent_last_name = NULL,
      parent_email = NULL,
      parent_relationship = NULL,
      -- Identifiants / texte libre
      numero_association = NULL,
      numero_jersey = NULL,
      notes_coach = NULL,
      programme_interet = NULL,
      -- Médias / réseaux (rattachables à l'identité)
      video_faits_saillants_url = NULL,
      video_match_complet_url = NULL,
      video_entrainement_url = NULL,
      hudl_url = NULL,
      youtube_url = NULL,
      instagram_url = NULL,
      -- Scolaire (données personnelles)
      moyenne_generale = NULL,
      annee_diplomation = NULL,
      matieres_fortes = NULL,
      mentions_academiques = NULL,
      programme_cegep_vise = NULL,
      regions_cegep_preferees = NULL,
      -- Biométrie / mensurations / tests
      taille_pieds = NULL,
      taille_pouces = NULL,
      poids_lbs = NULL,
      envergure = NULL,
      taille_mains = NULL,
      main_dominante = NULL,
      pied_dominant = NULL,
      test_40_verges = NULL,
      saut_vertical = NULL,
      saut_longueur = NULL,
      developpe_couche = NULL,
      navette_agilite = NULL,
      sprint_100m = NULL,
      -- Liens (bloquent claim coach/athlète + détachent)
      coach_id = NULL,
      school_id = NULL,
      committed_school_id = NULL,
      user_id = NULL,               -- redondant avec le SET NULL du cascade final
      -- Visibilité partenaire (neutralise le trigger five_star + retrait Loi 25)
      partner_visibility_opt_in = false,
      partner_visibility_parental_consent = false,
      partner_visibility_opted_in_at = NULL,
      -- Statut terminal (RLS recruteur exige status='ACTIF' → exclut la recherche)
      status = 'SUPPRIME'
    WHERE id = v_athlete_id;
  END IF;

  -- ───────────────────────────────────────────────────────────────────────
  -- D. Purge des FK RESTRICT / NO ACTION → users et → auth.users qui
  --    bloqueraient le DELETE auth.users (et le cascade vers public.users).
  --    Données possédées par l'appelant → DELETE. Références « acteur » sur
  --    des enregistrements partagés/globaux (colonne nullable) → SET NULL.
  -- ───────────────────────────────────────────────────────────────────────
  -- Messagerie : messages.sender_id RESTRICT ; messages.conversation_id CASCADE.
  DELETE FROM messages      WHERE sender_id = v_uid;
  DELETE FROM conversations WHERE coach_id = v_uid OR recruiter_id = v_uid; -- cascade messages restants

  -- Évaluations / avis / suggestions / pipeline / signalements (RESTRICT → users)
  DELETE FROM evaluations         WHERE coach_id = v_uid;
  DELETE FROM coach_reviews       WHERE coach_id = v_uid OR recruiter_id = v_uid;
  DELETE FROM athlete_suggestions WHERE coach_id = v_uid OR submitted_by = v_uid;
  DELETE FROM pipeline            WHERE recruiter_id = v_uid;
  DELETE FROM reports             WHERE reported_user_id = v_uid;

  -- Requêtes dont la colonne acteur est NOT NULL → DELETE la ligne entière.
  DELETE FROM admin_transfer_requests WHERE from_user_id = v_uid OR to_user_id = v_uid;
  DELETE FROM commitment_requests     WHERE requested_by = v_uid;

  -- Références « acteur » nullable sur des enregistrements partagés → SET NULL
  -- (on NE supprime PAS le réglage global / le partenaire / la fiche d'autrui).
  UPDATE app_settings   SET updated_by  = NULL WHERE updated_by  = v_uid;
  UPDATE media_partners SET approved_by = NULL WHERE approved_by = v_uid;
  UPDATE athletes       SET recruitment_status_changed_by = NULL
                        WHERE recruitment_status_changed_by = v_uid;

  -- Recruteur : FK NO ACTION → auth.users (par recruiter_id) bloquant le DELETE.
  DELETE FROM recruiter_favorites     WHERE recruiter_id = v_uid;
  DELETE FROM recruiter_notes         WHERE recruiter_id = v_uid;
  DELETE FROM recruiter_pipeline      WHERE recruiter_id = v_uid;
  DELETE FROM recruiter_athlete_views WHERE recruiter_id = v_uid;

  -- NB : parental_consents.coach_id et consent_audit_trail.coach_id passent
  --      AUTOMATIQUEMENT en SET NULL au DELETE de public.users (1c + existant).
  --      On ne les supprime PAS : c'est la preuve de consentement des athlètes.

  -- ───────────────────────────────────────────────────────────────────────
  -- E. (Défense-en-profondeur) Scrub PII de public.users AVANT le delete.
  --    Techniquement redondant (la ligne cascade-disparaît en F), mais sûr
  --    si jamais le DELETE final était différé/empêché en aval.
  -- ───────────────────────────────────────────────────────────────────────
  UPDATE users SET
    email = 'deleted-' || v_uid::text || '@deleted.invalid',  -- NOT NULL → placeholder
    first_name = NULL,
    last_name = NULL,
    phone = NULL,
    avatar_url = NULL,
    photo_url = NULL,
    date_naissance = NULL,
    title = NULL,
    team_name = NULL,
    division = NULL,
    sport = NULL,
    region = NULL,
    profile_data = NULL,
    recruitment_preferences = NULL,
    notification_preferences = NULL,
    privacy_preferences = NULL
  WHERE id = v_uid;

  -- ───────────────────────────────────────────────────────────────────────
  -- F. Suppression du compte auth. Cascade : public.users + auth.identities +
  --    auth.sessions + tous les auth.* + les SET NULL → users restants
  --    (athletes.coach_id/user_id/verified_by, consent_audit_trail.coach_id,
  --     parental_consents.coach_id/withdrawn_by, deletion_requests.user_id, …).
  --    Le rôle postgres (owner de cette fonction) a le privilège DELETE sur
  --    auth.users (vérifié). Aucun trigger DELETE sur auth.users.
  -- ───────────────────────────────────────────────────────────────────────
  DELETE FROM auth.users WHERE id = v_uid;

END;
$$;

-- Owner = postgres (BYPASSRLS + DELETE sur auth.users). Explicite par sûreté.
ALTER FUNCTION public.delete_my_account() OWNER TO postgres;

-- Surface d'appel : utilisateurs authentifiés uniquement. Jamais public/anon.
REVOKE ALL     ON FUNCTION public.delete_my_account() FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.delete_my_account() FROM anon;
GRANT  EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
