-- ═══════════════════════════════════════════════════════════════════════════
-- CORRECTIF — le garde de périmètre ne bloquait RIEN
--
-- APPLIQUÉE sur le cloud le 2026-09-09 (version 20260909191916), minutes après
-- 20260909191744. Preuves par exécution en fin de fichier.
--
-- LA FAUTE. Le garde était posé en SECURITY DEFINER et testait
-- `current_user <> 'authenticated'` pour laisser passer les chemins DEFINER
-- (triggers de la vague 2, RPC de rejet/réclamation). Or DANS une fonction
-- SECURITY DEFINER, `current_user` vaut le PROPRIÉTAIRE de la fonction, pas le
-- rôle qui écrit. Le test était donc vrai à CHAQUE appel, y compris sur une
-- écriture client directe : la fonction sortait en early-return et ne
-- protégeait aucune colonne.
--
-- Mesuré, en se faisant passer pour un athlète sur sa propre ligne, juste
-- après l'apply de 20260909191744 : coach_id, school_id, status, verified,
-- verified_at, cote_globale_entraineur, profile_completion,
-- consentement_parental, partner_visibility_opt_in, committed_school_id —
-- TOUS passaient encore.
--
-- ⚠ LA LEÇON, ET ELLE EST GÉNÉRALE : `current_user` dans un SECURITY DEFINER
-- ne dit pas qui appelle. Les 8 gates de catalogue étaient verts — DEFINER
-- présent, search_path pinné, ACL conforme, le corps contenait bien le mot
-- `current_user`. Aucun contrôle de forme ne pouvait voir que le
-- comportement était inversé. Seule l'exécution le montre. Un gate qui lit le
-- catalogue prouve qu'une chose EXISTE, jamais qu'elle FONCTIONNE.
--
-- LE CORRECTIF. SECURITY INVOKER : la fonction ne lit que NEW/OLD et
-- auth.uid(), elle n'a besoin d'aucun privilège. `current_user` redevient
-- alors le rôle qui écrit — `authenticated` pour un client, le propriétaire
-- pour un chemin DEFINER — et le discriminant fonctionne dans les deux sens.
-- `row_security = off` part avec le DEFINER : inutile ici, et non posable par
-- un rôle non privilégié.
--
-- ⚠ ET L'ACL CHANGE DE SENS. En INVOKER, c'est `authenticated` qui EXÉCUTE la
-- fonction : un REVOKE complet la rendrait inappelable et casserait TOUT
-- UPDATE sur `athletes`. D'où le GRANT explicite — l'inverse de la discipline
-- habituelle, pour une raison qui tient à l'INVOKER, pas à un relâchement.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.enforce_athlete_self_edit_perimeter()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
DECLARE
  v_bloquees text[] := ARRAY[]::text[];
