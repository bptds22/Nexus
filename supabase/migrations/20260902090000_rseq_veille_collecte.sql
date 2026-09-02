-- 20260902090000_rseq_veille_collecte.sql
-- ============================================================================
-- VEILLE RSEQ HEBDOMADAIRE — LOT A : collecte (résultats + classements).
--
-- Une fois par semaine, pour chaque ligue COLLÉGIALE de la saison courante :
-- relire GetLeagueDiffusion, mettre à jour `games` (scores) et
-- `rseq_standings` (classement officiel). Rien d'autre.
--
-- CE QUE CETTE MIGRATION N'AUTORISE PAS
--   • Aucun DELETE, nulle part. Les RPC ci-dessous ne savent qu'INSERT/UPDATE.
--   • Aucun INSERT dans `schools` ni dans `teams`. Une équipe inconnue est
--     SIGNALÉE (lot B), jamais créée. La règle RSEQ maison tient dans le code :
--     il n'existe aucun chemin d'écriture vers ces deux tables ici.
--
-- LE CLASSEMENT EST STOCKÉ TEL QUEL, JAMAIS RECALCULÉ.
--   Les bris d'égalité RSEQ (TieBreakingRules, TieBreakingDecisions, points
--   d'éthique, forfaits) ne sont pas notre métier : une V-D-N recalculée
--   depuis `games` donnerait un classement plausible et FAUX. On copie la
--   position publiée par RSEQ et on l'affiche telle quelle. `position` vient
--   d'eux ; aucun ORDER BY de notre cru ne la remplace.
--
-- IDEMPOTENCE — la raison des clauses WHERE sur les DO UPDATE.
--   Un upsert nu réécrit la ligne à chaque passage : le journal dirait
--   « 2 368 matchs mis à jour » toutes les semaines et ne vaudrait rien. Ici
--   le DO UPDATE porte un WHERE qui exige qu'AU MOINS UN champ diffère
--   réellement (IS DISTINCT FROM, donc NULL-safe). Une ligne inchangée n'est
--   pas réécrite, n'est pas renvoyée par le RETURNING, et n'est pas comptée.
--   `xmax = 0` sur le RETURNING distingue l'INSERT de l'UPDATE : sur une
--   ligne fraîchement insérée xmax vaut 0, sur une ligne mise à jour il porte
--   l'id de la transaction courante.
--   Conséquence recherchée, et vérifiable en recette : deux passages
--   consécutifs = 0 changement au second.
-- ============================================================================


-- ── 1. Journal des passages ────────────────────────────────────────────────
create table if not exists public.rseq_sync_runs (
  id               uuid primary key default gen_random_uuid(),
  started_at       timestamptz not null default now(),
  finished_at      timestamptz,
  -- 'cron' | 'manual' : la recette se fait en manuel, le régime en cron.
  declencheur      text not null default 'cron',
  saison           text not null,
  secteur          text not null default 'Collégial',

  ligues_visees    integer not null default 0,
  ligues_ok        integer not null default 0,
  ligues_ko        integer not null default 0,

  matchs_vus       integer not null default 0,
  matchs_inseres   integer not null default 0,
  matchs_maj       integer not null default 0,

  classements_vus     integer not null default 0,
  classements_inseres integer not null default 0,
  classements_maj     integer not null default 0,

  alertes_levees   integer not null default 0,

  -- 'RUNNING' | 'DONE' | 'ERROR'
  statut           text not null default 'RUNNING',
  erreurs          jsonb not null default '[]'::jsonb
);

comment on table public.rseq_sync_runs is
  'Un enregistrement par passage de la veille RSEQ. La preuve d''idempotence se lit ici : matchs_maj et classements_maj tombent a 0 au second passage.';

create index if not exists rseq_sync_runs_started_idx
  on public.rseq_sync_runs (started_at desc);


