


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



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."account_status" AS ENUM (
    'ACTIF',
    'DESACTIVE',
    'EN_ATTENTE',
    'DIPLOME'
);


ALTER TYPE "public"."account_status" OWNER TO "postgres";


CREATE TYPE "public"."coach_school_role" AS ENUM (
    'DIRECTEUR_INTERIM',
    'DIRECTEUR',
    'COACH',
    'PENDING'
);


ALTER TYPE "public"."coach_school_role" OWNER TO "postgres";


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
    'ATHLETE'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE TYPE "public"."verification_method" AS ENUM (
    'auto',
    'manuel_coach',
    'manuel_directeur'
);


ALTER TYPE "public"."verification_method" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."apply_approved_suggestion"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_coach_id UUID;
  v_rows_updated INT;
  v_is_detailed BOOLEAN;
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

      WHEN 'Distinctions' THEN
        UPDATE evaluations SET distinctions = NEW.valeur_proposee::jsonb WHERE athlete_id = NEW.athlete_id AND coach_id = v_coach_id;
        GET DIAGNOSTICS v_rows_updated = ROW_COUNT;
        IF v_rows_updated = 0 THEN INSERT INTO evaluations (athlete_id, coach_id, distinctions) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee::jsonb) ON CONFLICT (coach_id, athlete_id) DO UPDATE SET distinctions = EXCLUDED.distinctions; END IF;

      WHEN 'Distinction personnalisée' THEN
        INSERT INTO custom_distinctions (athlete_id, coach_id, title) VALUES (NEW.athlete_id, v_coach_id, NEW.valeur_proposee);

      ELSE NULL;
    END CASE;
  END IF;

  IF NEW.status = 'REJETEE' AND OLD.status = 'EN_ATTENTE' THEN
    NEW.reviewed_at = now();
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."apply_approved_suggestion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_link_athlete_to_coach"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN IF NEW.coach_id IS NULL AND NEW.school_id IS NOT NULL THEN SELECT id INTO NEW.coach_id FROM users WHERE school_id = NEW.school_id AND role = 'COACH' LIMIT 1; END IF; RETURN NEW; END; $$;


ALTER FUNCTION "public"."auto_link_athlete_to_coach"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."auto_verify_athlete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.profile_completion >= 60 AND (OLD.profile_completion < 60 OR OLD.verified = FALSE) THEN
    NEW.verified := TRUE;
    NEW.verification_method := 'auto';
    NEW.verified_at := NOW();
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_verify_athlete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."backfill_athletes_on_coach_join"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$ BEGIN UPDATE athletes SET coach_id = NEW.id WHERE school_id = NEW.school_id AND coach_id IS NULL; RETURN NEW; END; $$;


ALTER FUNCTION "public"."backfill_athletes_on_coach_join"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calc_cote_globale"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_sum NUMERIC := 0;
  v_count INT := 0;
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.cote_globale IS NOT NULL
     AND NEW.cote_globale IS DISTINCT FROM OLD.cote_globale THEN
    UPDATE athletes SET cote_globale_entraineur = NEW.cote_globale WHERE id = NEW.athlete_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT'
     AND NEW.cote_globale IS NOT NULL
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

  IF total >= 60 AND NEW.verified = FALSE AND (NEW.verification_method IS NULL OR NEW.verification_method != 'manuel_coach') THEN
    NEW.verified := TRUE;
    NEW.verification_method := 'auto';
    NEW.verified_at := NOW();
  END IF;

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_profile_completion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_recruiter_email_domain"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
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

  IF domain_match THEN
    NEW.verified := true;
  ELSE
    NEW.verified := false;
    
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


CREATE OR REPLACE FUNCTION "public"."first_coach_claim"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_director_id UUID;
  v_coach_count INTEGER;
BEGIN
  SELECT director_id INTO v_director_id
  FROM school_registry WHERE id = NEW.school_id;

  SELECT count(*) INTO v_coach_count
  FROM school_coaches
  WHERE school_id = NEW.school_id AND role != 'PENDING' AND id != NEW.id;

  IF v_director_id IS NULL AND v_coach_count = 0 THEN
    NEW.role := 'ADMIN_COACH_INTERIM';
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."first_coach_claim"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_my_school_ids"() RETURNS SETOF "uuid"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    AS $$
  SELECT school_id FROM school_directors WHERE user_id = auth.uid()
$$;


ALTER FUNCTION "public"."get_my_school_ids"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_sport_view_stats"("p_athlete_id" "uuid") RETURNS TABLE("total" bigint, "rank" bigint, "percentile" numeric)
    LANGUAGE "plpgsql"
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


CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  INSERT INTO public.users (id, email, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::public.user_role,
      'ATHLETE'::public.user_role
    ),
    'ACTIF'::public.account_status
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_new_auth_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET row_security = off  -- prevents recursion via "admins read all" / "admins update all" policies on users
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'ADMIN');
$$;


ALTER FUNCTION "public"."is_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."link_athlete_on_signup"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
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
    AS $$ BEGIN IF OLD.video_faits_saillants_url IS DISTINCT FROM NEW.video_faits_saillants_url OR OLD.verified IS DISTINCT FROM NEW.verified OR OLD.cote_globale_entraineur IS DISTINCT FROM NEW.cote_globale_entraineur THEN INSERT INTO recruiter_activity_log (recruiter_id, athlete_id, action_type, details) SELECT rf.recruiter_id, NEW.id, CASE WHEN OLD.video_faits_saillants_url IS DISTINCT FROM NEW.video_faits_saillants_url AND NEW.video_faits_saillants_url IS NOT NULL THEN 'VIDEO_ADDED' WHEN OLD.verified IS DISTINCT FROM NEW.verified AND NEW.verified = true THEN 'ATHLETE_VERIFIED' ELSE 'PROFILE_UPDATED' END, jsonb_build_object('first_name', NEW.first_name, 'last_name', NEW.last_name) FROM recruiter_favorites rf WHERE rf.athlete_id = NEW.id; END IF; RETURN NEW; END; $$;


ALTER FUNCTION "public"."log_athlete_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_coach_activity_badge"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
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


CREATE OR REPLACE FUNCTION "public"."log_new_athlete"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
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
    AS $$
BEGIN
  INSERT INTO recruiter_activity_log (recruiter_id, athlete_id, action_type, details)
  SELECT NEW.recruiter_id, NEW.athlete_id, 'PIPELINE_CHANGED',
    jsonb_build_object('first_name', a.first_name, 'last_name', a.last_name, 'new_stage', NEW.stage)
  FROM athletes a WHERE a.id = NEW.athlete_id;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_pipeline_change"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."log_profile_view"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
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
    AS $$
BEGIN
  INSERT INTO recruiter_activity_log (recruiter_id, athlete_id, action_type, details)
  VALUES (NEW.recruiter_id, NEW.athlete_id, 'REVIEW_SUBMITTED',
    jsonb_build_object('coach_id', NEW.coach_id, 'note_globale', NEW.note_globale));
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."log_review_submitted"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_athlete_evaluation_updated"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$ BEGIN IF NEW.cote_globale IS NOT NULL AND NEW.cote_globale IS DISTINCT FROM OLD.cote_globale THEN INSERT INTO athlete_notifications (athlete_id, type, title, metadata) VALUES (NEW.athlete_id, 'COACH_EVALUATION_UPDATED', 'Ton coach a mis à jour ton évaluation : Cote Globale ' || ROUND(NEW.cote_globale::numeric, 1)::text || '/5', jsonb_build_object('cote', NEW.cote_globale)); END IF; RETURN NEW; END; $$;


