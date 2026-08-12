-- ═══════════════════════════════════════════════════════════════════════
-- P3 (recruteur↔athlète) — Lot A (1/4) : éligibilité (stub) + black-out
--
-- Décisions BP verrouillées :
--   • Éligibilité « pas sous secondaire 5 » : NON confirmée. On expédie un STUB
--     qui retourne true pour tous. Quand la règle est confirmée → CREATE OR
--     REPLACE avec la dérivation annee_diplomation (zéro migration).
--   • Black-out : table de plages datées ordonnancées par l'admin. GLOBAL en v1
--     (colonnes scope_type/scope_id présentes pour sport/ligue plus tard).
--     Sert aussi de fenêtre de maintenance. Enforcement DB-level (triggers, lot 3).
-- ═══════════════════════════════════════════════════════════════════════

-- 0. PRÉREQUIS MODÈLE P3 : coach_id NULLABLE.
--    Phase A a rendu recruiter_id nullable mais a laissé coach_id NOT NULL — or
--    le CHECK conversations_participants_by_type exige coach_id IS NULL pour
--    RECRUTEUR_ATHLETE. Contradiction dormante (slot réservé/inutilisé) : un fil
--    recruteur↔athlète n'était donc PAS insérable. On lève la contrainte de
--    colonne ; le CHECK par type continue d'imposer coach_id NOT NULL pour
--    RECRUTEUR_COACH / ATHLETE_COACH / PARENT_COACH. Additif (lignes P1 intactes).
ALTER TABLE public.conversations ALTER COLUMN coach_id DROP NOT NULL;

-- 1. Éligibilité — STUB. Retourne true pour tous. RÈGLE EN ATTENTE (BP/ligue).
--    Quand confirmée : remplacer le corps par
--      annee_diplomation IS NOT NULL AND annee_diplomation <= cutoff_grad_year
--    (cutoff = year(now()) + (month(now())>=9 ? 1 : 0)). Aucune migration.
CREATE OR REPLACE FUNCTION public.is_athlete_contactable(p_athlete uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  -- STUB : règle « pas sous secondaire 5 » en attente de confirmation BP/ligue.
  SELECT true;
$$;
REVOKE ALL ON FUNCTION public.is_athlete_contactable(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_athlete_contactable(uuid) TO authenticated;

-- 2. Plages de black-out (ordonnancées par l'admin plateforme).
CREATE TABLE IF NOT EXISTS public.blackout_periods (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type text NOT NULL DEFAULT 'GLOBAL' CHECK (scope_type IN ('GLOBAL','SPORT','LEAGUE')),
  scope_id   uuid,                       -- réservé (sport/ligue) ; NULL pour GLOBAL
  starts_at  timestamptz NOT NULL,
  ends_at    timestamptz NOT NULL,
  reason     text,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blackout_end_after_start CHECK (ends_at > starts_at)
);
CREATE INDEX IF NOT EXISTS idx_blackout_active ON public.blackout_periods (starts_at, ends_at);

ALTER TABLE public.blackout_periods ENABLE ROW LEVEL SECURITY;
-- Lecture : tout authentifié (l'UI affiche la bannière advisory).
CREATE POLICY "blackout read" ON public.blackout_periods
  FOR SELECT TO authenticated USING (true);
-- Écriture : admin plateforme uniquement.
CREATE POLICY "blackout admin write" ON public.blackout_periods
  FOR ALL
  USING (public.is_platform_admin(auth.uid()))
  WITH CHECK (public.is_platform_admin(auth.uid()));

-- 3. Helper black-out actif. v1 : GLOBAL uniquement (p_athlete ignoré ; conservé
--    pour le scope sport/ligue futur → CREATE OR REPLACE sans migration).
CREATE OR REPLACE FUNCTION public.is_messaging_blacked_out(p_athlete uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blackout_periods b
    WHERE b.scope_type = 'GLOBAL'
      AND now() >= b.starts_at
      AND now() <  b.ends_at
  );
$$;
REVOKE ALL ON FUNCTION public.is_messaging_blacked_out(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_messaging_blacked_out(uuid) TO authenticated;