-- ── 2. Journal des changements (le détail, pas les compteurs) ──────────────
-- On ne consigne QUE les diffs réels. Un passage sans changement n'écrit
-- aucune ligne ici — c'est voulu, et c'est ce qui rend le journal lisible.
create table if not exists public.rseq_sync_changes (
  id             bigserial primary key,
  run_id         uuid not null references public.rseq_sync_runs(id) on delete cascade,
  -- 'game' | 'standing'
  entite         text not null,
  entite_id      uuid,
  rseq_league_id uuid,
  -- 'INSERT' | 'UPDATE'
  operation      text not null,
  -- Résumé lisible : « 46-0 (etait : a venir) », « rang 3 -> 1 ».
  resume         text,
  avant          jsonb,
  apres          jsonb,
  created_at     timestamptz not null default now()
);

create index if not exists rseq_sync_changes_run_idx
  on public.rseq_sync_changes (run_id, entite);


-- ── 3. Classement officiel ─────────────────────────────────────────────────
-- Copie fidèle du bloc `Standings[]` de GetLeagueDiffusion, moins les deux
-- champs *DiffusionHtml : des ancres <a> vers diffusion.rseq.ca, du markup
-- d'un tiers, aucune valeur pour nous — on ne stocke pas du HTML étranger.
--
-- `show_flags` conserve les ~40 booléens Standings_Show_* : c'est RSEQ qui
-- nous dit quelles colonnes ont un sens pour CE sport (au volleyball les
-- sets, au football les points pour/contre). L'affichage (lot C) les lira au
-- lieu de deviner sport par sport.
create table if not exists public.rseq_standings (
  id                 uuid primary key default gen_random_uuid(),

  rseq_league_id     uuid not null,
  rseq_team_id       uuid not null,
  rseq_standings_id  uuid,
  -- Résolu par jointure sur teams.rseq_team_id. NULL = équipe non pontée :
  -- la ligne est conservée quand même, sinon on afficherait un classement
  -- à trous (une équipe manquante fausse la lecture des rangs).
  team_id            uuid references public.teams(id) on delete set null,

  saison             text not null,
  secteur            text not null default 'Collégial',
  -- SeasonType du payload : 1 = saison régulière.
  season_type        integer not null default 1,

  team_code          text,
  team_name          text,
  pool               text,
  section_id         uuid,

  position              integer,
  position_formatted    text,
  pool_position         text,

  games_played       integer,
  wins               integer,
  wins_overtime      integer,
  wins_shootout      integer,
  losses             integer,
  losses_overtime    integer,
  losses_shootout    integer,
  draws              integer,

  set_wins           integer,
  set_losses         integer,
  half_wins          integer,
  half_losses        integer,
  half_draws         integer,

  points_for         integer,
  points_against     integer,
  goals_for          integer,
  goals_against      integer,

  average               numeric,
  average_formatted     text,
  average_points        numeric,
  average_pts_formatted text,
  diff1                 numeric,
  diff2                 numeric,
  diff2_formatted       text,
  plus_minus            integer,

  league_points      integer,
  ethics_points      integer,
  bonus_points       integer,
  total_points       integer,
  number_forfeits    integer,

  -- Détail volleyball (Wins_2Sets0 … Losses_0Sets3) : 10 champs qui ne
  -- servent qu'à un sport. En jsonb plutôt qu'en 10 colonnes vides partout.
  set_detail         jsonb not null default '{}'::jsonb,
  -- Standings_Show_* + ShowNumberForfeits.
  show_flags         jsonb not null default '{}'::jsonb,

  updated_at         timestamptz not null default now(),
  created_at         timestamptz not null default now()
);

comment on table public.rseq_standings is
  'Classement RSEQ officiel, copie tel quel. JAMAIS recalcule : les bris d''egalite RSEQ ne sont pas reproductibles depuis games. La colonne position vient de RSEQ.';

-- Clé d'unicité : une équipe apparaît une fois par ligue et par type de
-- saison (régulière / séries). C'est la cible du ON CONFLICT.
create unique index if not exists rseq_standings_uidx
  on public.rseq_standings (rseq_league_id, rseq_team_id, season_type);

create index if not exists rseq_standings_team_idx
  on public.rseq_standings (team_id) where team_id is not null;
create index if not exists rseq_standings_saison_idx
  on public.rseq_standings (saison, secteur);

-- RLS : calque EXACT de `games` (une seule policy, SELECT, authenticated).
-- On n'ouvre pas `anon` : le web public passe par le service-role, qui
-- contourne la RLS, et le mobile anonyme est fermé volontairement sur les
-- pages d'équipe (voir l'entête de app/college/[schoolId]/[teamId]/page.tsx).
-- Élargir ici rouvrirait par la bande ce que cette page ferme.
alter table public.rseq_standings enable row level security;