ALTER FUNCTION "public"."notify_athlete_evaluation_updated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_athlete_favorited"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$ BEGIN INSERT INTO athlete_notifications (athlete_id, type, title, metadata) VALUES (NEW.athlete_id, 'ADDED_TO_FAVORITES', 'Un recruteur t''a ajouté à ses favoris', jsonb_build_object('recruiter_id', NEW.recruiter_id)); RETURN NEW; END; $$;


ALTER FUNCTION "public"."notify_athlete_favorited"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_athlete_profile_viewed"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$ DECLARE v_region TEXT; BEGIN SELECT s.region INTO v_region FROM users u LEFT JOIN schools s ON s.id = u.school_id WHERE u.id = NEW.recruiter_id; INSERT INTO athlete_notifications (athlete_id, type, title, metadata) VALUES (NEW.athlete_id, 'PROFILE_VIEWED', 'Un recruteur de la région ' || COALESCE(v_region, 'inconnue') || ' a consulté ton profil', jsonb_build_object('recruiter_id', NEW.recruiter_id, 'region', v_region)); RETURN NEW; END; $$;


ALTER FUNCTION "public"."notify_athlete_profile_viewed"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_athlete_suggestion_result"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
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
    AS $$ BEGIN IF NEW.verified = true AND OLD.verified = false THEN INSERT INTO athlete_notifications (athlete_id, type, title, metadata) VALUES (NEW.id, 'COACH_REPORT_UPDATED', 'Ton coach a vérifié ton profil', jsonb_build_object('action', 'verified')); END IF; RETURN NEW; END; $$;


ALTER FUNCTION "public"."notify_athlete_verified"() OWNER TO "postgres";


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


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_global_recruitment_status"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  max_pipeline_stage TEXT;
  new_global_status recruitment_status;
BEGIN
  SELECT stage INTO max_pipeline_stage
  FROM recruiter_pipeline
  WHERE athlete_id = NEW.athlete_id
  ORDER BY CASE stage
    WHEN 'IDENTIFIE' THEN 1
    WHEN 'CONTACTE' THEN 2
    WHEN 'EN_DISCUSSION' THEN 3
    WHEN 'VISITE_PLANIFIEE' THEN 4
    WHEN 'ENGAGE' THEN 5
    WHEN 'LETTRE_SIGNEE' THEN 6
    ELSE 0
  END DESC
  LIMIT 1;

  IF max_pipeline_stage IN ('ENGAGE', 'LETTRE_SIGNEE') THEN
    new_global_status := 'RECRUTE';
  ELSIF max_pipeline_stage IN ('EN_DISCUSSION', 'VISITE_PLANIFIEE') THEN
    new_global_status := 'EN_PROCESSUS';
  ELSE
    new_global_status := 'OUVERT';
  END IF;

  UPDATE athletes
  SET recruitment_status = new_global_status,
      recruitment_status_changed_at = now(),
      recruitment_status_changed_by = NULL
  WHERE id = NEW.athlete_id
    AND (
      recruitment_status_changed_by IS NULL
      OR
      CASE new_global_status
        WHEN 'OUVERT' THEN 0
        WHEN 'EN_PROCESSUS' THEN 1
        WHEN 'RECRUTE' THEN 2
        WHEN 'RETIRE' THEN 3
      END
      >
      CASE recruitment_status
        WHEN 'OUVERT' THEN 0
        WHEN 'EN_PROCESSUS' THEN 1
        WHEN 'RECRUTE' THEN 2
        WHEN 'RETIRE' THEN 3
      END
    );

  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."sync_global_recruitment_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_school_admin_flag"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$ BEGIN IF TG_OP = 'INSERT' THEN UPDATE users SET is_school_admin = true WHERE id = NEW.user_id; RETURN NEW; ELSIF TG_OP = 'DELETE' THEN IF NOT EXISTS (SELECT 1 FROM school_directors WHERE user_id = OLD.user_id AND id != OLD.id) THEN UPDATE users SET is_school_admin = false WHERE id = OLD.user_id; END IF; RETURN OLD; END IF; RETURN NULL; END; $$;


ALTER FUNCTION "public"."sync_school_admin_flag"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."sync_user_admin_flag"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
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

SET default_tablespace = '';

SET default_table_access_method = "heap";


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
    "age_group" "text"
);


ALTER TABLE "public"."teams" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."profile_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "recruiter_id" "uuid",
    "cegep_id" "uuid",
    "region" "text",
    "viewed_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."profile_views" OWNER TO "postgres";


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
    CONSTRAINT "schools_langue_check" CHECK (("langue" = ANY (ARRAY['FR'::"text", 'EN'::"text", 'BILINGUE'::"text"]))),
    CONSTRAINT "schools_reseau_check" CHECK (("reseau" = ANY (ARRAY['PUBLIC'::"text", 'PRIVE'::"text"]))),
    CONSTRAINT "schools_type_check" CHECK (("type" = ANY (ARRAY['SECONDAIRE'::"text", 'CEGEP'::"text"])))
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
    CONSTRAINT "users_context_check" CHECK (("context" = ANY (ARRAY['scolaire'::"text", 'collegial'::"text", 'ligue_civile'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."athlete_view_details" AS
 SELECT "pv"."athlete_id",
    "pv"."recruiter_id",
    (("u"."first_name" || ' '::"text") || "u"."last_name") AS "recruiter_name",
    "s"."name" AS "cegep_name",
    "s"."region" AS "cegep_region",
    "count"(*) AS "visit_count",
    "max"("pv"."viewed_at") AS "last_viewed_at",
    "min"("pv"."viewed_at") AS "first_viewed_at"
   FROM (("public"."profile_views" "pv"
     JOIN "public"."users" "u" ON (("u"."id" = "pv"."recruiter_id")))
     LEFT JOIN "public"."schools" "s" ON (("s"."id" = "u"."school_id")))
  GROUP BY "pv"."athlete_id", "pv"."recruiter_id", "u"."first_name", "u"."last_name", "s"."name", "s"."region"
  ORDER BY ("max"("pv"."viewed_at")) DESC;


ALTER VIEW "public"."athlete_view_details" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."athlete_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "viewer_id" "uuid",
    "viewer_role" "text",
    "viewed_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."athlete_views" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."athlete_views_weekly" AS
 SELECT "athlete_id",
    ("date_trunc"('week'::"text", "viewed_at"))::"date" AS "week_start",
    "count"(*) AS "view_count"
   FROM "public"."profile_views" "pv"
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
   FROM "public"."profile_views" "pv"
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
    CONSTRAINT "chk_school_or_league" CHECK ((NOT (("school_id" IS NOT NULL) AND ("league_team_id" IS NOT NULL))))
);


ALTER TABLE "public"."athletes" OWNER TO "postgres";


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
    "user_id" "uuid" NOT NULL,
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
    CONSTRAINT "evaluations_rapport_entraineur_check" CHECK (("char_length"("rapport_entraineur") <= 300)),
    CONSTRAINT "evaluations_resilience_check" CHECK ((("resilience" >= 1) AND ("resilience" <= 5))),
    CONSTRAINT "evaluations_sens_tactique_check" CHECK ((("sens_tactique" >= (0)::numeric) AND ("sens_tactique" <= (5)::numeric))),
    CONSTRAINT "evaluations_vision_du_jeu_check" CHECK ((("vision_du_jeu" >= (0)::numeric) AND ("vision_du_jeu" <= (5)::numeric))),
    CONSTRAINT "evaluations_vitesse_explosivite_check" CHECK ((("vitesse_explosivite" >= (0)::numeric) AND ("vitesse_explosivite" <= (5)::numeric)))
);


ALTER TABLE "public"."evaluations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."league_coaches" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "league_id" "uuid" NOT NULL,
    "league_team_id" "uuid",
    "coach_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'ADMIN'::"text" NOT NULL,
    "sport" "text",
    "approved_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "league_coaches_role_check" CHECK (("role" = ANY (ARRAY['ADMIN'::"text", 'COACH'::"text", 'PENDING'::"text"])))
);


ALTER TABLE "public"."league_coaches" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."league_teams" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "league_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "division" "text",
    "gender" "text",
    "season" "text",
    "sport_id" "uuid",
    "owner_id" "uuid" NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "league_teams_gender_check" CHECK (("gender" = ANY (ARRAY['masculin'::"text", 'feminin'::"text", 'mixte'::"text"])))
);


