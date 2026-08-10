-- ============================================================================
-- Phase 4A — Calendriers RSEQ : schéma games + pont teams.rseq_team_id
--
-- Table générique public.games (pourra accueillir des matchs non-RSEQ ; la
-- provenance RSEQ reste préfixée rseq_ sur les colonnes concernées).
-- Pont teams.rseq_team_id (uuid, UNIQUE partiel — 1:1 imposé).
-- RLS : lecture authenticated (donnée publique RSEQ), écriture service role.
-- ============================================================================

-- ── 1. Pont team ↔ matchs ────────────────────────────────────────────────
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS rseq_team_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS teams_rseq_team_id_uidx
  ON public.teams (rseq_team_id) WHERE rseq_team_id IS NOT NULL;

-- ── 2. Table des matchs ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.games (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rseq_game_id         uuid NOT NULL,
  game_no              text,
  season               text NOT NULL,
  sector               text,
  phase                text NOT NULL,
  game_date            date,
  game_time            text,

  home_team_id         uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  visitor_team_id      uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  home_rseq_team_id    uuid,
  visitor_rseq_team_id uuid,
  home_name_raw        text,
  visitor_name_raw     text,
  home_code            text,
  visitor_code         text,

  home_score           integer,
  visitor_score        integer,
  result_formatted     text,
  home_forfeit         boolean DEFAULT false,
  visitor_forfeit      boolean DEFAULT false,
  is_played            boolean DEFAULT false,

  venue                text,
  venue_lat            double precision,
  venue_lon            double precision,
  field_number         integer,
  is_released          boolean,

  rseq_league_id       uuid,
  league_name          text,
  sport                text,
  region               text,
  division             text,
  category             text,
  sex_type             text,

  created_at           timestamptz DEFAULT now(),
  updated_at           timestamptz DEFAULT now()
);

-- ── 3. Idempotence des re-runs (upsert sur rseq_game_id en septembre) ─────
ALTER TABLE public.games ADD CONSTRAINT games_rseq_game_id_key UNIQUE (rseq_game_id);

-- ── 4. Indexes ───────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS games_home_team_idx     ON public.games (home_team_id);
CREATE INDEX IF NOT EXISTS games_visitor_team_idx  ON public.games (visitor_team_id);
CREATE INDEX IF NOT EXISTS games_date_idx          ON public.games (game_date);
CREATE INDEX IF NOT EXISTS games_season_sector_idx ON public.games (season, sector);
CREATE INDEX IF NOT EXISTS games_rseq_league_idx   ON public.games (rseq_league_id);
CREATE INDEX IF NOT EXISTS games_home_rseq_idx      ON public.games (home_rseq_team_id);
CREATE INDEX IF NOT EXISTS games_visitor_rseq_idx   ON public.games (visitor_rseq_team_id);

-- ── 5. RLS ───────────────────────────────────────────────────────────────
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Games readable by authenticated"
  ON public.games FOR SELECT TO authenticated USING (true);
-- Aucune policy INSERT/UPDATE/DELETE → seul le service_role écrit.
