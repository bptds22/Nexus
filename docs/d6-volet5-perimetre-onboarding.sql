-- ═══════════════════════════════════════════════════════════════════════════
-- D6 — VOLET 5 : l'onboarding rend l'école et le coach à l'athlète
--
-- ⚠️ DDL PRÉPARÉ, NON APPLIQUÉ. Ne pas `apply_migration` depuis ce fichier.
--    Il rejoint la migration de la session D6 (dédoublonnage des conversations
--    + index unique RECRUTEUR_COACH + is_team_head_coach/REFERENT_ROLES),
--    en cinquième volet. Registre : docs/fast-follow-1.4.2.md §16.
--
-- ── LE CONFLIT, TEL QU'IL S'EST MANIFESTÉ ─────────────────────────────────
-- Recette du 2026-09-11, inscription neuve sur nexus.athc@nexussports.ca :
-- « Échec de sauvegarde » à la finalisation. Cause réelle, lue dans les logs
-- Supabase (PATCH /rest/v1/athletes → 400) : `enforce_athlete_self_edit_perimeter`
-- refusait `coach_id, school_id`.
--
-- Deux règles vraies se contredisaient :
--   · le trigger (20260909191744) dit « l'école et le coach appartiennent à
--     l'entraîneur, pas à l'athlète » — juste, une fois le profil vivant ;
--   · l'onboarding dit « l'athlète choisit son école et son coach » — juste
--     aussi, c'est LE geste de l'inscription.
-- Aucune des deux n'est un bug. Il manquait la frontière entre les deux.
--
-- ── LA DÉCISION PRODUIT (BP, 2026-09-11) ──────────────────────────────────
-- PENDANT l'onboarding — c'est-à-dire tant que `users.onboarding_complete`
-- est faux — l'athlète peut choisir son école et son coach. La garde
-- s'applique PLEINEMENT après. Le reste du périmètre (vérification, cote,
-- consentements, statut de recrutement…) n'est JAMAIS ouvert, à aucun moment :
-- ces colonnes-là ne sont pas un choix d'inscription.
--
-- ── POURQUOI UNE LISTE BLANCHE EN TÊTE, ET PAS UNE CONDITION EN LIGNE ──────
-- Règle 11 du dépôt : une exemption décidée s'écrit, elle ne s'hérite pas.
-- `v_ouvert` est déclaré AVANT le premier test, nommé, et commenté. Ajouter
-- demain une colonne au périmètre ne la rendra pas silencieusement modifiable
-- pendant l'onboarding ; et retirer l'exemption devra être un geste délibéré,
-- visible en diff, pas un effet de bord.
--
-- ── CE QUI RESTE VRAI SANS CE DDL ─────────────────────────────────────────
-- Le correctif client de 1.4.1 (lib/athlete/perimetreProtege.ts) n'envoie plus
-- les colonnes protégées inchangées : l'athlète qui GARDE l'école héritée de sa
-- fiche finalise sans erreur. Celui qui en CHANGE reste refusé — jusqu'à ce
-- DDL. Le client ne contourne pas la garde, il cesse de la réveiller pour rien.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.enforce_athlete_self_edit_perimeter()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path TO 'public'
AS $$
DECLARE
  v_bloquees text[] := ARRAY[]::text[];
  v_ouvert   text[] := ARRAY[]::text[];