ALTER TABLE "public"."league_teams" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leagues" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "abbreviation" "text",
    "sport_id" "uuid",
    "city" "text",
    "region" "text",
    "level" "text",
    "website" "text",
    "logo_url" "text",
    "is_active" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "federation" character varying(255),
    "saison" character varying(20),
    "created_by" "uuid",
    CONSTRAINT "leagues_level_check" CHECK (("level" = ANY (ARRAY['AAA'::"text", 'AA'::"text", 'A'::"text", 'Civil'::"text", 'Club'::"text"])))
);


ALTER TABLE "public"."leagues" OWNER TO "postgres";


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


CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "conversation_id" "uuid" NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "read_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


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
    "coach_id" "uuid" NOT NULL,
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


CREATE TABLE IF NOT EXISTS "public"."prospect_list_athletes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "list_id" "uuid" NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "added_at" timestamp with time zone DEFAULT "now"(),
    "note" "text"
);


ALTER TABLE "public"."prospect_list_athletes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prospect_lists" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recruiter_id" "uuid" NOT NULL,
    "nom" "text" NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "prospect_lists_description_check" CHECK (("char_length"("description") <= 200))
);


ALTER TABLE "public"."prospect_lists" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recruiter_activity_log" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recruiter_id" "uuid" NOT NULL,
    "athlete_id" "uuid",
    "list_id" "uuid",
    "action_type" "text" NOT NULL,
    "details" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "recruiter_activity_log_action_type_check" CHECK (("action_type" = ANY (ARRAY['NOTE_ADDED'::"text", 'NOTE_UPDATED'::"text", 'LIST_CREATED'::"text", 'LIST_NOTE_ADDED'::"text", 'ATHLETE_ADDED_TO_LIST'::"text", 'ATHLETE_REMOVED_FROM_LIST'::"text", 'PIPELINE_CHANGED'::"text", 'FAVORITED'::"text", 'UNFAVORITED'::"text", 'PROFILE_VIEWED'::"text", 'NEW_ATHLETE'::"text", 'PROFILE_UPDATED'::"text", 'VIDEO_ADDED'::"text", 'ATHLETE_VERIFIED'::"text", 'STATS_UPDATED'::"text", 'REVIEW_SUBMITTED'::"text", 'COACH_REPLY'::"text", 'ADMIN_BROADCAST'::"text"])))
);


ALTER TABLE "public"."recruiter_activity_log" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recruiter_athlete_views" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "recruiter_id" "uuid" NOT NULL,
    "athlete_id" "uuid" NOT NULL,
    "viewed_at" timestamp with time zone DEFAULT "now"(),
    "view_date" "date" GENERATED ALWAYS AS ((("viewed_at" AT TIME ZONE 'America/Montreal'::"text"))::"date") STORED
);


ALTER TABLE "public"."recruiter_athlete_views" OWNER TO "postgres";


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
    "next_action_note" "text"
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
    "team_name" character varying(255),
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
    "price_annual_cents" integer DEFAULT 0
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
    "price_annual_cents" integer DEFAULT 0
);


ALTER TABLE "public"."subscription_features_coach" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."subscription_features_recruteur" (
    "tier" "text" NOT NULL,
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
    "has_list_access" boolean DEFAULT false
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
    CONSTRAINT "subscriptions_billing_cycle_check" CHECK (("billing_cycle" = ANY (ARRAY['monthly'::"text", 'annual'::"text"])))
);


ALTER TABLE "public"."subscriptions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."activities"
    ADD CONSTRAINT "activities_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."activity_feed"
    ADD CONSTRAINT "activity_feed_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."athlete_notifications"
    ADD CONSTRAINT "athlete_notifications_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."athlete_suggestions"
    ADD CONSTRAINT "athlete_suggestions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."athlete_views"
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



ALTER TABLE ONLY "public"."equipes"
    ADD CONSTRAINT "equipes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."evaluations"
    ADD CONSTRAINT "evaluations_coach_id_athlete_id_key" UNIQUE ("coach_id", "athlete_id");



ALTER TABLE ONLY "public"."evaluations"
    ADD CONSTRAINT "evaluations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."league_coaches"
    ADD CONSTRAINT "league_coaches_league_id_league_team_id_coach_id_key" UNIQUE ("league_id", "league_team_id", "coach_id");



ALTER TABLE ONLY "public"."league_coaches"
    ADD CONSTRAINT "league_coaches_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."league_teams"
    ADD CONSTRAINT "league_teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leagues"
    ADD CONSTRAINT "leagues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ligues"
    ADD CONSTRAINT "ligues_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_event_type_key" UNIQUE ("user_id", "event_type");



ALTER TABLE ONLY "public"."parental_consents"
    ADD CONSTRAINT "parental_consents_athlete_id_school_year_key" UNIQUE ("athlete_id", "school_year");



ALTER TABLE ONLY "public"."parental_consents"
    ADD CONSTRAINT "parental_consents_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."profile_views"
    ADD CONSTRAINT "profile_views_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prospect_list_athletes"
    ADD CONSTRAINT "prospect_list_athletes_list_id_athlete_id_key" UNIQUE ("list_id", "athlete_id");



ALTER TABLE ONLY "public"."prospect_list_athletes"
    ADD CONSTRAINT "prospect_list_athletes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prospect_lists"
    ADD CONSTRAINT "prospect_lists_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recruiter_activity_log"
    ADD CONSTRAINT "recruiter_activity_log_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recruiter_athlete_views"
    ADD CONSTRAINT "recruiter_athlete_views_pkey" PRIMARY KEY ("id");



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



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_email_key" UNIQUE ("email");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



CREATE INDEX "idx_activities_athlete" ON "public"."activities" USING "btree" ("athlete_id");



CREATE INDEX "idx_activities_coach" ON "public"."activities" USING "btree" ("coach_id", "created_at" DESC);



CREATE INDEX "idx_activity_created" ON "public"."activity_feed" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_activity_log_athlete" ON "public"."recruiter_activity_log" USING "btree" ("athlete_id", "created_at" DESC);



CREATE INDEX "idx_activity_log_list" ON "public"."recruiter_activity_log" USING "btree" ("list_id", "created_at" DESC);



CREATE INDEX "idx_activity_log_recruiter_date" ON "public"."recruiter_activity_log" USING "btree" ("recruiter_id", "created_at" DESC);



CREATE INDEX "idx_activity_user" ON "public"."activity_feed" USING "btree" ("user_id");



CREATE INDEX "idx_athlete_notif_athlete" ON "public"."athlete_notifications" USING "btree" ("athlete_id", "created_at" DESC);



CREATE INDEX "idx_athlete_notif_unread" ON "public"."athlete_notifications" USING "btree" ("athlete_id") WHERE ("read" = false);



CREATE INDEX "idx_athlete_views_athlete" ON "public"."athlete_views" USING "btree" ("athlete_id");



CREATE INDEX "idx_athletes_coach" ON "public"."athletes" USING "btree" ("coach_id");



CREATE INDEX "idx_athletes_completion" ON "public"."athletes" USING "btree" ("profile_completion");



CREATE INDEX "idx_athletes_league_team" ON "public"."athletes" USING "btree" ("league_team_id");



CREATE INDEX "idx_athletes_school" ON "public"."athletes" USING "btree" ("school_id");



CREATE INDEX "idx_athletes_sport" ON "public"."athletes" USING "btree" ("sport_id");