drop policy if exists "Standings readable by authenticated" on public.rseq_standings;
create policy "Standings readable by authenticated"
  on public.rseq_standings for select to authenticated using (true);

-- Journaux : RLS active, AUCUNE policy. Lisibles par le service-role (edge
-- function) et par l'admin en SQL. Personne d'autre n'a à les lire.
alter table public.rseq_sync_runs    enable row level security;
alter table public.rseq_sync_changes enable row level security;


-- ── 4. Liste de veille : les 22 familles de ligues ─────────────────────────
-- Les GUID de ligue CHANGENT à chaque saison : on ne peut pas suivre une
-- ligue par son id. On suit une FAMILLE (sport + division), stable d'une
-- année à l'autre.
--
-- Une famille regroupe PLUSIEURS ligues (sections Nord-Est / Sud-Ouest, A/B),
-- donc cette table ne porte pas de GUID : la liste d'appels réelle se lit
-- dans `games` (vue rseq_ligues_a_appeler ci-dessous). Cette table-ci sert à
-- une seule chose, et c'est la demande « le détecteur doit voir large » :
-- savoir qu'une famille EXISTE même quand elle n'a aucune ligue publiée.
--
-- 18 familles actives en 2026-2027 + 4 dormantes (Badminton D2, Badminton D3,
-- Soccer intérieur, Soccer intérieur D3 — les ligues d'hiver, publiées plus
-- tard) = 22.
--
-- ALIAS : « Ultimate » (2025-2026) et « Ultimate frisbee » (2026-2027) sont la
-- même ligue sous deux libellés. Sans repli la famille se dédouble et on
-- compte 23 au lieu de 22.
create table if not exists public.rseq_watch_leagues (
  id             uuid primary key default gen_random_uuid(),
  -- Clé de famille stable : « volleyball|D1 ». Voir rseq_family_key().
  family_key     text not null unique,
  sport          text not null,
  division       text,
  saison         text not null,
  -- 'ACTIVE'   : au moins une ligue publiée cette saison.
  -- 'DORMANTE' : vue une saison passée, rien de publié cette saison.
  statut         text not null default 'ACTIVE',
  nb_ligues      integer not null default 0,
  -- Ancre d'attente : date du 1er match de cette famille la saison passée.
  -- Passé cette date sans publication, une dormante devient anormale (lot B).
  attendu_vers   date,
  last_ok_at     timestamptz,
  updated_at     timestamptz not null default now(),
  created_at     timestamptz not null default now()
);

alter table public.rseq_watch_leagues enable row level security;

create or replace function public.rseq_family_key(p_sport text, p_division text)
returns text language sql immutable as $$
  select case
           when lower(coalesce(p_sport,'')) like 'ultimate%' then 'ultimate'
           else lower(coalesce(p_sport,''))
         end || '|' || coalesce(nullif(p_division,''), '-');
$$;

comment on function public.rseq_family_key(text, text) is
  'Cle de famille de ligue, stable entre saisons (les GUID, eux, changent). Replie Ultimate / Ultimate frisbee sur une seule famille.';

-- Amorce depuis ce que `games` sait déjà : toutes les familles collégiales
-- vues sur 2025-2026 et 2026-2027.
insert into public.rseq_watch_leagues
  (family_key, sport, division, saison, statut, nb_ligues, attendu_vers)
select
  public.rseq_family_key(f.sport, f.division),
  -- Libellé canonique : le plus récent vu pour cette famille.
  (array_agg(f.sport order by f.saison desc))[1],
  nullif(f.division, ''),
  '2026-2027',
  case when bool_or(f.saison = '2026-2027') then 'ACTIVE' else 'DORMANTE' end,
  coalesce(sum(f.nb_ligues) filter (where f.saison = '2026-2027'), 0)::int,
  min(f.premier_match) filter (where f.saison = '2025-2026')
