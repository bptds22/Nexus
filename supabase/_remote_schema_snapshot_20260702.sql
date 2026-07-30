


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "moddatetime" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."account_status" AS ENUM (
    'ACTIF',
    'DESACTIVE',
    'EN_ATTENTE',
    'DIPLOME',
    'SUPPRIME'
);


ALTER TYPE "public"."account_status" OWNER TO "postgres";


CREATE TYPE "public"."coach_school_role" AS ENUM (
    'DIRECTEUR_INTERIM',
    'DIRECTEUR',
    'COACH',
    'PENDING'
);


ALTER TYPE "public"."coach_school_role" OWNER TO "postgres";


CREATE TYPE "public"."invitation_status" AS ENUM (
    'PENDING',
    'CONSUMED',
    'EXPIRED',
    'REVOKED'
);


ALTER TYPE "public"."invitation_status" OWNER TO "postgres";


CREATE TYPE "public"."pipeline_status" AS ENUM (
    'NONE',
    'IDENTIFIE',
    'CONTACTE',
    'EN_DISCUSSION',
    'VISITE_PLANIFIEE',
    'ENGAGE',
    'LETTRE_SIGNEE',
    'RETIRE'
);


ALTER TYPE "public"."pipeline_status" OWNER TO "postgres";


CREATE TYPE "public"."recruitment_status" AS ENUM (
    'OUVERT',
    'EN_PROCESSUS',
    'RECRUTE',
    'RETIRE'
);


ALTER TYPE "public"."recruitment_status" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'ADMIN',
    'COACH',
    'RECRUTEUR',
    'ATHLETE',
    'PARTNER'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE TYPE "public"."verification_method" AS ENUM (
    'auto',
    'manuel_coach',
    'manuel_directeur'
);


ALTER TYPE "public"."verification_method" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_admin_claim_approval"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_admin_type TEXT;
BEGIN
  -- Only react to PENDING → terminal transitions.
  IF OLD.status IS DISTINCT FROM 'PENDING' THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'APPROVED' THEN
    v_admin_type := CASE
      WHEN NEW.claim_type = 'DIRECTEUR' THEN 'owner'
      WHEN NEW.claim_type = 'INTERIM' THEN 'interim'
      ELSE NULL
    END;

    -- Demote any sitting interim on this school when a DIRECTEUR
    -- claim is approved. Skip if the claimant somehow is the same
    -- person (shouldn't happen — wizard prevents claiming twice via
    -- the unique partial index on PENDING — but be defensive).
    IF NEW.claim_type = 'DIRECTEUR' THEN
      UPDATE public.users
      SET is_school_admin = false,
          profile_data = COALESCE(profile_data, '{}'::jsonb) || jsonb_build_object('admin_type', NULL)
      WHERE school_id = NEW.school_id
        AND is_school_admin = true
        AND COALESCE(profile_data->>'admin_type', '') = 'interim'
        AND id <> NEW.user_id;
    END IF;

    -- Promote the claimant.
    UPDATE public.users
    SET is_school_admin = true,
        profile_data = COALESCE(profile_data, '{}'::jsonb) || jsonb_build_object('admin_type', v_admin_type)
    WHERE id = NEW.user_id;

  ELSIF NEW.status = 'REJECTED' THEN
    -- Defensive cleanup. is_school_admin was never set on PENDING
    -- (wizard guard), but profile_data.admin_type was written so the
    -- claimant could read it back. Clear it on rejection.
    UPDATE public.users
    SET profile_data = COALESCE(profile_data, '{}'::jsonb) || jsonb_build_object('admin_type', NULL)
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."apply_admin_claim_approval"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."apply_admin_claim_approval"() IS 'Item 11-Security: promote users.is_school_admin on APPROVED admin_claims, demote sitting interim on DIRECTEUR approval. SECURITY DEFINER — fires only on PENDING transitions.';



CREATE OR REPLACE FUNCTION "public"."apply_approved_suggestion"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "row_security" TO 'off'
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_coach_id UUID;
  v_rows_updated INT;
  v_is_detailed BOOLEAN;
  v_sport_id UUID;
  v_position_id UUID;