CREATE INDEX "idx_athletes_status" ON "public"."athletes" USING "btree" ("status");



CREATE INDEX "idx_athletes_verified" ON "public"."athletes" USING "btree" ("verified");



CREATE INDEX "idx_coach_reviews_coach" ON "public"."coach_reviews" USING "btree" ("coach_id");



CREATE INDEX "idx_conversations_athlete" ON "public"."conversations" USING "btree" ("athlete_id");



CREATE INDEX "idx_evaluations_athlete" ON "public"."evaluations" USING "btree" ("athlete_id");



CREATE INDEX "idx_evaluations_coach" ON "public"."evaluations" USING "btree" ("coach_id");



CREATE INDEX "idx_league_coaches_coach" ON "public"."league_coaches" USING "btree" ("coach_id");



CREATE INDEX "idx_league_coaches_league" ON "public"."league_coaches" USING "btree" ("league_id");



CREATE INDEX "idx_league_teams_league" ON "public"."league_teams" USING "btree" ("league_id");



CREATE INDEX "idx_league_teams_owner" ON "public"."league_teams" USING "btree" ("owner_id");



CREATE INDEX "idx_messages_conversation" ON "public"."messages" USING "btree" ("conversation_id");



CREATE INDEX "idx_messages_created" ON "public"."messages" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_parental_consents_athlete" ON "public"."parental_consents" USING "btree" ("athlete_id");



CREATE INDEX "idx_pipeline_athlete" ON "public"."pipeline" USING "btree" ("athlete_id");



CREATE INDEX "idx_pipeline_recruiter" ON "public"."pipeline" USING "btree" ("recruiter_id");



CREATE INDEX "idx_pipeline_status" ON "public"."pipeline" USING "btree" ("status");



CREATE INDEX "idx_profile_changes_coach" ON "public"."profile_changes" USING "btree" ("coach_id", "status", "created_at" DESC);



CREATE INDEX "idx_profile_views_athlete" ON "public"."profile_views" USING "btree" ("athlete_id");



CREATE INDEX "idx_profile_views_time" ON "public"."profile_views" USING "btree" ("viewed_at" DESC);



CREATE INDEX "idx_prospect_list_recruiter" ON "public"."prospect_lists" USING "btree" ("recruiter_id");



CREATE INDEX "idx_referrals_ambassador" ON "public"."referrals" USING "btree" ("ambassador_id");



CREATE INDEX "idx_school_coaches_school" ON "public"."school_coaches" USING "btree" ("school_id");



CREATE INDEX "idx_school_registry_city" ON "public"."school_registry" USING "btree" ("city");



CREATE INDEX "idx_school_registry_collegial" ON "public"."school_registry" USING "btree" ("has_collegial") WHERE ("has_collegial" = true);



CREATE INDEX "idx_school_registry_css" ON "public"."school_registry" USING "btree" ("meq_css_code");



CREATE INDEX "idx_school_registry_fts" ON "public"."school_registry" USING "gin" ("to_tsvector"('"french"'::"regconfig", (((((COALESCE("name", ''::character varying))::"text" || ' '::"text") || (COALESCE("city", ''::character varying))::"text") || ' '::"text") || (COALESCE("css_name", ''::character varying))::"text")));



CREATE INDEX "idx_school_registry_name_normalized" ON "public"."school_registry" USING "btree" ("name_normalized");



CREATE INDEX "idx_school_registry_region" ON "public"."school_registry" USING "btree" ("region_admin");



CREATE INDEX "idx_school_registry_secondaire" ON "public"."school_registry" USING "btree" ("has_secondaire") WHERE ("has_secondaire" = true);



CREATE INDEX "idx_subscriptions_tier" ON "public"."subscriptions" USING "btree" ("tier");



CREATE INDEX "idx_subscriptions_user" ON "public"."subscriptions" USING "btree" ("user_id");



CREATE INDEX "idx_teams_school" ON "public"."teams" USING "btree" ("school_id");



CREATE INDEX "idx_users_role" ON "public"."users" USING "btree" ("role");



CREATE INDEX "idx_users_school" ON "public"."users" USING "btree" ("school_id");



CREATE UNIQUE INDEX "recruiter_athlete_views_daily" ON "public"."recruiter_athlete_views" USING "btree" ("recruiter_id", "athlete_id", "view_date");



CREATE UNIQUE INDEX "schools_name_city_unique" ON "public"."schools" USING "btree" ("lower"("name"), COALESCE("lower"("city"), ''::"text"));



CREATE OR REPLACE TRIGGER "on_user_created_link_athlete" AFTER INSERT ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."link_athlete_on_signup"();



CREATE OR REPLACE TRIGGER "set_updated_at_career_prefs" BEFORE UPDATE ON "public"."coach_career_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_league_teams" BEFORE UPDATE ON "public"."league_teams" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_leagues" BEFORE UPDATE ON "public"."leagues" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "set_updated_at_notif_prefs" BEFORE UPDATE ON "public"."notification_preferences" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at"();



CREATE OR REPLACE TRIGGER "trg_ambassadors_updated_at" BEFORE UPDATE ON "public"."ambassadors" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_apply_suggestion" BEFORE UPDATE ON "public"."athlete_suggestions" FOR EACH ROW EXECUTE FUNCTION "public"."apply_approved_suggestion"();



CREATE OR REPLACE TRIGGER "trg_athletes_updated_at" BEFORE UPDATE ON "public"."athletes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_auto_verify" BEFORE UPDATE OF "profile_completion" ON "public"."athletes" FOR EACH ROW EXECUTE FUNCTION "public"."auto_verify_athlete"();

ALTER TABLE "public"."athletes" DISABLE TRIGGER "trg_auto_verify";



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



CREATE OR REPLACE TRIGGER "trg_equipes_updated_at" BEFORE UPDATE ON "public"."equipes" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_evaluations_updated_at" BEFORE UPDATE ON "public"."evaluations" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_favorite_to_en_processus" AFTER INSERT ON "public"."recruiter_favorites" FOR EACH ROW EXECUTE FUNCTION "public"."auto_upgrade_favorite_to_en_processus"();



CREATE OR REPLACE TRIGGER "trg_first_coach_claim" BEFORE INSERT ON "public"."school_coaches" FOR EACH ROW EXECUTE FUNCTION "public"."first_coach_claim"();



CREATE OR REPLACE TRIGGER "trg_log_athlete_update" AFTER UPDATE ON "public"."athletes" FOR EACH ROW EXECUTE FUNCTION "public"."log_athlete_update"();



CREATE OR REPLACE TRIGGER "trg_log_favorite" AFTER INSERT ON "public"."recruiter_favorites" FOR EACH ROW EXECUTE FUNCTION "public"."log_favorite_added"();



CREATE OR REPLACE TRIGGER "trg_log_new_athlete" AFTER INSERT ON "public"."athletes" FOR EACH ROW EXECUTE FUNCTION "public"."log_new_athlete"();



CREATE OR REPLACE TRIGGER "trg_log_note" AFTER INSERT ON "public"."recruiter_notes" FOR EACH ROW EXECUTE FUNCTION "public"."log_note_added"();



CREATE OR REPLACE TRIGGER "trg_log_pipeline" AFTER INSERT OR UPDATE ON "public"."recruiter_pipeline" FOR EACH ROW EXECUTE FUNCTION "public"."log_pipeline_change"();



CREATE OR REPLACE TRIGGER "trg_log_review" AFTER INSERT ON "public"."coach_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."log_review_submitted"();



CREATE OR REPLACE TRIGGER "trg_log_view" AFTER INSERT ON "public"."recruiter_athlete_views" FOR EACH ROW EXECUTE FUNCTION "public"."log_profile_view"();