from (
  select sport, division, season as saison,
         min(game_date) as premier_match,
         count(distinct rseq_league_id) as nb_ligues
  from public.games
  where sector = 'Collégial' and season in ('2025-2026', '2026-2027')
  group by sport, division, season
) f
group by public.rseq_family_key(f.sport, f.division), nullif(f.division, '')
on conflict (family_key) do nothing;

-- La liste d'appels de la semaine : un GUID par ligue publiée sur la saison
-- courante. C'est ce que l'edge function lit pour savoir quoi appeler.
-- Les colonnes de méta (sport, region, category, sex_type…) sont reprises de
-- ce qui est DÉJÀ en base et non relues du payload : elles venaient à
-- l'origine du catalogue de ligues, pas de GetLeagueDiffusion. Les recopier
-- telles quelles garantit qu'un passage de veille ne les fait pas « changer »
-- pour la seule raison que la source a changé de forme — sinon le premier
-- passage afficherait 2 368 fausses mises à jour et la recette ne prouverait
-- rien.
create or replace view public.rseq_ligues_a_appeler
with (security_invoker = true) as
select distinct
  g.rseq_league_id,
  g.season      as saison,
  g.sector,
  g.sport,
  g.region,
  g.division,
  g.category,
  g.sex_type,
  g.league_name,
  public.rseq_family_key(g.sport, g.division) as family_key
from public.games g
where g.sector = 'Collégial'
  and g.rseq_league_id is not null
  and g.season = case
        when extract(month from current_date) >= 7
          then extract(year from current_date)::int || '-' || (extract(year from current_date)::int + 1)
        else (extract(year from current_date)::int - 1) || '-' || extract(year from current_date)::int
      end;

comment on view public.rseq_ligues_a_appeler is
  'Les ligues collegiales de la saison courante a interroger cette semaine. 38 lignes au 2026-09-02.';


-- ── 5. RPC : application des matchs ────────────────────────────────────────
-- L'edge function normalise le payload et passe un tableau jsonb. Toute
-- l'écriture se fait ici, en UNE instruction par ligue : les CTE voient le
-- snapshot d'avant l'UPDATE, ce qui permet de journaliser l'état AVANT et
-- APRÈS sans seconde lecture.
create or replace function public.rseq_sync_apply_games(
  p_run_id    uuid,
  p_league_id uuid,
  p_games     jsonb
) returns table (vus integer, inseres integer, maj integer)
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_ins integer := 0;
  v_maj integer := 0;
  v_vus integer := coalesce(jsonb_array_length(p_games), 0);