BEGIN
  IF NEW.status = 'APPROUVEE' AND OLD.status = 'EN_ATTENTE' THEN
    NEW.reviewed_at = now();
    SELECT coach_id INTO v_coach_id FROM athletes WHERE id = NEW.athlete_id;
    IF v_coach_id IS NULL THEN v_coach_id := NEW.coach_id; END IF;

    CASE NEW.champ
      WHEN 'Taille' THEN
        UPDATE athletes SET taille_pieds = NULLIF(split_part(replace(NEW.valeur_proposee, '"', ''), '''', 1), '')::int,
          taille_pouces = NULLIF(split_part(replace(NEW.valeur_proposee, '"', ''), '''', 2), '')::int
          WHERE id = NEW.athlete_id;
      WHEN 'Poids' THEN UPDATE athletes SET poids_lbs = NULLIF(replace(NEW.valeur_proposee, ' lbs', ''), '')::numeric WHERE id = NEW.athlete_id;
      WHEN 'Envergure' THEN UPDATE athletes SET envergure = NEW.valeur_proposee WHERE id = NEW.athlete_id;
      WHEN 'Taille mains' THEN UPDATE athletes SET taille_mains = NEW.valeur_proposee WHERE id = NEW.athlete_id;
      WHEN 'Main dominante' THEN UPDATE athletes SET main_dominante = NEW.valeur_proposee WHERE id = NEW.athlete_id;
      WHEN 'Pied dominant' THEN UPDATE athletes SET pied_dominant = NEW.valeur_proposee WHERE id = NEW.athlete_id;
      WHEN '40 yards' THEN UPDATE athletes SET test_40_verges = NEW.valeur_proposee WHERE id = NEW.athlete_id;
      WHEN 'Saut vertical' THEN UPDATE athletes SET saut_vertical = NEW.valeur_proposee WHERE id = NEW.athlete_id;
      WHEN 'Saut longueur' THEN UPDATE athletes SET saut_longueur = NEW.valeur_proposee WHERE id = NEW.athlete_id;
      WHEN 'Développé couché' THEN UPDATE athletes SET developpe_couche = NEW.valeur_proposee WHERE id = NEW.athlete_id;
      WHEN 'Navette' THEN UPDATE athletes SET navette_agilite = NEW.valeur_proposee WHERE id = NEW.athlete_id;
      WHEN 'Sprint 100m' THEN UPDATE athletes SET sprint_100m = NEW.valeur_proposee WHERE id = NEW.athlete_id;
      WHEN 'Numéro' THEN UPDATE athletes SET numero_jersey = replace(NEW.valeur_proposee, '#', '') WHERE id = NEW.athlete_id;

      -- ---- FK / name->id champs (added 20260522130000) ----
      WHEN 'Sport principal' THEN
        SELECT id INTO v_sport_id FROM sports WHERE lower(nom) = lower(NEW.valeur_proposee);
        IF v_sport_id IS NULL THEN
          RAISE EXCEPTION 'apply_approved_suggestion: sport principal "%" introuvable', NEW.valeur_proposee;
        END IF;
        UPDATE athletes SET sport_id = v_sport_id WHERE id = NEW.athlete_id;

      WHEN 'Sport secondaire' THEN
        SELECT id INTO v_sport_id FROM sports WHERE lower(nom) = lower(NEW.valeur_proposee);
        IF v_sport_id IS NULL THEN
          RAISE EXCEPTION 'apply_approved_suggestion: sport secondaire "%" introuvable', NEW.valeur_proposee;
        END IF;
        UPDATE athletes SET sport_secondaire_id = v_sport_id WHERE id = NEW.athlete_id;

      WHEN 'Position' THEN
        SELECT p.id INTO v_position_id
        FROM positions p JOIN athletes a ON a.id = NEW.athlete_id
        WHERE p.sport_id = a.sport_id AND lower(p.nom) = lower(NEW.valeur_proposee);
        IF v_position_id IS NULL THEN
          RAISE EXCEPTION 'apply_approved_suggestion: position "%" introuvable pour le sport principal de cet athlète', NEW.valeur_proposee;
        END IF;
        UPDATE athletes SET position_id = v_position_id WHERE id = NEW.athlete_id;

      WHEN 'Position secondaire' THEN
        SELECT p.id INTO v_position_id
        FROM positions p JOIN athletes a ON a.id = NEW.athlete_id
        WHERE p.sport_id = COALESCE(a.sport_secondaire_id, a.sport_id)
          AND lower(p.nom) = lower(NEW.valeur_proposee);
        IF v_position_id IS NULL THEN
          RAISE EXCEPTION 'apply_approved_suggestion: position secondaire "%" introuvable', NEW.valeur_proposee;
        END IF;
        UPDATE athletes SET position_secondaire_id = v_position_id WHERE id = NEW.athlete_id;

      WHEN 'Cote globale' THEN
        SELECT (leadership IS NOT NULL OR discipline IS NOT NULL OR coachabilite IS NOT NULL OR intelligence_jeu IS NOT NULL OR competitivite IS NOT NULL OR esprit_equipe IS NOT NULL OR resilience IS NOT NULL OR attitude_mentalite IS NOT NULL)
          INTO v_is_detailed FROM evaluations WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        IF v_is_detailed THEN
          RAISE EXCEPTION 'Impossible d''appliquer une cote globale plate : l''évaluation détaillée est active pour cet athlète.';
        END IF;
        UPDATE athletes SET cote_globale_entraineur = NEW.valeur_proposee::numeric WHERE id = NEW.athlete_id;
        UPDATE evaluations SET cote_globale = NEW.valeur_proposee::numeric WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN
          INSERT INTO evaluations (athlete_id, coach_id, cote_globale) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::numeric)
            ON CONFLICT (coach_id, athlete_id) DO UPDATE SET cote_globale = EXCLUDED.cote_globale;
        END IF;

      WHEN 'Leadership' THEN
        UPDATE evaluations SET leadership = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, leadership) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET leadership = EXCLUDED.leadership; END IF;
      WHEN 'Discipline' THEN
        UPDATE evaluations SET discipline = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, discipline) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET discipline = EXCLUDED.discipline; END IF;
      WHEN 'Coachabilité' THEN
        UPDATE evaluations SET coachabilite = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, coachabilite) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET coachabilite = EXCLUDED.coachabilite; END IF;
      WHEN 'Intelligence de jeu' THEN
        UPDATE evaluations SET intelligence_jeu = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, intelligence_jeu) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET intelligence_jeu = EXCLUDED.intelligence_jeu; END IF;
      WHEN 'Compétitivité' THEN
        UPDATE evaluations SET competitivite = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, competitivite) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET competitivite = EXCLUDED.competitivite; END IF;
      WHEN 'Esprit d''équipe' THEN
        UPDATE evaluations SET esprit_equipe = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, esprit_equipe) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET esprit_equipe = EXCLUDED.esprit_equipe; END IF;
      WHEN 'Résilience' THEN
        UPDATE evaluations SET resilience = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, resilience) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET resilience = EXCLUDED.resilience; END IF;
      WHEN 'Attitude / Mentalité' THEN
        UPDATE evaluations SET attitude_mentalite = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, attitude_mentalite) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET attitude_mentalite = EXCLUDED.attitude_mentalite; END IF;

      -- ---- NEW : 6 tactical-trait champs (added by this migration) ----
      --  Cloned BYTE-FOR-BYTE from the Leadership/Discipline/etc. template
      --  above : int cast on NEW.valeur_proposee, scoped WHERE on
      --  athlete_id + coach_id, update-then-upsert idiom with the
      --  evaluations (coach_id, athlete_id) UNIQUE index as the ON
      --  CONFLICT target. The champ strings MUST match the athlete UI's
      --  TRAIT_LABELS map verbatim (page.tsx :486-491 / :757-758) — a
      --  single character drift falls through to the ELSE RAISE EXCEPTION
      --  branch below and re-breaks approval.
      WHEN 'Vitesse / Explosivité' THEN
        UPDATE evaluations SET vitesse_explosivite = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, vitesse_explosivite) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET vitesse_explosivite = EXCLUDED.vitesse_explosivite; END IF;
      WHEN 'Force / Puissance' THEN
        UPDATE evaluations SET force_puissance = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, force_puissance) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET force_puissance = EXCLUDED.force_puissance; END IF;
      WHEN 'Endurance cardio' THEN
        UPDATE evaluations SET endurance_cardio = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, endurance_cardio) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET endurance_cardio = EXCLUDED.endurance_cardio; END IF;
      WHEN 'Agilité / Coordination' THEN
        UPDATE evaluations SET agilite_coordination = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, agilite_coordination) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET agilite_coordination = EXCLUDED.agilite_coordination; END IF;
      WHEN 'Vision du jeu' THEN
        UPDATE evaluations SET vision_du_jeu = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, vision_du_jeu) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET vision_du_jeu = EXCLUDED.vision_du_jeu; END IF;
      WHEN 'Sens tactique' THEN
        UPDATE evaluations SET sens_tactique = NEW.valeur_proposee::int WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, sens_tactique) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::int) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET sens_tactique = EXCLUDED.sens_tactique; END IF;

      WHEN 'Distinctions' THEN
        UPDATE evaluations SET distinctions = NEW.valeur_proposee::jsonb WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, distinctions) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::jsonb) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET distinctions = EXCLUDED.distinctions; END IF;

      WHEN 'Distinction personnalisée' THEN
        INSERT INTO custom_distinctions (athlete_id, coach_id, title) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee);

      ELSE
        RAISE EXCEPTION 'apply_approved_suggestion: champ non géré "%"', NEW.champ;
    END CASE;
  END IF;

  IF NEW.status = 'REJETEE' AND OLD.status = 'EN_ATTENTE' THEN
    NEW.reviewed_at = now();
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."apply_approved_suggestion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_stripe_subscription"("p_user_id" "uuid", "p_tier" "text", "p_status" "text", "p_billing_cycle" "text", "p_stripe_subscription_id" "text", "p_stripe_price_id" "text", "p_current_period_start" timestamp with time zone, "p_current_period_end" timestamp with time zone, "p_cancel_at_period_end" boolean DEFAULT false, "p_canceled_at" timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  INSERT INTO public.subscriptions (
    user_id, tier, status, billing_cycle,
    stripe_subscription_id, stripe_price_id,
    current_period_start, current_period_end,
    cancel_at_period_end, canceled_at,
    tier_source, updated_at
  ) VALUES (
    p_user_id, p_tier, p_status, p_billing_cycle,
    p_stripe_subscription_id, p_stripe_price_id,
    p_current_period_start, p_current_period_end,
    p_cancel_at_period_end, p_canceled_at,
    'stripe', now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    tier                    = EXCLUDED.tier,
    status                  = EXCLUDED.status,
    billing_cycle           = EXCLUDED.billing_cycle,
    stripe_subscription_id  = EXCLUDED.stripe_subscription_id,
    stripe_price_id         = EXCLUDED.stripe_price_id,
    current_period_start    = EXCLUDED.current_period_start,
    current_period_end      = EXCLUDED.current_period_end,
    cancel_at_period_end    = EXCLUDED.cancel_at_period_end,
    canceled_at             = EXCLUDED.canceled_at,
    tier_source             = 'stripe',
    updated_at              = now()
  WHERE subscriptions.tier_source = 'stripe';
$$;


ALTER FUNCTION "public"."apply_stripe_subscription"("p_user_id" "uuid", "p_tier" "text", "p_status" "text", "p_billing_cycle" "text", "p_stripe_subscription_id" "text", "p_stripe_price_id" "text", "p_current_period_start" timestamp with time zone, "p_current_period_end" timestamp with time zone, "p_cancel_at_period_end" boolean, "p_canceled_at" timestamp with time zone) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_team_invitation_acceptance"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_team_school_id uuid;
BEGIN
  IF NEW.status <> 'ACCEPTED' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'ACCEPTED' THEN
    -- Idempotent : déjà accepté, skip
    RETURN NEW;
  END IF;

  -- Résoudre school_id depuis teams (FK NOT NULL garantit non-null)
  SELECT school_id INTO v_team_school_id
  FROM teams
  WHERE id = NEW.team_id;

  IF v_team_school_id IS NULL THEN
    RAISE EXCEPTION 'Team % has NULL school_id — invalid state', NEW.team_id;
  END IF;

  -- (a) INSERT junction team_athletes (idempotent via ON CONFLICT)
  INSERT INTO team_athletes (team_id, athlete_id, joined_at)
  VALUES (NEW.team_id, NEW.athlete_id, now())
  ON CONFLICT (team_id, athlete_id) DO NOTHING;

  -- (b) UPDATE athletes : anchor school_id + propage coach_id si vide
  -- Note : on écrase school_id (invitation = transfert sémantique).
  -- coach_id : COALESCE pour préserver l'existant si déjà set.
  UPDATE athletes
  SET
    school_id = v_team_school_id,
    coach_id = COALESCE(athletes.coach_id, NEW.invited_by_coach_id)
  WHERE id = NEW.athlete_id;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."apply_team_invitation_acceptance"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."apply_team_invitation_acceptance"() IS 'Fires when team_invitations.status flips to ACCEPTED. Operations in order: (a) INSERT junction, (b) UPDATE anchor, (c) DELETE old junctions, (d) Set athletes.coach_id = team ADMIN (defensive COALESCE, ORDER BY created_at ASC LIMIT 1 for the theoretical multi-ADMIN tie-breaker).';



CREATE OR REPLACE FUNCTION "public"."auto_pipeline_identifie"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.favorited_at IS NOT NULL AND OLD.favorited_at IS NULL THEN
    NEW.status := 'IDENTIFIE';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_pipeline_identifie"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_set_recrute_on_confirmation"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF NEW.status = 'CONFIRMED' AND OLD.status = 'PENDING' THEN
    UPDATE athletes
    SET recruitment_status = 'RECRUTE',
        committed_school_id = NEW.school_id,
        open_to_offers = NEW.open_to_offers,
        recruitment_status_changed_by = NEW.requested_by,
        recruitment_status_changed_at = now()
    WHERE id = NEW.athlete_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_set_recrute_on_confirmation"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_upgrade_favorite_to_en_processus"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE athletes
  SET recruitment_status = 'EN_PROCESSUS',
      recruitment_status_changed_at = now()
  WHERE id = NEW.athlete_id
    AND recruitment_status = 'OUVERT'
    AND recruitment_status_changed_by IS NULL;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_upgrade_favorite_to_en_processus"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."backfill_athletes_on_coach_join"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "row_security" TO 'off'
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE athletes
  SET coach_id = NEW.id
  WHERE school_id = NEW.school_id AND coach_id IS NULL;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."backfill_athletes_on_coach_join"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calc_cote_globale"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "row_security" TO 'off'
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_sum NUMERIC := 0;
  v_count INT := 0;
BEGIN
  -- Unified simple-mode passthrough (replaces the old asymmetric
  -- INSERT-only branch + UPDATE-changed branch). Direct writes from
  -- the simple-mode star input arrive with cote_globale set and all
  -- per-trait columns NULL — preserve the value and cascade to the
  -- athletes denormalized column.
  IF NEW.cote_globale IS NOT NULL
     AND NEW.vitesse_explosivite IS NULL AND NEW.force_puissance IS NULL
     AND NEW.endurance_cardio IS NULL AND NEW.agilite_coordination IS NULL
     AND NEW.vision_du_jeu IS NULL AND NEW.sens_tactique IS NULL
     AND NEW.leadership IS NULL AND NEW.discipline IS NULL
     AND NEW.coachabilite IS NULL AND NEW.intelligence_jeu IS NULL
     AND NEW.competitivite IS NULL AND NEW.esprit_equipe IS NULL
     AND NEW.resilience IS NULL AND NEW.attitude_mentalite IS NULL THEN
    UPDATE athletes SET cote_globale_entraineur = NEW.cote_globale WHERE id = NEW.athlete_id;
    RETURN NEW;
  END IF;

  -- Detailed mode: derive cote_globale from per-trait average.
  IF NEW.vitesse_explosivite  IS NOT NULL THEN v_sum := v_sum + NEW.vitesse_explosivite;  v_count := v_count + 1; END IF;
  IF NEW.force_puissance      IS NOT NULL THEN v_sum := v_sum + NEW.force_puissance;      v_count := v_count + 1; END IF;
  IF NEW.endurance_cardio     IS NOT NULL THEN v_sum := v_sum + NEW.endurance_cardio;     v_count := v_count + 1; END IF;
  IF NEW.agilite_coordination IS NOT NULL THEN v_sum := v_sum + NEW.agilite_coordination; v_count := v_count + 1; END IF;
  IF NEW.vision_du_jeu        IS NOT NULL THEN v_sum := v_sum + NEW.vision_du_jeu;        v_count := v_count + 1; END IF;
  IF NEW.sens_tactique        IS NOT NULL THEN v_sum := v_sum + NEW.sens_tactique;        v_count := v_count + 1; END IF;
  IF NEW.leadership           IS NOT NULL THEN v_sum := v_sum + NEW.leadership;           v_count := v_count + 1; END IF;
  IF NEW.discipline           IS NOT NULL THEN v_sum := v_sum + NEW.discipline;           v_count := v_count + 1; END IF;
  IF NEW.coachabilite         IS NOT NULL THEN v_sum := v_sum + NEW.coachabilite;         v_count := v_count + 1; END IF;
  IF NEW.intelligence_jeu     IS NOT NULL THEN v_sum := v_sum + NEW.intelligence_jeu;     v_count := v_count + 1; END IF;
  IF NEW.competitivite        IS NOT NULL THEN v_sum := v_sum + NEW.competitivite;        v_count := v_count + 1; END IF;
  IF NEW.esprit_equipe        IS NOT NULL THEN v_sum := v_sum + NEW.esprit_equipe;        v_count := v_count + 1; END IF;
  IF NEW.resilience           IS NOT NULL THEN v_sum := v_sum + NEW.resilience;           v_count := v_count + 1; END IF;
  IF NEW.attitude_mentalite   IS NOT NULL THEN v_sum := v_sum + NEW.attitude_mentalite;   v_count := v_count + 1; END IF;

  IF v_count > 0 THEN
    NEW.cote_globale := ROUND(v_sum / v_count, 1);
  ELSE
    NEW.cote_globale := NULL;
  END IF;

  UPDATE athletes SET cote_globale_entraineur = NEW.cote_globale WHERE id = NEW.athlete_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calc_cote_globale"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calc_note_globale"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  total NUMERIC := 0;
  count INTEGER := 0;
  criteria INTEGER[];
  c     INTEGER;
BEGIN
  criteria := ARRAY[NEW.qualite_profils, NEW.reactivite,
                    NEW.honnetete_evaluations, NEW.professionnalisme];
  FOREACH c IN ARRAY criteria LOOP
    IF c IS NOT NULL THEN
      total := total + c;
      count := count + 1;
    END IF;
  END LOOP;
  IF count > 0 THEN
    NEW.note_globale := ROUND(total::NUMERIC / count, 2);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calc_note_globale"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_profile_completion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  simplified_count INTEGER := 0;
  detailed_count INTEGER := 0;
  video_bonus INTEGER := 0;
  total INTEGER;
BEGIN
  -- TIER 1: Simplified fields (12 fields = 60%)
  IF NEW.first_name IS NOT NULL AND NEW.first_name != '' THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.last_name IS NOT NULL AND NEW.last_name != '' THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.date_naissance IS NOT NULL THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.genre IS NOT NULL AND NEW.genre != '' THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.annee_diplomation IS NOT NULL THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.sport_id IS NOT NULL THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.position_id IS NOT NULL THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.numero_jersey IS NOT NULL AND NEW.numero_jersey != '' THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.school_id IS NOT NULL THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.taille_pieds IS NOT NULL AND NEW.taille_pieds > 0 THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.poids_lbs IS NOT NULL AND NEW.poids_lbs > 0 THEN simplified_count := simplified_count + 1; END IF;
  IF NEW.cote_globale_entraineur IS NOT NULL AND NEW.cote_globale_entraineur > 0 THEN simplified_count := simplified_count + 1; END IF;

  -- TIER 2: Video (15%)
  IF NEW.video_faits_saillants_url IS NOT NULL AND NEW.video_faits_saillants_url != '' THEN video_bonus := 15; END IF;

  -- TIER 3: Detailed fields (10 fields = 25%)
  IF NEW.moyenne_generale IS NOT NULL AND NEW.moyenne_generale > 0 THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.programme_cegep_vise IS NOT NULL AND jsonb_array_length(NEW.programme_cegep_vise::jsonb) > 0 THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.matieres_fortes IS NOT NULL AND jsonb_array_length(NEW.matieres_fortes::jsonb) > 0 THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.notes_coach IS NOT NULL AND NEW.notes_coach != '' THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.envergure IS NOT NULL AND NEW.envergure != '' THEN detailed_count := detailed_count + 1; END IF;
  IF (NEW.test_40_verges IS NOT NULL OR NEW.saut_vertical IS NOT NULL OR NEW.saut_longueur IS NOT NULL OR NEW.developpe_couche IS NOT NULL OR NEW.navette_agilite IS NOT NULL OR NEW.sprint_100m IS NOT NULL) THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.photo_url IS NOT NULL AND NEW.photo_url != '' THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.bio IS NOT NULL AND NEW.bio != '' THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.mentions_academiques IS NOT NULL AND jsonb_array_length(NEW.mentions_academiques::jsonb) > 0 THEN detailed_count := detailed_count + 1; END IF;
  IF NEW.regions_cegep_preferees IS NOT NULL AND jsonb_array_length(NEW.regions_cegep_preferees::jsonb) > 0 THEN detailed_count := detailed_count + 1; END IF;

  total := ROUND((simplified_count::NUMERIC / 12) * 60) + video_bonus + ROUND((detailed_count::NUMERIC / 10) * 25);
  IF total > 100 THEN total := 100; END IF;

  NEW.profile_completion := total;

  -- (Removed in Phase A 2026-05-04: auto-verify block that flipped
  --  NEW.verified := TRUE / NEW.verification_method := 'auto' /
  --  NEW.verified_at := NOW() when total >= 60. Verification is now
  --  100% explicit human consent — no server-side auto-elevation.)

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_profile_completion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_recruiter_email_domain"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  user_email TEXT;
  user_domain TEXT;
  domain_match BOOLEAN;
  school_name TEXT;
BEGIN
  IF NEW.role::text != 'RECRUTEUR' THEN
    RETURN NEW;
  END IF;

  SELECT email INTO user_email FROM auth.users WHERE id = NEW.id;

  IF user_email IS NULL THEN
    RETURN NEW;
  END IF;

  user_domain := split_part(user_email, '@', 2);

  SELECT EXISTS(
    SELECT 1 FROM cegep_email_domains WHERE domain = user_domain
  ) INTO domain_match;

  IF NEW.school_id IS NOT NULL THEN
    SELECT name INTO school_name FROM schools WHERE id = NEW.school_id;
  END IF;

  -- Recognized CEGEP domain -> nothing to do (short-circuit).
  -- Unknown domain -> flag for manual admin review.
  IF NOT domain_match THEN
    INSERT INTO admin_notifications (type, title, message, related_user_id)
    VALUES (
      'RECRUITER_VERIFICATION',
      'Nouveau recruteur a verifier',
      'Le recruteur ' || COALESCE(NEW.first_name, '') || ' ' || COALESCE(NEW.last_name, '') ||
      ' (' || COALESCE(user_email, 'email inconnu') || ')' ||
      ' s est inscrit comme recruteur' ||
      CASE WHEN school_name IS NOT NULL THEN ' pour ' || school_name ELSE '' END ||
      '. Verification manuelle requise.',
      NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."check_recruiter_email_domain"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."coach_can_manage_athlete"("p_athlete_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "row_security" TO 'off'
    SET "search_path" TO 'public'
    AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.team_coaches tc
      JOIN public.team_athletes ta ON ta.team_id = tc.team_id
      WHERE tc.coach_id = auth.uid()
        AND ta.athlete_id = p_athlete_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.school_coaches sc
      WHERE sc.coach_id = auth.uid()
        AND sc.school_id = (SELECT school_id FROM public.athletes WHERE id = p_athlete_id)
        AND sc.role = ANY (ARRAY['DIRECTEUR'::public.coach_school_role,
                                 'DIRECTEUR_INTERIM'::public.coach_school_role])
    );
$$;


ALTER FUNCTION "public"."coach_can_manage_athlete"("p_athlete_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_athlete_invitation"("p_token" "text", "p_new_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "row_security" TO 'off'
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_athlete_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_new_user_id THEN
    RAISE EXCEPTION 'consume_athlete_invitation: cannot consume for another user';
  END IF;

  UPDATE public.athlete_invitations
  SET status              = 'CONSUMED',
      consumed_by_user_id = p_new_user_id,
      consumed_at         = now()
  WHERE token = p_token
    AND status = 'PENDING'
    AND expires_at > now()
  RETURNING athlete_id INTO v_athlete_id;

  IF v_athlete_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.athletes
  SET user_id = p_new_user_id
  WHERE id = v_athlete_id
    AND user_id IS NULL;

  RETURN v_athlete_id;
END;
$$;


ALTER FUNCTION "public"."consume_athlete_invitation"("p_token" "text", "p_new_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."consume_invitation_token"("p_token" "text", "p_new_user_id" "uuid") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "row_security" TO 'off'
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_invitation_id uuid;
  v_school_id uuid;
  v_caller uuid;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NOT NULL AND v_caller != p_new_user_id THEN
    RAISE EXCEPTION 'consume_invitation_token: cannot consume for another user';
  END IF;

  UPDATE public.invitations
  SET
    status = 'CONSUMED',
    consumed_by_user_id = p_new_user_id,
    consumed_at = now()
  WHERE token = p_token
    AND status = 'PENDING'
    AND expires_at > now()
  RETURNING id, school_id INTO v_invitation_id, v_school_id;

  IF v_school_id IS NOT NULL THEN
    UPDATE public.users
    SET school_id = v_school_id
    WHERE id = p_new_user_id;
  END IF;

  RETURN v_invitation_id;
END;
$$;


ALTER FUNCTION "public"."consume_invitation_token"("p_token" "text", "p_new_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_athlete_favorites"("athlete_uuid" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COUNT(*)::INTEGER
  FROM recruiter_favorites
  WHERE athlete_id = athlete_uuid;
$$;


ALTER FUNCTION "public"."count_athlete_favorites"("athlete_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_athlete_views"("athlete_uuid" "uuid") RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT COUNT(*)::INTEGER
  FROM recruiter_athlete_views
  WHERE athlete_id = athlete_uuid;
$$;


ALTER FUNCTION "public"."count_athlete_views"("athlete_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_coach_athletes"("uid" "uuid" DEFAULT "auth"."uid"()) RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  SELECT COUNT(*)::INTEGER FROM athletes WHERE coach_id = auth.uid();
$$;


ALTER FUNCTION "public"."count_coach_athletes"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."count_user_favorites"("uid" "uuid" DEFAULT "auth"."uid"()) RETURNS integer
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  SELECT COUNT(*)::INTEGER FROM recruiter_favorites WHERE recruiter_id = auth.uid();
$$;


ALTER FUNCTION "public"."count_user_favorites"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_athlete_invitation"("p_athlete_id" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "row_security" TO 'off'
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_caller   uuid;
  v_coach_id uuid;
  v_user_id  uuid;
  v_token    text;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT coach_id, user_id INTO v_coach_id, v_user_id
  FROM public.athletes WHERE id = p_athlete_id;

  IF NOT FOUND OR v_coach_id IS NULL THEN
    RAISE EXCEPTION 'ATHLETE_NOT_FOUND';
  END IF;

  IF v_coach_id <> v_caller THEN
    RAISE EXCEPTION 'NOT_OWNER';
  END IF;

  IF v_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'ALREADY_CLAIMED';
  END IF;

  SELECT token INTO v_token
  FROM public.athlete_invitations
  WHERE athlete_id = p_athlete_id
    AND status = 'PENDING'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_token IS NOT NULL THEN
    RETURN v_token;
  END IF;

  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.athlete_invitations (token, athlete_id, created_by)
  VALUES (v_token, p_athlete_id, v_caller);

  RETURN v_token;
END;
$$;


ALTER FUNCTION "public"."create_athlete_invitation"("p_athlete_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_default_subscription"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  INSERT INTO subscriptions (user_id, tier, status)
  VALUES (NEW.id, 'free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."create_default_subscription"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_email"() RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "row_security" TO 'off'
    SET "search_path" TO 'public'
    AS $$
  SELECT email::text FROM auth.users WHERE id = auth.uid();
$$;


ALTER FUNCTION "public"."current_user_email"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."current_user_school_id"() RETURNS "uuid"
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "row_security" TO 'off'
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_role text;
  v_school_id uuid;
BEGIN
  SELECT role INTO v_role FROM public.users WHERE id = auth.uid();
  IF v_role = 'ATHLETE' THEN
    SELECT school_id INTO v_school_id FROM public.athletes WHERE user_id = auth.uid();
  ELSE
    SELECT school_id INTO v_school_id FROM public.users WHERE id = auth.uid();
  END IF;
  RETURN v_school_id;
END;
$$;


ALTER FUNCTION "public"."current_user_school_id"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."deactivate_my_account"("p_revoke_consent" boolean DEFAULT false) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "row_security" TO 'off'
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  UPDATE public.users
     SET status = 'DESACTIVE'
   WHERE id = v_uid;

  UPDATE public.athletes
     SET status = 'DESACTIVE',
         consentement_parental = CASE WHEN p_revoke_consent
                                      THEN false
                                      ELSE consentement_parental END
   WHERE user_id = v_uid;
END;
$$;


ALTER FUNCTION "public"."deactivate_my_account"("p_revoke_consent" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_my_account"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
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


ALTER FUNCTION "public"."delete_my_account"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."demote_interim_on_director_appointment"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_interim_record RECORD;
  v_director_name TEXT;
  v_school_name TEXT;
BEGIN
  -- Only fire on transition INTO 'DIRECTEUR'
  -- (not on inserts where someone is already DIRECTEUR but the row is new,
  -- and not on updates that don't change role)
  IF NEW.role <> 'DIRECTEUR' THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, only proceed if role actually changed to DIRECTEUR
  IF TG_OP = 'UPDATE' AND OLD.role = 'DIRECTEUR' THEN
    RETURN NEW;
  END IF;

  -- Find any existing DIRECTEUR_INTERIM at the same school (excluding this row)
  -- Note: school_coaches uses coach_id (not user_id) — verified against live schema
  FOR v_interim_record IN
    SELECT sc.id, sc.coach_id, u.first_name, u.last_name
    FROM public.school_coaches sc
    JOIN public.users u ON u.id = sc.coach_id
    WHERE sc.school_id = NEW.school_id
      AND sc.role = 'DIRECTEUR_INTERIM'
      AND sc.id <> NEW.id
  LOOP
    -- Demote the interim to COACH
    UPDATE public.school_coaches
    SET role = 'COACH'
    WHERE id = v_interim_record.id;

    -- Resolve names for the notification message
    SELECT first_name || ' ' || last_name INTO v_director_name
    FROM public.users
    WHERE id = NEW.coach_id;

    SELECT name INTO v_school_name
    FROM public.schools
    WHERE id = NEW.school_id;

    -- Write a notification for the demoted interim
    INSERT INTO public.coach_notifications (coach_id, type, title, message, metadata)
    VALUES (
      v_interim_record.coach_id,
      'INTERIM_DEMOTED',
      'Ton rôle de directeur intérimaire a pris fin',
      COALESCE(v_director_name, 'Un directeur officiel') ||
        ' est maintenant directeur sportif de ' ||
        COALESCE(v_school_name, 'l''école') ||
        '. Ton rôle a été ramené à entraîneur.',
      jsonb_build_object(
        'school_id', NEW.school_id,
        'school_name', v_school_name,
        'new_director_user_id', NEW.coach_id,
        'new_director_name', v_director_name,
        'demoted_at', now()
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."demote_interim_on_director_appointment"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."emit_commitment_newsroom_event"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_athlete_name TEXT;
  v_school_name TEXT;
  v_sport_name TEXT;
BEGIN
  -- Only on transition INTO 'RECRUTE'
  IF NEW.recruitment_status = 'RECRUTE'
     AND (OLD.recruitment_status IS NULL OR OLD.recruitment_status IS DISTINCT FROM 'RECRUTE') THEN

    -- Skip if athlete is not partner-eligible
    IF NOT is_partner_eligible_athlete(NEW.id) THEN
      RETURN NEW;
    END IF;

    -- Resolve display fields. School name comes from the
    -- committed_school_id populated by the cascade; sport name
    -- from the athlete's primary sport.
    SELECT
      NEW.first_name || ' ' || NEW.last_name,
      sch.name,
      s.nom
    INTO v_athlete_name, v_school_name, v_sport_name
    FROM (SELECT 1) dummy
    LEFT JOIN schools sch ON sch.id = NEW.committed_school_id
    LEFT JOIN sports s ON s.id = NEW.sport_id;

    INSERT INTO newsroom_events (
      event_type, athlete_id, school_id, sport_id,
      title, description, metadata, occurred_at
    ) VALUES (
      'COMMITMENT',
      NEW.id,
      NEW.committed_school_id,
      NEW.sport_id,
      v_athlete_name || ' s''engage à ' || COALESCE(v_school_name, 'un CÉGEP'),
      'Engagement confirmé en ' || COALESCE(v_sport_name, 'sport-études'),
      jsonb_build_object(
        'school_id', NEW.committed_school_id,
        'school_name', v_school_name,
        'sport_name', v_sport_name
      ),
      NOW()
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."emit_commitment_newsroom_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."emit_five_star_newsroom_event"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_athlete_name TEXT;
  v_school_name TEXT;
  v_sport_name TEXT;
BEGIN
  IF NEW.cote_globale_entraineur IS NULL
     OR NEW.cote_globale_entraineur < 4.5 THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.cote_globale_entraineur IS NOT NULL
     AND OLD.cote_globale_entraineur >= 4.5 THEN
    RETURN NEW;
  END IF;

  IF NOT is_partner_eligible_athlete(NEW.id) THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM newsroom_events
    WHERE athlete_id = NEW.id
      AND event_type = 'FIVE_STAR_SIGNUP'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT sch.name, s.nom
    INTO v_school_name, v_sport_name
  FROM (SELECT 1) dummy
  LEFT JOIN schools sch ON sch.id = NEW.school_id
  LEFT JOIN sports s ON s.id = NEW.sport_id;

  v_athlete_name := NEW.first_name || ' ' || NEW.last_name;

  INSERT INTO newsroom_events (
    event_type, athlete_id, school_id, sport_id,
    title, description, metadata, occurred_at
  ) VALUES (
    'FIVE_STAR_SIGNUP',
    NEW.id,
    NEW.school_id,
    NEW.sport_id,
    v_athlete_name || ' atteint 5 etoiles',
    'Cote globale ' || NEW.cote_globale_entraineur || ' / 5 - ' || COALESCE(v_sport_name, 'sport-etudes'),
    jsonb_build_object(
      'cote_globale', NEW.cote_globale_entraineur,
      'school_name', v_school_name,
      'sport_name', v_sport_name,
      'emitted_via', 'rating_threshold_cross'
    ),
    NOW()
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."emit_five_star_newsroom_event"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."emit_five_star_on_eligibility_flip"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_athlete_name TEXT;
  v_school_name TEXT;
  v_sport_name TEXT;
  v_was_eligible BOOLEAN;
  v_is_eligible BOOLEAN;
BEGIN
  IF NEW.cote_globale_entraineur IS NULL
     OR NEW.cote_globale_entraineur < 4.5 THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM newsroom_events
    WHERE athlete_id = NEW.id
      AND event_type = 'FIVE_STAR_SIGNUP'
  ) THEN
    RETURN NEW;
  END IF;

  v_was_eligible :=
    COALESCE(OLD.partner_visibility_opt_in, false) = true
    AND (
      EXTRACT(YEAR FROM AGE(OLD.date_naissance)) >= 18
      OR COALESCE(OLD.partner_visibility_parental_consent, false) = true
    )
    AND COALESCE(OLD.verified, false) = true
    AND COALESCE(OLD.modified_since_verification, false) = false
    AND OLD.cote_globale_entraineur IS NOT NULL;

  v_is_eligible := is_partner_eligible_athlete(NEW.id);

  IF v_was_eligible OR NOT v_is_eligible THEN
    RETURN NEW;
  END IF;

  SELECT sch.name, s.nom
    INTO v_school_name, v_sport_name
  FROM (SELECT 1) dummy
  LEFT JOIN schools sch ON sch.id = NEW.school_id
  LEFT JOIN sports s ON s.id = NEW.sport_id;

  v_athlete_name := NEW.first_name || ' ' || NEW.last_name;

  INSERT INTO newsroom_events (
    event_type, athlete_id, school_id, sport_id,
    title, description, metadata, occurred_at
  ) VALUES (
    'FIVE_STAR_SIGNUP',
    NEW.id,
    NEW.school_id,
    NEW.sport_id,
    v_athlete_name || ' atteint 5 etoiles',
    'Cote globale ' || NEW.cote_globale_entraineur || ' / 5 - ' || COALESCE(v_sport_name, 'sport-etudes'),
    jsonb_build_object(
      'cote_globale', NEW.cote_globale_entraineur,
      'school_name', v_school_name,
      'sport_name', v_sport_name,
      'emitted_via', 'eligibility_flip'
    ),
    NOW()
  );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."emit_five_star_on_eligibility_flip"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fav_insert_to_pipeline"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_existing_id UUID;
BEGIN
  -- Check if a pipeline row already exists for this (recruiter, athlete)
  SELECT id INTO v_existing_id
  FROM public.recruiter_pipeline
  WHERE recruiter_id = NEW.recruiter_id
    AND athlete_id = NEW.athlete_id;

  IF v_existing_id IS NULL THEN
    -- No existing row: create at IDENTIFIE
    INSERT INTO public.recruiter_pipeline (recruiter_id, athlete_id, stage)
    VALUES (NEW.recruiter_id, NEW.athlete_id, 'IDENTIFIE');
  ELSE
    -- Existing row (re-favorite case): reset to IDENTIFIE only if currently RETIRE
    -- This protects active recruitment work — if the row is at any other stage
    -- (CONTACTE, EN_DISCUSSION, etc.) leave it alone. The favorite-pipeline
    -- coupling reasserts at IDENTIFIE only.
    UPDATE public.recruiter_pipeline
    SET stage = 'IDENTIFIE'
    WHERE id = v_existing_id
      AND stage = 'RETIRE';
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."fav_insert_to_pipeline"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finish_coach_civil_onboarding"("p_club_id" "uuid", "p_club_name" "text", "p_club_city" "text", "p_club_region" "text", "p_sport" "text", "p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_bio" "text", "p_experience_years" integer, "p_photo_url" "text", "p_team_id" "uuid", "p_team_name" "text", "p_team_age_group" "text", "p_team_gender" "text", "p_team_division" "text", "p_director_choice" "text", "p_rprp_accepted" boolean, "p_invite_email" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_uid                uuid;
  v_role               public.user_role;
  v_context            text;
  v_club_id            uuid;
  v_club_type          text;
  v_club_created       boolean := false;
  v_team_id            uuid;
  v_team_created       boolean := false;
  v_sport_id           uuid;
  v_has_resp           boolean;
  v_existing_pd        jsonb;
  v_merged_pd          jsonb;
  v_admin_type         text;
  v_pending_invite     jsonb;
  v_rprp_accepted_at   timestamptz;
  v_claim_type         text;
  v_existing_claim_id  uuid;
  v_claim_created      boolean := false;
  v_now                timestamptz := now();
BEGIN
  -- ── 1. Auth check ────────────────────────────────────────────
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  -- ── 2. Role + context check (civil : ligue_civile uniquement) ─
  SELECT role, context INTO v_role, v_context
  FROM public.users WHERE id = v_uid;

  IF v_role IS DISTINCT FROM 'COACH'::public.user_role
     OR v_context IS DISTINCT FROM 'ligue_civile'
  THEN
    RAISE EXCEPTION 'WRONG_ROLE_OR_CONTEXT';
  END IF;

  -- ── 3. Director choice validation (parité école : 4 choix) ──
  IF p_director_choice NOT IN ('owner', 'interim', 'invite', 'coach_only') THEN
    RAISE EXCEPTION 'INVALID_DIRECTOR_CHOICE';
  END IF;

  -- ── 4. Résoudre ou créer le club (delta civil) ─────────────
  IF p_club_id IS NOT NULL THEN
    SELECT type INTO v_club_type FROM public.schools WHERE id = p_club_id;
    IF v_club_type IS NULL OR v_club_type IS DISTINCT FROM 'LIGUE_CIVILE' THEN
      RAISE EXCEPTION 'INVALID_CLUB';
    END IF;
    v_club_id := p_club_id;
  ELSE
    IF p_club_name IS NULL OR LENGTH(TRIM(p_club_name)) = 0 THEN
      RAISE EXCEPTION 'INVALID_CLUB';
    END IF;
    INSERT INTO public.schools (name, type, city, region)
    VALUES (
      TRIM(p_club_name),
      'LIGUE_CIVILE',
      NULLIF(TRIM(COALESCE(p_club_city, '')),   ''),
      NULLIF(TRIM(COALESCE(p_club_region, '')), '')
    )
    RETURNING id INTO v_club_id;
    v_club_created := true;
  END IF;

  -- ── 5. ENFORCEMENT — règle Loi 25 (parité école) ───────────
  v_has_resp := public.school_has_responsable(v_club_id);

  -- Règle 1 : club sans responsable → seuls owner ou interim acceptés.
  --           (invite + coach_only sont rejetés tant qu'aucun responsable
  --            n'a attesté — on ne crée pas un club orphelin sur Nexus.)
  IF NOT v_has_resp AND p_director_choice NOT IN ('owner', 'interim') THEN
    RAISE EXCEPTION 'SCHOOL_REQUIRES_RESPONSABLE';
  END IF;

  -- Règle 2 : owner/interim exige p_rprp_accepted=true (Loi 25).
  IF p_director_choice IN ('owner', 'interim') AND p_rprp_accepted IS NOT TRUE THEN
    RAISE EXCEPTION 'RPRP_REQUIRED';
  END IF;

  -- ── 6. Résoudre sport_id (si création équipe) ──────────────
  IF p_sport IS NOT NULL AND LENGTH(TRIM(p_sport)) > 0 THEN
    SELECT id INTO v_sport_id FROM public.sports WHERE nom = TRIM(p_sport);
  END IF;

  -- ── 7. Préparation profile_data (parité école) ──────────────
  v_admin_type := CASE
    WHEN p_director_choice = 'owner'   THEN 'owner'
    WHEN p_director_choice = 'interim' THEN 'interim'
    ELSE NULL
  END;

  -- Invite : stash uniquement si email non-vide. type='league' (civil-
  -- specific, vs 'school' côté école — discriminateur préservé).
  v_pending_invite := CASE
    WHEN p_director_choice = 'invite' AND COALESCE(TRIM(p_invite_email), '') != ''
      THEN jsonb_build_object('email', TRIM(p_invite_email), 'sent_at', v_now, 'type', 'league')
    ELSE NULL
  END;

  -- RPRP timestamp : posé pour owner OU interim accepté.
  v_rprp_accepted_at := CASE
    WHEN p_director_choice IN ('owner','interim') AND p_rprp_accepted THEN v_now
    ELSE NULL
  END;

  -- ── 8. Merge profile_data (préserve l'existant) ─────────────
  SELECT COALESCE(profile_data, '{}'::jsonb) INTO v_existing_pd
  FROM public.users WHERE id = v_uid;

  v_merged_pd := v_existing_pd
    || jsonb_build_object('bio', NULLIF(TRIM(COALESCE(p_bio, '')), ''))
    || jsonb_build_object('experience_years', p_experience_years)
    || jsonb_build_object('admin_type', v_admin_type)
    || jsonb_build_object('pending_director_invite', v_pending_invite)
    || jsonb_build_object('rprp_accepted_at', v_rprp_accepted_at);

  -- ── 9. users UPDATE ─────────────────────────────────────────
  UPDATE public.users
  SET onboarding_complete = true,
      first_name          = NULLIF(TRIM(p_first_name), ''),
      last_name           = NULLIF(TRIM(p_last_name), ''),
      phone               = NULLIF(TRIM(COALESCE(p_phone, '')), ''),
      school_id           = v_club_id,
      region              = COALESCE(NULLIF(TRIM(COALESCE(p_club_region, '')), ''), region),
      sport               = p_sport,
      photo_url           = COALESCE(p_photo_url, photo_url),
      profile_data        = v_merged_pd
  WHERE id = v_uid;

  -- ── 10. school_coaches UPSERT — role TOUJOURS 'COACH' ───────
  -- Aucun chemin (owner/interim/invite/coach_only) n'écrit DIRECTEUR
  -- direct. Le claim DIRECTEUR/INTERIM passe par admin_claims +
  -- modération admin.
  INSERT INTO public.school_coaches (coach_id, school_id, role, sport)
  VALUES (v_uid, v_club_id, 'COACH'::public.coach_school_role, p_sport)
  ON CONFLICT (school_id, coach_id) DO UPDATE
    SET role  = EXCLUDED.role,
        sport = EXCLUDED.sport;

  -- ── 11. Équipe — rejoindre ou créer (inchangé) ──────────────
  IF p_team_id IS NOT NULL THEN
    v_team_id := p_team_id;
    INSERT INTO public.team_coaches (coach_id, team_id, role)
    VALUES (v_uid, v_team_id, 'assistant')
    ON CONFLICT (team_id, coach_id) DO NOTHING;
  ELSIF p_team_name IS NOT NULL AND LENGTH(TRIM(p_team_name)) > 0 THEN
    IF v_sport_id IS NULL THEN
      RAISE EXCEPTION 'INVALID_SPORT';
    END IF;
    INSERT INTO public.teams (
      school_id, sport_id, name, age_group, gender, division, is_active
    ) VALUES (
      v_club_id,
      v_sport_id,
      TRIM(p_team_name),
      NULLIF(TRIM(COALESCE(p_team_age_group, '')), ''),
      NULLIF(TRIM(COALESCE(p_team_gender,    '')), ''),
      NULLIF(TRIM(COALESCE(p_team_division,  '')), ''),
      true
    )
    RETURNING id INTO v_team_id;
    v_team_created := true;
    INSERT INTO public.team_coaches (coach_id, team_id, role)
    VALUES (v_uid, v_team_id, 'head_coach')
    ON CONFLICT (team_id, coach_id) DO NOTHING;
  END IF;

  -- ── 12. admin_claims INSERT si owner/interim — anti-duplicate ─
  IF p_director_choice IN ('owner', 'interim') THEN
    SELECT id INTO v_existing_claim_id
    FROM public.admin_claims
    WHERE user_id   = v_uid
      AND school_id = v_club_id
      AND status    IN ('PENDING', 'APPROVED')
    LIMIT 1;

    IF v_existing_claim_id IS NULL THEN
      v_claim_type := CASE
        WHEN p_director_choice = 'owner'   THEN 'DIRECTEUR'
        WHEN p_director_choice = 'interim' THEN 'INTERIM'
      END;
      INSERT INTO public.admin_claims (user_id, school_id, claim_type, status)
      VALUES (v_uid, v_club_id, v_claim_type, 'PENDING');
      v_claim_created := true;
    END IF;
  END IF;

  -- ── 13. Retour ──────────────────────────────────────────────
  RETURN jsonb_build_object(
    'ok',                     true,
    'club_id',                v_club_id,
    'club_created',           v_club_created,
    'has_responsable_before', v_has_resp,
    'team_id',                v_team_id,
    'team_created',           v_team_created,
    'claim_created',          v_claim_created
  );
END;
$$;


ALTER FUNCTION "public"."finish_coach_civil_onboarding"("p_club_id" "uuid", "p_club_name" "text", "p_club_city" "text", "p_club_region" "text", "p_sport" "text", "p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_bio" "text", "p_experience_years" integer, "p_photo_url" "text", "p_team_id" "uuid", "p_team_name" "text", "p_team_age_group" "text", "p_team_gender" "text", "p_team_division" "text", "p_director_choice" "text", "p_rprp_accepted" boolean, "p_invite_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finish_coach_school_onboarding"("p_school_id" "uuid", "p_region" "text", "p_sport" "text", "p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_bio" "text", "p_experience_years" integer, "p_photo_url" "text", "p_team_id" "uuid", "p_director_choice" "text", "p_rprp_accepted" boolean, "p_invite_email" "text", "p_team_name" "text" DEFAULT NULL::"text", "p_team_age_group" "text" DEFAULT NULL::"text", "p_team_gender" "text" DEFAULT NULL::"text", "p_team_division" "text" DEFAULT NULL::"text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_uid                uuid;
  v_role               public.user_role;
  v_context            text;
  v_has_resp           boolean;
  v_existing_pd        jsonb;
  v_merged_pd          jsonb;
  v_admin_type         text;
  v_pending_invite     jsonb;
  v_rprp_accepted_at   timestamptz;
  v_claim_type         text;
  v_existing_claim_id  uuid;
  v_claim_created      boolean := false;
  v_team_created       boolean := false;
  v_sport_id           uuid;
  v_team_id            uuid;
  v_now                timestamptz := now();
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  SELECT role, context INTO v_role, v_context
  FROM public.users WHERE id = v_uid;

  IF v_role IS DISTINCT FROM 'COACH'::public.user_role
     OR v_context IS NULL
     OR v_context = 'ligue_civile'
  THEN
    RAISE EXCEPTION 'WRONG_ROLE_OR_CONTEXT';
  END IF;

  IF p_director_choice NOT IN ('owner', 'interim', 'invite', 'coach_only') THEN
    RAISE EXCEPTION 'INVALID_DIRECTOR_CHOICE';
  END IF;

  v_has_resp := public.school_has_responsable(p_school_id);

  IF NOT v_has_resp AND p_director_choice NOT IN ('owner', 'interim') THEN
    RAISE EXCEPTION 'SCHOOL_REQUIRES_RESPONSABLE';
  END IF;

  IF p_director_choice IN ('owner', 'interim') AND p_rprp_accepted IS NOT TRUE THEN
    RAISE EXCEPTION 'RPRP_REQUIRED';
  END IF;

  v_admin_type := CASE
    WHEN p_director_choice = 'owner'   THEN 'owner'
    WHEN p_director_choice = 'interim' THEN 'interim'
    ELSE NULL
  END;

  v_pending_invite := CASE
    WHEN p_director_choice = 'invite' AND COALESCE(TRIM(p_invite_email), '') != ''
      THEN jsonb_build_object('email', TRIM(p_invite_email), 'sent_at', v_now, 'type', 'school')
    ELSE NULL
  END;

  v_rprp_accepted_at := CASE
    WHEN p_director_choice IN ('owner','interim') AND p_rprp_accepted THEN v_now
    ELSE NULL
  END;

  SELECT COALESCE(profile_data, '{}'::jsonb) INTO v_existing_pd
  FROM public.users WHERE id = v_uid;

  v_merged_pd := v_existing_pd
    || jsonb_build_object('bio', NULLIF(TRIM(COALESCE(p_bio, '')), ''))
    || jsonb_build_object('experience_years', p_experience_years)
    || jsonb_build_object('admin_type', v_admin_type)
    || jsonb_build_object('pending_director_invite', v_pending_invite)
    || jsonb_build_object('rprp_accepted_at', v_rprp_accepted_at);

  UPDATE public.users
  SET onboarding_complete = true,
      first_name          = NULLIF(TRIM(p_first_name), ''),
      last_name           = NULLIF(TRIM(p_last_name), ''),
      phone               = NULLIF(TRIM(COALESCE(p_phone, '')), ''),
      school_id           = p_school_id,
      region              = NULLIF(TRIM(COALESCE(p_region, '')), ''),
      sport               = p_sport,
      photo_url           = COALESCE(p_photo_url, photo_url),
      profile_data        = v_merged_pd
  WHERE id = v_uid;

  INSERT INTO public.school_coaches (coach_id, school_id, role, sport)
  VALUES (v_uid, p_school_id, 'COACH'::public.coach_school_role, p_sport)
  ON CONFLICT (school_id, coach_id) DO UPDATE
    SET role  = EXCLUDED.role,
        sport = EXCLUDED.sport;

  IF p_sport IS NOT NULL AND LENGTH(TRIM(p_sport)) > 0 THEN
    SELECT id INTO v_sport_id FROM public.sports WHERE nom = TRIM(p_sport);
  END IF;

  IF p_team_id IS NOT NULL THEN
    INSERT INTO public.team_coaches (coach_id, team_id, role)
    VALUES (v_uid, p_team_id, 'assistant')
    ON CONFLICT (team_id, coach_id) DO NOTHING;
    GET DIAGNOSTICS v_team_created = ROW_COUNT;
    v_team_created := (v_team_created::int = 1);

  ELSIF p_team_name IS NOT NULL AND LENGTH(TRIM(p_team_name)) > 0 THEN
    IF v_sport_id IS NULL THEN
      RAISE EXCEPTION 'INVALID_SPORT';
    END IF;
    INSERT INTO public.teams (school_id, sport_id, name, age_group, gender, division, is_active)
    VALUES (
      p_school_id,
      v_sport_id,
      TRIM(p_team_name),
      NULLIF(TRIM(COALESCE(p_team_age_group, '')), ''),
      NULLIF(TRIM(COALESCE(p_team_gender,    '')), ''),
      NULLIF(TRIM(COALESCE(p_team_division,  '')), ''),
      true
    )
    RETURNING id INTO v_team_id;
    INSERT INTO public.team_coaches (coach_id, team_id, role)
    VALUES (v_uid, v_team_id, 'head_coach')
    ON CONFLICT (team_id, coach_id) DO NOTHING;
    v_team_created := true;
  END IF;

  IF p_director_choice IN ('owner', 'interim') THEN
    SELECT id INTO v_existing_claim_id
    FROM public.admin_claims
    WHERE user_id   = v_uid
      AND school_id = p_school_id
      AND status    IN ('PENDING', 'APPROVED')
    LIMIT 1;

    IF v_existing_claim_id IS NULL THEN
      v_claim_type := CASE
        WHEN p_director_choice = 'owner'   THEN 'DIRECTEUR'
        WHEN p_director_choice = 'interim' THEN 'INTERIM'
      END;
      INSERT INTO public.admin_claims (user_id, school_id, claim_type, status)
      VALUES (v_uid, p_school_id, v_claim_type, 'PENDING');
      v_claim_created := true;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok',                     true,
    'has_responsable_before', v_has_resp,
    'claim_created',          v_claim_created,
    'team_linked',            COALESCE(v_team_created, false),
    'team_id',                v_team_id
  );
END;
$$;


ALTER FUNCTION "public"."finish_coach_school_onboarding"("p_school_id" "uuid", "p_region" "text", "p_sport" "text", "p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_bio" "text", "p_experience_years" integer, "p_photo_url" "text", "p_team_id" "uuid", "p_director_choice" "text", "p_rprp_accepted" boolean, "p_invite_email" "text", "p_team_name" "text", "p_team_age_group" "text", "p_team_gender" "text", "p_team_division" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."finish_recruiter_onboarding"("p_cegep_id" "uuid", "p_primary_team_id" "uuid", "p_sport" "text", "p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_bio" "text", "p_experience_years" integer, "p_photo_url" "text", "p_director_choice" "text", "p_rprp_accepted" boolean, "p_invite_email" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_uid                uuid;
  v_role               public.user_role;
  v_context            text;
  v_cegep_valid        boolean;
  v_has_resp           boolean;
  v_existing_pd        jsonb;
  v_merged_pd          jsonb;
  v_admin_type         text;
  v_pending_invite     jsonb;
  v_rprp_accepted_at   timestamptz;
  v_claim_type         text;
  v_existing_claim_id  uuid;
  v_claim_created      boolean := false;
  v_now                timestamptz := now();
BEGIN
  -- ── 1. Auth check ────────────────────────────────────────────
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  -- ── 2. Role + context check (recruteur : collegial uniquement) ─
  SELECT role, context INTO v_role, v_context
  FROM public.users WHERE id = v_uid;

  IF v_role IS DISTINCT FROM 'RECRUTEUR'::public.user_role
     OR v_context IS DISTINCT FROM 'collegial'
  THEN
    RAISE EXCEPTION 'WRONG_ROLE_OR_CONTEXT';
  END IF;

  -- ── 3. CÉGEP validation (has_collegial=true, cohérence wizard) ──
  SELECT (has_collegial = true) INTO v_cegep_valid
  FROM public.schools WHERE id = p_cegep_id;

  IF v_cegep_valid IS NULL OR NOT v_cegep_valid THEN
    RAISE EXCEPTION 'INVALID_CEGEP';
  END IF;

  -- ── 4. Director choice validation (parité école : 4 choix) ──
  IF p_director_choice NOT IN ('owner', 'interim', 'invite', 'coach_only') THEN
    RAISE EXCEPTION 'INVALID_DIRECTOR_CHOICE';
  END IF;

  -- ── 5. ENFORCEMENT — règle Loi 25 (parité école) ───────────
  v_has_resp := public.school_has_responsable(p_cegep_id);

  -- Règle 1 : CÉGEP sans responsable → seuls owner ou interim acceptés.
  IF NOT v_has_resp AND p_director_choice NOT IN ('owner', 'interim') THEN
    RAISE EXCEPTION 'SCHOOL_REQUIRES_RESPONSABLE';
  END IF;

  -- Règle 2 : owner/interim exige p_rprp_accepted=true.
  IF p_director_choice IN ('owner', 'interim') AND p_rprp_accepted IS NOT TRUE THEN
    RAISE EXCEPTION 'RPRP_REQUIRED';
  END IF;

  -- ── 6. Préparation profile_data (parité école) ──────────────
  v_admin_type := CASE
    WHEN p_director_choice = 'owner'   THEN 'owner'
    WHEN p_director_choice = 'interim' THEN 'interim'
    ELSE NULL
  END;

  -- Invite : stash uniquement si email non-vide. type='cegep'
  -- (recruteur-specific, vs 'school'/'league' côté coach).
  v_pending_invite := CASE
    WHEN p_director_choice = 'invite' AND COALESCE(TRIM(p_invite_email), '') != ''
      THEN jsonb_build_object('email', TRIM(p_invite_email), 'sent_at', v_now, 'type', 'cegep')
    ELSE NULL
  END;

  v_rprp_accepted_at := CASE
    WHEN p_director_choice IN ('owner','interim') AND p_rprp_accepted THEN v_now
    ELSE NULL
  END;

  -- ── 7. Merge profile_data (préserve l'existant) ─────────────
  SELECT COALESCE(profile_data, '{}'::jsonb) INTO v_existing_pd
  FROM public.users WHERE id = v_uid;

  v_merged_pd := v_existing_pd
    || jsonb_build_object('bio', NULLIF(TRIM(COALESCE(p_bio, '')), ''))
    || jsonb_build_object('experience_years', p_experience_years)
    || jsonb_build_object('admin_type', v_admin_type)
    || jsonb_build_object('pending_director_invite', v_pending_invite)
    || jsonb_build_object('rprp_accepted_at', v_rprp_accepted_at);

  -- ── 8. users UPDATE ─────────────────────────────────────────
  -- primary_team_id : conditionnel — si null fourni, on PRÉSERVE la
  -- valeur existante (COALESCE) plutôt que d'écraser. Le recruteur
  -- peut sauter le programme step et revenir le compléter plus tard.
  -- photo_url : idem (préserve si pas de nouvelle).
  UPDATE public.users
  SET onboarding_complete = true,
      first_name          = NULLIF(TRIM(p_first_name), ''),
      last_name           = NULLIF(TRIM(p_last_name), ''),
      phone               = NULLIF(TRIM(COALESCE(p_phone, '')), ''),
      school_id           = p_cegep_id,
      primary_team_id     = COALESCE(p_primary_team_id, primary_team_id),
      sport               = p_sport,
      photo_url           = COALESCE(p_photo_url, photo_url),
      profile_data        = v_merged_pd
  WHERE id = v_uid;

  -- ── 9. admin_claims INSERT si owner/interim — anti-duplicate ─
  IF p_director_choice IN ('owner', 'interim') THEN
    SELECT id INTO v_existing_claim_id
    FROM public.admin_claims
    WHERE user_id   = v_uid
      AND school_id = p_cegep_id
      AND status    IN ('PENDING', 'APPROVED')
    LIMIT 1;

    IF v_existing_claim_id IS NULL THEN
      v_claim_type := CASE
        WHEN p_director_choice = 'owner'   THEN 'DIRECTEUR'
        WHEN p_director_choice = 'interim' THEN 'INTERIM'
      END;
      INSERT INTO public.admin_claims (user_id, school_id, claim_type, status)
      VALUES (v_uid, p_cegep_id, v_claim_type, 'PENDING');
      v_claim_created := true;
    END IF;
  END IF;

  -- ── 10. Retour ──────────────────────────────────────────────
  RETURN jsonb_build_object(
    'ok',                     true,
    'cegep_id',               p_cegep_id,
    'has_responsable_before', v_has_resp,
    'claim_created',          v_claim_created
  );
END;
$$;


ALTER FUNCTION "public"."finish_recruiter_onboarding"("p_cegep_id" "uuid", "p_primary_team_id" "uuid", "p_sport" "text", "p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_bio" "text", "p_experience_years" integer, "p_photo_url" "text", "p_director_choice" "text", "p_rprp_accepted" boolean, "p_invite_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_athlete_view_details"() RETURNS TABLE("athlete_id" "uuid", "recruiter_id" "uuid", "recruiter_name" "text", "cegep_name" "text", "cegep_region" "text", "visit_count" bigint, "last_viewed_at" timestamp with time zone, "first_viewed_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  SELECT
    avd.athlete_id,
    avd.recruiter_id,
    avd.recruiter_name,
    avd.cegep_name,
    avd.cegep_region,
    avd.visit_count,
    avd.last_viewed_at,
    avd.first_viewed_at
  FROM public.athlete_view_details avd
  WHERE avd.athlete_id IN (
          SELECT id FROM public.athletes WHERE user_id = auth.uid()
        )
    AND public.user_has_pro(auth.uid());
$$;


ALTER FUNCTION "public"."get_my_athlete_view_details"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_sport_view_stats"("p_athlete_id" "uuid") RETURNS TABLE("total" bigint, "rank" bigint, "percentile" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "row_security" TO 'off'
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH sport AS (
    SELECT sport_id FROM athletes WHERE id = p_athlete_id
  ),
  athlete_views AS (
    SELECT a.id, COUNT(rav.id) as view_count
    FROM athletes a
    LEFT JOIN recruiter_athlete_views rav ON rav.athlete_id = a.id
    WHERE a.sport_id = (SELECT sport_id FROM sport)
    GROUP BY a.id
  ),
  ranked AS (
    SELECT av.id, av.view_count,
           RANK() OVER (ORDER BY av.view_count DESC) as rnk,
           COUNT(*) OVER () as total
    FROM athlete_views av
  )
  SELECT ranked.total::BIGINT,
         ranked.rnk::BIGINT,
         CASE 
           WHEN ranked.total <= 1 THEN 50
           ELSE ROUND(((ranked.total - ranked.rnk)::NUMERIC / (ranked.total - 1)) * 100, 0)
         END
  FROM ranked
  WHERE ranked.id = p_athlete_id;
END;
$$;


ALTER FUNCTION "public"."get_sport_view_stats"("p_athlete_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_tier"("uid" "uuid" DEFAULT "auth"."uid"()) RETURNS "text"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  SELECT COALESCE(
    (SELECT tier FROM subscriptions
     WHERE user_id = auth.uid() AND status = 'active'
     ORDER BY created_at DESC LIMIT 1),
    'free'
  );
$$;


ALTER FUNCTION "public"."get_user_tier"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
DECLARE
  v_invitation_token text;
  v_claim_token      text;
BEGIN
  INSERT INTO public.users (
    id, email, role, status, first_name, last_name, context, date_naissance
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::public.user_role,
      'ATHLETE'::public.user_role
    ),
    'ACTIF'::public.account_status,
    NEW.raw_user_meta_data->>'first_name',
    NEW.raw_user_meta_data->>'last_name',
    CASE NEW.raw_user_meta_data->>'context'
      WHEN 'scolaire'     THEN 'scolaire'
      WHEN 'collegial'    THEN 'collegial'
      WHEN 'ligue_civile' THEN 'ligue_civile'
      ELSE NULL
    END,
    CASE
      WHEN NEW.raw_user_meta_data->>'date_naissance' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        THEN (NEW.raw_user_meta_data->>'date_naissance')::date
      ELSE NULL
    END
  )
  ON CONFLICT (id) DO NOTHING;

  v_invitation_token := NEW.raw_user_meta_data->>'invitation_token';
  IF v_invitation_token IS NOT NULL AND v_invitation_token != '' THEN
    PERFORM public.consume_invitation_token(v_invitation_token, NEW.id);
  END IF;

  v_claim_token := NEW.raw_user_meta_data->>'claim_token';
  IF v_claim_token IS NOT NULL AND v_claim_token <> '' THEN
    BEGIN
      PERFORM public.consume_athlete_invitation(v_claim_token, NEW.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'consume_athlete_invitation failed (non-fatal): %', SQLERRM;
    END;
  END IF;

  RETURN NEW;
END;
$_$;


ALTER FUNCTION "public"."handle_new_auth_user"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."handle_new_auth_user"() IS 'Mirrors auth.users → public.users on signup. Reads first_name, last_name, context, invitation_token from raw_user_meta_data (set by signUp() options.data). Consumes any provided invitation_token to propagate school_id. SECURITY DEFINER bypasses RLS + GRANT.';



CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "row_security" TO 'off'
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN');
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_approved_partner"("uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM media_partners
    WHERE user_id = auth.uid() AND status = 'APPROVED'
  );
$$;


ALTER FUNCTION "public"."is_approved_partner"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_coach"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role = 'COACH'
  );
$$;


ALTER FUNCTION "public"."is_coach"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_partner_eligible_athlete"("p_athlete_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  SELECT
    a.partner_visibility_opt_in = true
    AND (
      EXTRACT(YEAR FROM AGE(a.date_naissance)) >= 18
      OR a.partner_visibility_parental_consent = true
    )
  FROM public.athletes a
  WHERE a.id = p_athlete_id;
$$;


ALTER FUNCTION "public"."is_partner_eligible_athlete"("p_athlete_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_platform_admin"("uid" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  SELECT COALESCE(
    (SELECT is_platform_admin FROM public.users WHERE id = auth.uid()),
    false
  );
$$;


ALTER FUNCTION "public"."is_platform_admin"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_recruiter"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role = 'RECRUTEUR'::user_role
  );
$$;


ALTER FUNCTION "public"."is_recruiter"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_athlete_on_signup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE athletes 
  SET user_id = NEW.id
  WHERE email = NEW.email 
    AND user_id IS NULL;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."link_athlete_on_signup"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_athlete_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ BEGIN IF OLD.video_faits_saillants_url IS DISTINCT FROM NEW.video_faits_saillants_url OR OLD.verified IS DISTINCT FROM NEW.verified OR OLD.cote_globale_entraineur IS DISTINCT FROM NEW.cote_globale_entraineur THEN INSERT INTO recruiter_activity_log (recruiter_id, athlete_id, action_type, details) SELECT rf.recruiter_id, NEW.id, CASE WHEN OLD.video_faits_saillants_url IS DISTINCT FROM NEW.video_faits_saillants_url AND NEW.video_faits_saillants_url IS NOT NULL THEN 'VIDEO_ADDED' WHEN OLD.verified IS DISTINCT FROM NEW.verified AND NEW.verified = true THEN 'ATHLETE_VERIFIED' ELSE 'PROFILE_UPDATED' END, jsonb_build_object('first_name', NEW.first_name, 'last_name', NEW.last_name) FROM recruiter_favorites rf WHERE rf.athlete_id = NEW.id; END IF; RETURN NEW; END; $$;


ALTER FUNCTION "public"."log_athlete_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_coach_activity_badge"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "row_security" TO 'off'
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_athlete RECORD;
BEGIN
  -- Only fire if distinctions actually changed
  IF (OLD.distinctions IS DISTINCT FROM NEW.distinctions) AND NEW.distinctions IS NOT NULL THEN
    SELECT first_name, last_name, coach_id
    INTO v_athlete
    FROM athletes
    WHERE id = NEW.athlete_id;

    IF v_athlete.coach_id IS NOT NULL THEN
      INSERT INTO activities (type, actor_id, actor_role, athlete_id, coach_id, metadata)
      VALUES (
        'BADGE_EARNED',
        v_athlete.coach_id,
        'coach',
        NEW.athlete_id,
        v_athlete.coach_id,
        jsonb_build_object(
          'first_name', v_athlete.first_name,
          'last_name', v_athlete.last_name,
          'distinctions', NEW.distinctions
        )
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_coach_activity_badge"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_coach_activity_favorited"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_athlete RECORD;
  v_coach_id UUID;
BEGIN
  -- Get athlete info + their coach
  SELECT a.first_name, a.last_name, a.coach_id
  INTO v_athlete
  FROM athletes a
  WHERE a.id = NEW.athlete_id;

  IF v_athlete.coach_id IS NOT NULL THEN
    INSERT INTO activities (type, actor_id, actor_role, athlete_id, coach_id, metadata)
    VALUES (
      'FAVORITED',
      NEW.recruiter_id,
      'recruiter',
      NEW.athlete_id,
      v_athlete.coach_id,
      jsonb_build_object(
        'first_name', v_athlete.first_name,
        'last_name', v_athlete.last_name,
        'recruiter_id', NEW.recruiter_id
      )
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_coach_activity_favorited"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_coach_activity_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_conv RECORD;
  v_athlete RECORD;
BEGIN
  -- Get conversation details
  SELECT * INTO v_conv
  FROM conversations
  WHERE id = NEW.conversation_id;

  IF v_conv.coach_id IS NOT NULL AND NEW.sender_id != v_conv.coach_id THEN
    -- Message sent TO the coach (not by the coach)
    SELECT first_name, last_name INTO v_athlete
    FROM athletes WHERE id = v_conv.athlete_id;

    INSERT INTO activities (type, actor_id, actor_role, athlete_id, coach_id, metadata)
    VALUES (
      'NEW_MESSAGE',
      NEW.sender_id,
      'recruiter',
      v_conv.athlete_id,
      v_conv.coach_id,
      jsonb_build_object(
        'first_name', COALESCE(v_athlete.first_name, ''),
        'last_name', COALESCE(v_athlete.last_name, ''),
        'conversation_id', NEW.conversation_id,
        'preview', LEFT(NEW.content, 100)
      )
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_coach_activity_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_coach_activity_verified"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  IF OLD.verified = false AND NEW.verified = true AND NEW.coach_id IS NOT NULL THEN
    INSERT INTO activities (type, actor_id, actor_role, athlete_id, coach_id, metadata)
    VALUES (
      'PROFILE_VERIFIED',
      NEW.coach_id,
      'coach',
      NEW.id,
      NEW.coach_id,
      jsonb_build_object(
        'first_name', NEW.first_name,
        'last_name', NEW.last_name
      )
    );
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_coach_activity_verified"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_coach_reply"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.recruiter_activity_log (recruiter_id, athlete_id, action_type, details)
  SELECT c.recruiter_id, c.athlete_id, 'COACH_REPLY',
    jsonb_build_object(
      'first_name', u.first_name,
      'last_name', u.last_name,
      'conversation_id', c.id
    )
  FROM public.conversations c
  LEFT JOIN public.users u ON u.id = NEW.sender_id
  WHERE c.id = NEW.conversation_id
    AND NEW.sender_id = c.coach_id
    AND NEW.sender_id <> c.recruiter_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_coach_reply"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_consent_change"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO consent_audit_trail
      (consent_id, athlete_id, action, previous_status, new_status)
    VALUES
      (NEW.id, NEW.athlete_id, NEW.status, OLD.status, NEW.status);
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_consent_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_favorite_added"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO recruiter_activity_log (recruiter_id, athlete_id, action_type, details)
  SELECT NEW.recruiter_id, NEW.athlete_id, 'FAVORITED',
    jsonb_build_object('first_name', a.first_name, 'last_name', a.last_name)
  FROM athletes a WHERE a.id = NEW.athlete_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_favorite_added"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_list_created"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.recruiter_activity_log (recruiter_id, athlete_id, list_id, action_type, details)
  VALUES (NEW.recruiter_id, NULL, NEW.id, 'LIST_CREATED',
    jsonb_build_object('list_name', NEW.name));
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_list_created"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_list_member_added"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.recruiter_activity_log (recruiter_id, athlete_id, list_id, action_type, details)
  SELECT l.recruiter_id, NEW.athlete_id, NEW.list_id, 'ATHLETE_ADDED_TO_LIST',
    jsonb_build_object(
      'first_name', a.first_name,
      'last_name', a.last_name,
      'list_name', l.name
    )
  FROM public.recruiter_lists l
  JOIN public.athletes a ON a.id = NEW.athlete_id
  WHERE l.id = NEW.list_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_list_member_added"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_list_member_removed"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.recruiter_activity_log (recruiter_id, athlete_id, list_id, action_type, details)
  SELECT l.recruiter_id, OLD.athlete_id, OLD.list_id, 'ATHLETE_REMOVED_FROM_LIST',
    jsonb_build_object(
      'first_name', a.first_name,
      'last_name', a.last_name,
      'list_name', l.name
    )
  FROM public.recruiter_lists l
  JOIN public.athletes a ON a.id = OLD.athlete_id
  WHERE l.id = OLD.list_id;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."log_list_member_removed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_list_note_added"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.recruiter_activity_log (recruiter_id, athlete_id, list_id, action_type, details)
  SELECT NEW.recruiter_id, NULL, NEW.list_id, 'LIST_NOTE_ADDED',
    jsonb_build_object('list_name', l.name)
  FROM public.recruiter_lists l
  WHERE l.id = NEW.list_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_list_note_added"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_new_athlete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO recruiter_activity_log (recruiter_id, athlete_id, action_type, details)
  SELECT DISTINCT rf.recruiter_id, NEW.id, 'NEW_ATHLETE',
    jsonb_build_object('first_name', NEW.first_name, 'last_name', NEW.last_name)
  FROM recruiter_favorites rf;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_new_athlete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_note_added"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO recruiter_activity_log (recruiter_id, athlete_id, action_type, details)
  SELECT NEW.recruiter_id, NEW.athlete_id, 'NOTE_ADDED',
    jsonb_build_object('first_name', a.first_name, 'last_name', a.last_name)
  FROM athletes a WHERE a.id = NEW.athlete_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_note_added"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_pipeline_change"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.recruiter_activity_log (recruiter_id, athlete_id, action_type, details)
  SELECT NEW.recruiter_id, NEW.athlete_id, 'PIPELINE_CHANGED',
    jsonb_build_object(
      'first_name', a.first_name,
      'last_name', a.last_name,
      'new_stage', NEW.stage,
      -- Iter 7.30a — capture du before_stage pour afficher "X → Y" dans le feed.
      -- Sur AFTER INSERT, OLD.* est NULL → before_stage NULL (1ère entrée pipeline).
      -- Sur AFTER UPDATE, OLD.stage est la valeur avant changement.
      'before_stage', CASE WHEN TG_OP = 'UPDATE' THEN OLD.stage ELSE NULL END
    )
  FROM public.athletes a WHERE a.id = NEW.athlete_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_pipeline_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_profile_view"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO recruiter_activity_log (recruiter_id, athlete_id, action_type, details)
  SELECT NEW.recruiter_id, NEW.athlete_id, 'PROFILE_VIEWED',
    jsonb_build_object('first_name', a.first_name, 'last_name', a.last_name)
  FROM athletes a WHERE a.id = NEW.athlete_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_profile_view"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_review_submitted"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO recruiter_activity_log (recruiter_id, athlete_id, action_type, details)
  VALUES (NEW.recruiter_id, NEW.athlete_id, 'REVIEW_SUBMITTED',
    jsonb_build_object('coach_id', NEW.coach_id, 'note_globale', NEW.note_globale));
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_review_submitted"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_unfavorited"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.recruiter_activity_log (recruiter_id, athlete_id, action_type, details)
  SELECT OLD.recruiter_id, OLD.athlete_id, 'UNFAVORITED',
    jsonb_build_object('first_name', a.first_name, 'last_name', a.last_name)
  FROM public.athletes a WHERE a.id = OLD.athlete_id;
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."log_unfavorited"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lookup_civil_unclaimed_by_email"("p_prefix" "text") RETURNS TABLE("user_id" "uuid", "athlete_id" "uuid", "email" "text", "first_name" "text", "last_name" "text", "sport_name" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_prefix text := lower(trim(coalesce(p_prefix, '')));
BEGIN
  -- Garde rôle : seuls les coachs (auth.uid() = appelant, jamais le définer).
  IF NOT public.is_coach() THEN
    RETURN;
  END IF;
  -- Garde longueur : anti-énumération (miroir du minimum côté TS).
  IF length(v_prefix) < 4 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT u.id, a.id, u.email, a.first_name, a.last_name, sp.nom
  FROM public.users u
  JOIN public.athletes a ON a.user_id = u.id
  LEFT JOIN public.schools s  ON s.id  = a.school_id
  LEFT JOIN public.sports  sp ON sp.id = a.sport_id
  WHERE u.role = 'ATHLETE'::public.user_role
    AND u.email ILIKE v_prefix || '%'
    AND a.coach_id IS NULL
    AND (a.school_id IS NULL OR s.type = 'LIGUE_CIVILE')
  ORDER BY u.email
  LIMIT 3;
END;
$$;


ALTER FUNCTION "public"."lookup_civil_unclaimed_by_email"("p_prefix" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_athlete_evaluation_updated"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "row_security" TO 'off'
    SET "search_path" TO 'public'
    AS $$ BEGIN IF NEW.cote_globale IS NOT NULL AND NEW.cote_globale IS DISTINCT FROM OLD.cote_globale THEN INSERT INTO athlete_notifications (athlete_id, type, title, metadata) VALUES (NEW.athlete_id, 'COACH_EVALUATION_UPDATED', 'Ton coach a mis à jour ton évaluation : Cote Globale ' || ROUND(NEW.cote_globale::numeric, 1)::text || '/5', jsonb_build_object('cote', NEW.cote_globale)); END IF; RETURN NEW; END; $$;


ALTER FUNCTION "public"."notify_athlete_evaluation_updated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_athlete_favorited"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ BEGIN INSERT INTO athlete_notifications (athlete_id, type, title, metadata) VALUES (NEW.athlete_id, 'ADDED_TO_FAVORITES', 'Un recruteur t''a ajouté à ses favoris', jsonb_build_object('recruiter_id', NEW.recruiter_id)); RETURN NEW; END; $$;


ALTER FUNCTION "public"."notify_athlete_favorited"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_athlete_profile_viewed"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ DECLARE v_region TEXT; BEGIN SELECT s.region INTO v_region FROM users u LEFT JOIN schools s ON s.id = u.school_id WHERE u.id = NEW.recruiter_id; INSERT INTO athlete_notifications (athlete_id, type, title, metadata) VALUES (NEW.athlete_id, 'PROFILE_VIEWED', 'Un recruteur de la région ' || COALESCE(v_region, 'inconnue') || ' a consulté ton profil', jsonb_build_object('recruiter_id', NEW.recruiter_id, 'region', v_region)); RETURN NEW; END; $$;


ALTER FUNCTION "public"."notify_athlete_profile_viewed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_athlete_suggestion_result"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_title TEXT;
  v_is_rating BOOLEAN;
BEGIN
  v_is_rating := NEW.champ IN (
    'Cote globale', 'Leadership', 'Discipline', 'Coachabilité',
    'Intelligence de jeu', 'Compétitivité', 'Esprit d''équipe',
    'Résilience', 'Attitude / Mentalité',
    'Vitesse / Explosivité', 'Force / Puissance', 'Endurance / Cardio',
    'Agilité / Coordination', 'Vision du jeu', 'Sens tactique'
  );

  IF NEW.status = 'APPROUVEE' AND OLD.status = 'EN_ATTENTE' THEN
    IF NEW.champ = 'Distinctions' THEN
      v_title := 'Ton coach a approuvé ta suggestion : Distinctions mises à jour';
    ELSIF v_is_rating AND COALESCE(NEW.valeur_proposee, '') <> '' THEN
      v_title := 'Ton coach a approuvé ta suggestion : ' || NEW.champ
              || ' mis à jour (' || NEW.valeur_proposee || '/5)';
    ELSE
      v_title := 'Ton coach a approuvé ta suggestion : ' || COALESCE(NEW.champ, '')
              || ' mis à jour';
    END IF;

    INSERT INTO athlete_notifications (athlete_id, type, title, metadata)
    VALUES (
      NEW.athlete_id,
      'SUGGESTION_APPROVED',
      v_title,
      jsonb_build_object('champ', NEW.champ, 'valeur', NEW.valeur_proposee)
    );

  ELSIF NEW.status = 'REJETEE' AND OLD.status = 'EN_ATTENTE' THEN
    v_title := 'Ton coach a rejeté ta suggestion : ' || COALESCE(NEW.champ, '');

    INSERT INTO athlete_notifications (athlete_id, type, title, metadata)
    VALUES (
      NEW.athlete_id,
      'SUGGESTION_REJECTED',
      v_title,
      jsonb_build_object('champ', NEW.champ, 'raison', NEW.raison_rejet)
    );
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_athlete_suggestion_result"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_athlete_verified"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ BEGIN IF NEW.verified = true AND OLD.verified = false THEN INSERT INTO athlete_notifications (athlete_id, type, title, metadata) VALUES (NEW.id, 'COACH_REPORT_UPDATED', 'Ton coach a vérifié ton profil', jsonb_build_object('action', 'verified')); END IF; RETURN NEW; END; $$;


ALTER FUNCTION "public"."notify_athlete_verified"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_on_message"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    SET "row_security" TO 'off'
    AS $$
declare
  v_secret text;
  v_url text := 'https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/send-push';
  r record;
begin
  begin
    select decrypted_secret into v_secret
    from vault.decrypted_secrets
    where name = 'PUSH_DISPATCH_SECRET'
    limit 1;

    if v_secret is null then
      raise warning 'notify_on_message: PUSH_DISPATCH_SECRET absent du Vault';
      return null;
    end if;

    for r in
      select p.user_id
      from public.conversations c
      cross join lateral (values
        (c.recruiter_id),
        (c.coach_id),
        ((select a.user_id from public.athletes a where a.id = c.athlete_id))
      ) as p(user_id)
      where c.id = NEW.conversation_id
        and p.user_id is not null
        and p.user_id <> NEW.sender_id
    loop
      perform net.http_post(
        url := v_url,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-push-secret', v_secret
        ),
        body := jsonb_build_object(
          'user_id', r.user_id,
          'title', 'Nexus',
          'body', 'Tu as un nouveau message',
          'data', jsonb_build_object(
            'type', 'message',
            'conversation_id', NEW.conversation_id
          )
        )
      );
    end loop;

  exception when others then
    raise warning 'notify_on_message a échoué pour message %: %', NEW.id, SQLERRM;
  end;

  return null; -- AFTER trigger : retour ignoré
end;
$$;


ALTER FUNCTION "public"."notify_on_message"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."partner_privileged_cols_unchanged"("p_status" "text", "p_show_on_homepage" boolean) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "row_security" TO 'off'
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.media_partners
    WHERE user_id = auth.uid()
      AND status IS NOT DISTINCT FROM p_status
      AND show_on_homepage IS NOT DISTINCT FROM p_show_on_homepage
  );
$$;


ALTER FUNCTION "public"."partner_privileged_cols_unchanged"("p_status" "text", "p_show_on_homepage" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."register_device_token"("p_token" "text", "p_platform" "text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    SET "row_security" TO 'off'
    AS $$
begin
  if auth.uid() is null then
    raise exception 'register_device_token: appel non authentifié';
  end if;
  if p_platform not in ('ios','android') then
    raise exception 'register_device_token: platform invalide (%)', p_platform;
  end if;

  insert into public.device_tokens (user_id, token, platform, last_seen_at)
  values (auth.uid(), p_token, p_platform, now())
  on conflict (token) do update
    set user_id      = excluded.user_id,
        platform     = excluded.platform,
        last_seen_at = now();
end;
$$;


ALTER FUNCTION "public"."register_device_token"("p_token" "text", "p_platform" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."require_recruiter_role"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = NEW.recruiter_id AND role = 'RECRUTEUR'
  ) THEN
    RAISE EXCEPTION 'recruiter_id % is not a RECRUTEUR user', NEW.recruiter_id
      USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."require_recruiter_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."reset_athlete_anchor_on_team_remove"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  v_team_school_type text;
  v_other_civil_count int;
  v_deleted_school_id uuid;
BEGIN
  -- Type de la school liée à la team supprimée
  SELECT s.type, s.id INTO v_team_school_type, v_deleted_school_id
  FROM schools s
  JOIN teams t ON t.school_id = s.id
  WHERE t.id = OLD.team_id;

  -- School n'existe plus (cascade en cours) → exit silently
  IF v_team_school_type IS NULL THEN
    RETURN OLD;
  END IF;

  -- SECONDAIRE/CEGEP : athlète garde son school_id (école persiste
  -- au-delà d'une team isolée). Exit.
  IF v_team_school_type IN ('SECONDAIRE', 'CEGEP') THEN
    RETURN OLD;
  END IF;

  -- LIGUE_CIVILE : compter les autres teams civiles de l'athlète
  SELECT COUNT(*) INTO v_other_civil_count
  FROM team_athletes ta
  JOIN teams t ON t.id = ta.team_id
  JOIN schools s ON s.id = t.school_id
  WHERE ta.athlete_id = OLD.athlete_id
    AND s.type = 'LIGUE_CIVILE'
    AND ta.team_id <> OLD.team_id;

  IF v_other_civil_count = 0 THEN
    -- Aucune autre team civile : null-out school_id si match
    UPDATE athletes
    SET school_id = NULL
    WHERE id = OLD.athlete_id
      AND school_id = v_deleted_school_id;
  ELSE
    -- Repoint vers la plus récente des autres teams civiles
    UPDATE athletes
    SET school_id = (
      SELECT t.school_id
      FROM team_athletes ta
      JOIN teams t ON t.id = ta.team_id
      JOIN schools s ON s.id = t.school_id
      WHERE ta.athlete_id = OLD.athlete_id
        AND s.type = 'LIGUE_CIVILE'
        AND ta.team_id <> OLD.team_id
      ORDER BY ta.joined_at DESC NULLS LAST
      LIMIT 1
    )
    WHERE id = OLD.athlete_id
      AND school_id = v_deleted_school_id;
  END IF;

  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."reset_athlete_anchor_on_team_remove"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."reset_athlete_anchor_on_team_remove"() IS 'Resets athletes.league_team_id to NULL when the matching junction row is deleted. Preserves anchor when athlete is removed from a non-anchor team (multi-team edge case). Paired with 5.5d-iii-b UI removal flow.';



CREATE OR REPLACE FUNCTION "public"."resolve_athlete_invitation"("p_token" "text") RETURNS TABLE("athlete_id" "uuid", "email" "text", "first_name" "text", "last_name" "text", "status" "text", "expires_at" timestamp with time zone, "is_valid" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "row_security" TO 'off'
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id,
    a.email,
    a.first_name,
    a.last_name,
    ai.status,
    ai.expires_at,
    (ai.status = 'PENDING' AND ai.expires_at > now() AND a.user_id IS NULL) AS is_valid
  FROM public.athlete_invitations ai
  JOIN public.athletes a ON a.id = ai.athlete_id
  WHERE ai.token = p_token
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."resolve_athlete_invitation"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_invitation_token"("p_token" "text") RETURNS TABLE("email" "text", "school_id" "uuid", "school_name" "text", "locale" "text", "message" "text", "inviter_first_name" "text", "inviter_last_name" "text", "status" "public"."invitation_status", "expires_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "row_security" TO 'off'
    SET "search_path" TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    i.email,
    i.school_id,
    s.name AS school_name,
    i.locale,
    i.message,
    u.first_name AS inviter_first_name,
    u.last_name AS inviter_last_name,
    i.status,
    i.expires_at
  FROM public.invitations i
  LEFT JOIN public.schools s ON s.id = i.school_id
  LEFT JOIN public.users u ON u.id = i.invited_by
  WHERE i.token = p_token
  LIMIT 1;
END;
$$;


ALTER FUNCTION "public"."resolve_invitation_token"("p_token" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rls_auto_enable"() RETURNS "event_trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'pg_catalog'
    AS $$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$$;


ALTER FUNCTION "public"."rls_auto_enable"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."school_has_responsable"("p_school_id" "uuid") RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "row_security" TO 'off'
    SET "search_path" TO 'public'
    AS $$
  SELECT
    EXISTS (
      SELECT 1
      FROM public.admin_claims
      WHERE school_id  = p_school_id
        AND claim_type IN ('DIRECTEUR', 'INTERIM')
        AND status     = 'APPROVED'
    )
    OR EXISTS (
      SELECT 1
      FROM public.users
      WHERE school_id        = p_school_id
        AND is_school_admin  = true
    )
    OR EXISTS (
      SELECT 1
      FROM public.school_coaches
      WHERE school_id = p_school_id
        AND role IN ('DIRECTEUR'::public.coach_school_role,
                     'DIRECTEUR_INTERIM'::public.coach_school_role)
    );
$$;


ALTER FUNCTION "public"."school_has_responsable"("p_school_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_initial_role_and_context"("p_role" "text", "p_context" "text") RETURNS "jsonb"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
DECLARE
  v_uid  uuid;
  v_role public.user_role;
  v_ob   boolean;
  v_ctx  text;
BEGIN
  -- 1. Auth obligatoire
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;

  -- 2. Validation des valeurs (self-service : JAMAIS ADMIN/PARTNER)
  IF p_role NOT IN ('ATHLETE','COACH','RECRUTEUR') THEN
    RAISE EXCEPTION 'INVALID_ROLE';
  END IF;
  IF p_context NOT IN ('scolaire','collegial','ligue_civile') THEN
    RAISE EXCEPTION 'INVALID_CONTEXT';
  END IF;
  -- Cohérence role <-> context (athlète relâché : scolaire OU ligue_civile)
  IF NOT (
       (p_role = 'ATHLETE'   AND p_context IN ('scolaire','ligue_civile'))
    OR (p_role = 'COACH'     AND p_context IN ('scolaire','ligue_civile'))
    OR (p_role = 'RECRUTEUR' AND p_context = 'collegial')
  ) THEN
    RAISE EXCEPTION 'INCOHERENT_ROLE_CONTEXT';
  END IF;

  -- 3. Etat courant (lecture en row_security=off -> pas de recursion sur users)
  SELECT role, onboarding_complete, context
    INTO v_role, v_ob, v_ctx
  FROM public.users
  WHERE id = v_uid;

  IF v_role IS NULL THEN
    RAISE EXCEPTION 'NO_PROFILE';
  END IF;

  -- 4. Gardes one-shot
  IF v_ob IS TRUE THEN
    RAISE EXCEPTION 'ALREADY_ONBOARDED';
  END IF;
  IF v_role <> 'ATHLETE'::public.user_role THEN
    RAISE EXCEPTION 'ROLE_ALREADY_SET';
  END IF;
  IF v_ctx IS NOT NULL THEN
    RAISE EXCEPTION 'CONTEXT_ALREADY_SET';
  END IF;

  -- 5. Ecriture STRICTE : role + context UNIQUEMENT.
  UPDATE public.users
  SET role    = p_role::public.user_role,
      context = p_context
  WHERE id = v_uid;

  RETURN jsonb_build_object('ok', true, 'role', p_role, 'context', p_context);
END;
$$;


ALTER FUNCTION "public"."set_initial_role_and_context"("p_role" "text", "p_context" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_athlete_context"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE public.athletes
  SET context = NEW.context
  WHERE user_id = NEW.id;
  RETURN NEW;
END $$;


ALTER FUNCTION "public"."sync_athlete_context"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_global_recruitment_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  max_pipeline_stage TEXT;
  max_recruiter_id UUID;
  new_global_status recruitment_status;
  new_committed_school_id UUID;
BEGIN
  -- Tier guard: only Pro+ recruiters' pipeline writes propagate
  -- to the shared athletes.recruitment_status field.
  IF NOT public.user_has_pro(NEW.recruiter_id) THEN
    RETURN NEW;
  END IF;

  -- Compute the highest pipeline stage across ALL recruiters for
  -- this athlete, AND capture the recruiter_id of the row that
  -- produced it. Tiebreaker: most recent moved_at wins.
  SELECT stage, recruiter_id
    INTO max_pipeline_stage, max_recruiter_id
  FROM recruiter_pipeline
  WHERE athlete_id = NEW.athlete_id
  ORDER BY CASE stage
    WHEN 'IDENTIFIE'         THEN 1
    WHEN 'CONTACTE'          THEN 2
    WHEN 'EN_DISCUSSION'     THEN 3
    WHEN 'VISITE_PLANIFIEE'  THEN 4
    WHEN 'ENGAGE'            THEN 5
    WHEN 'LETTRE_SIGNEE'     THEN 6
    ELSE 0
  END DESC,
  moved_at DESC NULLS LAST
  LIMIT 1;

  IF max_pipeline_stage IN ('ENGAGE', 'LETTRE_SIGNEE') THEN
    new_global_status := 'RECRUTE';
    -- Source the committing CÉGEP from the recruiter whose row
    -- produced the max stage.
    SELECT school_id INTO new_committed_school_id
    FROM users
    WHERE id = max_recruiter_id;
  ELSIF max_pipeline_stage IN ('EN_DISCUSSION', 'VISITE_PLANIFIEE') THEN
    new_global_status := 'EN_PROCESSUS';
    new_committed_school_id := NULL;
  ELSE
    new_global_status := 'OUVERT';
    new_committed_school_id := NULL;
  END IF;

  -- Same precedence guard as before: only update if no manual
  -- override is set, or if the cascade is upgrading. This
  -- preserves coach/admin manual overrides at higher tiers.
  UPDATE athletes
  SET recruitment_status = new_global_status,
      committed_school_id = new_committed_school_id,
      recruitment_status_changed_at = now(),
      recruitment_status_changed_by = NULL
  WHERE id = NEW.athlete_id
    AND (
      recruitment_status_changed_by IS NULL
      OR
      CASE new_global_status
        WHEN 'OUVERT'       THEN 0
        WHEN 'EN_PROCESSUS' THEN 1
        WHEN 'RECRUTE'      THEN 2
        WHEN 'RETIRE'       THEN 3
      END
      >
      CASE recruitment_status
        WHEN 'OUVERT'       THEN 0
        WHEN 'EN_PROCESSUS' THEN 1
        WHEN 'RECRUTE'      THEN 2
        WHEN 'RETIRE'       THEN 3
      END
    );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_global_recruitment_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_school_admin_flag"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ BEGIN IF TG_OP = 'INSERT' THEN UPDATE users SET is_school_admin = true WHERE id = NEW.user_id; RETURN NEW; ELSIF TG_OP = 'DELETE' THEN IF NOT EXISTS (SELECT 1 FROM school_directors WHERE user_id = OLD.user_id AND id != OLD.id) THEN UPDATE users SET is_school_admin = false WHERE id = OLD.user_id; END IF; RETURN OLD; END IF; RETURN NULL; END; $$;


ALTER FUNCTION "public"."sync_school_admin_flag"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_user_admin_flag"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE users 
  SET is_school_admin = (NEW.role = 'DIRECTEUR')
  WHERE id = NEW.coach_id;
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_user_admin_flag"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_user_school_from_coaches"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- When a coach is added/moved to a school, update their users.school_id
  UPDATE users 
  SET school_id = NEW.school_id 
  WHERE id = NEW.coach_id 
  AND (school_id IS DISTINCT FROM NEW.school_id);
  
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_user_school_from_coaches"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_user_school_on_coach_remove"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  -- When a coach is removed, clear their school_id 
  -- (only if they don't have another school_coaches record)
  IF NOT EXISTS (
    SELECT 1 FROM school_coaches 
    WHERE coach_id = OLD.coach_id AND id != OLD.id
  ) THEN
    UPDATE users 
    SET school_id = NULL, is_school_admin = false
    WHERE id = OLD.coach_id;
  END IF;
  
  RETURN OLD;
END;
$$;


ALTER FUNCTION "public"."sync_user_school_on_coach_remove"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."upsert_stripe_customer"("p_user_id" "uuid", "p_customer_id" "text") RETURNS "void"
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  INSERT INTO public.subscriptions (user_id, stripe_customer_id, tier, status, tier_source)
  VALUES (p_user_id, p_customer_id, 'free', 'active', 'stripe')
  ON CONFLICT (user_id) DO UPDATE SET
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    updated_at = now();
$$;


ALTER FUNCTION "public"."upsert_stripe_customer"("p_user_id" "uuid", "p_customer_id" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_all_star"("uid" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  SELECT public.get_user_tier() = 'all_star';
$$;


ALTER FUNCTION "public"."user_has_all_star"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_has_pro"("uid" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  SELECT public.get_user_tier() IN ('pro', 'all_star');
$$;


ALTER FUNCTION "public"."user_has_pro"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_is_school_admin"("uid" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    SET "row_security" TO 'off'
    AS $$
  SELECT COALESCE(
    (SELECT is_school_admin FROM users WHERE id = auth.uid()),
    false
  );
$$;


ALTER FUNCTION "public"."user_is_school_admin"("uid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."user_privileged_cols_unchanged"("p_role" "public"."user_role", "p_status" "public"."account_status", "p_is_platform_admin" boolean, "p_context" "text", "p_is_school_admin" boolean) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "row_security" TO 'off'
    SET "search_path" TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role IS NOT DISTINCT FROM p_role
      AND status IS NOT DISTINCT FROM p_status
      AND is_platform_admin IS NOT DISTINCT FROM p_is_platform_admin
      AND context IS NOT DISTINCT FROM p_context
      AND is_school_admin IS NOT DISTINCT FROM p_is_school_admin
  );
$$;


ALTER FUNCTION "public"."user_privileged_cols_unchanged"("p_role" "public"."user_role", "p_status" "public"."account_status", "p_is_platform_admin" boolean, "p_context" "text", "p_is_school_admin" boolean) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."_deprecated_athlete_views_2026_05" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "viewer_id" "uuid",
    "viewer_role" "text",
    "viewed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."_deprecated_athlete_views_2026_05" OWNER TO "postgres";


COMMENT ON TABLE "public"."_deprecated_athlete_views_2026_05" IS 'DEPRECATED 2026-05-03. Original orphan after canonical migration to recruiter_athlete_views. Drop after 3+ months of confirmed zero usage (target August 2026).';



CREATE TABLE IF NOT EXISTS "public"."_deprecated_profile_views_2026_05" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "recruiter_id" "uuid",
    "cegep_id" "uuid",
    "region" "text",
    "viewed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."_deprecated_profile_views_2026_05" OWNER TO "postgres";


COMMENT ON TABLE "public"."_deprecated_profile_views_2026_05" IS 'DEPRECATED 2026-05-03. Original orphan after canonical migration to recruiter_athlete_views. Three views (athlete_visibility_stats, athlete_view_details, athlete_views_weekly) were repointed before this rename. Drop after 3+ months of confirmed zero usage (target August 2026).';



CREATE TABLE IF NOT EXISTS "public"."activities" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "actor_id" "uuid",
    "actor_role" "text",
    "athlete_id" "uuid",
    "coach_id" "uuid" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "activities_type_check" CHECK (("type" = ANY (ARRAY['PROFILE_MODIFIED'::"text", 'PROFILE_VERIFIED'::"text", 'NEW_MESSAGE'::"text", 'FAVORITED'::"text", 'STATUS_CHANGED'::"text", 'ATHLETE_ADDED'::"text", 'VIDEO_ADDED'::"text", 'BADGE_EARNED'::"text", 'PROFILE_VIEWED'::"text", 'PIPELINE_CHANGED'::"text", 'PROFILE_UPDATED'::"text", 'NEW_ATHLETE'::"text", 'ADMIN_BROADCAST'::"text"])))
);


ALTER TABLE "public"."activities" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."activity_feed" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "school_id" "uuid",
    "event_type" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."activity_feed" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_claims" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "school_id" "uuid" NOT NULL,
    "claim_type" "text" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "reviewed_at" timestamp with time zone,
    "reviewer_id" "uuid",
    "rejection_reason" "text",
    CONSTRAINT "admin_claims_claim_type_check" CHECK (("claim_type" = ANY (ARRAY['DIRECTEUR'::"text", 'INTERIM'::"text"]))),
    CONSTRAINT "admin_claims_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'APPROVED'::"text", 'REJECTED'::"text"])))
);


ALTER TABLE "public"."admin_claims" OWNER TO "postgres";


COMMENT ON TABLE "public"."admin_claims" IS 'Item 11-Security: PENDING_VERIFICATION queue for coach signups claiming Directeur/Interim admin roles. Reviewed from /admin/approvals.';



CREATE TABLE IF NOT EXISTS "public"."admin_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text" NOT NULL,
    "related_user_id" "uuid",
    "read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."admin_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."admin_transfer_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "from_user_id" "uuid" NOT NULL,
    "to_user_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolved_by" "text",
    CONSTRAINT "admin_transfer_requests_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'APPROVED'::"text", 'REJECTED'::"text"])))
);


ALTER TABLE "public"."admin_transfer_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ambassadors" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "region_rseq" "text",
    "referral_code" "text" NOT NULL,
    "status" "text" DEFAULT 'CANDIDAT'::"text" NOT NULL,
    "activated_at" timestamp with time zone,
    "elite_at" timestamp with time zone,
    "inactivated_at" timestamp with time zone,
    "free_months_earned" integer DEFAULT 0 NOT NULL,
    "free_months_used" integer DEFAULT 0 NOT NULL,
    "commission_rate" numeric(4,2) DEFAULT 0.15 NOT NULL,
    "commission_balance_cents" integer DEFAULT 0 NOT NULL,
    "payout_threshold_cents" integer DEFAULT 5000 NOT NULL,
    "stripe_connect_id" "text",
    "stripe_connect_enabled" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "ambassadors_status_check" CHECK (("status" = ANY (ARRAY['CANDIDAT'::"text", 'ACTIF'::"text", 'CONFIRME'::"text", 'ELITE'::"text", 'INACTIF'::"text"]))),
    CONSTRAINT "ambassadors_type_check" CHECK (("type" = ANY (ARRAY['COACH'::"text", 'RECRUTEUR'::"text"])))
);


ALTER TABLE "public"."ambassadors" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_settings" (
    "key" "text" NOT NULL,
    "value" "text" NOT NULL,
    "type" "text" NOT NULL,
    "description" "text",
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "updated_by" "uuid",
    CONSTRAINT "app_settings_type_check" CHECK (("type" = ANY (ARRAY['STRING'::"text", 'NUMBER'::"text", 'BOOLEAN'::"text", 'JSON'::"text"])))
);


ALTER TABLE "public"."app_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_athletes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "jersey_number" "text",
    "is_captain" boolean DEFAULT false,
    "joined_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."team_athletes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_coaches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'assistant'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "team_coaches_role_check" CHECK (("role" = ANY (ARRAY['head_coach'::"text", 'assistant'::"text", 'coordinator'::"text"])))
);


ALTER TABLE "public"."team_coaches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "sport_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "division" "text",
    "league" "text",
    "season" "text" DEFAULT '2025-2026'::"text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "age_group" "text",
    "gender" "text"
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


COMMENT ON COLUMN "public"."teams"."gender" IS 'Optional gender designation (M/F/Mixed). Nullable for back-compat. Added in Phase 6.1.a to absorb league_teams.gender pre-data-migration.';



CREATE OR REPLACE VIEW "public"."athlete_coaches" AS
 SELECT DISTINCT "ta"."athlete_id",
    "tc"."coach_id",
    "tc"."role" AS "coach_role",
    "t"."id" AS "team_id",
    "t"."name" AS "team_name",
    "t"."division",
    "t"."league",
    "t"."sport_id"
   FROM (("public"."team_athletes" "ta"
     JOIN "public"."teams" "t" ON (("t"."id" = "ta"."team_id")))
     JOIN "public"."team_coaches" "tc" ON (("tc"."team_id" = "t"."id")))
  WHERE ("t"."is_active" = true);


ALTER VIEW "public"."athlete_coaches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."athlete_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "consumed_by_user_id" "uuid",
    "consumed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '30 days'::interval) NOT NULL,
    CONSTRAINT "athlete_invitations_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'CONSUMED'::"text", 'EXPIRED'::"text", 'REVOKED'::"text"])))
);


ALTER TABLE "public"."athlete_invitations" OWNER TO "postgres";


COMMENT ON TABLE "public"."athlete_invitations" IS '#48 token de claim lie a un athletes.id orphelin precis. Creation via create_athlete_invitation (garde coach-proprietaire + orphelin) ; resolution publique via resolve_athlete_invitation. Consume en sous-unite 3.';



CREATE TABLE IF NOT EXISTS "public"."athlete_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "read" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "athlete_notifications_type_check" CHECK (("type" = ANY (ARRAY['PROFILE_VIEWED'::"text", 'ADDED_TO_FAVORITES'::"text", 'SUGGESTION_APPROVED'::"text", 'SUGGESTION_REJECTED'::"text", 'COACH_REPORT_UPDATED'::"text", 'COACH_VERIFIED'::"text", 'COACH_MODIFIED_PROFILE'::"text", 'COACH_DISTINCTION_ADDED'::"text", 'COACH_EVALUATION_UPDATED'::"text", 'PROFILE_MILESTONE'::"text", 'PROFILE_TIP'::"text", 'ADMIN_BROADCAST'::"text"])))
);


ALTER TABLE "public"."athlete_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."athlete_suggestions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "coach_id" "uuid",
    "champ" "text" NOT NULL,
    "valeur_actuelle" "text",
    "valeur_proposee" "text" NOT NULL,
    "status" "text" DEFAULT 'EN_ATTENTE'::"text" NOT NULL,
    "raison_rejet" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "reviewed_at" timestamp with time zone,
    "submitted_by" "uuid",
    "message" "text",
    CONSTRAINT "athlete_suggestions_status_check" CHECK (("status" = ANY (ARRAY['EN_ATTENTE'::"text", 'APPROUVEE'::"text", 'REJETEE'::"text"])))
);


ALTER TABLE "public"."athlete_suggestions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."athlete_targets" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "school_id" "uuid" NOT NULL,
    "rank" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "status" "text" DEFAULT 'CIBLE'::"text" NOT NULL,
    CONSTRAINT "athlete_targets_status_check" CHECK (("status" = ANY (ARRAY['CIBLE'::"text", 'REVE'::"text"])))
);


ALTER TABLE "public"."athlete_targets" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recruiter_athlete_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recruiter_id" "uuid" NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "viewed_at" timestamp with time zone DEFAULT "now"(),
    "view_date" "date" GENERATED ALWAYS AS ((("viewed_at" AT TIME ZONE 'America/Montreal'::"text"))::"date") STORED
);


ALTER TABLE "public"."recruiter_athlete_views" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."schools" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "type" "text" NOT NULL,
    "region" "text",
    "city" "text",
    "address" "text",
    "logo_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "team_name" "text",
    "website" "text",
    "division" "text",
    "age_category" "text",
    "conference" "text",
    "reseau" "text",
    "langue" "text",
    "meq_code" "text",
    "has_secondaire" boolean DEFAULT false,
    "has_collegial" boolean DEFAULT false,
    "school_registry_id" "uuid",
    "postal_code" "text",
    "slug" "text",
    "iso_active" boolean,
    "rseq_institution_id" "uuid",
    CONSTRAINT "schools_langue_check" CHECK (("langue" = ANY (ARRAY['FR'::"text", 'EN'::"text", 'BILINGUE'::"text"]))),
    CONSTRAINT "schools_reseau_check" CHECK (("reseau" = ANY (ARRAY['PUBLIC'::"text", 'PRIVE'::"text"]))),
    CONSTRAINT "schools_type_check" CHECK (("type" = ANY (ARRAY['SECONDAIRE'::"text", 'CEGEP'::"text", 'LIGUE_CIVILE'::"text"])))
);


ALTER TABLE "public"."schools" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" NOT NULL,
    "email" "text" NOT NULL,
    "role" "public"."user_role" NOT NULL,
    "status" "public"."account_status" DEFAULT 'ACTIF'::"public"."account_status" NOT NULL,
    "school_id" "uuid",
    "first_name" "text",
    "last_name" "text",
    "phone" "text",
    "avatar_url" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "onboarding_complete" boolean DEFAULT false,
    "profile_data" "jsonb" DEFAULT '{}'::"jsonb",
    "is_school_admin" boolean DEFAULT false,
    "context" "text",
    "photo_url" "text",
    "title" "text",
    "division" "text",
    "team_name" "text",
    "sport" "text",
    "region" "text",
    "recruitment_preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "notification_preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "privacy_preferences" "jsonb" DEFAULT '{}'::"jsonb",
    "preferred_language" "text" DEFAULT 'fr'::"text",
    "is_platform_admin" boolean DEFAULT false NOT NULL,
    "primary_team_id" "uuid",
    "date_naissance" "date",
    CONSTRAINT "users_context_check" CHECK (("context" = ANY (ARRAY['scolaire'::"text", 'collegial'::"text", 'ligue_civile'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."athlete_view_details" WITH ("security_invoker"='on') AS
 SELECT "pv"."athlete_id",
    "pv"."recruiter_id",
    (("u"."first_name" || ' '::"text") || "u"."last_name") AS "recruiter_name",
    "s"."name" AS "cegep_name",
    "s"."region" AS "cegep_region",
    "count"(*) AS "visit_count",
    "max"("pv"."viewed_at") AS "last_viewed_at",
    "min"("pv"."viewed_at") AS "first_viewed_at"
   FROM (("public"."recruiter_athlete_views" "pv"
     JOIN "public"."users" "u" ON (("u"."id" = "pv"."recruiter_id")))
     LEFT JOIN "public"."schools" "s" ON (("s"."id" = "u"."school_id")))
  GROUP BY "pv"."athlete_id", "pv"."recruiter_id", "u"."first_name", "u"."last_name", "s"."name", "s"."region"
  ORDER BY ("max"("pv"."viewed_at")) DESC;


ALTER VIEW "public"."athlete_view_details" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."athlete_views_weekly" AS
 SELECT "athlete_id",
    ("date_trunc"('week'::"text", "viewed_at"))::"date" AS "week_start",
    "count"(*) AS "view_count"
   FROM "public"."recruiter_athlete_views" "pv"
  WHERE ("viewed_at" >= ("now"() - '56 days'::interval))
  GROUP BY "athlete_id", ("date_trunc"('week'::"text", "viewed_at"))
  ORDER BY (("date_trunc"('week'::"text", "viewed_at"))::"date");


ALTER VIEW "public"."athlete_views_weekly" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recruiter_favorites" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recruiter_id" "uuid" NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recruiter_favorites" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."athlete_visibility_stats" AS
 SELECT "athlete_id",
    "count"(*) FILTER (WHERE ("viewed_at" >= "date_trunc"('month'::"text", "now"()))) AS "views_this_month",
    "count"(*) FILTER (WHERE (("viewed_at" >= ("date_trunc"('month'::"text", "now"()) - '1 mon'::interval)) AND ("viewed_at" < "date_trunc"('month'::"text", "now"())))) AS "views_last_month",
    "count"(DISTINCT "recruiter_id") AS "unique_recruiters_total",
    "count"(DISTINCT "recruiter_id") FILTER (WHERE ("viewed_at" >= "date_trunc"('month'::"text", "now"()))) AS "unique_recruiters_this_month",
    ( SELECT "count"(*) AS "count"
           FROM "public"."recruiter_favorites" "rf"
          WHERE ("rf"."athlete_id" = "pv"."athlete_id")) AS "total_favorites"
   FROM "public"."recruiter_athlete_views" "pv"
  GROUP BY "athlete_id";


ALTER VIEW "public"."athlete_visibility_stats" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."athletes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "school_id" "uuid",
    "coach_id" "uuid",
    "first_name" "text" NOT NULL,
    "last_name" "text" NOT NULL,
    "date_naissance" "date",
    "genre" "text",
    "photo_url" "text",
    "email" "text",
    "telephone" "text",
    "nom_parent" "text",
    "telephone_parent" "text",
    "consentement_parental" boolean DEFAULT false NOT NULL,
    "consentement_parental_date" timestamp with time zone,
    "annee_diplomation" integer,
    "moyenne_generale" numeric(5,2),
    "matieres_fortes" "jsonb" DEFAULT '[]'::"jsonb",
    "mentions_academiques" "jsonb" DEFAULT '[]'::"jsonb",
    "programme_cegep_vise" "jsonb" DEFAULT '[]'::"jsonb",
    "ouvert_cegep_prive" boolean DEFAULT false,
    "ouvert_cegep_anglophone" boolean DEFAULT false,
    "pret_changer_region" boolean DEFAULT false,
    "regions_cegep_preferees" "jsonb" DEFAULT '[]'::"jsonb",
    "taille_pieds" integer,
    "taille_pouces" integer,
    "poids_lbs" numeric(5,1),
    "envergure" "text",
    "taille_mains" "text",
    "main_dominante" "text",
    "pied_dominant" "text",
    "test_40_verges" "text",
    "saut_vertical" "text",
    "saut_longueur" "text",
    "developpe_couche" "text",
    "navette_agilite" "text",
    "sprint_100m" "text",
    "sport_id" "uuid",
    "position_id" "uuid",
    "numero_jersey" "text",
    "sport_secondaire_id" "uuid",
    "position_secondaire_id" "uuid",
    "equipe_id" "uuid",
    "ligue_id" "uuid",
    "numero_association" "text",
    "ouvert_entraineur_cegep" boolean DEFAULT false,
    "video_faits_saillants_url" "text",
    "hudl_url" "text",
    "youtube_url" "text",
    "instagram_url" "text",
    "video_match_complet_url" "text",
    "video_entrainement_url" "text",
    "verified" boolean DEFAULT false NOT NULL,
    "verification_method" "public"."verification_method",
    "verified_at" timestamp with time zone,
    "verified_by" "uuid",
    "profile_completion" integer DEFAULT 0 NOT NULL,
    "cote_globale_entraineur" numeric(3,2),
    "status" "public"."account_status" DEFAULT 'ACTIF'::"public"."account_status" NOT NULL,
    "notes_coach" "text",
    "bio" "text",
    "programme_interet" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "consent_id" "uuid",
    "statut_recrutement_override" "text",
    "recrutement_override_at" timestamp with time zone,
    "modified_since_verification" boolean DEFAULT false,
    "last_verified_state_at" timestamp with time zone,
    "league_team_id" "uuid",
    "recruitment_status" "public"."recruitment_status" DEFAULT 'OUVERT'::"public"."recruitment_status" NOT NULL,
    "committed_school_id" "uuid",
    "open_to_offers" boolean,
    "recruitment_status_changed_by" "uuid",
    "recruitment_status_changed_at" timestamp with time zone,
    "parent_first_name" "text",
    "parent_last_name" "text",
    "parent_email" "text",
    "parent_relationship" "text",
    "last_profile_validation" timestamp with time zone,
    "partner_visibility_opt_in" boolean DEFAULT false NOT NULL,
    "partner_visibility_opted_in_at" timestamp with time zone,
    "partner_visibility_parental_consent" boolean DEFAULT false NOT NULL,
    "context" "text",
    "parcours_readiness" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    CONSTRAINT "chk_school_or_league" CHECK ((NOT (("school_id" IS NOT NULL) AND ("league_team_id" IS NOT NULL)))),
    CONSTRAINT "photo_url_not_signed" CHECK ((("photo_url" IS NULL) OR ("photo_url" !~~ '%/sign/%'::"text")))
);


ALTER TABLE "public"."athletes" OWNER TO "postgres";


COMMENT ON COLUMN "public"."athletes"."context" IS 'Denormalized from users.context (Phase 6.3-followup-4). Kept in sync by trg_sync_athlete_context on public.users. Readable by recruiters via the existing athletes RLS — users.context is not (RLS-blocked for recruiter -> athlete user rows).';



CREATE TABLE IF NOT EXISTS "public"."cegep_email_domains" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid",
    "domain" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."cegep_email_domains" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_badges" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "badge" "text" NOT NULL,
    "earned_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "coach_badges_badge_check" CHECK (("badge" = ANY (ARRAY['EVALUE'::"text", 'RECOMMANDE'::"text", 'COACH_ELITE'::"text", 'PLACEUR'::"text"])))
);


ALTER TABLE "public"."coach_badges" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_career_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "is_open" boolean DEFAULT false NOT NULL,
    "target_sports" "text"[] DEFAULT '{}'::"text"[],
    "target_regions" "text"[] DEFAULT '{}'::"text"[],
    "role_type" "text",
    "bio" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "coach_career_preferences_role_type_check" CHECK (("role_type" = ANY (ARRAY['head'::"text", 'assistant'::"text", 'both'::"text"])))
);


ALTER TABLE "public"."coach_career_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_notifications" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "message" "text",
    "metadata" "jsonb",
    "read" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."coach_notifications" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."coach_reviews" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recruiter_id" "uuid" NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "athlete_id" "uuid",
    "qualite_profils" integer,
    "reactivite" integer,
    "honnetete_evaluations" integer,
    "professionnalisme" integer,
    "note_globale" numeric(3,2),
    "recommande" boolean,
    "commentaire" "text",
    "reponse_coach" "text",
    "reponse_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "coach_reviews_honnetete_evaluations_check" CHECK ((("honnetete_evaluations" >= 1) AND ("honnetete_evaluations" <= 5))),
    CONSTRAINT "coach_reviews_professionnalisme_check" CHECK ((("professionnalisme" >= 1) AND ("professionnalisme" <= 5))),
    CONSTRAINT "coach_reviews_qualite_profils_check" CHECK ((("qualite_profils" >= 1) AND ("qualite_profils" <= 5))),
    CONSTRAINT "coach_reviews_reactivite_check" CHECK ((("reactivite" >= 1) AND ("reactivite" <= 5)))
);


ALTER TABLE "public"."coach_reviews" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."commitment_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "requested_by" "uuid" NOT NULL,
    "school_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "open_to_offers" boolean,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "responded_at" timestamp with time zone,
    CONSTRAINT "commitment_requests_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'CONFIRMED'::"text", 'DENIED'::"text"])))
);


ALTER TABLE "public"."commitment_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."consent_audit_trail" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "consent_id" "uuid" NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "coach_id" "uuid",
    "action" "text" NOT NULL,
    "previous_status" "text",
    "new_status" "text",
    "ip_address" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "consent_audit_trail_action_check" CHECK (("action" = ANY (ARRAY['ATTESTED'::"text", 'WITHDRAWN'::"text", 'EXPIRED'::"text", 'PDF_DOWNLOADED'::"text", 'PDF_UPLOADED'::"text"])))
);


ALTER TABLE "public"."consent_audit_trail" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recruiter_id" "uuid" NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "pipeline_id" "uuid",
    "status" "text" DEFAULT 'ACTIVE'::"text",
    "last_message_at" timestamp with time zone,
    "unread_count" integer DEFAULT 0,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "conversations_status_check" CHECK (("status" = ANY (ARRAY['ACTIVE'::"text", 'ARCHIVE'::"text"])))
);


ALTER TABLE "public"."conversations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."custom_distinctions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid",
    "coach_id" "uuid",
    "title" character varying(50) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."custom_distinctions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deletion_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "requested_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "scope" "text" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "raison" "text",
    "note_admin" "text",
    "completed_at" timestamp with time zone,
    "completed_by" "uuid",
    "retention_override" boolean DEFAULT false,
    "retention_reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "deletion_requests_scope_check" CHECK (("scope" = ANY (ARRAY['FULL_ACCOUNT'::"text", 'MESSAGES_ONLY'::"text", 'PROFILE_DATA'::"text"]))),
    CONSTRAINT "deletion_requests_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'IN_PROGRESS'::"text", 'COMPLETED'::"text", 'REJECTED'::"text"])))
);


ALTER TABLE "public"."deletion_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."device_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "token" "text" NOT NULL,
    "platform" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "device_tokens_platform_check" CHECK (("platform" = ANY (ARRAY['ios'::"text", 'android'::"text"])))
);


ALTER TABLE "public"."device_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."equipes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nom" "text" NOT NULL,
    "school_id" "uuid" NOT NULL,
    "sport_id" "uuid" NOT NULL,
    "ligue_id" "uuid",
    "categorie" "text",
    "genre" "text",
    "saison" "text",
    "actif" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "ligue_custom" "text"
);


ALTER TABLE "public"."equipes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."evaluations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "leadership" integer,
    "discipline" integer,
    "coachabilite" integer,
    "intelligence_jeu" integer,
    "competitivite" integer,
    "esprit_equipe" integer,
    "resilience" integer,
    "attitude_mentalite" integer,
    "cote_globale" numeric(3,2),
    "distinctions" "jsonb" DEFAULT '[]'::"jsonb",
    "rapport_entraineur" "text",
    "commentaires" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "vitesse_explosivite" numeric(3,1),
    "force_puissance" numeric(3,1),
    "endurance_cardio" numeric(3,1),
    "agilite_coordination" numeric(3,1),
    "vision_du_jeu" numeric(3,1),
    "sens_tactique" numeric(3,1),
    CONSTRAINT "evaluations_agilite_coordination_check" CHECK ((("agilite_coordination" >= (0)::numeric) AND ("agilite_coordination" <= (5)::numeric))),
    CONSTRAINT "evaluations_attitude_mentalite_check" CHECK ((("attitude_mentalite" >= 1) AND ("attitude_mentalite" <= 5))),
    CONSTRAINT "evaluations_coachabilite_check" CHECK ((("coachabilite" >= 1) AND ("coachabilite" <= 5))),
    CONSTRAINT "evaluations_competitivite_check" CHECK ((("competitivite" >= 1) AND ("competitivite" <= 5))),
    CONSTRAINT "evaluations_discipline_check" CHECK ((("discipline" >= 1) AND ("discipline" <= 5))),
    CONSTRAINT "evaluations_endurance_cardio_check" CHECK ((("endurance_cardio" >= (0)::numeric) AND ("endurance_cardio" <= (5)::numeric))),
    CONSTRAINT "evaluations_esprit_equipe_check" CHECK ((("esprit_equipe" >= 1) AND ("esprit_equipe" <= 5))),
    CONSTRAINT "evaluations_force_puissance_check" CHECK ((("force_puissance" >= (0)::numeric) AND ("force_puissance" <= (5)::numeric))),
    CONSTRAINT "evaluations_intelligence_jeu_check" CHECK ((("intelligence_jeu" >= 1) AND ("intelligence_jeu" <= 5))),
    CONSTRAINT "evaluations_leadership_check" CHECK ((("leadership" >= 1) AND ("leadership" <= 5))),
    CONSTRAINT "evaluations_rapport_entraineur_check" CHECK (("char_length"("rapport_entraineur") <= 1000)),
    CONSTRAINT "evaluations_resilience_check" CHECK ((("resilience" >= 1) AND ("resilience" <= 5))),
    CONSTRAINT "evaluations_sens_tactique_check" CHECK ((("sens_tactique" >= (0)::numeric) AND ("sens_tactique" <= (5)::numeric))),
    CONSTRAINT "evaluations_vision_du_jeu_check" CHECK ((("vision_du_jeu" >= (0)::numeric) AND ("vision_du_jeu" <= (5)::numeric))),
    CONSTRAINT "evaluations_vitesse_explosivite_check" CHECK ((("vitesse_explosivite" >= (0)::numeric) AND ("vitesse_explosivite" <= (5)::numeric)))
);


ALTER TABLE "public"."evaluations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "token" "text" NOT NULL,
    "email" "text" NOT NULL,
    "invited_by" "uuid" NOT NULL,
    "school_id" "uuid",
    "message" "text",
    "locale" "text" DEFAULT 'fr-CA'::"text" NOT NULL,
    "status" "public"."invitation_status" DEFAULT 'PENDING'::"public"."invitation_status" NOT NULL,
    "consumed_by_user_id" "uuid",
    "consumed_at" timestamp with time zone,
    "expires_at" timestamp with time zone DEFAULT ("now"() + '30 days'::interval) NOT NULL,
    "email_sent_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "invitations_locale_check" CHECK (("locale" = ANY (ARRAY['fr-CA'::"text", 'en-CA'::"text"])))
);


ALTER TABLE "public"."invitations" OWNER TO "postgres";


COMMENT ON TABLE "public"."invitations" IS 'Generic platform invitations. One inviter, one email, one optional school. Invitee picks role during normal onboarding. Email send wires up via Resend; today UX is copy-link.';



CREATE TABLE IF NOT EXISTS "public"."ligues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sport_id" "uuid" NOT NULL,
    "nom" "text" NOT NULL,
    "division" "text",
    "categorie" "text",
    "genre" "text",
    "gestionnaire" "text",
    "saison" "text",
    "niveau_provincial" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."ligues" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loi25_incidents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "date_incident" "date" NOT NULL,
    "severity" "text" NOT NULL,
    "type" "text",
    "description" "text",
    "affected_users_count" integer DEFAULT 0 NOT NULL,
    "cause" "text",
    "containment" "text",
    "school_id" "uuid",
    "cai_notified" boolean DEFAULT false NOT NULL,
    "cai_notified_at" timestamp with time zone,
    "status" "text" DEFAULT 'OPEN'::"text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "loi25_incidents_severity_check" CHECK (("severity" = ANY (ARRAY['Faible'::"text", 'Moyenne'::"text", 'Élevée'::"text", 'Critique'::"text"]))),
    CONSTRAINT "loi25_incidents_status_check" CHECK (("status" = ANY (ARRAY['OPEN'::"text", 'IN_PROGRESS'::"text", 'RESOLVED'::"text", 'CLOSED'::"text"])))
);


ALTER TABLE "public"."loi25_incidents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loi25_portability_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid",
    "requester_name" "text" NOT NULL,
    "requester_email" "text",
    "request_type" "text" NOT NULL,
    "submitted_at" "date" DEFAULT CURRENT_DATE NOT NULL,
    "deadline" "date" GENERATED ALWAYS AS (("submitted_at" + 30)) STORED,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "fulfilled_at" "date",
    "notes" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "loi25_portability_requests_request_type_check" CHECK (("request_type" = ANY (ARRAY['access'::"text", 'portability'::"text", 'rectification'::"text", 'deletion'::"text"]))),
    CONSTRAINT "loi25_portability_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'fulfilled'::"text", 'refused'::"text"])))
);


ALTER TABLE "public"."loi25_portability_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."loi25_settings" (
    "id" boolean DEFAULT true NOT NULL,
    "rprp_name" "text",
    "rprp_email" "text",
    "rprp_named_at" "date",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "loi25_settings_id_check" CHECK ("id")
);


ALTER TABLE "public"."loi25_settings" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."media_partners" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "organization_name" "text" NOT NULL,
    "contact_name" "text" NOT NULL,
    "contact_email" "text" NOT NULL,
    "logo_url" "text",
    "website_url" "text",
    "instagram_handle" "text",
    "facebook_url" "text",
    "tiktok_handle" "text",
    "description" "text",
    "audience_size" integer,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "show_on_homepage" boolean DEFAULT false NOT NULL,
    "homepage_order" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "terms_accepted_at" timestamp with time zone,
    "terms_version" "text",
    "password_reset_completed_at" timestamp with time zone,
    "x_url" "text",
    "youtube_url" "text",
    "linkedin_url" "text",
    "about_text" "text",
    CONSTRAINT "media_partners_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'APPROVED'::"text", 'SUSPENDED'::"text", 'REVOKED'::"text"])))
);


ALTER TABLE "public"."media_partners" OWNER TO "postgres";


COMMENT ON COLUMN "public"."media_partners"."terms_accepted_at" IS 'Timestamp when partner accepted Loi 25 terms during welcome flow';



COMMENT ON COLUMN "public"."media_partners"."terms_version" IS 'Version of terms accepted (for tracking when terms wording changes)';



COMMENT ON COLUMN "public"."media_partners"."password_reset_completed_at" IS 'Timestamp when partner replaced their admin-issued temp password';



CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."newsroom_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "athlete_id" "uuid",
    "school_id" "uuid",
    "sport_id" "uuid",
    "title" "text" NOT NULL,
    "description" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "newsroom_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['COMMITMENT'::"text", 'FIVE_STAR_SIGNUP'::"text"])))
);


ALTER TABLE "public"."newsroom_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notification_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "courriel" boolean DEFAULT true NOT NULL,
    "push" boolean DEFAULT false NOT NULL,
    "sms" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "notification_preferences_event_type_check" CHECK (("event_type" = ANY (ARRAY['NOUVELLE_DEMANDE_CONTACT'::"text", 'DEMANDE_ACCEPTEE'::"text", 'NOUVEAU_MESSAGE'::"text", 'PROFIL_ATHLETE_APPROUVE'::"text", 'PROFIL_ATHLETE_REFUSE'::"text", 'RESUME_HEBDOMADAIRE'::"text"])))
);


ALTER TABLE "public"."notification_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."parental_consents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "coach_id" "uuid",
    "school_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "attested_at" timestamp with time zone,
    "attestation_text" "text",
    "school_year" "text" NOT NULL,
    "pdf_template_version" "text",
    "pdf_downloaded_at" timestamp with time zone,
    "pdf_upload_url" "text",
    "consent_profile_public" boolean DEFAULT true,
    "consent_photo" boolean DEFAULT true,
    "consent_stats" boolean DEFAULT true,
    "consent_contact" boolean DEFAULT false,
    "withdrawn_at" timestamp with time zone,
    "withdrawn_by" "uuid",
    "withdrawal_reason" "text",
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "parental_consents_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'ATTESTED'::"text", 'WITHDRAWN'::"text", 'EXPIRED'::"text"])))
);


ALTER TABLE "public"."parental_consents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."partner_card_downloads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "partner_id" "uuid" NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "format" "text" NOT NULL,
    "downloaded_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "partner_card_downloads_format_check" CHECK (("format" = ANY (ARRAY['publication'::"text", 'story'::"text"])))
);


ALTER TABLE "public"."partner_card_downloads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."partner_profile_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "partner_id" "uuid" NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "viewed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."partner_profile_views" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."pipeline" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recruiter_id" "uuid" NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "status" "public"."pipeline_status" DEFAULT 'NONE'::"public"."pipeline_status" NOT NULL,
    "favorited_at" timestamp with time zone,
    "contacted_at" timestamp with time zone,
    "engaged_at" timestamp with time zone,
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."pipeline" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."platform_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "snapshot_date" "date" NOT NULL,
    "metrics" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."platform_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."positions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sport_id" "uuid" NOT NULL,
    "nom" "text" NOT NULL,
    "abreviation" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."positions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."profile_changes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "coach_id" "uuid",
    "field_name" "text" NOT NULL,
    "old_value" "text",
    "new_value" "text",
    "status" "text" DEFAULT 'PENDING'::"text",
    "message" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "profile_changes_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'ACKNOWLEDGED'::"text", 'REVERTED'::"text"])))
);


ALTER TABLE "public"."profile_changes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recruiter_activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recruiter_id" "uuid" NOT NULL,
    "athlete_id" "uuid",
    "list_id" "uuid",
    "action_type" "text" NOT NULL,
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "is_read" boolean DEFAULT false NOT NULL,
    CONSTRAINT "recruiter_activity_log_action_type_check" CHECK (("action_type" = ANY (ARRAY['NOTE_ADDED'::"text", 'NOTE_UPDATED'::"text", 'LIST_CREATED'::"text", 'LIST_NOTE_ADDED'::"text", 'ATHLETE_ADDED_TO_LIST'::"text", 'ATHLETE_REMOVED_FROM_LIST'::"text", 'PIPELINE_CHANGED'::"text", 'FAVORITED'::"text", 'UNFAVORITED'::"text", 'PROFILE_VIEWED'::"text", 'NEW_ATHLETE'::"text", 'PROFILE_UPDATED'::"text", 'VIDEO_ADDED'::"text", 'ATHLETE_VERIFIED'::"text", 'STATS_UPDATED'::"text", 'REVIEW_SUBMITTED'::"text", 'COACH_REPLY'::"text", 'ADMIN_BROADCAST'::"text"])))
);


ALTER TABLE "public"."recruiter_activity_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recruiter_list_members" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "list_id" "uuid" NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recruiter_list_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recruiter_list_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "list_id" "uuid" NOT NULL,
    "recruiter_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recruiter_list_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recruiter_lists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recruiter_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "color" "text" DEFAULT '#E63946'::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recruiter_lists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recruiter_notes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recruiter_id" "uuid" NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recruiter_notes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recruiter_pipeline" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recruiter_id" "uuid" NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "stage" character varying(50) DEFAULT 'IDENTIFIE'::character varying NOT NULL,
    "notes" "text",
    "moved_at" timestamp with time zone DEFAULT "now"(),
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "flagged" boolean DEFAULT false,
    "next_action_at" "date",
    "next_action_note" "text",
    CONSTRAINT "chk_recruiter_pipeline_stage" CHECK ((("stage")::"text" = ANY ((ARRAY['IDENTIFIE'::character varying, 'CONTACTE'::character varying, 'EN_DISCUSSION'::character varying, 'VISITE_PLANIFIEE'::character varying, 'ENGAGE'::character varying, 'LETTRE_SIGNEE'::character varying])::"text"[])))
);


ALTER TABLE "public"."recruiter_pipeline" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recruiter_preferences" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recruiter_id" "uuid" NOT NULL,
    "sport_id" "uuid",
    "position_ids" "uuid"[] DEFAULT '{}'::"uuid"[],
    "divisions" "text"[] DEFAULT '{}'::"text"[],
    "regions_preferees" "text"[] DEFAULT '{}'::"text"[],
    "graduation_years" integer[] DEFAULT '{}'::integer[],
    "moyenne_min" numeric(5,2) DEFAULT 50.00,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."recruiter_preferences" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."referrals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "ambassador_id" "uuid",
    "referred_user_id" "uuid" NOT NULL,
    "referral_code" "text" NOT NULL,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "signed_up_at" timestamp with time zone DEFAULT "now"(),
    "activated_at" timestamp with time zone,
    "converted_at" timestamp with time zone,
    "commission_rate" numeric(4,2),
    "commission_amount_cents" integer,
    "commission_paid_at" timestamp with time zone,
    "stripe_invoice_id" "text",
    "commission_months_remaining" integer DEFAULT 12,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "referrals_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'ACTIVE'::"text", 'CONVERTED'::"text", 'EXPIRED'::"text"])))
);


ALTER TABLE "public"."referrals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."reports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "type" "text" NOT NULL,
    "target_id" "uuid",
    "target_type" "text",
    "reported_user_id" "uuid" NOT NULL,
    "reported_by_id" "uuid",
    "raison" "text" NOT NULL,
    "contenu_signale" "text",
    "status" "text" DEFAULT 'OUVERT'::"text" NOT NULL,
    "action_prise" "text",
    "reviewed_by" "uuid",
    "reviewed_at" timestamp with time zone,
    "note_admin" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "reports_action_prise_check" CHECK (("action_prise" = ANY (ARRAY['AVERTISSEMENT'::"text", 'SUSPENSION'::"text", 'AUCUNE'::"text"]))),
    CONSTRAINT "reports_status_check" CHECK (("status" = ANY (ARRAY['OUVERT'::"text", 'EN_EXAMEN'::"text", 'RESOLU'::"text", 'REJETE'::"text"]))),
    CONSTRAINT "reports_type_check" CHECK (("type" = ANY (ARRAY['PROFIL'::"text", 'MESSAGE'::"text", 'ABUS_CONTACT'::"text"])))
);


ALTER TABLE "public"."reports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."school_coaches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "school_id" "uuid" NOT NULL,
    "coach_id" "uuid" NOT NULL,
    "role" "public"."coach_school_role" DEFAULT 'PENDING'::"public"."coach_school_role" NOT NULL,
    "sport" character varying(100),
    "approved_at" timestamp with time zone,
    "approved_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."school_coaches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."school_registry" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "meq_code" character varying(10) NOT NULL,
    "meq_css_code" character varying(10),
    "name" character varying(255) NOT NULL,
    "name_normalized" character varying(255),
    "address" character varying(500),
    "city" character varying(100),
    "postal_code" character varying(7),
    "region_admin" character varying(100),
    "latitude" numeric(10,7),
    "longitude" numeric(10,7),
    "css_name" character varying(255),
    "css_type" character varying(50),
    "phone" character varying(20),
    "website" character varying(500),
    "has_prescolaire" boolean DEFAULT false,
    "has_primaire" boolean DEFAULT false,
    "has_secondaire" boolean DEFAULT false,
    "has_formation_pro" boolean DEFAULT false,
    "has_collegial" boolean DEFAULT false,
    "has_universitaire" boolean DEFAULT false,
    "claimed_at" timestamp with time zone,
    "claimed_by" "uuid",
    "subscription_tier" character varying(50),
    "subscription_expires_at" timestamp with time zone,
    "meq_data_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "status" character varying(20) DEFAULT 'ACTIVE'::character varying
);


ALTER TABLE "public"."school_registry" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."sports" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "nom" "text" NOT NULL,
    "categorie" "text",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."sports" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."stripe_webhook_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "stripe_event_id" "text" NOT NULL,
    "event_type" "text" NOT NULL,
    "payload" "jsonb" DEFAULT '{}'::"jsonb",
    "status" "text" DEFAULT 'PENDING'::"text",
    "error" "text",
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "stripe_webhook_events_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'PROCESSED'::"text", 'FAILED'::"text", 'IGNORED'::"text"])))
);


ALTER TABLE "public"."stripe_webhook_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_features_athlete" (
    "tier" "text" NOT NULL,
    "can_see_vus_count" boolean DEFAULT true,
    "can_see_vus_trend" boolean DEFAULT false,
    "can_see_likes_count" boolean DEFAULT true,
    "can_see_likes_trend" boolean DEFAULT false,
    "can_see_favorites_count" boolean DEFAULT true,
    "can_see_who_viewed" boolean DEFAULT false,
    "can_see_who_liked" boolean DEFAULT false,
    "can_see_who_favorited" boolean DEFAULT false,
    "can_search_programs" boolean DEFAULT false,
    "can_access_blog" boolean DEFAULT false,
    "can_use_interactive_map" boolean DEFAULT false,
    "can_see_cegep_selling" boolean DEFAULT false,
    "can_access_recruiting_guide" boolean DEFAULT false,
    "price_monthly_cents" integer DEFAULT 0,
    "price_annual_cents" integer DEFAULT 0,
    CONSTRAINT "athlete_features_tier_lowercase" CHECK (("tier" = "lower"("tier")))
);


ALTER TABLE "public"."subscription_features_athlete" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_features_coach" (
    "tier" "text" NOT NULL,
    "can_see_mon_ecole" boolean DEFAULT false,
    "can_see_stats_ecole" boolean DEFAULT false,
    "can_see_placement" boolean DEFAULT false,
    "can_see_reputation" boolean DEFAULT false,
    "can_see_analytics" boolean DEFAULT false,
    "can_access_all" boolean DEFAULT false,
    "price_monthly_cents" integer DEFAULT 0,
    "price_annual_cents" integer DEFAULT 0,
    "max_athletes" integer NOT NULL,
    CONSTRAINT "coach_features_tier_lowercase" CHECK (("tier" = "lower"("tier")))
);