CREATE OR REPLACE TRIGGER "trg_note_globale" BEFORE INSERT OR UPDATE ON "public"."coach_reviews" FOR EACH ROW EXECUTE FUNCTION "public"."calc_note_globale"();



CREATE OR REPLACE TRIGGER "trg_notify_athlete_verified" AFTER UPDATE OF "verified" ON "public"."athletes" FOR EACH ROW EXECUTE FUNCTION "public"."notify_athlete_verified"();



CREATE OR REPLACE TRIGGER "trg_notify_evaluation_updated" AFTER UPDATE ON "public"."evaluations" FOR EACH ROW WHEN (("old"."cote_globale" IS DISTINCT FROM "new"."cote_globale")) EXECUTE FUNCTION "public"."notify_athlete_evaluation_updated"();



CREATE OR REPLACE TRIGGER "trg_notify_favorited" AFTER INSERT ON "public"."recruiter_favorites" FOR EACH ROW EXECUTE FUNCTION "public"."notify_athlete_favorited"();



CREATE OR REPLACE TRIGGER "trg_notify_profile_viewed" AFTER INSERT ON "public"."profile_views" FOR EACH ROW EXECUTE FUNCTION "public"."notify_athlete_profile_viewed"();



CREATE OR REPLACE TRIGGER "trg_notify_suggestion_result" AFTER UPDATE ON "public"."athlete_suggestions" FOR EACH ROW EXECUTE FUNCTION "public"."notify_athlete_suggestion_result"();



CREATE OR REPLACE TRIGGER "trg_parental_consents_updated_at" BEFORE UPDATE ON "public"."parental_consents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_pipeline_identifie" BEFORE UPDATE OF "favorited_at" ON "public"."pipeline" FOR EACH ROW EXECUTE FUNCTION "public"."auto_pipeline_identifie"();



CREATE OR REPLACE TRIGGER "trg_pipeline_recruiter_role" BEFORE INSERT OR UPDATE OF "recruiter_id" ON "public"."recruiter_pipeline" FOR EACH ROW EXECUTE FUNCTION "public"."require_recruiter_role"();



CREATE OR REPLACE TRIGGER "trg_pipeline_updated_at" BEFORE UPDATE ON "public"."pipeline" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_profile_completion" BEFORE INSERT OR UPDATE ON "public"."athletes" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_profile_completion"();

ALTER TABLE "public"."athletes" DISABLE TRIGGER "trg_profile_completion";



CREATE OR REPLACE TRIGGER "trg_prospect_lists_updated_at" BEFORE UPDATE ON "public"."prospect_lists" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_reports_updated_at" BEFORE UPDATE ON "public"."reports" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_subscriptions_updated_at" BEFORE UPDATE ON "public"."subscriptions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_sync_admin_flag" AFTER INSERT OR UPDATE OF "role" ON "public"."school_coaches" FOR EACH ROW EXECUTE FUNCTION "public"."sync_user_admin_flag"();



CREATE OR REPLACE TRIGGER "trg_sync_global_status" AFTER INSERT OR UPDATE ON "public"."recruiter_pipeline" FOR EACH ROW EXECUTE FUNCTION "public"."sync_global_recruitment_status"();



CREATE OR REPLACE TRIGGER "trg_sync_user_school_on_coach_change" AFTER INSERT OR UPDATE ON "public"."school_coaches" FOR EACH ROW EXECUTE FUNCTION "public"."sync_user_school_from_coaches"();



CREATE OR REPLACE TRIGGER "trg_sync_user_school_on_coach_remove" AFTER DELETE ON "public"."school_coaches" FOR EACH ROW EXECUTE FUNCTION "public"."sync_user_school_on_coach_remove"();



CREATE OR REPLACE TRIGGER "trg_users_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_auto_link_athlete_coach" BEFORE INSERT OR UPDATE ON "public"."athletes" FOR EACH ROW EXECUTE FUNCTION "public"."auto_link_athlete_to_coach"();



CREATE OR REPLACE TRIGGER "trigger_backfill_athletes_coach" AFTER INSERT OR UPDATE ON "public"."users" FOR EACH ROW WHEN ((("new"."role" = 'COACH'::"public"."user_role") AND ("new"."school_id" IS NOT NULL))) EXECUTE FUNCTION "public"."backfill_athletes_on_coach_join"();



CREATE OR REPLACE TRIGGER "trigger_profile_completion" BEFORE INSERT OR UPDATE ON "public"."athletes" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_profile_completion"();

ALTER TABLE "public"."athletes" DISABLE TRIGGER "trigger_profile_completion";



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



ALTER TABLE ONLY "public"."athlete_notifications"
    ADD CONSTRAINT "athlete_notifications_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."athlete_suggestions"
    ADD CONSTRAINT "athlete_suggestions_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."athlete_suggestions"
    ADD CONSTRAINT "athlete_suggestions_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."athlete_suggestions"
    ADD CONSTRAINT "athlete_suggestions_submitted_by_fkey" FOREIGN KEY ("submitted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."athlete_views"
    ADD CONSTRAINT "athlete_views_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."athlete_views"
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
    ADD CONSTRAINT "athletes_league_team_id_fkey" FOREIGN KEY ("league_team_id") REFERENCES "public"."league_teams"("id");



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
    ADD CONSTRAINT "deletion_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



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



ALTER TABLE ONLY "public"."league_coaches"
    ADD CONSTRAINT "league_coaches_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."league_coaches"
    ADD CONSTRAINT "league_coaches_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."league_coaches"
    ADD CONSTRAINT "league_coaches_league_team_id_fkey" FOREIGN KEY ("league_team_id") REFERENCES "public"."league_teams"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."league_teams"
    ADD CONSTRAINT "league_teams_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."league_teams"
    ADD CONSTRAINT "league_teams_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id");



ALTER TABLE ONLY "public"."league_teams"
    ADD CONSTRAINT "league_teams_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id");



ALTER TABLE ONLY "public"."leagues"
    ADD CONSTRAINT "leagues_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."leagues"
    ADD CONSTRAINT "leagues_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id");



ALTER TABLE ONLY "public"."ligues"
    ADD CONSTRAINT "ligues_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."notification_preferences"
    ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parental_consents"
    ADD CONSTRAINT "parental_consents_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."parental_consents"
    ADD CONSTRAINT "parental_consents_coach_id_fkey" FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."parental_consents"
    ADD CONSTRAINT "parental_consents_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."parental_consents"
    ADD CONSTRAINT "parental_consents_withdrawn_by_fkey" FOREIGN KEY ("withdrawn_by") REFERENCES "public"."users"("id") ON DELETE SET NULL;



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



ALTER TABLE ONLY "public"."profile_views"
    ADD CONSTRAINT "profile_views_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."profile_views"
    ADD CONSTRAINT "profile_views_cegep_id_fkey" FOREIGN KEY ("cegep_id") REFERENCES "public"."schools"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."profile_views"
    ADD CONSTRAINT "profile_views_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."prospect_list_athletes"
    ADD CONSTRAINT "prospect_list_athletes_athlete_id_fkey" FOREIGN KEY ("athlete_id") REFERENCES "public"."athletes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prospect_list_athletes"
    ADD CONSTRAINT "prospect_list_athletes_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "public"."prospect_lists"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prospect_lists"
    ADD CONSTRAINT "prospect_lists_recruiter_id_fkey" FOREIGN KEY ("recruiter_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



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



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."teams"
    ADD CONSTRAINT "teams_sport_id_fkey" FOREIGN KEY ("sport_id") REFERENCES "public"."sports"("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_school_id_fkey" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE SET NULL;



CREATE POLICY "Admin coaches can update their school" ON "public"."school_registry" FOR UPDATE USING (("claimed_by" = "auth"."uid"()));



CREATE POLICY "Anyone can read domains" ON "public"."cegep_email_domains" FOR SELECT USING (true);



CREATE POLICY "Anyone can read leagues" ON "public"."leagues" FOR SELECT USING (true);



CREATE POLICY "Anyone can view custom distinctions" ON "public"."custom_distinctions" FOR SELECT USING (true);



CREATE POLICY "Anyone insert leagues" ON "public"."leagues" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "Athletes can read own suggestions" ON "public"."athlete_suggestions" FOR SELECT USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."user_id" = "auth"."uid"()))));



