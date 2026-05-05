-- ════════════════════════════════════════════════════════════════════════════
-- Phase A: remove server-side auto-verification of athletes.
--
-- Two server-side paths flip athletes.verified = true without explicit
-- human action when profile_completion crosses 60%:
--
--   1. trg_auto_verify (BEFORE UPDATE) → auto_verify_athlete()
--   2. calculate_profile_completion() (BEFORE INSERT/UPDATE) — internal
--      auto-verify block at the end of the function
--
-- Decision (architectural pivot v5, 2026-05-04): verification = explicit
-- human consent. Both paths removed.
--
-- Existing rows where verified=true AND verification_method='auto' are
-- preserved as-is — we don't retroactively un-verify athletes who reached
-- BLUE under the old rule. New writes simply won't trigger the flip.
-- Pre-check at 2026-05-04 found 1 such athlete (verified 2026-04-24).
--
-- The duplicate trigger `trigger_profile_completion` (same function as
-- `trg_profile_completion`, fires the same plpgsql body) inherits this
-- change automatically since both use CREATE OR REPLACE'd
-- calculate_profile_completion(). The duplicate-trigger anomaly is
-- pre-existing tech debt unrelated to this migration.
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Drop the dedicated auto-verify trigger and its function.
DROP TRIGGER IF EXISTS trg_auto_verify ON public.athletes;
DROP FUNCTION IF EXISTS public.auto_verify_athlete();

-- 2. Reproduce calculate_profile_completion() identically EXCEPT the
--    auto-verify IF-block (5 lines: `IF total >= 60 AND NEW.verified = FALSE
--    AND (NEW.verification_method IS NULL OR NEW.verification_method !=
--    'manuel_coach') THEN ... END IF;`). All field-counting logic, video
--    bonus, total computation, and the NEW.profile_completion := total
--    assignment are unchanged.
CREATE OR REPLACE FUNCTION public.calculate_profile_completion()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
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
$function$;