BEGIN
  -- Pas l'athlète lui-même en écriture DIRECTE ? On ne s'en mêle pas.
  -- En INVOKER, current_user = 'authenticated' pour un UPDATE venu du client,
  -- et le propriétaire de la fonction appelante pour un chemin DEFINER.
  -- ⚠ EXCLUSION VOLONTAIRE : statut_recrutement_override n'est PAS bloquée —
  -- règle produit CLAUDE.md, l'écriture athlète y est légitime.
  IF current_user <> 'authenticated'
     OR auth.uid() IS NULL
     OR OLD.user_id IS NULL
     OR auth.uid() <> OLD.user_id THEN
    RETURN NEW;
  END IF;

  -- ═══ EXEMPTION D'ONBOARDING — décision produit BP 2026-09-11 ═══════════
  -- Tant que le compte n'a pas terminé son inscription, choisir son école et
  -- son entraîneur EST l'inscription. Les bloquer y rendait la finalisation
  -- impossible pour toute fiche héritée d'un coach (cf l'en-tête).
  --
  -- Déclarée ICI, en tête, AVANT les tests qui suivent — y compris pour des
  -- colonnes que ces tests traiteraient de toute façon. La redondance est le
  -- point : elle survit à l'ajout d'une colonne au périmètre demain.
  --
  -- Volontairement limitée à ces deux colonnes. `status`, `verified`,
  -- `cote_globale_entraineur`, les consentements et le statut de recrutement
  -- restent fermés MÊME pendant l'onboarding : rien dans le parcours
  -- d'inscription ne demande à l'athlète de les poser.
  --
  -- ⚠ CE SELECT DÉPEND D'UNE POLICY. La fonction est SECURITY INVOKER
  -- (migration 20260909191916_edition_directe_athlete_garde_invoker — ne pas
  -- la repasser en DEFINER), donc la lecture de `users` passe par la RLS. Elle
  -- ne tient que grâce à `users read own` (`id = auth.uid()`), et on ne lit
  -- ICI que la ligne `OLD.user_id`, qui vaut `auth.uid()` puisqu'on a franchi
  -- la garde ci-dessus. Si cette policy disparaissait, le SELECT rendrait NULL
  -- et le COALESCE ouvrirait l'exemption EN PERMANENCE — un échec OUVERT,
  -- silencieux. La preuve 6 ci-dessous existe pour ça.
  IF NOT COALESCE(
       (SELECT u.onboarding_complete FROM public.users u WHERE u.id = OLD.user_id),
       false)
  THEN
    v_ouvert := ARRAY['school_id', 'coach_id'];
  END IF;

  IF NEW.user_id   IS DISTINCT FROM OLD.user_id   THEN v_bloquees := v_bloquees || 'user_id';   END IF;
  IF NEW.coach_id  IS DISTINCT FROM OLD.coach_id
     AND NOT ('coach_id'  = ANY (v_ouvert))       THEN v_bloquees := v_bloquees || 'coach_id';  END IF;
  IF NEW.school_id IS DISTINCT FROM OLD.school_id
     AND NOT ('school_id' = ANY (v_ouvert))       THEN v_bloquees := v_bloquees || 'school_id'; END IF;
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
$$;

-- ── PREUVES À PRODUIRE À L'APPLICATION (règle 7 : par exécution, pas par
--    lecture). Sous un VRAI JWT athlète, `SET ROLE authenticated` +
--    request.jwt.claims, sur une fiche jetable créée pour l'occasion :
--
--   1. onboarding_complete = false → UPDATE school_id  ⇒ PASSE
--   2. onboarding_complete = false → UPDATE coach_id   ⇒ PASSE
--   3. onboarding_complete = false → UPDATE verified   ⇒ REFUSÉ (le chemin
--      d'exemption ne doit ouvrir QUE les deux colonnes nommées)
--   4. onboarding_complete = true  → UPDATE school_id  ⇒ REFUSÉ
--   5. coach sur SA fiche d'athlète (current_user ≠ athlète) → school_id
--      ⇒ PASSE, inchangé (la garde ne doit pas s'être élargie)
--   6. `users` illisible (ligne absente, ou policy `users read own` retirée)
--      → le SELECT rend NULL, le COALESCE rend false, l'exemption s'OUVRE.
--      C'est le bon comportement pour un compte en cours de création (le cas
--      voulu), et le MAUVAIS si la policy a disparu. Vérifier la présence de
--      `users read own` fait donc partie de la preuve, pas du décor.
--   7. Après application : relancer le parcours d'inscription complet sur une
--      fiche héritée, école CHANGÉE — c'est le scénario exact du 2026-09-11,
--      et le seul qui prouve que le volet a servi à quelque chose.