CREATE POLICY "Athletes insert own suggestions" ON "public"."athlete_suggestions" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Athletes read own favorites" ON "public"."recruiter_favorites" FOR SELECT USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."user_id" = "auth"."uid"()))));



CREATE POLICY "Athletes read own notifications" ON "public"."athlete_notifications" FOR SELECT USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."user_id" = "auth"."uid"()))));



CREATE POLICY "Athletes read own views" ON "public"."profile_views" FOR SELECT USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."user_id" = "auth"."uid"()))));



CREATE POLICY "Athletes see their teams" ON "public"."teams" FOR SELECT USING (("school_id" IN ( SELECT "teams"."school_id"
   FROM "public"."schools"
  WHERE ("schools"."id" IN ( SELECT "athletes"."school_id"
           FROM "public"."athletes"
          WHERE ("athletes"."user_id" = "auth"."uid"()))))));



CREATE POLICY "Athletes update own notifications" ON "public"."athlete_notifications" FOR UPDATE USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."user_id" = "auth"."uid"()))));



CREATE POLICY "Authenticated access team_athletes" ON "public"."team_athletes" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated read league_teams" ON "public"."league_teams" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated read leagues" ON "public"."leagues" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Authenticated users can create leagues" ON "public"."leagues" FOR INSERT WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Authenticated users update suggestions" ON "public"."athlete_suggestions" FOR UPDATE USING (("auth"."uid"() IS NOT NULL)) WITH CHECK (("auth"."uid"() IS NOT NULL));



CREATE POLICY "Coaches can delete their custom distinctions" ON "public"."custom_distinctions" FOR DELETE USING (("auth"."uid"() = "coach_id"));



CREATE POLICY "Coaches can insert custom distinctions" ON "public"."custom_distinctions" FOR INSERT WITH CHECK (("auth"."uid"() = "coach_id"));



CREATE POLICY "Coaches can read their athletes suggestions" ON "public"."athlete_suggestions" FOR SELECT USING ((("coach_id" = "auth"."uid"()) OR ("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."coach_id" = "auth"."uid"())))));



CREATE POLICY "Coaches create teams" ON "public"."teams" FOR INSERT WITH CHECK (("school_id" IN ( SELECT "users"."school_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Coaches delete teams" ON "public"."teams" FOR DELETE USING (("school_id" IN ( SELECT "users"."school_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Coaches insert team_coaches" ON "public"."team_coaches" FOR INSERT WITH CHECK (("team_id" IN ( SELECT "t"."id"
   FROM "public"."teams" "t"
  WHERE ("t"."school_id" IN ( SELECT "users"."school_id"
           FROM "public"."users"
          WHERE ("users"."id" = "auth"."uid"()))))));



CREATE POLICY "Coaches manage team_coaches" ON "public"."team_coaches" USING (true) WITH CHECK (true);



CREATE POLICY "Coaches read activity for their athletes" ON "public"."recruiter_activity_log" FOR SELECT USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."coach_id" = "auth"."uid"()))));



CREATE POLICY "Coaches read favorites for their athletes" ON "public"."recruiter_favorites" FOR SELECT USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."coach_id" = "auth"."uid"()))));



CREATE POLICY "Coaches read own league assignments" ON "public"."league_coaches" FOR SELECT TO "authenticated" USING (("coach_id" = "auth"."uid"()));



CREATE POLICY "Coaches read views for their athletes" ON "public"."profile_views" FOR SELECT USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."coach_id" = "auth"."uid"()))));



CREATE POLICY "Coaches read views for their athletes" ON "public"."recruiter_athlete_views" FOR SELECT USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."coach_id" = "auth"."uid"()))));



CREATE POLICY "Coaches see team assignments" ON "public"."team_coaches" FOR SELECT USING (true);



CREATE POLICY "Coaches see their school teams" ON "public"."teams" FOR SELECT USING (("school_id" IN ( SELECT "users"."school_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Coaches update teams" ON "public"."teams" FOR UPDATE USING (("school_id" IN ( SELECT "users"."school_id"
   FROM "public"."users"
  WHERE ("users"."id" = "auth"."uid"()))));



CREATE POLICY "Owners manage their teams" ON "public"."league_teams" TO "authenticated" USING (("owner_id" = "auth"."uid"()));



CREATE POLICY "Recruiters insert views" ON "public"."profile_views" FOR INSERT WITH CHECK (("recruiter_id" = "auth"."uid"()));



CREATE POLICY "Recruiters manage own favorites" ON "public"."recruiter_favorites" USING ((("auth"."uid"() = "recruiter_id") AND (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'RECRUTEUR'::"public"."user_role")))))) WITH CHECK ((("auth"."uid"() = "recruiter_id") AND (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'RECRUTEUR'::"public"."user_role"))))));



CREATE POLICY "Recruiters manage own notes" ON "public"."recruiter_notes" USING ((("auth"."uid"() = "recruiter_id") AND (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'RECRUTEUR'::"public"."user_role")))))) WITH CHECK ((("auth"."uid"() = "recruiter_id") AND (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'RECRUTEUR'::"public"."user_role"))))));



CREATE POLICY "Recruiters manage own pipeline" ON "public"."recruiter_pipeline" USING ((("auth"."uid"() = "recruiter_id") AND (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'RECRUTEUR'::"public"."user_role")))))) WITH CHECK ((("auth"."uid"() = "recruiter_id") AND (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'RECRUTEUR'::"public"."user_role"))))));



CREATE POLICY "Recruiters manage own views" ON "public"."recruiter_athlete_views" USING ((("auth"."uid"() = "recruiter_id") AND (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'RECRUTEUR'::"public"."user_role")))))) WITH CHECK ((("auth"."uid"() = "recruiter_id") AND (EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'RECRUTEUR'::"public"."user_role"))))));



CREATE POLICY "Recruiters manage their own list members" ON "public"."recruiter_list_members" USING (("list_id" IN ( SELECT "recruiter_lists"."id"
   FROM "public"."recruiter_lists"
  WHERE ("recruiter_lists"."recruiter_id" = "auth"."uid"())))) WITH CHECK (("list_id" IN ( SELECT "recruiter_lists"."id"
   FROM "public"."recruiter_lists"
  WHERE ("recruiter_lists"."recruiter_id" = "auth"."uid"()))));



CREATE POLICY "Recruiters manage their own list notes" ON "public"."recruiter_list_notes" USING (("recruiter_id" = "auth"."uid"())) WITH CHECK (("recruiter_id" = "auth"."uid"()));



CREATE POLICY "Recruiters manage their own lists" ON "public"."recruiter_lists" USING (("recruiter_id" = "auth"."uid"())) WITH CHECK (("recruiter_id" = "auth"."uid"()));



CREATE POLICY "Recruiters see teams" ON "public"."teams" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."users"
  WHERE (("users"."id" = "auth"."uid"()) AND ("users"."role" = 'RECRUTEUR'::"public"."user_role")))));



CREATE POLICY "Recruiters see their own activity" ON "public"."recruiter_activity_log" USING (("recruiter_id" = "auth"."uid"())) WITH CHECK (("recruiter_id" = "auth"."uid"()));



CREATE POLICY "School registry is publicly readable" ON "public"."school_registry" FOR SELECT USING (true);



CREATE POLICY "Service role can insert users" ON "public"."users" FOR INSERT WITH CHECK (true);