ALTER TABLE "public"."subscription_features_coach" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_features_recruteur" (
    "can_see_athlete_name" boolean DEFAULT false,
    "can_see_athlete_photo" boolean DEFAULT false,
    "can_see_jersey_number" boolean DEFAULT false,
    "can_see_highlights" boolean DEFAULT false,
    "can_see_coach_comments" boolean DEFAULT false,
    "can_see_academic_full" boolean DEFAULT false,
    "can_see_detailed_profile" boolean DEFAULT false,
    "can_see_recruitment_status" boolean DEFAULT false,
    "can_see_who_viewed" boolean DEFAULT false,
    "max_favorites" integer DEFAULT 10,
    "max_search_results" integer DEFAULT 10,
    "coaches_per_team" integer DEFAULT 1,
    "pipeline_enabled" boolean DEFAULT false,
    "pipeline_statuses" "text"[] DEFAULT '{}'::"text"[],
    "can_send_messages" boolean DEFAULT false,
    "can_send_auto_message" boolean DEFAULT false,
    "has_full_inbox" boolean DEFAULT false,
    "has_activity_feed" boolean DEFAULT false,
    "has_athlete_trends" boolean DEFAULT false,
    "has_full_gestion_cegep" boolean DEFAULT false,
    "has_list_access" boolean DEFAULT false,
    "tier" "text" NOT NULL,
    CONSTRAINT "recruteur_features_tier_lowercase" CHECK (("tier" = "lower"("tier")))
);


