-- ═══════════════════════════════════════════════════════════════
-- Phase 6.1.a — Schema prep pour unification civil/école
--
-- Pré-flight pour Bloc 2 (data migration + seed reset). Ajuste teams
-- + team_invitations pour absorber les besoins civils sans toucher
-- aux tables legacy (leagues, league_coaches, league_teams,
-- league_team_athletes). Celles-ci seront vidées en Bloc 2 puis
-- droppées en Phase 6.3.
--
-- Décisions BP appliquées :
--   D3 — rename team_invitations.league_team_id → team_id, re-FK vers teams
--   D6 — add teams.gender (nullable)
--   D7 — UNIQUE (school_id, sport_id, name, age_group, division, season) on teams
--
-- D8 (drop school_coaches.team_name) DEFERRED — grep safety check
-- a trouvé 7 lectures dans app/admin/schools/[id]/page.tsx qui
-- s'appuient sur cette colonne pour dériver les noms de coachs par
-- team. À traiter dans une PR refactor séparée avant de pouvoir
-- dropper la colonne.
--
-- 0 user prod, mock data seulement, pas de risque de régression.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

-- ────────────────────────────────────────────────────────────────
-- D6 — teams.gender (nullable)
-- ────────────────────────────────────────────────────────────────
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS gender text;

COMMENT ON COLUMN public.teams.gender IS
  'Optional gender designation (M/F/Mixed). Nullable for back-compat. '
  'Added in Phase 6.1.a to absorb league_teams.gender pre-data-migration.';

-- ────────────────────────────────────────────────────────────────
-- D7 — UNIQUE (school_id, sport_id, name, age_group, division, season)
-- ────────────────────────────────────────────────────────────────
-- Empêche les doublons de teams (cf. paTS x2 vu en 5.5e). Les colonnes
-- nullable (age_group, division, season) sont traitées comme distinct
-- par défaut côté PostgreSQL — OK pour notre cas (chaque NULL = unique).
ALTER TABLE public.teams
  ADD CONSTRAINT teams_identity_unique
  UNIQUE (school_id, sport_id, name, age_group, division, season);

-- ────────────────────────────────────────────────────────────────
-- D3 — team_invitations.league_team_id → team_id + re-FK vers teams
-- ────────────────────────────────────────────────────────────────
-- 3 rows mock actuelles référencent encore league_teams (Alex ACCEPTED,
-- Sophie CANCELLED, Sophie PENDING). On les DELETE ici plutôt que de
-- créer une FK NOT VALID — plus propre, et Bloc 2 re-seed les
-- invitations dans le nouveau modèle.

ALTER TABLE public.team_invitations
  DROP CONSTRAINT IF EXISTS team_invitations_league_team_id_fkey;

DELETE FROM public.team_invitations;

ALTER TABLE public.team_invitations
  RENAME COLUMN league_team_id TO team_id;

ALTER TABLE public.team_invitations
  ADD CONSTRAINT team_invitations_team_id_fkey
  FOREIGN KEY (team_id)
  REFERENCES public.teams(id)
  ON DELETE CASCADE;

-- ────────────────────────────────────────────────────────────────
-- Sanity checks intra-transaction (RAISE EXCEPTION rollback la TX
-- si une assertion fail — protection ceinture+bretelles)
-- ────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='teams' AND column_name='gender'
  ) THEN
    RAISE EXCEPTION 'teams.gender column not created (D6 failed)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname='teams_identity_unique'
  ) THEN
    RAISE EXCEPTION 'teams_identity_unique constraint not created (D7 failed)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='team_invitations' AND column_name='team_id'
  ) THEN
    RAISE EXCEPTION 'team_invitations.team_id rename failed (D3 failed)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='team_invitations' AND column_name='league_team_id'
  ) THEN
    RAISE EXCEPTION 'team_invitations.league_team_id still exists (D3 partial)';
  END IF;
END $$;

COMMIT;