CREATE POLICY "Team owners insert league_coaches" ON "public"."league_coaches" FOR INSERT TO "authenticated" WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."league_teams"
  WHERE (("league_teams"."id" = "league_coaches"."league_team_id") AND ("league_teams"."owner_id" = "auth"."uid"())))) OR ("coach_id" = "auth"."uid"())));



CREATE POLICY "Users read conversation participants" ON "public"."users" FOR SELECT USING ((("id" = "auth"."uid"()) OR ("id" IN ( SELECT "conversations"."recruiter_id"
   FROM "public"."conversations"
  WHERE ("conversations"."coach_id" = "auth"."uid"()))) OR ("id" IN ( SELECT "conversations"."coach_id"
   FROM "public"."conversations"
  WHERE ("conversations"."recruiter_id" = "auth"."uid"())))));



ALTER TABLE "public"."activity_feed" ENABLE ROW LEVEL SECURITY;


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



CREATE POLICY "admins read all" ON "public"."athletes" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read all" ON "public"."evaluations" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read all" ON "public"."positions" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read all" ON "public"."profile_changes" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read all" ON "public"."profile_views" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read all" ON "public"."recruiter_favorites" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read all" ON "public"."recruiter_pipeline" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read all" ON "public"."reports" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read all" ON "public"."schools" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read all" ON "public"."sports" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read all" ON "public"."subscriptions" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read all" ON "public"."team_athletes" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read all" ON "public"."teams" FOR SELECT USING ("public"."is_admin"());



CREATE POLICY "admins read all" ON "public"."users" FOR SELECT USING ("public"."is_admin"());



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


CREATE POLICY "anyone can read evaluations" ON "public"."evaluations" FOR SELECT USING (true);



CREATE POLICY "anyone can read settings" ON "public"."app_settings" FOR SELECT USING (true);



ALTER TABLE "public"."app_settings" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."athlete_notifications" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."athlete_suggestions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."athletes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "athletes can insert own profile" ON "public"."athletes" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "athletes can read own profile" ON "public"."athletes" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "athletes can update own profile" ON "public"."athletes" FOR UPDATE USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "athletes read own views" ON "public"."recruiter_athlete_views" FOR SELECT USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."user_id" = "auth"."uid"()))));



CREATE POLICY "athletes read verified" ON "public"."athletes" FOR SELECT USING ((("verified" = true) OR ("coach_id" = "auth"."uid"())));



ALTER TABLE "public"."cegep_email_domains" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_badges" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."coach_career_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "coach_conversations_select" ON "public"."conversations" FOR SELECT USING (("coach_id" = "auth"."uid"()));



CREATE POLICY "coach_own_career_prefs" ON "public"."coach_career_preferences" USING (("user_id" = "auth"."uid"()));



CREATE POLICY "coach_read_own" ON "public"."school_coaches" FOR SELECT USING (("coach_id" = "auth"."uid"()));



CREATE POLICY "coach_read_reviews" ON "public"."coach_reviews" FOR SELECT USING (("coach_id" = "auth"."uid"()));



ALTER TABLE "public"."coach_reviews" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "coach_update_own" ON "public"."school_coaches" FOR UPDATE USING (("coach_id" = "auth"."uid"()));



CREATE POLICY "coaches can insert athletes" ON "public"."athletes" FOR INSERT WITH CHECK (("coach_id" = "auth"."uid"()));



CREATE POLICY "coaches can read own athletes" ON "public"."athletes" FOR SELECT USING ((("coach_id" = "auth"."uid"()) OR ("verified" = true)));



CREATE POLICY "coaches can update own athletes" ON "public"."athletes" FOR UPDATE USING (("coach_id" = "auth"."uid"()));



CREATE POLICY "coaches read pipeline for own athletes" ON "public"."recruiter_pipeline" FOR SELECT USING (("athlete_id" IN ( SELECT "athletes"."id"
   FROM "public"."athletes"
  WHERE ("athletes"."coach_id" = "auth"."uid"()))));



ALTER TABLE "public"."commitment_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."consent_audit_trail" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."conversations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "conversations participants" ON "public"."conversations" FOR SELECT USING ((("recruiter_id" = "auth"."uid"()) OR ("coach_id" = "auth"."uid"())));



ALTER TABLE "public"."custom_distinctions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deletion_requests" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "deletion_requests own" ON "public"."deletion_requests" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."equipes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."evaluations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "evaluations coach" ON "public"."evaluations" USING (("coach_id" = "auth"."uid"()));



ALTER TABLE "public"."league_coaches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."league_teams" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."leagues" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ligues" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "ligues public read" ON "public"."ligues" FOR SELECT USING (true);



ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "messages participants" ON "public"."messages" FOR SELECT USING (("conversation_id" IN ( SELECT "conversations"."id"
   FROM "public"."conversations"
  WHERE (("conversations"."recruiter_id" = "auth"."uid"()) OR ("conversations"."coach_id" = "auth"."uid"())))));



CREATE POLICY "messages_insert" ON "public"."messages" FOR INSERT WITH CHECK ((("sender_id" = "auth"."uid"()) AND ("conversation_id" IN ( SELECT "conversations"."id"
   FROM "public"."conversations"
  WHERE (("conversations"."recruiter_id" = "auth"."uid"()) OR ("conversations"."coach_id" = "auth"."uid"()))))));



CREATE POLICY "messages_select" ON "public"."messages" FOR SELECT USING (("conversation_id" IN ( SELECT "conversations"."id"
   FROM "public"."conversations"
  WHERE (("conversations"."recruiter_id" = "auth"."uid"()) OR ("conversations"."coach_id" = "auth"."uid"())))));



CREATE POLICY "messages_update" ON "public"."messages" FOR UPDATE USING (("conversation_id" IN ( SELECT "conversations"."id"
   FROM "public"."conversations"
  WHERE (("conversations"."recruiter_id" = "auth"."uid"()) OR ("conversations"."coach_id" = "auth"."uid"())))));



ALTER TABLE "public"."notification_preferences" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."parental_consents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."pipeline" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "pipeline own" ON "public"."pipeline" USING (("recruiter_id" = "auth"."uid"()));



ALTER TABLE "public"."positions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "positions public read" ON "public"."positions" FOR SELECT USING (true);



ALTER TABLE "public"."profile_views" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prospect_list_athletes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prospect_lists" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "prospect_lists own" ON "public"."prospect_lists" USING (("recruiter_id" = "auth"."uid"()));



ALTER TABLE "public"."recruiter_activity_log" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recruiter_athlete_views" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recruiter_conversations_all" ON "public"."conversations" USING (("recruiter_id" = "auth"."uid"())) WITH CHECK (("recruiter_id" = "auth"."uid"()));



ALTER TABLE "public"."recruiter_favorites" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recruiter_insert_reviews" ON "public"."coach_reviews" FOR INSERT WITH CHECK (("recruiter_id" = "auth"."uid"()));



ALTER TABLE "public"."recruiter_list_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recruiter_list_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recruiter_lists" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recruiter_notes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recruiter_pipeline" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recruiter_preferences" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recruiter_preferences own" ON "public"."recruiter_preferences" USING (("recruiter_id" = "auth"."uid"()));



CREATE POLICY "recruiter_read_reviews" ON "public"."coach_reviews" FOR SELECT USING (("recruiter_id" = "auth"."uid"()));



CREATE POLICY "recruiter_update_reviews" ON "public"."coach_reviews" FOR UPDATE USING (("recruiter_id" = "auth"."uid"()));



CREATE POLICY "recruiters can delete pipeline" ON "public"."pipeline" FOR DELETE USING (("recruiter_id" = "auth"."uid"()));



CREATE POLICY "recruiters can insert pipeline" ON "public"."pipeline" FOR INSERT WITH CHECK (("recruiter_id" = "auth"."uid"()));