BEGIN
  -- Pas l'athlète lui-même en écriture DIRECTE ? On ne s'en mêle pas.
  -- En INVOKER, current_user = 'authenticated' pour un UPDATE venu du client,
  -- et le propriétaire de la fonction appelante pour un chemin DEFINER.
  --
  -- ⚠ EXCLUSION VOLONTAIRE : `statut_recrutement_override` n'est PAS bloquée.
  -- Le CLAUDE.md en fait une règle produit — coach, athlète ou recruteur
  -- peuvent l'écrire, last-write-wins. La bloquer casserait une règle métier
  -- au nom d'une liste de sécurité. Son jumeau `recruitment_status`, lui, EST
  -- bloqué : il n'est écrit que par les flows coach/recruteur, et son
  -- `recruitment_status_changed_by` doit rester une signature crédible.
  -- Cette exclusion se relit le jour où l'un des deux disparaît (règle 11).
  IF current_user <> 'authenticated'
     OR auth.uid() IS NULL
     OR OLD.user_id IS NULL
     OR auth.uid() <> OLD.user_id THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id   IS DISTINCT FROM OLD.user_id   THEN v_bloquees := v_bloquees || 'user_id';   END IF;
  IF NEW.coach_id  IS DISTINCT FROM OLD.coach_id  THEN v_bloquees := v_bloquees || 'coach_id';  END IF;
  IF NEW.school_id IS DISTINCT FROM OLD.school_id THEN v_bloquees := v_bloquees || 'school_id'; END IF;
  IF NEW.status    IS DISTINCT FROM OLD.status    THEN v_bloquees := v_bloquees || 'status';    END IF;

  IF NEW.verified            IS DISTINCT FROM OLD.verified            THEN v_bloquees := v_bloquees || 'verified';            END IF;
  IF NEW.verified_at         IS DISTINCT FROM OLD.verified_at         THEN v_bloquees := v_bloquees || 'verified_at';         END IF;
  IF NEW.verified_by         IS DISTINCT FROM OLD.verified_by         THEN v_bloquees := v_bloquees || 'verified_by';         END IF;
  IF NEW.verification_method IS DISTINCT FROM OLD.verification_method THEN v_bloquees := v_bloquees || 'verification_method'; END IF;

  IF NEW.cote_globale_entraineur IS DISTINCT FROM OLD.cote_globale_entraineur THEN v_bloquees := v_bloquees || 'cote_globale_entraineur'; END IF;

  IF NEW.profile_completion IS DISTINCT FROM OLD.profile_completion THEN v_bloquees := v_bloquees || 'profile_completion'; END IF;
  IF NEW.is_showcase        IS DISTINCT FROM OLD.is_showcase        THEN v_bloquees := v_bloquees || 'is_showcase';        END IF;

  IF NEW.consentement_parental      IS DISTINCT FROM OLD.consentement_parental      THEN v_bloquees := v_bloquees || 'consentement_parental';      END IF;
  IF NEW.consentement_parental_date IS DISTINCT FROM OLD.consentement_parental_date THEN v_bloquees := v_bloquees || 'consentement_parental_date'; END IF;
  IF NEW.partner_visibility_opt_in            IS DISTINCT FROM OLD.partner_visibility_opt_in            THEN v_bloquees := v_bloquees || 'partner_visibility_opt_in';            END IF;
  IF NEW.partner_visibility_opted_in_at       IS DISTINCT FROM OLD.partner_visibility_opted_in_at       THEN v_bloquees := v_bloquees || 'partner_visibility_opted_in_at';       END IF;
  IF NEW.partner_visibility_parental_consent  IS DISTINCT FROM OLD.partner_visibility_parental_consent  THEN v_bloquees := v_bloquees || 'partner_visibility_parental_consent';  END IF;

  IF NEW.recruitment_status            IS DISTINCT FROM OLD.recruitment_status            THEN v_bloquees := v_bloquees || 'recruitment_status';            END IF;
  IF NEW.recruitment_status_changed_by IS DISTINCT FROM OLD.recruitment_status_changed_by THEN v_bloquees := v_bloquees || 'recruitment_status_changed_by'; END IF;
  IF NEW.recruitment_status_changed_at IS DISTINCT FROM OLD.recruitment_status_changed_at THEN v_bloquees := v_bloquees || 'recruitment_status_changed_at'; END IF;
  IF NEW.committed_school_id           IS DISTINCT FROM OLD.committed_school_id           THEN v_bloquees := v_bloquees || 'committed_school_id';           END IF;

  IF array_length(v_bloquees, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'NEXUS: ces informations ne se modifient pas depuis ton profil (%). Elles sont tenues par ton entraîneur ou par Nexus.',
      array_to_string(v_bloquees, ', ');
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_athlete_self_edit_perimeter() FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.enforce_athlete_self_edit_perimeter() TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════════
-- LES DEUX PREUVES PAR EXÉCUTION (transactions annulées, rien n'a persisté)
--
-- PREUVE 1 — l'athlète, sur SA ligne, colonne par colonne : 16 colonnes
-- protégées, 16 refus. Et son propre périmètre passe (poids_lbs + taille_pieds
-- écrits).
--   ⚠ Deux d'entre elles ont d'abord semblé « passer » : `verified` et
--   `committed_school_id`. Artefact de test, pas trou — la valeur d'essai
--   ÉGALAIT la valeur courante (verified déjà true, committed_school_id déjà
--   NULL), donc NEW = OLD et le garde n'avait rien à bloquer. Rejoué avec des
--   valeurs réellement différentes : refus tous les deux. La leçon vaut pour
--   le prochain qui écrira ce genre de sonde — une garde ne se teste qu'avec
--   une valeur qui CHANGE quelque chose.
--
-- PREUVE 2 — la vague 2 passe. L'athlète rejoint Wildcats D2 avec
-- auth.uid() = lui ; `trg_team_athletes_referent` (DEFINER) écrit son
-- coach_id :
--     coach_id avant  = a0000000-…-0000000000a3
--     référent équipe = b1e9f4aa-… (Raphaël Lajoie)
--     coach_id après  = b1e9f4aa-…  → le garde ne l'a pas bloqué
-- C'est exactement le scénario qu'un garde basé sur le seul `auth.uid()`
-- aurait cassé à la première prise d'équipe.
-- ═══════════════════════════════════════════════════════════════════════════