ALTER TABLE "public"."subscription_features_recruteur" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscriptions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "stripe_customer_id" "text",
    "stripe_subscription_id" "text",
    "stripe_price_id" "text",
    "tier" "text" DEFAULT 'free'::"text" NOT NULL,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "billing_cycle" "text",
    "current_period_start" timestamp with time zone,
    "current_period_end" timestamp with time zone,
    "trial_ends_at" timestamp with time zone,
    "cancel_at_period_end" boolean DEFAULT false,
    "canceled_at" timestamp with time zone,
    "referral_code" "text",
    "ambassador_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "tier_source" "text" DEFAULT 'stripe'::"text" NOT NULL,
    CONSTRAINT "subscriptions_billing_cycle_check" CHECK (("billing_cycle" = ANY (ARRAY['monthly'::"text", 'annual'::"text"]))),
    CONSTRAINT "subscriptions_tier_lowercase" CHECK (("tier" = "lower"("tier"))),
    CONSTRAINT "subscriptions_tier_source_check" CHECK (("tier_source" = ANY (ARRAY['stripe'::"text", 'admin_grant'::"text"])))
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."team_invitations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "team_id" "uuid" NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "invited_by_coach_id" "uuid",
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "responded_at" timestamp with time zone,
    CONSTRAINT "team_invitations_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'ACCEPTED'::"text", 'REJECTED'::"text", 'EXPIRED'::"text", 'CANCELLED'::"text"])))
);