CREATE POLICY "recruiters can read active athletes" ON "public"."athletes" FOR SELECT USING (("status" = 'ACTIF'::"public"."account_status"));



CREATE POLICY "recruiters can read own pipeline" ON "public"."pipeline" FOR SELECT USING (("recruiter_id" = "auth"."uid"()));



CREATE POLICY "recruiters can update pipeline" ON "public"."pipeline" FOR UPDATE USING (("recruiter_id" = "auth"."uid"()));



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



ALTER TABLE "public"."subscriptions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "subscriptions own" ON "public"."subscriptions" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "super_admin insert settings" ON "public"."app_settings" FOR INSERT WITH CHECK ("public"."is_admin"());



ALTER TABLE "public"."team_athletes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."team_coaches" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."teams" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transfer_from_insert" ON "public"."admin_transfer_requests" FOR INSERT WITH CHECK (("from_user_id" = "auth"."uid"()));



CREATE POLICY "transfer_involved_read" ON "public"."admin_transfer_requests" FOR SELECT USING ((("from_user_id" = "auth"."uid"()) OR ("to_user_id" = "auth"."uid"())));



CREATE POLICY "user_own_notif_prefs" ON "public"."notification_preferences" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users read own" ON "public"."users" FOR SELECT USING (("id" = "auth"."uid"()));



CREATE POLICY "users update own" ON "public"."users" FOR UPDATE USING (("id" = "auth"."uid"()));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";































































































































































GRANT ALL ON FUNCTION "public"."apply_approved_suggestion"() TO "anon";
GRANT ALL ON FUNCTION "public"."apply_approved_suggestion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."apply_approved_suggestion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_link_athlete_to_coach"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_link_athlete_to_coach"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_link_athlete_to_coach"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_pipeline_identifie"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_pipeline_identifie"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_pipeline_identifie"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_set_recrute_on_confirmation"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_set_recrute_on_confirmation"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_set_recrute_on_confirmation"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_upgrade_favorite_to_en_processus"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_upgrade_favorite_to_en_processus"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_upgrade_favorite_to_en_processus"() TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_verify_athlete"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_verify_athlete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_verify_athlete"() TO "service_role";



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



GRANT ALL ON FUNCTION "public"."create_default_subscription"() TO "anon";
GRANT ALL ON FUNCTION "public"."create_default_subscription"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_default_subscription"() TO "service_role";



GRANT ALL ON FUNCTION "public"."first_coach_claim"() TO "anon";
GRANT ALL ON FUNCTION "public"."first_coach_claim"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."first_coach_claim"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_my_school_ids"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_my_school_ids"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_my_school_ids"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_sport_view_stats"("p_athlete_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_sport_view_stats"("p_athlete_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_sport_view_stats"("p_athlete_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_admin"() TO "service_role";



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



GRANT ALL ON FUNCTION "public"."log_consent_change"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_consent_change"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_consent_change"() TO "service_role";



GRANT ALL ON FUNCTION "public"."log_favorite_added"() TO "anon";
GRANT ALL ON FUNCTION "public"."log_favorite_added"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."log_favorite_added"() TO "service_role";



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



GRANT ALL ON FUNCTION "public"."require_recruiter_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."require_recruiter_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."require_recruiter_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



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


















GRANT ALL ON TABLE "public"."activities" TO "anon";
GRANT ALL ON TABLE "public"."activities" TO "authenticated";
GRANT ALL ON TABLE "public"."activities" TO "service_role";



GRANT ALL ON TABLE "public"."activity_feed" TO "anon";
GRANT ALL ON TABLE "public"."activity_feed" TO "authenticated";
GRANT ALL ON TABLE "public"."activity_feed" TO "service_role";



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



GRANT ALL ON TABLE "public"."athlete_notifications" TO "anon";
GRANT ALL ON TABLE "public"."athlete_notifications" TO "authenticated";
GRANT ALL ON TABLE "public"."athlete_notifications" TO "service_role";



GRANT ALL ON TABLE "public"."athlete_suggestions" TO "anon";
GRANT ALL ON TABLE "public"."athlete_suggestions" TO "authenticated";
GRANT ALL ON TABLE "public"."athlete_suggestions" TO "service_role";



GRANT ALL ON TABLE "public"."profile_views" TO "anon";
GRANT ALL ON TABLE "public"."profile_views" TO "authenticated";
GRANT ALL ON TABLE "public"."profile_views" TO "service_role";



GRANT ALL ON TABLE "public"."schools" TO "anon";
GRANT ALL ON TABLE "public"."schools" TO "authenticated";
GRANT ALL ON TABLE "public"."schools" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."athlete_view_details" TO "anon";
GRANT ALL ON TABLE "public"."athlete_view_details" TO "authenticated";
GRANT ALL ON TABLE "public"."athlete_view_details" TO "service_role";



GRANT ALL ON TABLE "public"."athlete_views" TO "anon";
GRANT ALL ON TABLE "public"."athlete_views" TO "authenticated";
GRANT ALL ON TABLE "public"."athlete_views" TO "service_role";



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



GRANT ALL ON TABLE "public"."equipes" TO "anon";
GRANT ALL ON TABLE "public"."equipes" TO "authenticated";
GRANT ALL ON TABLE "public"."equipes" TO "service_role";



GRANT ALL ON TABLE "public"."evaluations" TO "anon";
GRANT ALL ON TABLE "public"."evaluations" TO "authenticated";
GRANT ALL ON TABLE "public"."evaluations" TO "service_role";



GRANT ALL ON TABLE "public"."league_coaches" TO "anon";
GRANT ALL ON TABLE "public"."league_coaches" TO "authenticated";
GRANT ALL ON TABLE "public"."league_coaches" TO "service_role";



GRANT ALL ON TABLE "public"."league_teams" TO "anon";
GRANT ALL ON TABLE "public"."league_teams" TO "authenticated";
GRANT ALL ON TABLE "public"."league_teams" TO "service_role";



GRANT ALL ON TABLE "public"."leagues" TO "anon";
GRANT ALL ON TABLE "public"."leagues" TO "authenticated";
GRANT ALL ON TABLE "public"."leagues" TO "service_role";



GRANT ALL ON TABLE "public"."ligues" TO "anon";
GRANT ALL ON TABLE "public"."ligues" TO "authenticated";
GRANT ALL ON TABLE "public"."ligues" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."notification_preferences" TO "anon";
GRANT ALL ON TABLE "public"."notification_preferences" TO "authenticated";
GRANT ALL ON TABLE "public"."notification_preferences" TO "service_role";



GRANT ALL ON TABLE "public"."parental_consents" TO "anon";
GRANT ALL ON TABLE "public"."parental_consents" TO "authenticated";
GRANT ALL ON TABLE "public"."parental_consents" TO "service_role";



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



GRANT ALL ON TABLE "public"."prospect_list_athletes" TO "anon";
GRANT ALL ON TABLE "public"."prospect_list_athletes" TO "authenticated";
GRANT ALL ON TABLE "public"."prospect_list_athletes" TO "service_role";



GRANT ALL ON TABLE "public"."prospect_lists" TO "anon";
GRANT ALL ON TABLE "public"."prospect_lists" TO "authenticated";
GRANT ALL ON TABLE "public"."prospect_lists" TO "service_role";



GRANT ALL ON TABLE "public"."recruiter_activity_log" TO "anon";
GRANT ALL ON TABLE "public"."recruiter_activity_log" TO "authenticated";
GRANT ALL ON TABLE "public"."recruiter_activity_log" TO "service_role";



GRANT ALL ON TABLE "public"."recruiter_athlete_views" TO "anon";
GRANT ALL ON TABLE "public"."recruiter_athlete_views" TO "authenticated";
GRANT ALL ON TABLE "public"."recruiter_athlete_views" TO "service_role";



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































