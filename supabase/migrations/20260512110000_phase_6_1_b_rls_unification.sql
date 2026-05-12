-- ═══════════════════════════════════════════════════════════════
-- Phase 6.1.b — RLS unification pour le modèle coaches unifié
--
-- Context: les 4 policies sur athletes + team_invitations utilisent
-- des sub-selects sur league_coaches qui vont devenir invalides
-- post-Phase 6.3 (DROP TABLE league_coaches).
--
-- Réécriture pour pointer vers school_coaches + team_coaches (modèle
-- unifié post-Phase 6).
--
-- Sémantique préservée : un coach a accès à un athlète/invitation
-- s'il est rattaché à la team correspondante via team_coaches, OU
-- à l'institution via school_coaches avec rôle DIRECTEUR ou
-- DIRECTEUR_INTERIM.
--
-- Les policies SUR les tables legacy (league_coaches, league_teams,
-- league_team_athletes, leagues) restent en place jusqu'à Phase 6.3
-- — pas touchées ici.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ────────────────────────────────────────────────────────────────
-- Policy 1 sur athletes — Coaches update own team athletes
-- (remplace l'ancienne "Civil coaches update own team athletes")
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Civil coaches update own team athletes" ON public.athletes;
DROP POLICY IF EXISTS "Coaches update own team athletes" ON public.athletes;

CREATE POLICY "Coaches update own team athletes" ON public.athletes
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM team_coaches tc
    JOIN team_athletes ta ON ta.team_id = tc.team_id
    WHERE tc.coach_id = auth.uid()
      AND ta.athlete_id = athletes.id
  )
  OR
  EXISTS (
    SELECT 1
    FROM school_coaches sc
    WHERE sc.coach_id = auth.uid()
      AND sc.school_id = athletes.school_id
      AND sc.role IN ('DIRECTEUR', 'DIRECTEUR_INTERIM')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM team_coaches tc
    JOIN team_athletes ta ON ta.team_id = tc.team_id
    WHERE tc.coach_id = auth.uid()
      AND ta.athlete_id = athletes.id
  )
  OR
  EXISTS (
    SELECT 1
    FROM school_coaches sc
    WHERE sc.coach_id = auth.uid()
      AND sc.school_id = athletes.school_id
      AND sc.role IN ('DIRECTEUR', 'DIRECTEUR_INTERIM')
  )
);

-- ────────────────────────────────────────────────────────────────
-- Policy 2 sur team_invitations — Coaches SELECT invitations on own teams
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Coaches select invitations on own teams" ON public.team_invitations;

CREATE POLICY "Coaches select invitations on own teams" ON public.team_invitations
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM team_coaches tc
    WHERE tc.coach_id = auth.uid()
      AND tc.team_id = team_invitations.team_id
  )
  OR
  EXISTS (
    SELECT 1
    FROM school_coaches sc
    JOIN teams t ON t.school_id = sc.school_id
    WHERE sc.coach_id = auth.uid()
      AND t.id = team_invitations.team_id
      AND sc.role IN ('DIRECTEUR', 'DIRECTEUR_INTERIM')
  )
);

-- ────────────────────────────────────────────────────────────────
-- Policy 3 sur team_invitations — Coaches INSERT invitations on own teams
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Coaches insert invitations on own teams" ON public.team_invitations;

CREATE POLICY "Coaches insert invitations on own teams" ON public.team_invitations
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM team_coaches tc
    WHERE tc.coach_id = auth.uid()
      AND tc.team_id = team_invitations.team_id
  )
  OR
  EXISTS (
    SELECT 1
    FROM school_coaches sc
    JOIN teams t ON t.school_id = sc.school_id
    WHERE sc.coach_id = auth.uid()
      AND t.id = team_invitations.team_id
      AND sc.role IN ('DIRECTEUR', 'DIRECTEUR_INTERIM')
  )
);

-- ────────────────────────────────────────────────────────────────
-- Policy 4 sur team_invitations — Coaches UPDATE (cancel) own invitations
-- ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Coaches cancel own invitations" ON public.team_invitations;

CREATE POLICY "Coaches cancel own invitations" ON public.team_invitations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM team_coaches tc
    WHERE tc.coach_id = auth.uid()
      AND tc.team_id = team_invitations.team_id
  )
  OR
  EXISTS (
    SELECT 1
    FROM school_coaches sc
    JOIN teams t ON t.school_id = sc.school_id
    WHERE sc.coach_id = auth.uid()
      AND t.id = team_invitations.team_id
      AND sc.role IN ('DIRECTEUR', 'DIRECTEUR_INTERIM')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM team_coaches tc
    WHERE tc.coach_id = auth.uid()
      AND tc.team_id = team_invitations.team_id
  )
  OR
  EXISTS (
    SELECT 1
    FROM school_coaches sc
    JOIN teams t ON t.school_id = sc.school_id
    WHERE sc.coach_id = auth.uid()
      AND t.id = team_invitations.team_id
      AND sc.role IN ('DIRECTEUR', 'DIRECTEUR_INTERIM')
  )
);

-- ────────────────────────────────────────────────────────────────
-- Sanity check intra-TX
-- ────────────────────────────────────────────────────────────────

DO $$
DECLARE
  expected_policies text[] := ARRAY[
    'Coaches update own team athletes',
    'Coaches select invitations on own teams',
    'Coaches insert invitations on own teams',
    'Coaches cancel own invitations'
  ];
  pol text;
BEGIN
  FOREACH pol IN ARRAY expected_policies LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE policyname = pol
    ) THEN
      RAISE EXCEPTION 'Policy % not created', pol;
    END IF;
  END LOOP;
END $$;

COMMIT;