ALTER TABLE "public"."team_invitations" OWNER TO "postgres";


COMMENT ON TABLE "public"."team_invitations" IS 'Flow A invitations from civil coaches to athletes already in DB. On ACCEPTED, trigger writes junction + updates anchor + cleans up old team membership. Flow B (email-based external invite) lives in a separate table planned for 5.5e-iii-b.';



CREATE OR REPLACE VIEW "public"."top_athletes_view" AS
 SELECT "a"."id",
    "a"."first_name",
    "a"."last_name",
    "a"."cote_globale_entraineur",
    "a"."annee_diplomation",
    "sch"."region",
    "a"."sport_id",
    "a"."position_id",
    "a"."school_id",
    "a"."photo_url",
    "s"."nom" AS "sport_name",
    "p"."nom" AS "position_name",
    "sch"."name" AS "school_name",
    "e"."distinctions",
    "a"."video_faits_saillants_url",
    "a"."video_match_complet_url",
    "a"."video_entrainement_url"
   FROM (((("public"."athletes" "a"
     LEFT JOIN "public"."sports" "s" ON (("s"."id" = "a"."sport_id")))
     LEFT JOIN "public"."positions" "p" ON (("p"."id" = "a"."position_id")))
     LEFT JOIN "public"."schools" "sch" ON (("sch"."id" = "a"."school_id")))
     LEFT JOIN LATERAL ( SELECT "evaluations"."distinctions"
           FROM "public"."evaluations"
          WHERE ("evaluations"."athlete_id" = "a"."id")
          ORDER BY "evaluations"."created_at" DESC
         LIMIT 1) "e" ON (true))
  WHERE "public"."is_partner_eligible_athlete"("a"."id")
  ORDER BY "a"."cote_globale_entraineur" DESC;


ALTER VIEW "public"."top_athletes_view" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."trending_athletes_view" AS
 WITH "recent_views" AS (
         SELECT "recruiter_athlete_views"."athlete_id",
            "count"(*) AS "views_last_7d"
           FROM "public"."recruiter_athlete_views"
          WHERE ("recruiter_athlete_views"."viewed_at" >= ("now"() - '7 days'::interval))
          GROUP BY "recruiter_athlete_views"."athlete_id"
        ), "prior_views" AS (
         SELECT "recruiter_athlete_views"."athlete_id",
            "count"(*) AS "views_prior_7d"
           FROM "public"."recruiter_athlete_views"
          WHERE (("recruiter_athlete_views"."viewed_at" >= ("now"() - '14 days'::interval)) AND ("recruiter_athlete_views"."viewed_at" < ("now"() - '7 days'::interval)))
          GROUP BY "recruiter_athlete_views"."athlete_id"
        ), "recent_favs" AS (
         SELECT "recruiter_favorites"."athlete_id",
            "count"(*) AS "favs_last_7d"
           FROM "public"."recruiter_favorites"
          WHERE ("recruiter_favorites"."created_at" >= ("now"() - '7 days'::interval))
          GROUP BY "recruiter_favorites"."athlete_id"
        ), "prior_favs" AS (
         SELECT "recruiter_favorites"."athlete_id",
            "count"(*) AS "favs_prior_7d"
           FROM "public"."recruiter_favorites"
          WHERE (("recruiter_favorites"."created_at" >= ("now"() - '14 days'::interval)) AND ("recruiter_favorites"."created_at" < ("now"() - '7 days'::interval)))
          GROUP BY "recruiter_favorites"."athlete_id"
        )
 SELECT "a"."id",
    "a"."first_name",
    "a"."last_name",
    "a"."photo_url",
    "a"."cote_globale_entraineur",
    "sch"."region",
    "sch"."name" AS "school_name",
    "a"."annee_diplomation",
    "s"."nom" AS "sport_name",
    COALESCE("rv"."views_last_7d", (0)::bigint) AS "views_7d",
    COALESCE("pv"."views_prior_7d", (0)::bigint) AS "views_prior_7d",
    (COALESCE("rv"."views_last_7d", (0)::bigint) - COALESCE("pv"."views_prior_7d", (0)::bigint)) AS "views_delta",
    COALESCE("rfv"."favs_last_7d", (0)::bigint) AS "favs_7d",
    COALESCE("pf"."favs_prior_7d", (0)::bigint) AS "favs_prior_7d",
    (COALESCE("rfv"."favs_last_7d", (0)::bigint) - COALESCE("pf"."favs_prior_7d", (0)::bigint)) AS "favs_delta",
    "a"."sport_id",
    "a"."position_id"
   FROM (((((("public"."athletes" "a"
     LEFT JOIN "public"."sports" "s" ON (("s"."id" = "a"."sport_id")))
     LEFT JOIN "public"."schools" "sch" ON (("sch"."id" = "a"."school_id")))
     LEFT JOIN "recent_views" "rv" ON (("rv"."athlete_id" = "a"."id")))
     LEFT JOIN "prior_views" "pv" ON (("pv"."athlete_id" = "a"."id")))
     LEFT JOIN "recent_favs" "rfv" ON (("rfv"."athlete_id" = "a"."id")))
     LEFT JOIN "prior_favs" "pf" ON (("pf"."athlete_id" = "a"."id")))
  WHERE "public"."is_partner_eligible_athlete"("a"."id");


ALTER VIEW "public"."trending_athletes_view" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_feed"
    ADD CONSTRAINT "activity_feed_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_claims"
    ADD CONSTRAINT "admin_claims_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_notifications"
    ADD CONSTRAINT "admin_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."admin_transfer_requests"
    ADD CONSTRAINT "admin_transfer_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ambassadors"
    ADD CONSTRAINT "ambassadors_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ambassadors"
    ADD CONSTRAINT "ambassadors_referral_code_key" UNIQUE ("referral_code");



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_pkey" PRIMARY KEY ("key");



ALTER TABLE ONLY "public"."athlete_invitations"
    ADD CONSTRAINT "athlete_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."athlete_invitations"
    ADD CONSTRAINT "athlete_invitations_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."athlete_notifications"
    ADD CONSTRAINT "athlete_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."athlete_suggestions"
    ADD CONSTRAINT "athlete_suggestions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."athlete_targets"
    ADD CONSTRAINT "athlete_targets_athlete_id_school_id_key" UNIQUE ("athlete_id", "school_id");



ALTER TABLE ONLY "public"."athlete_targets"
    ADD CONSTRAINT "athlete_targets_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."_deprecated_athlete_views_2026_05"
    ADD CONSTRAINT "athlete_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."athletes"
    ADD CONSTRAINT "athletes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cegep_email_domains"
    ADD CONSTRAINT "cegep_email_domains_domain_key" UNIQUE ("domain");



ALTER TABLE ONLY "public"."cegep_email_domains"
    ADD CONSTRAINT "cegep_email_domains_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_badges"
    ADD CONSTRAINT "coach_badges_coach_id_badge_key" UNIQUE ("coach_id", "badge");



ALTER TABLE ONLY "public"."coach_badges"
    ADD CONSTRAINT "coach_badges_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_career_preferences"
    ADD CONSTRAINT "coach_career_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_career_preferences"
    ADD CONSTRAINT "coach_career_preferences_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."coach_notifications"
    ADD CONSTRAINT "coach_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_reviews"
    ADD CONSTRAINT "coach_reviews_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."coach_reviews"
    ADD CONSTRAINT "coach_reviews_recruiter_id_coach_id_key" UNIQUE ("recruiter_id", "coach_id");



ALTER TABLE ONLY "public"."commitment_requests"
    ADD CONSTRAINT "commitment_requests_athlete_id_school_id_key" UNIQUE ("athlete_id", "school_id");



ALTER TABLE ONLY "public"."commitment_requests"
    ADD CONSTRAINT "commitment_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."consent_audit_trail"
    ADD CONSTRAINT "consent_audit_trail_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."custom_distinctions"
    ADD CONSTRAINT "custom_distinctions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deletion_requests"
    ADD CONSTRAINT "deletion_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."device_tokens"
    ADD CONSTRAINT "device_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."device_tokens"
    ADD CONSTRAINT "device_tokens_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."equipes"
    ADD CONSTRAINT "equipes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."evaluations"
    ADD CONSTRAINT "evaluations_coach_id_athlete_id_key" UNIQUE ("coach_id", "athlete_id");



ALTER TABLE ONLY "public"."evaluations"
    ADD CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_token_key" UNIQUE ("token");



ALTER TABLE ONLY "public"."ligues"
    ADD CONSTRAINT "ligues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loi25_incidents"
    ADD CONSTRAINT "loi25_incidents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loi25_portability_requests"
    ADD CONSTRAINT "loi25_portability_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."loi25_settings"
    ADD CONSTRAINT "loi25_settings_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media_partners"
    ADD CONSTRAINT "media_partners_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."media_partners"
    ADD CONSTRAINT "media_partners_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."newsroom_events"
    ADD CONSTRAINT "newsroom_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_event_type_key" UNIQUE ("user_id", "event_type");



ALTER TABLE ONLY "public"."parental_consents"
    ADD CONSTRAINT "parental_consents_athlete_id_school_year_key" UNIQUE ("athlete_id", "school_year");



ALTER TABLE ONLY "public"."parental_consents"
    ADD CONSTRAINT "parental_consents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."partner_card_downloads"
    ADD CONSTRAINT "partner_card_downloads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."partner_profile_views"
    ADD CONSTRAINT "partner_profile_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pipeline"
    ADD CONSTRAINT "pipeline_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."pipeline"
    ADD CONSTRAINT "pipeline_recruiter_id_athlete_id_key" UNIQUE ("recruiter_id", "athlete_id");



ALTER TABLE ONLY "public"."platform_snapshots"
    ADD CONSTRAINT "platform_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."platform_snapshots"
    ADD CONSTRAINT "platform_snapshots_snapshot_date_key" UNIQUE ("snapshot_date");



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_sport_id_nom_key" UNIQUE ("sport_id", "nom");



ALTER TABLE ONLY "public"."profile_changes"
    ADD CONSTRAINT "profile_changes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."_deprecated_profile_views_2026_05"
    ADD CONSTRAINT "profile_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recruiter_activity_log"
    ADD CONSTRAINT "recruiter_activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recruiter_athlete_views"
    ADD CONSTRAINT "recruiter_athlete_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recruiter_athlete_views"
    ADD CONSTRAINT "recruiter_athlete_views_recruiter_athlete_date_key" UNIQUE ("recruiter_id", "athlete_id", "view_date");



ALTER TABLE ONLY "public"."recruiter_favorites"
    ADD CONSTRAINT "recruiter_favorites_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recruiter_favorites"
    ADD CONSTRAINT "recruiter_favorites_recruiter_id_athlete_id_key" UNIQUE ("recruiter_id", "athlete_id");



ALTER TABLE ONLY "public"."recruiter_list_members"
    ADD CONSTRAINT "recruiter_list_members_list_id_athlete_id_key" UNIQUE ("list_id", "athlete_id");



ALTER TABLE ONLY "public"."recruiter_list_members"
    ADD CONSTRAINT "recruiter_list_members_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recruiter_list_notes"
    ADD CONSTRAINT "recruiter_list_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recruiter_lists"
    ADD CONSTRAINT "recruiter_lists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recruiter_notes"
    ADD CONSTRAINT "recruiter_notes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recruiter_pipeline"
    ADD CONSTRAINT "recruiter_pipeline_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recruiter_pipeline"
    ADD CONSTRAINT "recruiter_pipeline_recruiter_id_athlete_id_key" UNIQUE ("recruiter_id", "athlete_id");



ALTER TABLE ONLY "public"."recruiter_preferences"
    ADD CONSTRAINT "recruiter_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recruiter_preferences"
    ADD CONSTRAINT "recruiter_preferences_recruiter_id_key" UNIQUE ("recruiter_id");



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."school_coaches"
    ADD CONSTRAINT "school_coaches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."school_coaches"
    ADD CONSTRAINT "school_coaches_school_id_coach_id_key" UNIQUE ("school_id", "coach_id");



ALTER TABLE ONLY "public"."school_registry"
    ADD CONSTRAINT "school_registry_meq_code_key" UNIQUE ("meq_code");



ALTER TABLE ONLY "public"."school_registry"
    ADD CONSTRAINT "school_registry_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."schools"
    ADD CONSTRAINT "schools_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sports"
    ADD CONSTRAINT "sports_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_webhook_events"
    ADD CONSTRAINT "stripe_webhook_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."stripe_webhook_events"
    ADD CONSTRAINT "stripe_webhook_events_stripe_event_id_key" UNIQUE ("stripe_event_id");



ALTER TABLE ONLY "public"."subscription_features_athlete"
    ADD CONSTRAINT "subscription_features_athlete_pkey" PRIMARY KEY ("tier");



ALTER TABLE ONLY "public"."subscription_features_coach"
    ADD CONSTRAINT "subscription_features_coach_pkey" PRIMARY KEY ("tier");



ALTER TABLE ONLY "public"."subscription_features_recruteur"
    ADD CONSTRAINT "subscription_features_recruteur_pkey" PRIMARY KEY ("tier");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_stripe_customer_id_key" UNIQUE ("stripe_customer_id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_stripe_subscription_id_key" UNIQUE ("stripe_subscription_id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."team_athletes"
    ADD CONSTRAINT "team_athletes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_athletes"
    ADD CONSTRAINT "team_athletes_team_id_athlete_id_key" UNIQUE ("team_id", "athlete_id");



ALTER TABLE ONLY "public"."team_coaches"
    ADD CONSTRAINT "team_coaches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."team_coaches"
    ADD CONSTRAINT "team_coaches_team_id_coach_id_key" UNIQUE ("team_id", "coach_id");



ALTER TABLE ONLY "public"."team_invitations"
    ADD CONSTRAINT "team_invitations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_identity_unique" UNIQUE ("school_id", "sport_id", "name", "age_group", "division", "gender", "season");



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "athlete_invitations_athlete_idx" ON "public"."athlete_invitations" USING "btree" ("athlete_id");



CREATE INDEX "athlete_invitations_created_idx" ON "public"."athlete_invitations" USING "btree" ("created_by");



CREATE INDEX "athlete_invitations_token_idx" ON "public"."athlete_invitations" USING "btree" ("token");



CREATE INDEX "coach_notifications_coach_unread_idx" ON "public"."coach_notifications" USING "btree" ("coach_id", "created_at" DESC) WHERE ("read" = false);



CREATE INDEX "device_tokens_user_id_idx" ON "public"."device_tokens" USING "btree" ("user_id");



CREATE INDEX "idx_activities_athlete" ON "public"."activities" USING "btree" ("athlete_id");



CREATE INDEX "idx_activities_coach" ON "public"."activities" USING "btree" ("coach_id", "created_at" DESC);



CREATE INDEX "idx_activity_created" ON "public"."activity_feed" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_activity_log_athlete" ON "public"."recruiter_activity_log" USING "btree" ("athlete_id", "created_at" DESC);



CREATE INDEX "idx_activity_log_list" ON "public"."recruiter_activity_log" USING "btree" ("list_id", "created_at" DESC);



CREATE INDEX "idx_activity_log_recruiter_date" ON "public"."recruiter_activity_log" USING "btree" ("recruiter_id", "created_at" DESC);



CREATE INDEX "idx_activity_user" ON "public"."activity_feed" USING "btree" ("user_id");



CREATE INDEX "idx_admin_claims_pending_status" ON "public"."admin_claims" USING "btree" ("status") WHERE ("status" = 'PENDING'::"text");



CREATE INDEX "idx_admin_claims_school" ON "public"."admin_claims" USING "btree" ("school_id");



CREATE INDEX "idx_admin_claims_user" ON "public"."admin_claims" USING "btree" ("user_id");



CREATE INDEX "idx_athlete_notif_athlete" ON "public"."athlete_notifications" USING "btree" ("athlete_id", "created_at" DESC);



CREATE INDEX "idx_athlete_notif_unread" ON "public"."athlete_notifications" USING "btree" ("athlete_id") WHERE ("read" = false);



CREATE INDEX "idx_athlete_views_athlete" ON "public"."_deprecated_athlete_views_2026_05" USING "btree" ("athlete_id");



CREATE INDEX "idx_athletes_coach" ON "public"."athletes" USING "btree" ("coach_id");



CREATE INDEX "idx_athletes_completion" ON "public"."athletes" USING "btree" ("profile_completion");



CREATE INDEX "idx_athletes_league_team" ON "public"."athletes" USING "btree" ("league_team_id");



CREATE INDEX "idx_athletes_partner_opt_in" ON "public"."athletes" USING "btree" ("partner_visibility_opt_in") WHERE ("partner_visibility_opt_in" = true);



CREATE INDEX "idx_athletes_school" ON "public"."athletes" USING "btree" ("school_id");



