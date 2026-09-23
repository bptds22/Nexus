-- ═══════════════════════════════════════════════════════════════════════════
-- D6 volet 6 — ROLLBACK DDL de la migration 20260923210000.
-- Rétablit l'état relevé en prod le 2026-09-23. Plan §7.
--
-- ⚠ ORDRE : UI d'abord (git revert du diff /athlete/profil), puis ce script,
--   et le rollback DONNÉES (scripts/d6-volet6-oneshot.sql, mode=rollback)
--   AVANT ce script si le one-shot est passé. Ce script refuse de tourner
--   tant que des suggestions sont EN_ATTENTE : avec la policy d'UPDATE
--   ouverte rétablie, leurs auteurs pourraient les approuver eux-mêmes.
-- ═══════════════════════════════════════════════════════════════════════════
BEGIN;

DO $$ BEGIN
  IF (SELECT count(*) FROM public.athlete_suggestions WHERE status = 'EN_ATTENTE') <> 0 THEN
    RAISE EXCEPTION 'NEXUS: % suggestion(s) EN_ATTENTE — rollback DDL refusé (auto-approbation possible)',
      (SELECT count(*) FROM public.athlete_suggestions WHERE status = 'EN_ATTENTE');
  END IF;
END $$;

-- 1. L'aiguillage à deux sorties (définition prod du 2026-09-23).
CREATE OR REPLACE FUNCTION public.trg_suggestion_transition()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
  SET row_security TO 'off'
AS $$
BEGIN
  IF NEW.status <> 'EN_ATTENTE' THEN
    RETURN NEW;
  END IF;

  IF NEW.champ = ANY (public.champs_profil_athlete()) THEN
    UPDATE public.athlete_suggestions
       SET status = 'APPROUVEE',
           note_systeme = 'Édition directe (transition vieux client mobile)'
     WHERE id = NEW.id;
  ELSE
    UPDATE public.athlete_suggestions
       SET status = 'REJETEE',
           raison_rejet = 'Les distinctions et évaluations sont attribuées par ton entraîneur.',
           note_systeme = 'Édition directe (transition vieux client mobile)',
           reviewed_at = now()
     WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Les policies d'avant (formes prod, avec l'enveloppe (SELECT auth.uid())).
DROP POLICY IF EXISTS "Athletes insert own suggestions" ON public.athlete_suggestions;
CREATE POLICY "Athletes insert own suggestions"
  ON public.athlete_suggestions FOR INSERT
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated users update suggestions" ON public.athlete_suggestions;
CREATE POLICY "Authenticated users update suggestions"
  ON public.athlete_suggestions FOR UPDATE
  USING ((SELECT auth.uid()) IS NOT NULL)
  WITH CHECK ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Coaches can read suggestions for their claimed athletes" ON public.athlete_suggestions;
CREATE POLICY "Coaches can read suggestions for their claimed athletes"
  ON public.athlete_suggestions FOR SELECT
  USING (is_coach_of_athlete(athlete_id));

DROP POLICY IF EXISTS "Coaches update suggestions for their claimed athletes" ON public.athlete_suggestions;
CREATE POLICY "Coaches update suggestions for their claimed athletes"
  ON public.athlete_suggestions FOR UPDATE
  USING (is_coach_of_athlete(athlete_id));

-- 3. apply_approved_suggestion : substitution inverse, sur le corps déployé.
DO $$
DECLARE
  v_src text := replace(pg_get_functiondef('public.apply_approved_suggestion()'::regprocedure), chr(13), '');
  v_nouv constant text := 'IF v_coach_id IS NULL THEN v_coach_id := COALESCE(NEW.coach_id, auth.uid()); END IF;';
  v_anc  constant text := 'IF v_coach_id IS NULL THEN v_coach_id := NEW.coach_id; END IF;';
BEGIN
  IF (length(v_src) - length(replace(v_src, v_nouv, ''))) / length(v_nouv) <> 1 THEN
    RAISE EXCEPTION 'NEXUS: ligne d''attribution du volet 6 introuvable — aucune substitution';
  END IF;
  EXECUTE replace(v_src, v_nouv, v_anc);
END $$;

-- 4. Les deux fonctions du volet (plus rien ne les appelle).
DROP FUNCTION public.peut_trancher_suggestion(uuid);
DROP FUNCTION public.champs_autoevaluation_athlete();

COMMIT;
