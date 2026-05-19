-- ────────────────────────────────────────────────────────────────
-- Fix RLS recursion exposure on 3 evaluations trigger functions
-- ────────────────────────────────────────────────────────────────
-- Same family of fix as 20260517190000_fix_backfill_athletes_recursion.sql :
-- trigger functions that UPDATE athletes (or otherwise touch RLS-
-- protected tables) need SECURITY DEFINER + SET row_security = off
-- so their internal writes don't trip the caller's RLS evaluation
-- chain and cause infinite recursion / permission denied errors.
--
-- Three functions on public.evaluations are addressed :
--
--   • calc_cote_globale — BEFORE INSERT/UPDATE on evaluations.
--     Computes cote_globale from per-trait columns, then UPDATEs
--     athletes.cote_globale_entraineur. Currently LANGUAGE plpgsql
--     with no SECURITY DEFINER — full rewrite with body preserved
--     verbatim (captured via pg_get_functiondef 2026-05-17).
--
--   • log_coach_activity_badge — already SECURITY DEFINER, missing
--     only the two settings. Use ALTER FUNCTION to add them without
--     touching the body.
--
--   • notify_athlete_evaluation_updated — same situation as #2,
--     same ALTER FUNCTION pattern.
--
-- set_updated_at intentionally NOT touched — body is trivial and
-- doesn't read any RLS-protected tables.
-- ────────────────────────────────────────────────────────────────

-- ── 1. calc_cote_globale : rewrite with SECURITY DEFINER + bypass ──
-- Body preserved verbatim from current DB definition. Only the
-- function header changes (added SECURITY DEFINER + two SET clauses).

CREATE OR REPLACE FUNCTION public.calc_cote_globale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET row_security = off
SET search_path = public
AS $function$
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
$function$;

-- ── 2. log_coach_activity_badge : add bypass via ALTER FUNCTION ──
-- Already SECURITY DEFINER, body unchanged.

ALTER FUNCTION public.log_coach_activity_badge()
  SECURITY DEFINER
  SET row_security = off
  SET search_path = public;

-- ── 3. notify_athlete_evaluation_updated : same pattern ──

ALTER FUNCTION public.notify_athlete_evaluation_updated()
  SECURITY DEFINER
  SET row_security = off
  SET search_path = public;

-- ── Verification ──
DO $$
DECLARE
  v_calc record;
  v_log record;
  v_notify record;
BEGIN
  SELECT prosecdef, proconfig INTO v_calc
    FROM pg_proc WHERE proname='calc_cote_globale' AND pronamespace='public'::regnamespace;
  SELECT prosecdef, proconfig INTO v_log
    FROM pg_proc WHERE proname='log_coach_activity_badge' AND pronamespace='public'::regnamespace;
  SELECT prosecdef, proconfig INTO v_notify
    FROM pg_proc WHERE proname='notify_athlete_evaluation_updated' AND pronamespace='public'::regnamespace;

  IF NOT v_calc.prosecdef OR NOT ('row_security=off' = ANY(v_calc.proconfig)) OR NOT ('search_path=public' = ANY(v_calc.proconfig)) THEN
    RAISE EXCEPTION 'calc_cote_globale missing one of: SECURITY DEFINER / row_security=off / search_path=public (got prosecdef=%, proconfig=%)', v_calc.prosecdef, v_calc.proconfig;
  END IF;
  IF NOT v_log.prosecdef OR NOT ('row_security=off' = ANY(v_log.proconfig)) OR NOT ('search_path=public' = ANY(v_log.proconfig)) THEN
    RAISE EXCEPTION 'log_coach_activity_badge missing one of the settings (got prosecdef=%, proconfig=%)', v_log.prosecdef, v_log.proconfig;
  END IF;
  IF NOT v_notify.prosecdef OR NOT ('row_security=off' = ANY(v_notify.proconfig)) OR NOT ('search_path=public' = ANY(v_notify.proconfig)) THEN
    RAISE EXCEPTION 'notify_athlete_evaluation_updated missing one of the settings (got prosecdef=%, proconfig=%)', v_notify.prosecdef, v_notify.proconfig;
  END IF;

  RAISE NOTICE 'evaluations trigger fix OK: calc_cote_globale + log_coach_activity_badge + notify_athlete_evaluation_updated all bypass RLS';
END $$;