CREATE INDEX "idx_athletes_sport" ON "public"."athletes" USING "btree" ("sport_id");



CREATE INDEX "idx_athletes_status" ON "public"."athletes" USING "btree" ("status");



CREATE INDEX "idx_athletes_verified" ON "public"."athletes" USING "btree" ("verified");



CREATE INDEX "idx_coach_reviews_coach" ON "public"."coach_reviews" USING "btree" ("coach_id");



CREATE INDEX "idx_conversations_athlete" ON "public"."conversations" USING "btree" ("athlete_id");



CREATE INDEX "idx_evaluations_athlete" ON "public"."evaluations" USING "btree" ("athlete_id");



CREATE INDEX "idx_evaluations_coach" ON "public"."evaluations" USING "btree" ("coach_id");



CREATE INDEX "idx_loi25_incidents_date" ON "public"."loi25_incidents" USING "btree" ("date_incident" DESC);



CREATE INDEX "idx_loi25_portability_status_deadline" ON "public"."loi25_portability_requests" USING "btree" ("status", "deadline");



CREATE INDEX "idx_media_partners_homepage" ON "public"."media_partners" USING "btree" ("show_on_homepage", "homepage_order") WHERE ("show_on_homepage" = true);



CREATE INDEX "idx_media_partners_status" ON "public"."media_partners" USING "btree" ("status");



CREATE INDEX "idx_media_partners_welcome_pending" ON "public"."media_partners" USING "btree" ("user_id") WHERE (("terms_accepted_at" IS NULL) OR ("password_reset_completed_at" IS NULL));



CREATE INDEX "idx_messages_conversation" ON "public"."messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_messages_created" ON "public"."messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_newsroom_events_athlete" ON "public"."newsroom_events" USING "btree" ("athlete_id");



CREATE INDEX "idx_newsroom_events_occurred" ON "public"."newsroom_events" USING "btree" ("occurred_at" DESC);



CREATE INDEX "idx_newsroom_events_type" ON "public"."newsroom_events" USING "btree" ("event_type");



CREATE INDEX "idx_parental_consents_athlete" ON "public"."parental_consents" USING "btree" ("athlete_id");



CREATE INDEX "idx_partner_downloads_athlete" ON "public"."partner_card_downloads" USING "btree" ("athlete_id", "downloaded_at" DESC);



CREATE INDEX "idx_partner_downloads_partner" ON "public"."partner_card_downloads" USING "btree" ("partner_id", "downloaded_at" DESC);



CREATE INDEX "idx_pipeline_athlete" ON "public"."pipeline" USING "btree" ("athlete_id");



CREATE INDEX "idx_pipeline_recruiter" ON "public"."pipeline" USING "btree" ("recruiter_id");



CREATE INDEX "idx_pipeline_status" ON "public"."pipeline" USING "btree" ("status");



CREATE INDEX "idx_profile_changes_coach" ON "public"."profile_changes" USING "btree" ("coach_id", "status", "created_at" DESC);



CREATE INDEX "idx_profile_views_athlete" ON "public"."_deprecated_profile_views_2026_05" USING "btree" ("athlete_id");



CREATE INDEX "idx_profile_views_time" ON "public"."_deprecated_profile_views_2026_05" USING "btree" ("viewed_at" DESC);



CREATE INDEX "idx_referrals_ambassador" ON "public"."referrals" USING "btree" ("ambassador_id");



CREATE INDEX "idx_school_coaches_school" ON "public"."school_coaches" USING "btree" ("school_id");



CREATE INDEX "idx_school_registry_city" ON "public"."school_registry" USING "btree" ("city");



CREATE INDEX "idx_school_registry_collegial" ON "public"."school_registry" USING "btree" ("has_collegial") WHERE ("has_collegial" = true);



CREATE INDEX "idx_school_registry_css" ON "public"."school_registry" USING "btree" ("meq_css_code");



CREATE INDEX "idx_school_registry_fts" ON "public"."school_registry" USING "gin" ("to_tsvector"('"french"'::"regconfig", (((((COALESCE("name", ''::character varying))::"text" || ' '::"text") || (COALESCE("city", ''::character varying))::"text") || ' '::"text") || (COALESCE("css_name", ''::character varying))::"text")));



CREATE INDEX "idx_school_registry_name_normalized" ON "public"."school_registry" USING "btree" ("name_normalized");



CREATE INDEX "idx_school_registry_region" ON "public"."school_registry" USING "btree" ("region_admin");



CREATE INDEX "idx_school_registry_secondaire" ON "public"."school_registry" USING "btree" ("has_secondaire") WHERE ("has_secondaire" = true);



CREATE INDEX "idx_schools_rseq_institution_id" ON "public"."schools" USING "btree" ("rseq_institution_id") WHERE ("rseq_institution_id" IS NOT NULL);



CREATE INDEX "idx_subscriptions_tier" ON "public"."subscriptions" USING "btree" ("tier");



CREATE INDEX "idx_subscriptions_user" ON "public"."subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_team_invitations_athlete" ON "public"."team_invitations" USING "btree" ("athlete_id");



CREATE INDEX "idx_team_invitations_team" ON "public"."team_invitations" USING "btree" ("team_id");



CREATE INDEX "idx_teams_school" ON "public"."teams" USING "btree" ("school_id");



CREATE INDEX "idx_users_role" ON "public"."users" USING "btree" ("role");



CREATE INDEX "idx_users_school" ON "public"."users" USING "btree" ("school_id");



CREATE INDEX "invitations_email_idx" ON "public"."invitations" USING "btree" ("lower"("email"));



CREATE INDEX "invitations_invited_by_idx" ON "public"."invitations" USING "btree" ("invited_by");



CREATE INDEX "invitations_status_idx" ON "public"."invitations" USING "btree" ("status") WHERE ("status" = 'PENDING'::"public"."invitation_status");



CREATE INDEX "invitations_token_idx" ON "public"."invitations" USING "btree" ("token");



CREATE INDEX "partner_profile_views_athlete_id_idx" ON "public"."partner_profile_views" USING "btree" ("athlete_id", "viewed_at" DESC);



CREATE INDEX "partner_profile_views_partner_id_idx" ON "public"."partner_profile_views" USING "btree" ("partner_id", "viewed_at" DESC);



CREATE INDEX "recruiter_activity_log_unread_idx" ON "public"."recruiter_activity_log" USING "btree" ("recruiter_id") WHERE ("is_read" = false);



CREATE UNIQUE INDEX "recruiter_athlete_views_daily" ON "public"."recruiter_athlete_views" USING "btree" ("recruiter_id", "athlete_id", "view_date");



CREATE UNIQUE INDEX "schools_name_city_unique" ON "public"."schools" USING "btree" ("lower"("name"), COALESCE("lower"("city"), ''::"text"), "type");



CREATE UNIQUE INDEX "uq_admin_claims_one_pending_per_user_school" ON "public"."admin_claims" USING "btree" ("user_id", "school_id") WHERE ("status" = 'PENDING'::"text");



CREATE UNIQUE INDEX "uq_athlete_invitations_pending" ON "public"."athlete_invitations" USING "btree" ("athlete_id") WHERE ("status" = 'PENDING'::"text");



CREATE UNIQUE INDEX "uq_team_invitations_pending" ON "public"."team_invitations" USING "btree" ("team_id", "athlete_id") WHERE ("status" = 'PENDING'::"text");



CREATE OR REPLACE TRIGGER "apply_team_invitation_acceptance_trigger" AFTER UPDATE OF "status" ON "public"."team_invitations" FOR EACH ROW WHEN ((("new"."status" = 'ACCEPTED'::"text") AND ("old"."status" IS DISTINCT FROM 'ACCEPTED'::"text"))) EXECUTE FUNCTION "public"."apply_team_invitation_acceptance"();



CREATE OR REPLACE TRIGGER "on_user_created_link_athlete" AFTER INSERT ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."link_athlete_on_signup"();



CREATE OR REPLACE TRIGGER "reset_athlete_anchor_on_team_remove" AFTER DELETE ON "public"."team_athletes" FOR EACH ROW EXECUTE FUNCTION "public"."reset_athlete_anchor_on_team_remove"();



CREATE OR REPLACE TRIGGER "set_media_partners_updated_at" BEFORE UPDATE ON "public"."media_partners" FOR EACH ROW EXECUTE FUNCTION "public"."moddatetime"('updated_at');



CREATE OR REPLACE TRIGGER "set_updated_at_career_prefs" BEFORE UPDATE ON "public"."coach_career_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_notif_prefs" BEFORE UPDATE ON "public"."notification_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_ambassadors_updated_at" BEFORE UPDATE ON "public"."ambassadors" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_apply_admin_claim_approval" AFTER UPDATE OF "status" ON "public"."admin_claims" FOR EACH ROW EXECUTE FUNCTION "public"."apply_admin_claim_approval"();



CREATE OR REPLACE TRIGGER "trg_apply_suggestion" BEFORE UPDATE ON "public"."athlete_suggestions" FOR EACH ROW EXECUTE FUNCTION "public"."apply_approved_suggestion"();



CREATE OR REPLACE TRIGGER "trg_athletes_updated_at" BEFORE UPDATE ON "public"."athletes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_check_recruiter_domain" BEFORE INSERT ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."check_recruiter_email_domain"();



CREATE OR REPLACE TRIGGER "trg_coach_activity_badge" AFTER UPDATE ON "public"."evaluations" FOR EACH ROW EXECUTE FUNCTION "public"."log_coach_activity_badge"();



CREATE OR REPLACE TRIGGER "trg_coach_activity_badge_insert" AFTER INSERT ON "public"."evaluations" FOR EACH ROW WHEN (("new"."distinctions" IS NOT NULL)) EXECUTE FUNCTION "public"."log_coach_activity_badge"();



CREATE OR REPLACE TRIGGER "trg_coach_activity_favorited" AFTER INSERT ON "public"."recruiter_favorites" FOR EACH ROW EXECUTE FUNCTION "public"."log_coach_activity_favorited"();



CREATE OR REPLACE TRIGGER "trg_coach_activity_message" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."log_coach_activity_message"();



CREATE OR REPLACE TRIGGER "trg_coach_activity_verified" AFTER UPDATE ON "public"."athletes" FOR EACH ROW EXECUTE FUNCTION "public"."log_coach_activity_verified"();



CREATE OR REPLACE TRIGGER "trg_coach_reviews_updated_at" BEFORE UPDATE ON "public"."coach_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_commitment_confirmed" AFTER UPDATE ON "public"."commitment_requests" FOR EACH ROW EXECUTE FUNCTION "public"."auto_set_recrute_on_confirmation"();



CREATE OR REPLACE TRIGGER "trg_consent_audit_log" AFTER UPDATE OF "status" ON "public"."parental_consents" FOR EACH ROW EXECUTE FUNCTION "public"."log_consent_change"();



CREATE OR REPLACE TRIGGER "trg_conversations_updated_at" BEFORE UPDATE ON "public"."conversations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_cote_globale" BEFORE INSERT OR UPDATE ON "public"."evaluations" FOR EACH ROW EXECUTE FUNCTION "public"."calc_cote_globale"();



CREATE OR REPLACE TRIGGER "trg_create_subscription" AFTER INSERT ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."create_default_subscription"();



CREATE OR REPLACE TRIGGER "trg_deletion_requests_updated_at" BEFORE UPDATE ON "public"."deletion_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_demote_interim_on_director_appointment" AFTER INSERT OR UPDATE OF "role" ON "public"."school_coaches" FOR EACH ROW EXECUTE FUNCTION "public"."demote_interim_on_director_appointment"();



CREATE OR REPLACE TRIGGER "trg_equipes_updated_at" BEFORE UPDATE ON "public"."equipes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_evaluations_updated_at" BEFORE UPDATE ON "public"."evaluations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_fav_insert_to_pipeline" AFTER INSERT ON "public"."recruiter_favorites" FOR EACH ROW EXECUTE FUNCTION "public"."fav_insert_to_pipeline"();



CREATE OR REPLACE TRIGGER "trg_favorite_to_en_processus" AFTER INSERT ON "public"."recruiter_favorites" FOR EACH ROW EXECUTE FUNCTION "public"."auto_upgrade_favorite_to_en_processus"();



CREATE OR REPLACE TRIGGER "trg_invitations_updated_at" BEFORE UPDATE ON "public"."invitations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_log_athlete_update" AFTER UPDATE ON "public"."athletes" FOR EACH ROW EXECUTE FUNCTION "public"."log_athlete_update"();



CREATE OR REPLACE TRIGGER "trg_log_coach_reply" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."log_coach_reply"();



CREATE OR REPLACE TRIGGER "trg_log_favorite" AFTER INSERT ON "public"."recruiter_favorites" FOR EACH ROW EXECUTE FUNCTION "public"."log_favorite_added"();



CREATE OR REPLACE TRIGGER "trg_log_list_created" AFTER INSERT ON "public"."recruiter_lists" FOR EACH ROW EXECUTE FUNCTION "public"."log_list_created"();



CREATE OR REPLACE TRIGGER "trg_log_list_member_added" AFTER INSERT ON "public"."recruiter_list_members" FOR EACH ROW EXECUTE FUNCTION "public"."log_list_member_added"();



CREATE OR REPLACE TRIGGER "trg_log_list_member_removed" AFTER DELETE ON "public"."recruiter_list_members" FOR EACH ROW EXECUTE FUNCTION "public"."log_list_member_removed"();



CREATE OR REPLACE TRIGGER "trg_log_list_note_added" AFTER INSERT ON "public"."recruiter_list_notes" FOR EACH ROW EXECUTE FUNCTION "public"."log_list_note_added"();



CREATE OR REPLACE TRIGGER "trg_log_new_athlete" AFTER INSERT ON "public"."athletes" FOR EACH ROW EXECUTE FUNCTION "public"."log_new_athlete"();



CREATE OR REPLACE TRIGGER "trg_log_note" AFTER INSERT ON "public"."recruiter_notes" FOR EACH ROW EXECUTE FUNCTION "public"."log_note_added"();



CREATE OR REPLACE TRIGGER "trg_log_pipeline" AFTER INSERT OR UPDATE ON "public"."recruiter_pipeline" FOR EACH ROW EXECUTE FUNCTION "public"."log_pipeline_change"();



CREATE OR REPLACE TRIGGER "trg_log_review" AFTER INSERT ON "public"."coach_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."log_review_submitted"();



CREATE OR REPLACE TRIGGER "trg_log_unfavorited" AFTER DELETE ON "public"."recruiter_favorites" FOR EACH ROW EXECUTE FUNCTION "public"."log_unfavorited"();



CREATE OR REPLACE TRIGGER "trg_log_view" AFTER INSERT ON "public"."recruiter_athlete_views" FOR EACH ROW EXECUTE FUNCTION "public"."log_profile_view"();



CREATE OR REPLACE TRIGGER "trg_note_globale" BEFORE INSERT OR UPDATE ON "public"."coach_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."calc_note_globale"();



CREATE OR REPLACE TRIGGER "trg_notify_athlete_verified" AFTER UPDATE OF "verified" ON "public"."athletes" FOR EACH ROW EXECUTE FUNCTION "public"."notify_athlete_verified"();



CREATE OR REPLACE TRIGGER "trg_notify_evaluation_updated" AFTER UPDATE ON "public"."evaluations" FOR EACH ROW WHEN (("old"."cote_globale" IS DISTINCT FROM "new"."cote_globale")) EXECUTE FUNCTION "public"."notify_athlete_evaluation_updated"();



CREATE OR REPLACE TRIGGER "trg_notify_favorited" AFTER INSERT ON "public"."recruiter_favorites" FOR EACH ROW EXECUTE FUNCTION "public"."notify_athlete_favorited"();



CREATE OR REPLACE TRIGGER "trg_notify_on_message" AFTER INSERT ON "public"."messages" FOR EACH ROW EXECUTE FUNCTION "public"."notify_on_message"();



CREATE OR REPLACE TRIGGER "trg_notify_profile_viewed" AFTER INSERT ON "public"."_deprecated_profile_views_2026_05" FOR EACH ROW EXECUTE FUNCTION "public"."notify_athlete_profile_viewed"();



CREATE OR REPLACE TRIGGER "trg_notify_suggestion_result" AFTER UPDATE ON "public"."athlete_suggestions" FOR EACH ROW EXECUTE FUNCTION "public"."notify_athlete_suggestion_result"();



CREATE OR REPLACE TRIGGER "trg_parental_consents_updated_at" BEFORE UPDATE ON "public"."parental_consents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_pipeline_identifie" BEFORE UPDATE OF "favorited_at" ON "public"."pipeline" FOR EACH ROW EXECUTE FUNCTION "public"."auto_pipeline_identifie"();



CREATE OR REPLACE TRIGGER "trg_pipeline_recruiter_role" BEFORE INSERT OR UPDATE OF "recruiter_id" ON "public"."recruiter_pipeline" FOR EACH ROW EXECUTE FUNCTION "public"."require_recruiter_role"();



CREATE OR REPLACE TRIGGER "trg_pipeline_updated_at" BEFORE UPDATE ON "public"."pipeline" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profile_completion" BEFORE INSERT OR UPDATE ON "public"."athletes" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_profile_completion"();



CREATE OR REPLACE TRIGGER "trg_reports_updated_at" BEFORE UPDATE ON "public"."reports" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_subscriptions_updated_at" BEFORE UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sync_admin_flag" AFTER INSERT OR UPDATE OF "role" ON "public"."school_coaches" FOR EACH ROW EXECUTE FUNCTION "public"."sync_user_admin_flag"();



CREATE OR REPLACE TRIGGER "trg_sync_athlete_context" AFTER UPDATE OF "context" ON "public"."users" FOR EACH ROW WHEN (("new"."context" IS DISTINCT FROM "old"."context")) EXECUTE FUNCTION "public"."sync_athlete_context"();



CREATE OR REPLACE TRIGGER "trg_sync_global_status" AFTER INSERT OR UPDATE ON "public"."recruiter_pipeline" FOR EACH ROW EXECUTE FUNCTION "public"."sync_global_recruitment_status"();



CREATE OR REPLACE TRIGGER "trg_sync_user_school_on_coach_change" AFTER INSERT OR UPDATE ON "public"."school_coaches" FOR EACH ROW EXECUTE FUNCTION "public"."sync_user_school_from_coaches"();



CREATE OR REPLACE TRIGGER "trg_sync_user_school_on_coach_remove" AFTER DELETE ON "public"."school_coaches" FOR EACH ROW EXECUTE FUNCTION "public"."sync_user_school_on_coach_remove"();



CREATE OR REPLACE TRIGGER "trg_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_backfill_athletes_coach" AFTER INSERT OR UPDATE ON "public"."users" FOR EACH ROW WHEN ((("new"."role" = 'COACH'::"public"."user_role") AND ("new"."school_id" IS NOT NULL))) EXECUTE FUNCTION "public"."backfill_athletes_on_coach_join"();



CREATE OR REPLACE TRIGGER "trigger_commitment_newsroom_event" AFTER UPDATE OF "recruitment_status" ON "public"."athletes" FOR EACH ROW EXECUTE FUNCTION "public"."emit_commitment_newsroom_event"();



CREATE OR REPLACE TRIGGER "trigger_five_star_eligibility_flip" AFTER UPDATE OF "partner_visibility_opt_in", "partner_visibility_parental_consent", "verified", "modified_since_verification", "date_naissance" ON "public"."athletes" FOR EACH ROW EXECUTE FUNCTION "public"."emit_five_star_on_eligibility_flip"();



CREATE OR REPLACE TRIGGER "trigger_five_star_newsroom_event" AFTER INSERT OR UPDATE OF "cote_globale_entraineur" ON "public"."athletes" FOR EACH ROW EXECUTE FUNCTION "public"."emit_five_star_newsroom_event"();



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."activity_feed"
    ADD CONSTRAINT "activity_feed_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."activity_feed"
    ADD CONSTRAINT "activity_feed_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_claims"
    ADD CONSTRAINT "admin_claims_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."admin_claims"
    ADD CONSTRAINT "admin_claims_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_claims"
    ADD CONSTRAINT "admin_claims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_transfer_requests"
    ADD CONSTRAINT "admin_transfer_requests_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."admin_transfer_requests"
    ADD CONSTRAINT "admin_transfer_requests_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."admin_transfer_requests"
    ADD CONSTRAINT "admin_transfer_requests_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."ambassadors"
    ADD CONSTRAINT "ambassadors_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."app_settings"
    ADD CONSTRAINT "app_settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."athlete_invitations"
    ADD CONSTRAINT "athlete_invitations_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."athlete_invitations"
    ADD CONSTRAINT "athlete_invitations_consumed_by_user_id_fkey" FOREIGN KEY ("consumed_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."athlete_invitations"
    ADD CONSTRAINT "athlete_invitations_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."athlete_notifications"
    ADD CONSTRAINT "athlete_notifications_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."athlete_suggestions"
    ADD CONSTRAINT "athlete_suggestions_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."athlete_suggestions"
    ADD CONSTRAINT "athlete_suggestions_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."athlete_suggestions"
    ADD CONSTRAINT "athlete_suggestions_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."athlete_targets"
    ADD CONSTRAINT "athlete_targets_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."athlete_targets"
    ADD CONSTRAINT "athlete_targets_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."_deprecated_athlete_views_2026_05"
    ADD CONSTRAINT "athlete_views_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."_deprecated_athlete_views_2026_05"
    ADD CONSTRAINT "athlete_views_viewer_id_fkey" FOREIGN KEY ("viewer_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."athletes"
    ADD CONSTRAINT "athletes_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."athletes"
    ADD CONSTRAINT "athletes_committed_school_id_fkey" FOREIGN KEY ("committed_school_id") REFERENCES "public"."schools"("id");



ALTER TABLE ONLY "public"."athletes"
    ADD CONSTRAINT "athletes_consent_id_fkey" FOREIGN KEY ("consent_id") REFERENCES "public"."parental_consents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."athletes"
    ADD CONSTRAINT "athletes_equipe_id_fkey" FOREIGN KEY ("equipe_id") REFERENCES "public"."equipes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."athletes"
    ADD CONSTRAINT "athletes_ligue_id_fkey" FOREIGN KEY ("ligue_id") REFERENCES "public"."ligues"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."athletes"
    ADD CONSTRAINT "athletes_position_id_fkey" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."athletes"
    ADD CONSTRAINT "athletes_position_secondaire_id_fkey" FOREIGN KEY ("position_secondaire_id") REFERENCES "public"."positions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."athletes"
    ADD CONSTRAINT "athletes_recruitment_status_changed_by_fkey" FOREIGN KEY ("recruitment_status_changed_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."athletes"
    ADD CONSTRAINT "athletes_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."athletes"
    ADD CONSTRAINT "athletes_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."athletes"
    ADD CONSTRAINT "athletes_sport_secondaire_id_fkey" FOREIGN KEY ("sport_secondaire_id") REFERENCES "public"."sports"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."athletes"
    ADD CONSTRAINT "athletes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."athletes"
    ADD CONSTRAINT "athletes_verified_by_fkey" FOREIGN KEY ("verified_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."cegep_email_domains"
    ADD CONSTRAINT "cegep_email_domains_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id");



ALTER TABLE ONLY "public"."coach_badges"
    ADD CONSTRAINT "coach_badges_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_career_preferences"
    ADD CONSTRAINT "coach_career_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_notifications"
    ADD CONSTRAINT "coach_notifications_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."coach_reviews"
    ADD CONSTRAINT "coach_reviews_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."coach_reviews"
    ADD CONSTRAINT "coach_reviews_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."coach_reviews"
    ADD CONSTRAINT "coach_reviews_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."commitment_requests"
    ADD CONSTRAINT "commitment_requests_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."commitment_requests"
    ADD CONSTRAINT "commitment_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."commitment_requests"
    ADD CONSTRAINT "commitment_requests_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id");



ALTER TABLE ONLY "public"."consent_audit_trail"
    ADD CONSTRAINT "consent_audit_trail_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."consent_audit_trail"
    ADD CONSTRAINT "consent_audit_trail_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."consent_audit_trail"
    ADD CONSTRAINT "consent_audit_trail_consent_id_fkey" FOREIGN KEY ("consent_id") REFERENCES "public"."parental_consents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "public"."pipeline"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."conversations"
    ADD CONSTRAINT "conversations_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."custom_distinctions"
    ADD CONSTRAINT "custom_distinctions_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."custom_distinctions"
    ADD CONSTRAINT "custom_distinctions_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deletion_requests"
    ADD CONSTRAINT "deletion_requests_completed_by_fkey" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."deletion_requests"
    ADD CONSTRAINT "deletion_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."device_tokens"
    ADD CONSTRAINT "device_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."equipes"
    ADD CONSTRAINT "equipes_ligue_id_fkey" FOREIGN KEY ("ligue_id") REFERENCES "public"."ligues"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."equipes"
    ADD CONSTRAINT "equipes_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."equipes"
    ADD CONSTRAINT "equipes_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."evaluations"
    ADD CONSTRAINT "evaluations_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."evaluations"
    ADD CONSTRAINT "evaluations_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_consumed_by_user_id_fkey" FOREIGN KEY ("consumed_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."invitations"
    ADD CONSTRAINT "invitations_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ligues"
    ADD CONSTRAINT "ligues_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."loi25_incidents"
    ADD CONSTRAINT "loi25_incidents_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."loi25_incidents"
    ADD CONSTRAINT "loi25_incidents_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."loi25_portability_requests"
    ADD CONSTRAINT "loi25_portability_requests_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."loi25_portability_requests"
    ADD CONSTRAINT "loi25_portability_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."media_partners"
    ADD CONSTRAINT "media_partners_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."media_partners"
    ADD CONSTRAINT "media_partners_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."newsroom_events"
    ADD CONSTRAINT "newsroom_events_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."newsroom_events"
    ADD CONSTRAINT "newsroom_events_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."newsroom_events"
    ADD CONSTRAINT "newsroom_events_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parental_consents"
    ADD CONSTRAINT "parental_consents_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parental_consents"
    ADD CONSTRAINT "parental_consents_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."parental_consents"
    ADD CONSTRAINT "parental_consents_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."parental_consents"
    ADD CONSTRAINT "parental_consents_withdrawn_by_fkey" FOREIGN KEY ("withdrawn_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."partner_card_downloads"
    ADD CONSTRAINT "partner_card_downloads_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."partner_card_downloads"
    ADD CONSTRAINT "partner_card_downloads_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."media_partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."partner_profile_views"
    ADD CONSTRAINT "partner_profile_views_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."partner_profile_views"
    ADD CONSTRAINT "partner_profile_views_partner_id_fkey" FOREIGN KEY ("partner_id") REFERENCES "public"."media_partners"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pipeline"
    ADD CONSTRAINT "pipeline_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."pipeline"
    ADD CONSTRAINT "pipeline_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."positions"
    ADD CONSTRAINT "positions_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_changes"
    ADD CONSTRAINT "profile_changes_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_changes"
    ADD CONSTRAINT "profile_changes_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."_deprecated_profile_views_2026_05"
    ADD CONSTRAINT "profile_views_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."_deprecated_profile_views_2026_05"
    ADD CONSTRAINT "profile_views_cegep_id_fkey" FOREIGN KEY ("cegep_id") REFERENCES "public"."schools"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."_deprecated_profile_views_2026_05"
    ADD CONSTRAINT "profile_views_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."recruiter_activity_log"
    ADD CONSTRAINT "recruiter_activity_log_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recruiter_activity_log"
    ADD CONSTRAINT "recruiter_activity_log_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."recruiter_lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recruiter_activity_log"
    ADD CONSTRAINT "recruiter_activity_log_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recruiter_athlete_views"
    ADD CONSTRAINT "recruiter_athlete_views_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id");



ALTER TABLE ONLY "public"."recruiter_athlete_views"
    ADD CONSTRAINT "recruiter_athlete_views_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."recruiter_favorites"
    ADD CONSTRAINT "recruiter_favorites_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id");



ALTER TABLE ONLY "public"."recruiter_favorites"
    ADD CONSTRAINT "recruiter_favorites_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."recruiter_list_members"
    ADD CONSTRAINT "recruiter_list_members_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recruiter_list_members"
    ADD CONSTRAINT "recruiter_list_members_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."recruiter_lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recruiter_list_notes"
    ADD CONSTRAINT "recruiter_list_notes_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."recruiter_lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recruiter_list_notes"
    ADD CONSTRAINT "recruiter_list_notes_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recruiter_lists"
    ADD CONSTRAINT "recruiter_lists_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recruiter_notes"
    ADD CONSTRAINT "recruiter_notes_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id");



ALTER TABLE ONLY "public"."recruiter_notes"
    ADD CONSTRAINT "recruiter_notes_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."recruiter_pipeline"
    ADD CONSTRAINT "recruiter_pipeline_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id");



ALTER TABLE ONLY "public"."recruiter_pipeline"
    ADD CONSTRAINT "recruiter_pipeline_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."recruiter_preferences"
    ADD CONSTRAINT "recruiter_preferences_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recruiter_preferences"
    ADD CONSTRAINT "recruiter_preferences_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_ambassador_id_fkey" FOREIGN KEY ("ambassador_id") REFERENCES "public"."ambassadors"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."referrals"
    ADD CONSTRAINT "referrals_referred_user_id_fkey" FOREIGN KEY ("referred_user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reported_by_id_fkey" FOREIGN KEY ("reported_by_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."reports"
    ADD CONSTRAINT "reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."school_coaches"
    ADD CONSTRAINT "school_coaches_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."school_coaches"
    ADD CONSTRAINT "school_coaches_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."school_coaches"
    ADD CONSTRAINT "school_coaches_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id");



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_ambassador_id_fkey" FOREIGN KEY ("ambassador_id") REFERENCES "public"."ambassadors"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."subscriptions"
    ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_athletes"
    ADD CONSTRAINT "team_athletes_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_athletes"
    ADD CONSTRAINT "team_athletes_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_coaches"
    ADD CONSTRAINT "team_coaches_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_coaches"
    ADD CONSTRAINT "team_coaches_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_invitations"
    ADD CONSTRAINT "team_invitations_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_invitations"
    ADD CONSTRAINT "team_invitations_invited_by_coach_id_fkey" FOREIGN KEY ("invited_by_coach_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."team_invitations"
    ADD CONSTRAINT "team_invitations_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_primary_team_id_fkey" FOREIGN KEY ("primary_team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE SET NULL;



CREATE POLICY "Admin coaches can update their school" ON "public"."school_registry" FOR UPDATE USING (("claimed_by" = "auth"."uid"()));



CREATE POLICY "Admins delete invitations" ON "public"."invitations" FOR DELETE TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins manage all invitations" ON "public"."team_invitations" TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Admins read all partners" ON "public"."media_partners" FOR SELECT TO "authenticated" USING ("public"."is_admin"());



CREATE POLICY "Admins update all partners" ON "public"."media_partners" FOR UPDATE TO "authenticated" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "Anyone can read domains" ON "public"."cegep_email_domains" FOR SELECT USING (true);



CREATE POLICY "Anyone can view custom distinctions" ON "public"."custom_distinctions" FOR SELECT USING (true);



CREATE POLICY "Approved partners read eligible newsroom events" ON "public"."newsroom_events" FOR SELECT USING (("public"."is_approved_partner"("auth"."uid"()) AND (("athlete_id" IS NULL) OR "public"."is_partner_eligible_athlete"("athlete_id"))));



CREATE POLICY "Approved partners read opted-in athletes" ON "public"."athletes" FOR SELECT USING ((("partner_visibility_opt_in" = true) AND "public"."is_approved_partner"("auth"."uid"())));



CREATE POLICY "Athletes can read own suggestions" ON "public"."athlete_suggestions" FOR SELECT USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."user_id" = "auth"."uid"()))));



CREATE POLICY "Athletes insert own suggestions" ON "public"."athlete_suggestions" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Athletes manage own targets" ON "public"."athlete_targets" TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."athletes" "a"
  WHERE (("a"."id" = "athlete_targets"."athlete_id") AND ("a"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."athletes" "a"
  WHERE (("a"."id" = "athlete_targets"."athlete_id") AND ("a"."user_id" = "auth"."uid"())))));



CREATE POLICY "Athletes read own favorites" ON "public"."recruiter_favorites" FOR SELECT USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."user_id" = "auth"."uid"()))));



CREATE POLICY "Athletes read own notifications" ON "public"."athlete_notifications" FOR SELECT USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."user_id" = "auth"."uid"()))));



CREATE POLICY "Athletes read own team rows" ON "public"."team_athletes" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."athletes" "a"
  WHERE (("a"."id" = "team_athletes"."athlete_id") AND ("a"."user_id" = "auth"."uid"())))));



CREATE POLICY "Athletes read own views" ON "public"."_deprecated_profile_views_2026_05" FOR SELECT USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."user_id" = "auth"."uid"()))));