begin
  if v_vus = 0 then
    return query select 0, 0, 0;
    return;
  end if;

  with src as (
    select * from jsonb_to_recordset(p_games) as x(
      rseq_game_id uuid, game_no text, season text, sector text, phase text,
      game_date date, game_time text,
      home_rseq_team_id uuid, visitor_rseq_team_id uuid,
      home_name_raw text, visitor_name_raw text,
      home_code text, visitor_code text,
      home_score integer, visitor_score integer, result_formatted text,
      home_forfeit boolean, visitor_forfeit boolean, is_played boolean,
      venue text, venue_lat double precision, venue_lon double precision,
      field_number integer, is_released boolean,
      rseq_league_id uuid, league_name text, sport text, region text,
      division text, category text, sex_type text
    )
  ),
  -- Résolution des deux côtés. Une équipe non pontée laisse NULL et garde son
  -- nom brut : le match reste au calendrier, il n'est simplement rattaché à
  -- personne. On ne crée JAMAIS l'équipe manquante ici (lot B la signale).
  resolu as (
    select s.*,
           th.id as home_team_id,
           tv.id as visitor_team_id
    from src s
    left join public.teams th on th.rseq_team_id = s.home_rseq_team_id
    left join public.teams tv on tv.rseq_team_id = s.visitor_rseq_team_id
  ),
  -- Snapshot d'avant : les CTE d'une même instruction lisent l'état initial.
  avant as (
    select g.rseq_game_id, g.home_score, g.visitor_score, g.is_played,
           g.game_date, g.game_time, g.venue,
           g.home_team_id, g.visitor_team_id
    from public.games g
    where g.rseq_game_id in (select rseq_game_id from src)
  ),
  up as (
    insert into public.games (
      rseq_game_id, game_no, season, sector, phase, game_date, game_time,
      home_team_id, visitor_team_id, home_rseq_team_id, visitor_rseq_team_id,
      home_name_raw, visitor_name_raw, home_code, visitor_code,
      home_score, visitor_score, result_formatted,
      home_forfeit, visitor_forfeit, is_played,
      venue, venue_lat, venue_lon, field_number, is_released,
      rseq_league_id, league_name, sport, region, division, category, sex_type,
      updated_at
    )
    select
      r.rseq_game_id, r.game_no, r.season, r.sector, r.phase, r.game_date, r.game_time,
      r.home_team_id, r.visitor_team_id, r.home_rseq_team_id, r.visitor_rseq_team_id,
      r.home_name_raw, r.visitor_name_raw, r.home_code, r.visitor_code,
      r.home_score, r.visitor_score, r.result_formatted,
      coalesce(r.home_forfeit, false), coalesce(r.visitor_forfeit, false),
      coalesce(r.is_played, false),
      r.venue, r.venue_lat, r.venue_lon, r.field_number, r.is_released,
      r.rseq_league_id, r.league_name, r.sport, r.region, r.division, r.category, r.sex_type,
      now()
    from resolu r
    on conflict (rseq_game_id) do update set
      game_no            = excluded.game_no,
      game_date          = excluded.game_date,
      game_time          = excluded.game_time,
      home_team_id       = excluded.home_team_id,
      visitor_team_id    = excluded.visitor_team_id,
      home_name_raw      = excluded.home_name_raw,
      visitor_name_raw   = excluded.visitor_name_raw,
      home_code          = excluded.home_code,
      visitor_code       = excluded.visitor_code,
      home_score         = excluded.home_score,
      visitor_score      = excluded.visitor_score,
      result_formatted   = excluded.result_formatted,
      home_forfeit       = excluded.home_forfeit,
      visitor_forfeit    = excluded.visitor_forfeit,
      is_played          = excluded.is_played,
      venue              = excluded.venue,
      venue_lat          = excluded.venue_lat,
      venue_lon          = excluded.venue_lon,
      field_number       = excluded.field_number,
      is_released        = excluded.is_released,
      league_name        = excluded.league_name,
      division           = excluded.division,
      category           = excluded.category,
      sex_type           = excluded.sex_type,
      phase              = excluded.phase,
      updated_at         = now()
    -- LE COEUR DE L'IDEMPOTENCE. Si rien n'a bougé, pas d'écriture, pas de
    -- ligne renvoyée, pas de compteur incrémenté.
    where
         games.game_date        is distinct from excluded.game_date
      or games.game_time        is distinct from excluded.game_time
      or games.home_score       is distinct from excluded.home_score
      or games.visitor_score    is distinct from excluded.visitor_score
      or games.is_played        is distinct from excluded.is_played
      or games.home_forfeit     is distinct from excluded.home_forfeit
      or games.visitor_forfeit  is distinct from excluded.visitor_forfeit
      or games.result_formatted is distinct from excluded.result_formatted
      or games.venue            is distinct from excluded.venue
      or games.venue_lat        is distinct from excluded.venue_lat
      or games.venue_lon        is distinct from excluded.venue_lon
      or games.field_number     is distinct from excluded.field_number
      or games.is_released      is distinct from excluded.is_released
      or games.home_team_id     is distinct from excluded.home_team_id
      or games.visitor_team_id  is distinct from excluded.visitor_team_id
      or games.home_name_raw    is distinct from excluded.home_name_raw
      or games.visitor_name_raw is distinct from excluded.visitor_name_raw
      or games.league_name      is distinct from excluded.league_name
      or games.division         is distinct from excluded.division
      or games.category         is distinct from excluded.category
      or games.sex_type         is distinct from excluded.sex_type
      or games.phase            is distinct from excluded.phase
      or games.game_no          is distinct from excluded.game_no
    returning
      games.id,
      games.rseq_game_id,
      (xmax = 0) as insere,
      games.home_score, games.visitor_score,
      games.is_played, games.game_date, games.game_time,
      games.venue, games.home_name_raw, games.visitor_name_raw
  ),
  j as (
    insert into public.rseq_sync_changes
      (run_id, entite, entite_id, rseq_league_id, operation, resume, avant, apres)
    select
      p_run_id, 'game', up.id, p_league_id,
      case when up.insere then 'INSERT' else 'UPDATE' end,
      case
        when up.insere then
          'nouveau match ' || coalesce(up.home_name_raw,'?') || ' c. ' ||
          coalesce(up.visitor_name_raw,'?') || ' le ' || coalesce(up.game_date::text,'?')
        when a.is_played is distinct from up.is_played and up.is_played then
          'score publie ' || coalesce(up.home_score::text,'?') || '-' ||
          coalesce(up.visitor_score::text,'?') || ' (' ||
          coalesce(up.home_name_raw,'?') || ' c. ' || coalesce(up.visitor_name_raw,'?') || ')'
        when a.home_score is distinct from up.home_score
          or a.visitor_score is distinct from up.visitor_score then
          'score corrige ' || coalesce(a.home_score::text,'-') || '-' ||
          coalesce(a.visitor_score::text,'-') || ' -> ' ||
          coalesce(up.home_score::text,'-') || '-' || coalesce(up.visitor_score::text,'-')
        when a.game_date is distinct from up.game_date then
          'date deplacee ' || coalesce(a.game_date::text,'?') || ' -> ' ||
          coalesce(up.game_date::text,'?')
        else 'mise a jour'
      end,
      case when up.insere then null else to_jsonb(a.*) end,
      jsonb_build_object(
        'home_score', up.home_score, 'visitor_score', up.visitor_score,
        'is_played', up.is_played, 'game_date', up.game_date,
        'game_time', up.game_time, 'venue', up.venue
      )
    from up left join avant a on a.rseq_game_id = up.rseq_game_id
    returning operation
  )
  select
    count(*) filter (where operation = 'INSERT')::int,
    count(*) filter (where operation = 'UPDATE')::int
  into v_ins, v_maj
  from j;

  return query select v_vus, coalesce(v_ins, 0), coalesce(v_maj, 0);