CREATE POLICY "Athletes read their own card downloads" ON "public"."partner_card_downloads" FOR SELECT USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."user_id" = "auth"."uid"()))));



CREATE POLICY "Athletes read their own profile views" ON "public"."partner_profile_views" FOR SELECT USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."user_id" = "auth"."uid"()))));



CREATE POLICY "Athletes see their teams" ON "public"."teams" FOR SELECT USING (("school_id" = "public"."current_user_school_id"()));



CREATE POLICY "Athletes select own invitations" ON "public"."team_invitations" FOR SELECT TO "authenticated" USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."user_id" = "auth"."uid"()))));



CREATE POLICY "Athletes self-assign to school team" ON "public"."team_athletes" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."athletes" "a"
  WHERE (("a"."id" = "team_athletes"."athlete_id") AND ("a"."user_id" = "auth"."uid"())))) AND (EXISTS ( SELECT 1
   FROM ("public"."teams" "t"
     JOIN "public"."athletes" "a" ON (("a"."id" = "team_athletes"."athlete_id")))
  WHERE (("t"."id" = "team_athletes"."team_id") AND ("t"."school_id" = "a"."school_id"))))));



CREATE POLICY "Athletes update own invitations" ON "public"."team_invitations" FOR UPDATE TO "authenticated" USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."user_id" = "auth"."uid"())))) WITH CHECK ((("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."user_id" = "auth"."uid"()))) AND ("status" = ANY (ARRAY['ACCEPTED'::"text", 'REJECTED'::"text"]))));



CREATE POLICY "Athletes update own notifications" ON "public"."athlete_notifications" FOR UPDATE USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."user_id" = "auth"."uid"()))));



CREATE POLICY "Authenticated users can submit athlete reports" ON "public"."reports" FOR INSERT TO "authenticated" WITH CHECK ((("reported_by_id" = "auth"."uid"()) AND ("status" = 'OUVERT'::"text") AND ("target_type" = 'athlete'::"text") AND ("type" = 'PROFIL'::"text")));



CREATE POLICY "Authenticated users update suggestions" ON "public"."athlete_suggestions" FOR UPDATE USING (("auth"."uid"() IS NOT NULL)) WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Civil league teams are publicly discoverable" ON "public"."teams" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."schools" "s"
  WHERE (("s"."id" = "teams"."school_id") AND ("s"."type" = 'LIGUE_CIVILE'::"text")))));



CREATE POLICY "Coaches can delete their custom distinctions" ON "public"."custom_distinctions" FOR DELETE USING (("auth"."uid"() = "coach_id"));



CREATE POLICY "Coaches can insert custom distinctions" ON "public"."custom_distinctions" FOR INSERT WITH CHECK (("auth"."uid"() = "coach_id"));



CREATE POLICY "Coaches can read own notifications" ON "public"."coach_notifications" FOR SELECT TO "authenticated" USING (("coach_id" = "auth"."uid"()));



CREATE POLICY "Coaches can read suggestions for their claimed athletes" ON "public"."athlete_suggestions" FOR SELECT TO "authenticated" USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."coach_id" = "auth"."uid"()))));



CREATE POLICY "Coaches can update own notifications" ON "public"."coach_notifications" FOR UPDATE TO "authenticated" USING (("coach_id" = "auth"."uid"())) WITH CHECK (("coach_id" = "auth"."uid"()));



CREATE POLICY "Coaches cancel own invitations" ON "public"."team_invitations" FOR UPDATE TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."team_coaches" "tc"
  WHERE (("tc"."coach_id" = "auth"."uid"()) AND ("tc"."team_id" = "team_invitations"."team_id")))) OR (EXISTS ( SELECT 1
   FROM ("public"."school_coaches" "sc"
     JOIN "public"."teams" "t" ON (("t"."school_id" = "sc"."school_id")))
  WHERE (("sc"."coach_id" = "auth"."uid"()) AND ("t"."id" = "team_invitations"."team_id") AND ("sc"."role" = ANY (ARRAY['DIRECTEUR'::"public"."coach_school_role", 'DIRECTEUR_INTERIM'::"public"."coach_school_role"]))))))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."team_coaches" "tc"
  WHERE (("tc"."coach_id" = "auth"."uid"()) AND ("tc"."team_id" = "team_invitations"."team_id")))) OR (EXISTS ( SELECT 1
   FROM ("public"."school_coaches" "sc"
     JOIN "public"."teams" "t" ON (("t"."school_id" = "sc"."school_id")))
  WHERE (("sc"."coach_id" = "auth"."uid"()) AND ("t"."id" = "team_invitations"."team_id") AND ("sc"."role" = ANY (ARRAY['DIRECTEUR'::"public"."coach_school_role", 'DIRECTEUR_INTERIM'::"public"."coach_school_role"])))))));



CREATE POLICY "Coaches create civil schools" ON "public"."schools" FOR INSERT TO "authenticated" WITH CHECK ((("type" = 'LIGUE_CIVILE'::"text") AND (EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'COACH'::"public"."user_role") AND ("u"."context" = 'ligue_civile'::"text"))))));



CREATE POLICY "Coaches create teams" ON "public"."teams" FOR INSERT WITH CHECK (("school_id" = "public"."current_user_school_id"()));



CREATE POLICY "Coaches delete teams" ON "public"."teams" FOR DELETE USING (("school_id" = "public"."current_user_school_id"()));



CREATE POLICY "Coaches insert invitations on own teams" ON "public"."team_invitations" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."team_coaches" "tc"
  WHERE (("tc"."coach_id" = "auth"."uid"()) AND ("tc"."team_id" = "team_invitations"."team_id")))) OR (EXISTS ( SELECT 1
   FROM ("public"."school_coaches" "sc"
     JOIN "public"."teams" "t" ON (("t"."school_id" = "sc"."school_id")))
  WHERE (("sc"."coach_id" = "auth"."uid"()) AND ("t"."id" = "team_invitations"."team_id") AND ("sc"."role" = ANY (ARRAY['DIRECTEUR'::"public"."coach_school_role", 'DIRECTEUR_INTERIM'::"public"."coach_school_role"])))))));



CREATE POLICY "Coaches insert school_coaches" ON "public"."school_coaches" FOR INSERT TO "authenticated" WITH CHECK ((("coach_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."school_coaches" "sc_dir"
  WHERE (("sc_dir"."coach_id" = "auth"."uid"()) AND ("sc_dir"."school_id" = "school_coaches"."school_id") AND ("sc_dir"."role" = ANY (ARRAY['DIRECTEUR'::"public"."coach_school_role", 'DIRECTEUR_INTERIM'::"public"."coach_school_role"])))))));



CREATE POLICY "Coaches manage own team athletes" ON "public"."team_athletes" USING ((EXISTS ( SELECT 1
   FROM "public"."team_coaches" "tc"
  WHERE (("tc"."team_id" = "team_athletes"."team_id") AND ("tc"."coach_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."team_coaches" "tc"
  WHERE (("tc"."team_id" = "team_athletes"."team_id") AND ("tc"."coach_id" = "auth"."uid"())))));



CREATE POLICY "Coaches read activity for their claimed athletes" ON "public"."recruiter_activity_log" FOR SELECT USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."coach_id" = "auth"."uid"()))));



CREATE POLICY "Coaches read favorites for their athletes" ON "public"."recruiter_favorites" FOR SELECT USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."coach_id" = "auth"."uid"()))));



CREATE POLICY "Coaches read own athlete invitations" ON "public"."athlete_invitations" FOR SELECT TO "authenticated" USING ((("created_by" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "Coaches read views for their athletes" ON "public"."_deprecated_profile_views_2026_05" FOR SELECT USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."coach_id" = "auth"."uid"()))));



CREATE POLICY "Coaches read views for their athletes" ON "public"."recruiter_athlete_views" FOR SELECT USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."coach_id" = "auth"."uid"()))));



CREATE POLICY "Coaches see their school teams" ON "public"."teams" FOR SELECT USING (("school_id" = "public"."current_user_school_id"()));



CREATE POLICY "Coaches select invitations on own teams" ON "public"."team_invitations" FOR SELECT TO "authenticated" USING (((EXISTS ( SELECT 1
   FROM "public"."team_coaches" "tc"
  WHERE (("tc"."coach_id" = "auth"."uid"()) AND ("tc"."team_id" = "team_invitations"."team_id")))) OR (EXISTS ( SELECT 1
   FROM ("public"."school_coaches" "sc"
     JOIN "public"."teams" "t" ON (("t"."school_id" = "sc"."school_id")))
  WHERE (("sc"."coach_id" = "auth"."uid"()) AND ("t"."id" = "team_invitations"."team_id") AND ("sc"."role" = ANY (ARRAY['DIRECTEUR'::"public"."coach_school_role", 'DIRECTEUR_INTERIM'::"public"."coach_school_role"])))))));



CREATE POLICY "Coaches update own team athletes" ON "public"."athletes" FOR UPDATE TO "authenticated" USING ("public"."coach_can_manage_athlete"("id")) WITH CHECK ("public"."coach_can_manage_athlete"("id"));



CREATE POLICY "Coaches update suggestions for their claimed athletes" ON "public"."athlete_suggestions" FOR UPDATE TO "authenticated" USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."coach_id" = "auth"."uid"()))));



CREATE POLICY "Coaches update teams" ON "public"."teams" FOR UPDATE USING (("school_id" = "public"."current_user_school_id"()));



CREATE POLICY "Directors manage school team athletes" ON "public"."team_athletes" USING ((EXISTS ( SELECT 1
   FROM ("public"."teams" "t"
     JOIN "public"."school_coaches" "sc" ON (("sc"."school_id" = "t"."school_id")))
  WHERE (("t"."id" = "team_athletes"."team_id") AND ("sc"."coach_id" = "auth"."uid"()) AND ("sc"."role" = ANY (ARRAY['DIRECTEUR'::"public"."coach_school_role", 'DIRECTEUR_INTERIM'::"public"."coach_school_role"])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."teams" "t"
     JOIN "public"."school_coaches" "sc" ON (("sc"."school_id" = "t"."school_id")))
  WHERE (("t"."id" = "team_athletes"."team_id") AND ("sc"."coach_id" = "auth"."uid"()) AND ("sc"."role" = ANY (ARRAY['DIRECTEUR'::"public"."coach_school_role", 'DIRECTEUR_INTERIM'::"public"."coach_school_role"]))))));



CREATE POLICY "Institutional teams discoverable during onboarding" ON "public"."teams" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."schools" "s"
  WHERE (("s"."id" = "teams"."school_id") AND ("s"."type" = ANY (ARRAY['CEGEP'::"text", 'SECONDAIRE'::"text"]))))));



CREATE POLICY "Partners log own downloads" ON "public"."partner_card_downloads" FOR INSERT WITH CHECK (("partner_id" IN ( SELECT "media_partners"."id"
   FROM "public"."media_partners"
  WHERE (("media_partners"."user_id" = "auth"."uid"()) AND ("media_partners"."status" = 'APPROVED'::"text")))));



CREATE POLICY "Partners log own views" ON "public"."partner_profile_views" FOR INSERT WITH CHECK (("partner_id" IN ( SELECT "media_partners"."id"
   FROM "public"."media_partners"
  WHERE (("media_partners"."user_id" = "auth"."uid"()) AND ("media_partners"."status" = 'APPROVED'::"text")))));



CREATE POLICY "Partners read own download history" ON "public"."partner_card_downloads" FOR SELECT USING (("partner_id" IN ( SELECT "media_partners"."id"
   FROM "public"."media_partners"
  WHERE ("media_partners"."user_id" = "auth"."uid"()))));



CREATE POLICY "Partners read own profile" ON "public"."media_partners" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Partners read own view history" ON "public"."partner_profile_views" FOR SELECT USING (("partner_id" IN ( SELECT "media_partners"."id"
   FROM "public"."media_partners"
  WHERE ("media_partners"."user_id" = "auth"."uid"()))));



CREATE POLICY "Partners update own profile" ON "public"."media_partners" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK ((("user_id" = "auth"."uid"()) AND "public"."partner_privileged_cols_unchanged"("status", "show_on_homepage")));



CREATE POLICY "Platform admins read all newsroom events" ON "public"."newsroom_events" FOR SELECT USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "Public read approved partners" ON "public"."media_partners" FOR SELECT USING (("status" = 'APPROVED'::"text"));



CREATE POLICY "Recruiters insert views" ON "public"."_deprecated_profile_views_2026_05" FOR INSERT WITH CHECK (("recruiter_id" = "auth"."uid"()));



CREATE POLICY "Recruiters manage own notes" ON "public"."recruiter_notes" USING ((("auth"."uid"() = "recruiter_id") AND (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'RECRUTEUR'::"public"."user_role")))))) WITH CHECK ((("auth"."uid"() = "recruiter_id") AND (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'RECRUTEUR'::"public"."user_role"))))));



CREATE POLICY "Recruiters manage own views" ON "public"."recruiter_athlete_views" USING ((("auth"."uid"() = "recruiter_id") AND (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'RECRUTEUR'::"public"."user_role")))))) WITH CHECK ((("auth"."uid"() = "recruiter_id") AND (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'RECRUTEUR'::"public"."user_role"))))));



CREATE POLICY "Recruiters manage their own list notes" ON "public"."recruiter_list_notes" USING (("recruiter_id" = "auth"."uid"())) WITH CHECK (("recruiter_id" = "auth"."uid"()));



CREATE POLICY "Recruiters read verified team athletes" ON "public"."team_athletes" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."users" "u"
  WHERE (("u"."id" = "auth"."uid"()) AND ("u"."role" = 'RECRUTEUR'::"public"."user_role")))) AND (EXISTS ( SELECT 1
   FROM "public"."athletes" "a"
  WHERE (("a"."id" = "team_athletes"."athlete_id") AND ("a"."verified" = true) AND ("a"."status" = 'ACTIF'::"public"."account_status"))))));



CREATE POLICY "Recruiters see teams" ON "public"."teams" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'RECRUTEUR'::"public"."user_role")))));



CREATE POLICY "Recruiters see their own activity" ON "public"."recruiter_activity_log" USING (("recruiter_id" = "auth"."uid"())) WITH CHECK (("recruiter_id" = "auth"."uid"()));



CREATE POLICY "School registry is publicly readable" ON "public"."school_registry" FOR SELECT USING (true);



CREATE POLICY "Secondary teams readable for onboarding" ON "public"."teams" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."schools" "s"
  WHERE (("s"."id" = "teams"."school_id") AND ("s"."type" = 'SECONDAIRE'::"text")))));



CREATE POLICY "Users can read their own filed reports" ON "public"."reports" FOR SELECT TO "authenticated" USING (("reported_by_id" = "auth"."uid"()));



CREATE POLICY "Users invite from their own school" ON "public"."invitations" FOR INSERT TO "authenticated" WITH CHECK ((("invited_by" = "auth"."uid"()) AND ("status" = 'PENDING'::"public"."invitation_status") AND (("school_id" IS NULL) OR ("school_id" = "public"."current_user_school_id"()))));



CREATE POLICY "Users read conversation participants" ON "public"."users" FOR SELECT USING ((("id" = "auth"."uid"()) OR ("id" IN ( SELECT "conversations"."recruiter_id"
   FROM "public"."conversations"
  WHERE ("conversations"."coach_id" = "auth"."uid"()))) OR ("id" IN ( SELECT "conversations"."coach_id"
   FROM "public"."conversations"
  WHERE ("conversations"."recruiter_id" = "auth"."uid"())))));



CREATE POLICY "Users read their own invitations" ON "public"."invitations" FOR SELECT TO "authenticated" USING ((("invited_by" = "auth"."uid"()) OR ("consumed_by_user_id" = "auth"."uid"()) OR "public"."is_admin"()));



CREATE POLICY "Users revoke their own pending invitations" ON "public"."invitations" FOR UPDATE TO "authenticated" USING (((("invited_by" = "auth"."uid"()) AND ("status" = 'PENDING'::"public"."invitation_status")) OR "public"."is_admin"())) WITH CHECK (((("invited_by" = "auth"."uid"()) AND ("status" = 'REVOKED'::"public"."invitation_status")) OR "public"."is_admin"()));



ALTER TABLE "public"."_deprecated_athlete_views_2026_05" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."_deprecated_profile_views_2026_05" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activities" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."activity_feed" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_claims" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admin_claims_admin_select" ON "public"."admin_claims" FOR SELECT USING ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "admin_claims_admin_update" ON "public"."admin_claims" FOR UPDATE USING ("public"."is_platform_admin"("auth"."uid"())) WITH CHECK ("public"."is_platform_admin"("auth"."uid"()));



CREATE POLICY "admin_claims_user_insert_own" ON "public"."admin_claims" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "admin_claims_user_select_own" ON "public"."admin_claims" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."admin_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."admin_transfer_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "admins delete all" ON "public"."positions" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "admins delete all" ON "public"."reports" FOR DELETE USING ("public"."is_admin"());



CREATE POLICY "admins insert activities" ON "public"."activities" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins insert all" ON "public"."evaluations" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins insert all" ON "public"."positions" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins insert all" ON "public"."schools" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins insert all" ON "public"."sports" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins insert all" ON "public"."subscriptions" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins insert notifications" ON "public"."athlete_notifications" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins insert recruiter_activity_log" ON "public"."recruiter_activity_log" FOR INSERT WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins insert users" ON "public"."users" FOR INSERT TO "authenticated" WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins manage loi25_incidents" ON "public"."loi25_incidents" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins manage loi25_portability" ON "public"."loi25_portability_requests" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins manage loi25_settings" ON "public"."loi25_settings" USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins read all" ON "public"."_deprecated_profile_views_2026_05" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read all" ON "public"."athletes" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read all" ON "public"."evaluations" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read all" ON "public"."positions" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read all" ON "public"."profile_changes" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read all" ON "public"."recruiter_favorites" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read all" ON "public"."recruiter_pipeline" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read all" ON "public"."reports" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read all" ON "public"."schools" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read all" ON "public"."sports" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read all" ON "public"."subscriptions" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read all" ON "public"."team_athletes" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read all" ON "public"."teams" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read all" ON "public"."users" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read athlete_suggestions" ON "public"."athlete_suggestions" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read consent_audit_trail" ON "public"."consent_audit_trail" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read conversations" ON "public"."conversations" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read messages" ON "public"."messages" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read parental_consents" ON "public"."parental_consents" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read partner_profile_views" ON "public"."partner_profile_views" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read recruiter_activity_log" ON "public"."recruiter_activity_log" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read recruiter_athlete_views" ON "public"."recruiter_athlete_views" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins update all" ON "public"."athletes" FOR UPDATE USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins update all" ON "public"."evaluations" FOR UPDATE USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins update all" ON "public"."positions" FOR UPDATE USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins update all" ON "public"."recruiter_pipeline" FOR UPDATE USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins update all" ON "public"."reports" FOR UPDATE USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins update all" ON "public"."schools" FOR UPDATE USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins update all" ON "public"."sports" FOR UPDATE USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins update all" ON "public"."subscriptions" FOR UPDATE USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins update all" ON "public"."users" FOR UPDATE USING ("public"."is_admin"()) WITH CHECK ("public"."is_admin"());



CREATE POLICY "admins update settings" ON "public"."app_settings" FOR UPDATE USING ("public"."is_admin"());



ALTER TABLE "public"."ambassadors" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "anyone can read settings" ON "public"."app_settings" FOR SELECT USING (true);



ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."athlete_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."athlete_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."athlete_suggestions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."athlete_targets" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."athletes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "athletes can claim own orphan match" ON "public"."athletes" FOR UPDATE TO "authenticated" USING ((("user_id" IS NULL) AND ("email" IS NOT NULL) AND ("lower"("email") = "lower"("public"."current_user_email"())))) WITH CHECK (("user_id" = "auth"."uid"()));



COMMENT ON POLICY "athletes can claim own orphan match" ON "public"."athletes" IS 'Phase 2 athlete claim: lets the same athlete UPDATE that orphan row to set user_id = auth.uid(). WITH CHECK forces the claim to be atomic.';



CREATE POLICY "athletes can insert own profile" ON "public"."athletes" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "athletes can read own orphan match" ON "public"."athletes" FOR SELECT TO "authenticated" USING ((("user_id" IS NULL) AND ("email" IS NOT NULL) AND ("lower"("email") = "lower"("public"."current_user_email"()))));



COMMENT ON POLICY "athletes can read own orphan match" ON "public"."athletes" IS 'Phase 2 athlete claim: lets a just-signed-up athlete discover a coach-created orphan profile matching their email.';



CREATE POLICY "athletes can read own profile" ON "public"."athletes" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "athletes can update own profile" ON "public"."athletes" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "athletes read own views" ON "public"."recruiter_athlete_views" FOR SELECT USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."user_id" = "auth"."uid"()))));



CREATE POLICY "athletes_insert" ON "public"."athletes" FOR INSERT TO "authenticated" WITH CHECK ((("coach_id" = "auth"."uid"()) AND "public"."is_coach"() AND ("public"."user_has_pro"() OR (("public"."get_user_tier"() = 'free'::"text") AND ("public"."count_coach_athletes"() < 30)))));



CREATE POLICY "authenticated read coaches" ON "public"."users" FOR SELECT TO "authenticated" USING (("role" = 'COACH'::"public"."user_role"));



CREATE POLICY "authenticated read evaluations" ON "public"."evaluations" FOR SELECT TO "authenticated" USING ((("coach_id" = "auth"."uid"()) OR "public"."is_recruiter"() OR (EXISTS ( SELECT 1
   FROM "public"."athletes" "a"
  WHERE (("a"."id" = "evaluations"."athlete_id") AND ("a"."user_id" = "auth"."uid"())))) OR "public"."is_admin"()));



ALTER TABLE "public"."cegep_email_domains" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_career_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "coach_conversations_insert" ON "public"."conversations" FOR INSERT TO "authenticated" WITH CHECK ((("coach_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."athletes" "a"
  WHERE (("a"."id" = "conversations"."athlete_id") AND ("a"."coach_id" = "auth"."uid"()))))));



CREATE POLICY "coach_conversations_select" ON "public"."conversations" FOR SELECT USING (("coach_id" = "auth"."uid"()));



CREATE POLICY "coach_conversations_update" ON "public"."conversations" FOR UPDATE TO "authenticated" USING (("coach_id" = "auth"."uid"())) WITH CHECK (("coach_id" = "auth"."uid"()));



ALTER TABLE "public"."coach_notifications" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "coach_own_career_prefs" ON "public"."coach_career_preferences" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "coach_read_own" ON "public"."school_coaches" FOR SELECT USING (("coach_id" = "auth"."uid"()));



CREATE POLICY "coach_read_reviews" ON "public"."coach_reviews" FOR SELECT USING (("coach_id" = "auth"."uid"()));



ALTER TABLE "public"."coach_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "coach_update_own" ON "public"."school_coaches" FOR UPDATE USING (("coach_id" = "auth"."uid"()));



CREATE POLICY "coaches can claim unclaimed school athletes" ON "public"."athletes" FOR UPDATE USING ((("coach_id" IS NULL) AND ("school_id" = "public"."current_user_school_id"()))) WITH CHECK (("coach_id" = "auth"."uid"()));



CREATE POLICY "coaches can update own athletes" ON "public"."athletes" FOR UPDATE USING (("coach_id" = "auth"."uid"()));



CREATE POLICY "coaches read own athletes" ON "public"."athletes" FOR SELECT TO "authenticated" USING ((("coach_id" = "auth"."uid"()) OR ("public"."is_coach"() AND ("school_id" = "public"."current_user_school_id"())) OR (EXISTS ( SELECT 1
   FROM "public"."school_coaches" "sc"
  WHERE (("sc"."coach_id" = "auth"."uid"()) AND ("sc"."school_id" = "athletes"."school_id"))))));



CREATE POLICY "coaches read pipeline for own athletes" ON "public"."recruiter_pipeline" FOR SELECT USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."coach_id" = "auth"."uid"()))));



CREATE POLICY "coaches read recruiter directory" ON "public"."users" FOR SELECT TO "authenticated" USING ((("role" = 'RECRUTEUR'::"public"."user_role") AND "public"."is_coach"()));



ALTER TABLE "public"."commitment_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."consent_audit_trail" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversations participants" ON "public"."conversations" FOR SELECT USING ((("recruiter_id" = "auth"."uid"()) OR ("coach_id" = "auth"."uid"())));



CREATE POLICY "conversations_insert" ON "public"."conversations" FOR INSERT TO "authenticated" WITH CHECK ((("recruiter_id" = "auth"."uid"()) AND "public"."user_has_pro"()));



ALTER TABLE "public"."custom_distinctions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deletion_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "deletion_requests own" ON "public"."deletion_requests" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."device_tokens" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "device_tokens_delete_own" ON "public"."device_tokens" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "device_tokens_select_own" ON "public"."device_tokens" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."equipes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."evaluations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "evaluations coach" ON "public"."evaluations" TO "authenticated" USING (("coach_id" = "auth"."uid"())) WITH CHECK (("coach_id" = "auth"."uid"()));



ALTER TABLE "public"."invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ligues" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ligues public read" ON "public"."ligues" FOR SELECT USING (true);



ALTER TABLE "public"."loi25_incidents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."loi25_portability_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."loi25_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."media_partners" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages participants" ON "public"."messages" FOR SELECT USING (("conversation_id" IN ( SELECT "conversations"."id"
   FROM "public"."conversations"
  WHERE (("conversations"."recruiter_id" = "auth"."uid"()) OR ("conversations"."coach_id" = "auth"."uid"())))));



CREATE POLICY "messages_insert" ON "public"."messages" FOR INSERT TO "authenticated" WITH CHECK ((("sender_id" = "auth"."uid"()) AND ((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = 'COACH'::"public"."user_role") OR ((( SELECT "users"."role"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"())) = 'RECRUTEUR'::"public"."user_role") AND "public"."user_has_pro"())) AND (EXISTS ( SELECT 1
   FROM "public"."conversations"
  WHERE (("conversations"."id" = "messages"."conversation_id") AND (("conversations"."recruiter_id" = "auth"."uid"()) OR ("conversations"."coach_id" = "auth"."uid"())))))));



CREATE POLICY "messages_select" ON "public"."messages" FOR SELECT USING (("conversation_id" IN ( SELECT "conversations"."id"
   FROM "public"."conversations"
  WHERE (("conversations"."recruiter_id" = "auth"."uid"()) OR ("conversations"."coach_id" = "auth"."uid"())))));



CREATE POLICY "messages_update" ON "public"."messages" FOR UPDATE USING (("conversation_id" IN ( SELECT "conversations"."id"
   FROM "public"."conversations"
  WHERE (("conversations"."recruiter_id" = "auth"."uid"()) OR ("conversations"."coach_id" = "auth"."uid"())))));



ALTER TABLE "public"."newsroom_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parental_consents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."partner_card_downloads" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."partner_profile_views" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pipeline" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pipeline own" ON "public"."pipeline" USING (("recruiter_id" = "auth"."uid"()));



ALTER TABLE "public"."platform_snapshots" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."positions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "positions public read" ON "public"."positions" FOR SELECT USING (true);



ALTER TABLE "public"."profile_changes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recruiter_activity_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recruiter_athlete_views" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recruiter_conversations_delete" ON "public"."conversations" FOR DELETE TO "authenticated" USING (("recruiter_id" = "auth"."uid"()));



CREATE POLICY "recruiter_conversations_select" ON "public"."conversations" FOR SELECT TO "authenticated" USING (("recruiter_id" = "auth"."uid"()));



CREATE POLICY "recruiter_conversations_update" ON "public"."conversations" FOR UPDATE TO "authenticated" USING (("recruiter_id" = "auth"."uid"())) WITH CHECK (("recruiter_id" = "auth"."uid"()));



ALTER TABLE "public"."recruiter_favorites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recruiter_favorites_delete" ON "public"."recruiter_favorites" FOR DELETE TO "authenticated" USING (("recruiter_id" = "auth"."uid"()));



CREATE POLICY "recruiter_favorites_insert" ON "public"."recruiter_favorites" FOR INSERT TO "authenticated" WITH CHECK ((("recruiter_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'RECRUTEUR'::"public"."user_role")))) AND ("public"."user_has_pro"() OR (("public"."get_user_tier"() = 'free'::"text") AND ("public"."count_user_favorites"() < 10)))));



CREATE POLICY "recruiter_favorites_select" ON "public"."recruiter_favorites" FOR SELECT TO "authenticated" USING (("recruiter_id" = "auth"."uid"()));



CREATE POLICY "recruiter_favorites_update" ON "public"."recruiter_favorites" FOR UPDATE TO "authenticated" USING (("recruiter_id" = "auth"."uid"())) WITH CHECK (("recruiter_id" = "auth"."uid"()));



CREATE POLICY "recruiter_insert_reviews" ON "public"."coach_reviews" FOR INSERT WITH CHECK (("recruiter_id" = "auth"."uid"()));



ALTER TABLE "public"."recruiter_list_members" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recruiter_list_members_delete" ON "public"."recruiter_list_members" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."recruiter_lists"
  WHERE (("recruiter_lists"."id" = "recruiter_list_members"."list_id") AND ("recruiter_lists"."recruiter_id" = "auth"."uid"())))));



CREATE POLICY "recruiter_list_members_insert" ON "public"."recruiter_list_members" FOR INSERT TO "authenticated" WITH CHECK (("public"."user_has_pro"() AND (EXISTS ( SELECT 1
   FROM "public"."recruiter_lists"
  WHERE (("recruiter_lists"."id" = "recruiter_list_members"."list_id") AND ("recruiter_lists"."recruiter_id" = "auth"."uid"()))))));



CREATE POLICY "recruiter_list_members_select" ON "public"."recruiter_list_members" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."recruiter_lists"
  WHERE (("recruiter_lists"."id" = "recruiter_list_members"."list_id") AND ("recruiter_lists"."recruiter_id" = "auth"."uid"())))));



ALTER TABLE "public"."recruiter_list_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recruiter_lists" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recruiter_lists_delete" ON "public"."recruiter_lists" FOR DELETE TO "authenticated" USING (("recruiter_id" = "auth"."uid"()));



CREATE POLICY "recruiter_lists_insert" ON "public"."recruiter_lists" FOR INSERT TO "authenticated" WITH CHECK ((("recruiter_id" = "auth"."uid"()) AND "public"."user_has_pro"()));



CREATE POLICY "recruiter_lists_select" ON "public"."recruiter_lists" FOR SELECT TO "authenticated" USING (("recruiter_id" = "auth"."uid"()));



CREATE POLICY "recruiter_lists_update" ON "public"."recruiter_lists" FOR UPDATE TO "authenticated" USING (("recruiter_id" = "auth"."uid"())) WITH CHECK ((("recruiter_id" = "auth"."uid"()) AND "public"."user_has_pro"()));



ALTER TABLE "public"."recruiter_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recruiter_pipeline" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recruiter_pipeline_delete" ON "public"."recruiter_pipeline" FOR DELETE TO "authenticated" USING (("recruiter_id" = "auth"."uid"()));



CREATE POLICY "recruiter_pipeline_insert" ON "public"."recruiter_pipeline" FOR INSERT WITH CHECK ((("recruiter_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'RECRUTEUR'::"public"."user_role")))) AND "public"."user_has_pro"()));



CREATE POLICY "recruiter_pipeline_select" ON "public"."recruiter_pipeline" FOR SELECT TO "authenticated" USING (("recruiter_id" = "auth"."uid"()));



CREATE POLICY "recruiter_pipeline_update" ON "public"."recruiter_pipeline" FOR UPDATE USING ((("recruiter_id" = "auth"."uid"()) AND (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'RECRUTEUR'::"public"."user_role")))))) WITH CHECK ((("recruiter_id" = "auth"."uid"()) AND "public"."user_has_pro"()));



ALTER TABLE "public"."recruiter_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recruiter_preferences own" ON "public"."recruiter_preferences" USING (("recruiter_id" = "auth"."uid"()));



CREATE POLICY "recruiter_read_reviews" ON "public"."coach_reviews" FOR SELECT USING (("recruiter_id" = "auth"."uid"()));



CREATE POLICY "recruiter_update_reviews" ON "public"."coach_reviews" FOR UPDATE USING (("recruiter_id" = "auth"."uid"()));



CREATE POLICY "recruiters can delete pipeline" ON "public"."pipeline" FOR DELETE USING (("recruiter_id" = "auth"."uid"()));



CREATE POLICY "recruiters can insert pipeline" ON "public"."pipeline" FOR INSERT WITH CHECK (("recruiter_id" = "auth"."uid"()));



CREATE POLICY "recruiters can read own pipeline" ON "public"."pipeline" FOR SELECT USING (("recruiter_id" = "auth"."uid"()));



CREATE POLICY "recruiters can update pipeline" ON "public"."pipeline" FOR UPDATE USING (("recruiter_id" = "auth"."uid"()));



CREATE POLICY "recruiters read active athletes" ON "public"."athletes" FOR SELECT TO "authenticated" USING ((("status" = 'ACTIF'::"public"."account_status") AND "public"."is_recruiter"()));



ALTER TABLE "public"."referrals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."reports" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."school_coaches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."school_registry" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "school_registry public read" ON "public"."school_registry" FOR SELECT USING (true);



ALTER TABLE "public"."schools" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "schools public read" ON "public"."schools" FOR SELECT USING (true);



ALTER TABLE "public"."sports" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sports public read" ON "public"."sports" FOR SELECT USING (true);



ALTER TABLE "public"."stripe_webhook_events" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "sub_features_athlete public read" ON "public"."subscription_features_athlete" FOR SELECT USING (true);



CREATE POLICY "sub_features_coach public read" ON "public"."subscription_features_coach" FOR SELECT USING (true);



CREATE POLICY "sub_features_recruteur public read" ON "public"."subscription_features_recruteur" FOR SELECT USING (true);



ALTER TABLE "public"."subscription_features_athlete" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_features_coach" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscription_features_recruteur" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscriptions own" ON "public"."subscriptions" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "super_admin insert settings" ON "public"."app_settings" FOR INSERT WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."team_athletes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_coaches" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "team_coaches readable when team is readable" ON "public"."team_coaches" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM ("public"."teams" "t"
     JOIN "public"."schools" "s" ON (("s"."id" = "t"."school_id")))
  WHERE (("t"."id" = "team_coaches"."team_id") AND ("s"."type" = ANY (ARRAY['SECONDAIRE'::"text", 'LIGUE_CIVILE'::"text"]))))));



CREATE POLICY "team_coaches scoped delete" ON "public"."team_coaches" FOR DELETE USING ((("team_id" IN ( SELECT "t"."id"
   FROM "public"."teams" "t"
  WHERE ("t"."school_id" IN ( SELECT "users"."school_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))) OR "public"."is_admin"()));



CREATE POLICY "team_coaches scoped insert" ON "public"."team_coaches" FOR INSERT WITH CHECK ((("coach_id" = "auth"."uid"()) OR ("team_id" IN ( SELECT "t"."id"
   FROM "public"."teams" "t"
  WHERE ("t"."school_id" IN ( SELECT "users"."school_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"())))))));



CREATE POLICY "team_coaches scoped select" ON "public"."team_coaches" FOR SELECT USING ((("coach_id" = "auth"."uid"()) OR ("team_id" IN ( SELECT "t"."id"
   FROM "public"."teams" "t"
  WHERE ("t"."school_id" IN ( SELECT "users"."school_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))) OR "public"."is_admin"()));



CREATE POLICY "team_coaches scoped update" ON "public"."team_coaches" FOR UPDATE USING ((("team_id" IN ( SELECT "t"."id"
   FROM "public"."teams" "t"
  WHERE ("t"."school_id" IN ( SELECT "users"."school_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))) OR "public"."is_admin"())) WITH CHECK ((("team_id" IN ( SELECT "t"."id"
   FROM "public"."teams" "t"
  WHERE ("t"."school_id" IN ( SELECT "users"."school_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))) OR "public"."is_admin"()));



ALTER TABLE "public"."team_invitations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transfer_from_insert" ON "public"."admin_transfer_requests" FOR INSERT WITH CHECK (("from_user_id" = "auth"."uid"()));



CREATE POLICY "transfer_involved_read" ON "public"."admin_transfer_requests" FOR SELECT USING ((("from_user_id" = "auth"."uid"()) OR ("to_user_id" = "auth"."uid"())));



CREATE POLICY "user_own_notif_prefs" ON "public"."notification_preferences" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users read own" ON "public"."users" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "users update own" ON "public"."users" FOR UPDATE USING (("id" = "auth"."uid"())) WITH CHECK ((("id" = "auth"."uid"()) AND "public"."user_privileged_cols_unchanged"("role", "status", "is_platform_admin", "context", "is_school_admin")));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";








































































































































































GRANT ALL ON FUNCTION "public"."apply_admin_claim_approval"() TO "anon";
GRANT ALL ON FUNCTION "public"."apply_admin_claim_approval"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_admin_claim_approval"() TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_approved_suggestion"() TO "anon";
GRANT ALL ON FUNCTION "public"."apply_approved_suggestion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_approved_suggestion"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."apply_stripe_subscription"("p_user_id" "uuid", "p_tier" "text", "p_status" "text", "p_billing_cycle" "text", "p_stripe_subscription_id" "text", "p_stripe_price_id" "text", "p_current_period_start" timestamp with time zone, "p_current_period_end" timestamp with time zone, "p_cancel_at_period_end" boolean, "p_canceled_at" timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."apply_stripe_subscription"("p_user_id" "uuid", "p_tier" "text", "p_status" "text", "p_billing_cycle" "text", "p_stripe_subscription_id" "text", "p_stripe_price_id" "text", "p_current_period_start" timestamp with time zone, "p_current_period_end" timestamp with time zone, "p_cancel_at_period_end" boolean, "p_canceled_at" timestamp with time zone) TO "service_role";



GRANT ALL ON FUNCTION "public"."apply_team_invitation_acceptance"() TO "anon";
GRANT ALL ON FUNCTION "public"."apply_team_invitation_acceptance"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_team_invitation_acceptance"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_pipeline_identifie"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_pipeline_identifie"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_pipeline_identifie"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_set_recrute_on_confirmation"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_set_recrute_on_confirmation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_set_recrute_on_confirmation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_upgrade_favorite_to_en_processus"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_upgrade_favorite_to_en_processus"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_upgrade_favorite_to_en_processus"() TO "service_role";



GRANT ALL ON FUNCTION "public"."backfill_athletes_on_coach_join"() TO "anon";
GRANT ALL ON FUNCTION "public"."backfill_athletes_on_coach_join"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."backfill_athletes_on_coach_join"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calc_cote_globale"() TO "anon";
GRANT ALL ON FUNCTION "public"."calc_cote_globale"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calc_cote_globale"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calc_note_globale"() TO "anon";
GRANT ALL ON FUNCTION "public"."calc_note_globale"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calc_note_globale"() TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_profile_completion"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_profile_completion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_profile_completion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_recruiter_email_domain"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_recruiter_email_domain"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_recruiter_email_domain"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."coach_can_manage_athlete"("p_athlete_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."coach_can_manage_athlete"("p_athlete_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."coach_can_manage_athlete"("p_athlete_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."consume_athlete_invitation"("p_token" "text", "p_new_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."consume_athlete_invitation"("p_token" "text", "p_new_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."consume_athlete_invitation"("p_token" "text", "p_new_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."consume_invitation_token"("p_token" "text", "p_new_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."consume_invitation_token"("p_token" "text", "p_new_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."consume_invitation_token"("p_token" "text", "p_new_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."count_athlete_favorites"("athlete_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."count_athlete_favorites"("athlete_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_athlete_favorites"("athlete_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."count_athlete_views"("athlete_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."count_athlete_views"("athlete_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_athlete_views"("athlete_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."count_coach_athletes"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."count_coach_athletes"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_coach_athletes"("uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."count_user_favorites"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."count_user_favorites"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."count_user_favorites"("uid" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_athlete_invitation"("p_athlete_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_athlete_invitation"("p_athlete_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_athlete_invitation"("p_athlete_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_default_subscription"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_default_subscription"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_default_subscription"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_email"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_email"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_email"() TO "service_role";



GRANT ALL ON FUNCTION "public"."current_user_school_id"() TO "anon";
GRANT ALL ON FUNCTION "public"."current_user_school_id"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."current_user_school_id"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."deactivate_my_account"("p_revoke_consent" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."deactivate_my_account"("p_revoke_consent" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."deactivate_my_account"("p_revoke_consent" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."deactivate_my_account"("p_revoke_consent" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."delete_my_account"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."delete_my_account"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_my_account"() TO "service_role";



GRANT ALL ON FUNCTION "public"."demote_interim_on_director_appointment"() TO "anon";
GRANT ALL ON FUNCTION "public"."demote_interim_on_director_appointment"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."demote_interim_on_director_appointment"() TO "service_role";



GRANT ALL ON FUNCTION "public"."emit_commitment_newsroom_event"() TO "anon";
GRANT ALL ON FUNCTION "public"."emit_commitment_newsroom_event"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."emit_commitment_newsroom_event"() TO "service_role";



GRANT ALL ON FUNCTION "public"."emit_five_star_newsroom_event"() TO "anon";
GRANT ALL ON FUNCTION "public"."emit_five_star_newsroom_event"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."emit_five_star_newsroom_event"() TO "service_role";



GRANT ALL ON FUNCTION "public"."emit_five_star_on_eligibility_flip"() TO "anon";
GRANT ALL ON FUNCTION "public"."emit_five_star_on_eligibility_flip"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."emit_five_star_on_eligibility_flip"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fav_insert_to_pipeline"() TO "anon";
GRANT ALL ON FUNCTION "public"."fav_insert_to_pipeline"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fav_insert_to_pipeline"() TO "service_role";



GRANT ALL ON FUNCTION "public"."finish_coach_civil_onboarding"("p_club_id" "uuid", "p_club_name" "text", "p_club_city" "text", "p_club_region" "text", "p_sport" "text", "p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_bio" "text", "p_experience_years" integer, "p_photo_url" "text", "p_team_id" "uuid", "p_team_name" "text", "p_team_age_group" "text", "p_team_gender" "text", "p_team_division" "text", "p_director_choice" "text", "p_rprp_accepted" boolean, "p_invite_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."finish_coach_civil_onboarding"("p_club_id" "uuid", "p_club_name" "text", "p_club_city" "text", "p_club_region" "text", "p_sport" "text", "p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_bio" "text", "p_experience_years" integer, "p_photo_url" "text", "p_team_id" "uuid", "p_team_name" "text", "p_team_age_group" "text", "p_team_gender" "text", "p_team_division" "text", "p_director_choice" "text", "p_rprp_accepted" boolean, "p_invite_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."finish_coach_civil_onboarding"("p_club_id" "uuid", "p_club_name" "text", "p_club_city" "text", "p_club_region" "text", "p_sport" "text", "p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_bio" "text", "p_experience_years" integer, "p_photo_url" "text", "p_team_id" "uuid", "p_team_name" "text", "p_team_age_group" "text", "p_team_gender" "text", "p_team_division" "text", "p_director_choice" "text", "p_rprp_accepted" boolean, "p_invite_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."finish_coach_school_onboarding"("p_school_id" "uuid", "p_region" "text", "p_sport" "text", "p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_bio" "text", "p_experience_years" integer, "p_photo_url" "text", "p_team_id" "uuid", "p_director_choice" "text", "p_rprp_accepted" boolean, "p_invite_email" "text", "p_team_name" "text", "p_team_age_group" "text", "p_team_gender" "text", "p_team_division" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."finish_coach_school_onboarding"("p_school_id" "uuid", "p_region" "text", "p_sport" "text", "p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_bio" "text", "p_experience_years" integer, "p_photo_url" "text", "p_team_id" "uuid", "p_director_choice" "text", "p_rprp_accepted" boolean, "p_invite_email" "text", "p_team_name" "text", "p_team_age_group" "text", "p_team_gender" "text", "p_team_division" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."finish_coach_school_onboarding"("p_school_id" "uuid", "p_region" "text", "p_sport" "text", "p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_bio" "text", "p_experience_years" integer, "p_photo_url" "text", "p_team_id" "uuid", "p_director_choice" "text", "p_rprp_accepted" boolean, "p_invite_email" "text", "p_team_name" "text", "p_team_age_group" "text", "p_team_gender" "text", "p_team_division" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."finish_recruiter_onboarding"("p_cegep_id" "uuid", "p_primary_team_id" "uuid", "p_sport" "text", "p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_bio" "text", "p_experience_years" integer, "p_photo_url" "text", "p_director_choice" "text", "p_rprp_accepted" boolean, "p_invite_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."finish_recruiter_onboarding"("p_cegep_id" "uuid", "p_primary_team_id" "uuid", "p_sport" "text", "p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_bio" "text", "p_experience_years" integer, "p_photo_url" "text", "p_director_choice" "text", "p_rprp_accepted" boolean, "p_invite_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."finish_recruiter_onboarding"("p_cegep_id" "uuid", "p_primary_team_id" "uuid", "p_sport" "text", "p_first_name" "text", "p_last_name" "text", "p_phone" "text", "p_bio" "text", "p_experience_years" integer, "p_photo_url" "text", "p_director_choice" "text", "p_rprp_accepted" boolean, "p_invite_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."get_my_athlete_view_details"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."get_my_athlete_view_details"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_athlete_view_details"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_sport_view_stats"("p_athlete_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_sport_view_stats"("p_athlete_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_sport_view_stats"("p_athlete_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_tier"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_tier"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_tier"("uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_approved_partner"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_approved_partner"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_approved_partner"("uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_coach"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_coach"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_coach"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_partner_eligible_athlete"("p_athlete_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_partner_eligible_athlete"("p_athlete_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_partner_eligible_athlete"("p_athlete_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_platform_admin"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_platform_admin"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_platform_admin"("uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_recruiter"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_recruiter"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_recruiter"() TO "service_role";



GRANT ALL ON FUNCTION "public"."link_athlete_on_signup"() TO "anon";
GRANT ALL ON FUNCTION "public"."link_athlete_on_signup"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."link_athlete_on_signup"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_athlete_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_athlete_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_athlete_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_coach_activity_badge"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_coach_activity_badge"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_coach_activity_badge"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_coach_activity_favorited"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_coach_activity_favorited"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_coach_activity_favorited"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_coach_activity_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_coach_activity_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_coach_activity_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_coach_activity_verified"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_coach_activity_verified"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_coach_activity_verified"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_coach_reply"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_coach_reply"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_coach_reply"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_consent_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_consent_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_consent_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_favorite_added"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_favorite_added"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_favorite_added"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_list_created"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_list_created"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_list_created"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_list_member_added"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_list_member_added"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_list_member_added"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_list_member_removed"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_list_member_removed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_list_member_removed"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_list_note_added"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_list_note_added"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_list_note_added"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_new_athlete"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_new_athlete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_new_athlete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_note_added"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_note_added"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_note_added"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_pipeline_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_pipeline_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_pipeline_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_profile_view"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_profile_view"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_profile_view"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_review_submitted"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_review_submitted"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_review_submitted"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_unfavorited"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_unfavorited"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_unfavorited"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."lookup_civil_unclaimed_by_email"("p_prefix" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."lookup_civil_unclaimed_by_email"("p_prefix" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."lookup_civil_unclaimed_by_email"("p_prefix" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."moddatetime"() TO "postgres";
GRANT ALL ON FUNCTION "public"."moddatetime"() TO "anon";
GRANT ALL ON FUNCTION "public"."moddatetime"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."moddatetime"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_athlete_evaluation_updated"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_athlete_evaluation_updated"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_athlete_evaluation_updated"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_athlete_favorited"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_athlete_favorited"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_athlete_favorited"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_athlete_profile_viewed"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_athlete_profile_viewed"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_athlete_profile_viewed"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_athlete_suggestion_result"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_athlete_suggestion_result"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_athlete_suggestion_result"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_athlete_verified"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_athlete_verified"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_athlete_verified"() TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_on_message"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_on_message"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_on_message"() TO "service_role";



GRANT ALL ON FUNCTION "public"."partner_privileged_cols_unchanged"("p_status" "text", "p_show_on_homepage" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."partner_privileged_cols_unchanged"("p_status" "text", "p_show_on_homepage" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."partner_privileged_cols_unchanged"("p_status" "text", "p_show_on_homepage" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."register_device_token"("p_token" "text", "p_platform" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."register_device_token"("p_token" "text", "p_platform" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."register_device_token"("p_token" "text", "p_platform" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."register_device_token"("p_token" "text", "p_platform" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."require_recruiter_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."require_recruiter_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."require_recruiter_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."reset_athlete_anchor_on_team_remove"() TO "anon";
GRANT ALL ON FUNCTION "public"."reset_athlete_anchor_on_team_remove"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."reset_athlete_anchor_on_team_remove"() TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_athlete_invitation"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_athlete_invitation"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_athlete_invitation"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_invitation_token"("p_token" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_invitation_token"("p_token" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_invitation_token"("p_token" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."school_has_responsable"("p_school_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."school_has_responsable"("p_school_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."school_has_responsable"("p_school_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."set_initial_role_and_context"("p_role" "text", "p_context" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."set_initial_role_and_context"("p_role" "text", "p_context" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_initial_role_and_context"("p_role" "text", "p_context" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_athlete_context"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_athlete_context"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_athlete_context"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_global_recruitment_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_global_recruitment_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_global_recruitment_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_school_admin_flag"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_school_admin_flag"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_school_admin_flag"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_user_admin_flag"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_admin_flag"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_admin_flag"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_user_school_from_coaches"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_school_from_coaches"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_school_from_coaches"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sync_user_school_on_coach_remove"() TO "anon";
GRANT ALL ON FUNCTION "public"."sync_user_school_on_coach_remove"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."sync_user_school_on_coach_remove"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."upsert_stripe_customer"("p_user_id" "uuid", "p_customer_id" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."upsert_stripe_customer"("p_user_id" "uuid", "p_customer_id" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_all_star"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_all_star"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_all_star"("uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_has_pro"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_has_pro"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_has_pro"("uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_is_school_admin"("uid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."user_is_school_admin"("uid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_is_school_admin"("uid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."user_privileged_cols_unchanged"("p_role" "public"."user_role", "p_status" "public"."account_status", "p_is_platform_admin" boolean, "p_context" "text", "p_is_school_admin" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."user_privileged_cols_unchanged"("p_role" "public"."user_role", "p_status" "public"."account_status", "p_is_platform_admin" boolean, "p_context" "text", "p_is_school_admin" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."user_privileged_cols_unchanged"("p_role" "public"."user_role", "p_status" "public"."account_status", "p_is_platform_admin" boolean, "p_context" "text", "p_is_school_admin" boolean) TO "service_role";





















GRANT ALL ON TABLE "public"."_deprecated_athlete_views_2026_05" TO "anon";
GRANT ALL ON TABLE "public"."_deprecated_athlete_views_2026_05" TO "authenticated";
GRANT ALL ON TABLE "public"."_deprecated_athlete_views_2026_05" TO "service_role";



GRANT ALL ON TABLE "public"."_deprecated_profile_views_2026_05" TO "anon";
GRANT ALL ON TABLE "public"."_deprecated_profile_views_2026_05" TO "authenticated";
GRANT ALL ON TABLE "public"."_deprecated_profile_views_2026_05" TO "service_role";



GRANT ALL ON TABLE "public"."activities" TO "anon";
GRANT ALL ON TABLE "public"."activities" TO "authenticated";
GRANT ALL ON TABLE "public"."activities" TO "service_role";



GRANT ALL ON TABLE "public"."activity_feed" TO "anon";
GRANT ALL ON TABLE "public"."activity_feed" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_feed" TO "service_role";



GRANT ALL ON TABLE "public"."admin_claims" TO "anon";
GRANT ALL ON TABLE "public"."admin_claims" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_claims" TO "service_role";



GRANT ALL ON TABLE "public"."admin_notifications" TO "anon";
GRANT ALL ON TABLE "public"."admin_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."admin_transfer_requests" TO "anon";
GRANT ALL ON TABLE "public"."admin_transfer_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."admin_transfer_requests" TO "service_role";



GRANT ALL ON TABLE "public"."ambassadors" TO "anon";
GRANT ALL ON TABLE "public"."ambassadors" TO "authenticated";
GRANT ALL ON TABLE "public"."ambassadors" TO "service_role";



GRANT ALL ON TABLE "public"."app_settings" TO "anon";
GRANT ALL ON TABLE "public"."app_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."app_settings" TO "service_role";



GRANT ALL ON TABLE "public"."team_athletes" TO "anon";
GRANT ALL ON TABLE "public"."team_athletes" TO "authenticated";
GRANT ALL ON TABLE "public"."team_athletes" TO "service_role";



GRANT ALL ON TABLE "public"."team_coaches" TO "anon";
GRANT ALL ON TABLE "public"."team_coaches" TO "authenticated";
GRANT ALL ON TABLE "public"."team_coaches" TO "service_role";



GRANT ALL ON TABLE "public"."teams" TO "anon";
GRANT ALL ON TABLE "public"."teams" TO "authenticated";
GRANT ALL ON TABLE "public"."teams" TO "service_role";



GRANT ALL ON TABLE "public"."athlete_coaches" TO "anon";
GRANT ALL ON TABLE "public"."athlete_coaches" TO "authenticated";
GRANT ALL ON TABLE "public"."athlete_coaches" TO "service_role";



GRANT ALL ON TABLE "public"."athlete_invitations" TO "anon";
GRANT ALL ON TABLE "public"."athlete_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."athlete_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."athlete_notifications" TO "anon";
GRANT ALL ON TABLE "public"."athlete_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."athlete_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."athlete_suggestions" TO "anon";
GRANT ALL ON TABLE "public"."athlete_suggestions" TO "authenticated";
GRANT ALL ON TABLE "public"."athlete_suggestions" TO "service_role";



GRANT ALL ON TABLE "public"."athlete_targets" TO "anon";
GRANT ALL ON TABLE "public"."athlete_targets" TO "authenticated";
GRANT ALL ON TABLE "public"."athlete_targets" TO "service_role";



GRANT ALL ON TABLE "public"."recruiter_athlete_views" TO "anon";
GRANT ALL ON TABLE "public"."recruiter_athlete_views" TO "authenticated";
GRANT ALL ON TABLE "public"."recruiter_athlete_views" TO "service_role";



GRANT ALL ON TABLE "public"."schools" TO "anon";
GRANT ALL ON TABLE "public"."schools" TO "authenticated";
GRANT ALL ON TABLE "public"."schools" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."athlete_view_details" TO "service_role";



GRANT SELECT("athlete_id") ON TABLE "public"."athlete_view_details" TO "authenticated";



GRANT SELECT("cegep_region") ON TABLE "public"."athlete_view_details" TO "authenticated";



GRANT SELECT("visit_count") ON TABLE "public"."athlete_view_details" TO "authenticated";



GRANT SELECT("last_viewed_at") ON TABLE "public"."athlete_view_details" TO "authenticated";



GRANT SELECT("first_viewed_at") ON TABLE "public"."athlete_view_details" TO "authenticated";



GRANT ALL ON TABLE "public"."athlete_views_weekly" TO "anon";
GRANT ALL ON TABLE "public"."athlete_views_weekly" TO "authenticated";
GRANT ALL ON TABLE "public"."athlete_views_weekly" TO "service_role";



GRANT ALL ON TABLE "public"."recruiter_favorites" TO "anon";
GRANT ALL ON TABLE "public"."recruiter_favorites" TO "authenticated";
GRANT ALL ON TABLE "public"."recruiter_favorites" TO "service_role";



GRANT ALL ON TABLE "public"."athlete_visibility_stats" TO "anon";
GRANT ALL ON TABLE "public"."athlete_visibility_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."athlete_visibility_stats" TO "service_role";



GRANT ALL ON TABLE "public"."athletes" TO "anon";
GRANT ALL ON TABLE "public"."athletes" TO "authenticated";
GRANT ALL ON TABLE "public"."athletes" TO "service_role";



GRANT ALL ON TABLE "public"."cegep_email_domains" TO "anon";
GRANT ALL ON TABLE "public"."cegep_email_domains" TO "authenticated";
GRANT ALL ON TABLE "public"."cegep_email_domains" TO "service_role";



GRANT ALL ON TABLE "public"."coach_badges" TO "anon";
GRANT ALL ON TABLE "public"."coach_badges" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_badges" TO "service_role";



GRANT ALL ON TABLE "public"."coach_career_preferences" TO "anon";
GRANT ALL ON TABLE "public"."coach_career_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_career_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."coach_notifications" TO "anon";
GRANT ALL ON TABLE "public"."coach_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."coach_reviews" TO "anon";
GRANT ALL ON TABLE "public"."coach_reviews" TO "authenticated";
GRANT ALL ON TABLE "public"."coach_reviews" TO "service_role";



GRANT ALL ON TABLE "public"."commitment_requests" TO "anon";
GRANT ALL ON TABLE "public"."commitment_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."commitment_requests" TO "service_role";



GRANT ALL ON TABLE "public"."consent_audit_trail" TO "anon";
GRANT ALL ON TABLE "public"."consent_audit_trail" TO "authenticated";
GRANT ALL ON TABLE "public"."consent_audit_trail" TO "service_role";



GRANT ALL ON TABLE "public"."conversations" TO "anon";
GRANT ALL ON TABLE "public"."conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."conversations" TO "service_role";



GRANT ALL ON TABLE "public"."custom_distinctions" TO "anon";
GRANT ALL ON TABLE "public"."custom_distinctions" TO "authenticated";
GRANT ALL ON TABLE "public"."custom_distinctions" TO "service_role";



GRANT ALL ON TABLE "public"."deletion_requests" TO "anon";
GRANT ALL ON TABLE "public"."deletion_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."deletion_requests" TO "service_role";



GRANT ALL ON TABLE "public"."device_tokens" TO "anon";
GRANT ALL ON TABLE "public"."device_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."device_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."equipes" TO "anon";
GRANT ALL ON TABLE "public"."equipes" TO "authenticated";
GRANT ALL ON TABLE "public"."equipes" TO "service_role";



GRANT ALL ON TABLE "public"."evaluations" TO "anon";
GRANT ALL ON TABLE "public"."evaluations" TO "authenticated";
GRANT ALL ON TABLE "public"."evaluations" TO "service_role";



GRANT ALL ON TABLE "public"."invitations" TO "anon";
GRANT ALL ON TABLE "public"."invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."invitations" TO "service_role";



GRANT ALL ON TABLE "public"."ligues" TO "anon";
GRANT ALL ON TABLE "public"."ligues" TO "authenticated";
GRANT ALL ON TABLE "public"."ligues" TO "service_role";



GRANT ALL ON TABLE "public"."loi25_incidents" TO "anon";
GRANT ALL ON TABLE "public"."loi25_incidents" TO "authenticated";
GRANT ALL ON TABLE "public"."loi25_incidents" TO "service_role";



GRANT ALL ON TABLE "public"."loi25_portability_requests" TO "anon";
GRANT ALL ON TABLE "public"."loi25_portability_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."loi25_portability_requests" TO "service_role";



GRANT ALL ON TABLE "public"."loi25_settings" TO "anon";
GRANT ALL ON TABLE "public"."loi25_settings" TO "authenticated";
GRANT ALL ON TABLE "public"."loi25_settings" TO "service_role";



GRANT ALL ON TABLE "public"."media_partners" TO "anon";
GRANT ALL ON TABLE "public"."media_partners" TO "authenticated";
GRANT ALL ON TABLE "public"."media_partners" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."newsroom_events" TO "anon";
GRANT ALL ON TABLE "public"."newsroom_events" TO "authenticated";
GRANT ALL ON TABLE "public"."newsroom_events" TO "service_role";



GRANT ALL ON TABLE "public"."notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."parental_consents" TO "anon";
GRANT ALL ON TABLE "public"."parental_consents" TO "authenticated";
GRANT ALL ON TABLE "public"."parental_consents" TO "service_role";



GRANT ALL ON TABLE "public"."partner_card_downloads" TO "anon";
GRANT ALL ON TABLE "public"."partner_card_downloads" TO "authenticated";
GRANT ALL ON TABLE "public"."partner_card_downloads" TO "service_role";



GRANT ALL ON TABLE "public"."partner_profile_views" TO "anon";
GRANT ALL ON TABLE "public"."partner_profile_views" TO "authenticated";
GRANT ALL ON TABLE "public"."partner_profile_views" TO "service_role";



GRANT ALL ON TABLE "public"."pipeline" TO "anon";
GRANT ALL ON TABLE "public"."pipeline" TO "authenticated";
GRANT ALL ON TABLE "public"."pipeline" TO "service_role";



GRANT ALL ON TABLE "public"."platform_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."platform_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."platform_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."positions" TO "anon";
GRANT ALL ON TABLE "public"."positions" TO "authenticated";
GRANT ALL ON TABLE "public"."positions" TO "service_role";



GRANT ALL ON TABLE "public"."profile_changes" TO "anon";
GRANT ALL ON TABLE "public"."profile_changes" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_changes" TO "service_role";



GRANT ALL ON TABLE "public"."recruiter_activity_log" TO "anon";
GRANT ALL ON TABLE "public"."recruiter_activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."recruiter_activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."recruiter_list_members" TO "anon";
GRANT ALL ON TABLE "public"."recruiter_list_members" TO "authenticated";
GRANT ALL ON TABLE "public"."recruiter_list_members" TO "service_role";



GRANT ALL ON TABLE "public"."recruiter_list_notes" TO "anon";
GRANT ALL ON TABLE "public"."recruiter_list_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."recruiter_list_notes" TO "service_role";



GRANT ALL ON TABLE "public"."recruiter_lists" TO "anon";
GRANT ALL ON TABLE "public"."recruiter_lists" TO "authenticated";
GRANT ALL ON TABLE "public"."recruiter_lists" TO "service_role";



GRANT ALL ON TABLE "public"."recruiter_notes" TO "anon";
GRANT ALL ON TABLE "public"."recruiter_notes" TO "authenticated";
GRANT ALL ON TABLE "public"."recruiter_notes" TO "service_role";



GRANT ALL ON TABLE "public"."recruiter_pipeline" TO "anon";
GRANT ALL ON TABLE "public"."recruiter_pipeline" TO "authenticated";
GRANT ALL ON TABLE "public"."recruiter_pipeline" TO "service_role";



GRANT ALL ON TABLE "public"."recruiter_preferences" TO "anon";
GRANT ALL ON TABLE "public"."recruiter_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."recruiter_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."referrals" TO "anon";
GRANT ALL ON TABLE "public"."referrals" TO "authenticated";
GRANT ALL ON TABLE "public"."referrals" TO "service_role";



GRANT ALL ON TABLE "public"."reports" TO "anon";
GRANT ALL ON TABLE "public"."reports" TO "authenticated";
GRANT ALL ON TABLE "public"."reports" TO "service_role";



GRANT ALL ON TABLE "public"."school_coaches" TO "anon";
GRANT ALL ON TABLE "public"."school_coaches" TO "authenticated";
GRANT ALL ON TABLE "public"."school_coaches" TO "service_role";



GRANT ALL ON TABLE "public"."school_registry" TO "anon";
GRANT ALL ON TABLE "public"."school_registry" TO "authenticated";
GRANT ALL ON TABLE "public"."school_registry" TO "service_role";



GRANT ALL ON TABLE "public"."sports" TO "anon";
GRANT ALL ON TABLE "public"."sports" TO "authenticated";
GRANT ALL ON TABLE "public"."sports" TO "service_role";



GRANT ALL ON TABLE "public"."stripe_webhook_events" TO "anon";
GRANT ALL ON TABLE "public"."stripe_webhook_events" TO "authenticated";
GRANT ALL ON TABLE "public"."stripe_webhook_events" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_features_athlete" TO "anon";
GRANT ALL ON TABLE "public"."subscription_features_athlete" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_features_athlete" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_features_coach" TO "anon";
GRANT ALL ON TABLE "public"."subscription_features_coach" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_features_coach" TO "service_role";



GRANT ALL ON TABLE "public"."subscription_features_recruteur" TO "anon";
GRANT ALL ON TABLE "public"."subscription_features_recruteur" TO "authenticated";
GRANT ALL ON TABLE "public"."subscription_features_recruteur" TO "service_role";



GRANT ALL ON TABLE "public"."subscriptions" TO "anon";
GRANT ALL ON TABLE "public"."subscriptions" TO "authenticated";
GRANT ALL ON TABLE "public"."subscriptions" TO "service_role";



GRANT ALL ON TABLE "public"."team_invitations" TO "anon";
GRANT ALL ON TABLE "public"."team_invitations" TO "authenticated";
GRANT ALL ON TABLE "public"."team_invitations" TO "service_role";



GRANT ALL ON TABLE "public"."top_athletes_view" TO "anon";
GRANT ALL ON TABLE "public"."top_athletes_view" TO "authenticated";
GRANT ALL ON TABLE "public"."top_athletes_view" TO "service_role";



GRANT ALL ON TABLE "public"."trending_athletes_view" TO "anon";
GRANT ALL ON TABLE "public"."trending_athletes_view" TO "authenticated";
GRANT ALL ON TABLE "public"."trending_athletes_view" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";



