end;
$$;

comment on function public.rseq_sync_apply_games(uuid, uuid, jsonb) is
  'Applique les matchs d''une ligue RSEQ. INSERT/UPDATE seulement, jamais DELETE. Ne compte que les changements REELS (clause WHERE sur le DO UPDATE).';


-- ── 6. RPC : application du classement ─────────────────────────────────────
create or replace function public.rseq_sync_apply_standings(
  p_run_id    uuid,
  p_league_id uuid,
  p_saison    text,
  p_standings jsonb
) returns table (vus integer, inseres integer, maj integer)
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_ins integer := 0;
  v_maj integer := 0;
  v_vus integer := coalesce(jsonb_array_length(p_standings), 0);
begin
  if v_vus = 0 then
    return query select 0, 0, 0;
    return;
  end if;

  with src as (
    select * from jsonb_to_recordset(p_standings) as x(
      rseq_standings_id uuid, rseq_team_id uuid, season_type integer,
      team_code text, team_name text, pool text, section_id uuid,
      -- « position » est un col_name_keyword Postgres : on le cite pour que la
      -- liste de colonnes de jsonb_to_recordset ne parte pas en analyse de
      -- l'opérateur position(x in y).
      "position" integer, position_formatted text, pool_position text,
      games_played integer, wins integer, wins_overtime integer,
      wins_shootout integer, losses integer, losses_overtime integer,
      losses_shootout integer, draws integer,
      set_wins integer, set_losses integer,
      half_wins integer, half_losses integer, half_draws integer,
      points_for integer, points_against integer,
      goals_for integer, goals_against integer,
      average numeric, average_formatted text,
      average_points numeric, average_pts_formatted text,
      diff1 numeric, diff2 numeric, diff2_formatted text, plus_minus integer,
      league_points integer, ethics_points integer, bonus_points integer,
      total_points integer, number_forfeits integer,
      set_detail jsonb, show_flags jsonb
    )
  ),
  resolu as (
    select s.*, t.id as team_id
    from src s
    left join public.teams t on t.rseq_team_id = s.rseq_team_id
  ),
  avant as (
    select st.rseq_team_id, st.season_type, st.position, st.games_played,
           st.wins, st.losses, st.draws, st.total_points
    from public.rseq_standings st
    where st.rseq_league_id = p_league_id
      and st.rseq_team_id in (select rseq_team_id from src)
  ),
  up as (
    insert into public.rseq_standings (
      rseq_league_id, rseq_team_id, rseq_standings_id, team_id,
      saison, secteur, season_type,
      team_code, team_name, pool, section_id,
      position, position_formatted, pool_position,
      games_played, wins, wins_overtime, wins_shootout,
      losses, losses_overtime, losses_shootout, draws,
      set_wins, set_losses, half_wins, half_losses, half_draws,
      points_for, points_against, goals_for, goals_against,
      average, average_formatted, average_points, average_pts_formatted,
      diff1, diff2, diff2_formatted, plus_minus,
      league_points, ethics_points, bonus_points, total_points, number_forfeits,
      set_detail, show_flags, updated_at
    )
    select
      p_league_id, r.rseq_team_id, r.rseq_standings_id, r.team_id,
      p_saison, 'Collégial', coalesce(r.season_type, 1),
      r.team_code, r.team_name, r.pool, r.section_id,
      r.position, r.position_formatted, r.pool_position,
      r.games_played, r.wins, r.wins_overtime, r.wins_shootout,
      r.losses, r.losses_overtime, r.losses_shootout, r.draws,
      r.set_wins, r.set_losses, r.half_wins, r.half_losses, r.half_draws,
      r.points_for, r.points_against, r.goals_for, r.goals_against,
      r.average, r.average_formatted, r.average_points, r.average_pts_formatted,
      r.diff1, r.diff2, r.diff2_formatted, r.plus_minus,
      r.league_points, r.ethics_points, r.bonus_points, r.total_points,
      r.number_forfeits,
      coalesce(r.set_detail, '{}'::jsonb), coalesce(r.show_flags, '{}'::jsonb),
      now()
    from resolu r
    on conflict (rseq_league_id, rseq_team_id, season_type) do update set
      rseq_standings_id     = excluded.rseq_standings_id,
      team_id               = excluded.team_id,
      saison                = excluded.saison,
      team_code             = excluded.team_code,
      team_name             = excluded.team_name,
      pool                  = excluded.pool,
      section_id            = excluded.section_id,
      position              = excluded.position,
      position_formatted    = excluded.position_formatted,
      pool_position         = excluded.pool_position,
      games_played          = excluded.games_played,
      wins                  = excluded.wins,
      wins_overtime         = excluded.wins_overtime,
      wins_shootout         = excluded.wins_shootout,
      losses                = excluded.losses,
      losses_overtime       = excluded.losses_overtime,
      losses_shootout       = excluded.losses_shootout,
      draws                 = excluded.draws,
      set_wins              = excluded.set_wins,
      set_losses            = excluded.set_losses,
      half_wins             = excluded.half_wins,
      half_losses           = excluded.half_losses,
      half_draws            = excluded.half_draws,
      points_for            = excluded.points_for,
      points_against        = excluded.points_against,
      goals_for             = excluded.goals_for,
      goals_against         = excluded.goals_against,
      average               = excluded.average,
      average_formatted     = excluded.average_formatted,
      average_points        = excluded.average_points,
      average_pts_formatted = excluded.average_pts_formatted,
      diff1                 = excluded.diff1,
      diff2                 = excluded.diff2,
      diff2_formatted       = excluded.diff2_formatted,
      plus_minus            = excluded.plus_minus,
      league_points         = excluded.league_points,
      ethics_points         = excluded.ethics_points,
      bonus_points          = excluded.bonus_points,
      total_points          = excluded.total_points,
      number_forfeits       = excluded.number_forfeits,
      set_detail            = excluded.set_detail,
      show_flags            = excluded.show_flags,
      updated_at            = now()
    where
         rseq_standings.position          is distinct from excluded.position
      or rseq_standings.games_played      is distinct from excluded.games_played
      or rseq_standings.wins              is distinct from excluded.wins
      or rseq_standings.losses            is distinct from excluded.losses
      or rseq_standings.draws             is distinct from excluded.draws
      or rseq_standings.wins_overtime     is distinct from excluded.wins_overtime
      or rseq_standings.wins_shootout     is distinct from excluded.wins_shootout
      or rseq_standings.losses_overtime   is distinct from excluded.losses_overtime
      or rseq_standings.losses_shootout   is distinct from excluded.losses_shootout
      or rseq_standings.set_wins          is distinct from excluded.set_wins
      or rseq_standings.set_losses        is distinct from excluded.set_losses
      or rseq_standings.points_for        is distinct from excluded.points_for
      or rseq_standings.points_against    is distinct from excluded.points_against
      or rseq_standings.goals_for         is distinct from excluded.goals_for
      or rseq_standings.goals_against     is distinct from excluded.goals_against
      or rseq_standings.total_points      is distinct from excluded.total_points
      or rseq_standings.league_points     is distinct from excluded.league_points
      or rseq_standings.bonus_points      is distinct from excluded.bonus_points
      or rseq_standings.ethics_points     is distinct from excluded.ethics_points
      or rseq_standings.number_forfeits   is distinct from excluded.number_forfeits
      or rseq_standings.team_id           is distinct from excluded.team_id
      or rseq_standings.team_name         is distinct from excluded.team_name
      or rseq_standings.pool              is distinct from excluded.pool
      or rseq_standings.show_flags        is distinct from excluded.show_flags
      or rseq_standings.set_detail        is distinct from excluded.set_detail
    returning
      rseq_standings.id,
      rseq_standings.rseq_team_id,
      rseq_standings.season_type,
      (xmax = 0) as insere,
      rseq_standings.team_name,
      rseq_standings.position,
      rseq_standings.wins, rseq_standings.losses,
      rseq_standings.draws, rseq_standings.games_played
  ),
  j as (
    insert into public.rseq_sync_changes
      (run_id, entite, entite_id, rseq_league_id, operation, resume, avant, apres)
    select
      p_run_id, 'standing', up.id, p_league_id,
      case when up.insere then 'INSERT' else 'UPDATE' end,
      case
        when up.insere then
          'classement initial ' || coalesce(up.team_name,'?') || ' rang ' ||
          coalesce(up.position::text,'?')
        when a.position is distinct from up.position then
          coalesce(up.team_name,'?') || ' rang ' || coalesce(a.position::text,'?') ||
          ' -> ' || coalesce(up.position::text,'?')
        else
          coalesce(up.team_name,'?') || ' fiche ' ||
          coalesce(up.wins::text,'0') || '-' || coalesce(up.losses::text,'0') ||
          case when coalesce(up.draws,0) > 0 then '-' || up.draws::text else '' end
      end,
      case when up.insere then null else to_jsonb(a.*) end,
      jsonb_build_object(
        'position', up.position, 'games_played', up.games_played,
        'wins', up.wins, 'losses', up.losses, 'draws', up.draws
      )
    -- Appariement sur (equipe, season_type) et pas sur la seule equipe : une
    -- meme equipe a une ligne de saison reguliere ET une de series. Joindre
    -- sur l'equipe seule ferait raconter au journal la variation de l'autre.
    from up left join avant a
      on a.rseq_team_id = up.rseq_team_id
     and a.season_type  = up.season_type
    returning operation
  )
  select
    count(*) filter (where operation = 'INSERT')::int,
    count(*) filter (where operation = 'UPDATE')::int
  into v_ins, v_maj
  from j;

  return query select v_vus, coalesce(v_ins, 0), coalesce(v_maj, 0);
end;
$$;

comment on function public.rseq_sync_apply_standings(uuid, uuid, text, jsonb) is
  'Applique le classement officiel d''une ligue RSEQ, tel quel. Aucun recalcul, aucun tri maison : position vient de RSEQ.';


-- ── 7. Droits ──────────────────────────────────────────────────────────────
-- Seul le service-role (edge function) écrit. Rien n'est exposé à
-- authenticated ni à anon : ce ne sont pas des RPC applicatives.
revoke all on function public.rseq_sync_apply_games(uuid, uuid, jsonb) from public;
revoke all on function public.rseq_sync_apply_standings(uuid, uuid, text, jsonb) from public;
grant execute on function public.rseq_sync_apply_games(uuid, uuid, jsonb) to service_role;
grant execute on function public.rseq_sync_apply_standings(uuid, uuid, text, jsonb) to service_role;
