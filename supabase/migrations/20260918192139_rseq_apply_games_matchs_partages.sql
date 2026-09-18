-- 20260918192139_rseq_apply_games_matchs_partages
--
-- APPLIQUÉE en PROD le 2026-09-18 via MCP apply_migration, sur GO de BP.
-- Nom de fichier aligné sur la version RÉELLE assignée par MCP (rédigée sous
-- 20260918171403). md5 de rseq_sync_apply_games identique prod / recette locale (802495b4…).
--
-- VEILLE RSEQ SECONDAIRE — correctif trouvé à la recette du lot 4 (2026-09-18).
-- LOCAL SEULEMENT. À appliquer en prod dans la même fenêtre que 20260918192044
-- et 20260918192106 (voir docs/rseq-veille-secondaire-mise-en-prod.md).
--
-- ── LE DÉFAUT ────────────────────────────────────────────────────────────────
-- Au secondaire, un match INTER-SECTIONS (« Football J M D3 Section Est » contre
-- « … Section Ouest ») est publié par les DEUX ligues : 277 cas à la recette.
-- La première ligue à passer insérait le match ; la seconde réécrivait son
-- league_name / division / category / sex_type. D'où :
--   · 278 matchs dont le rseq_league_id désigne la ligue A et le league_name
--     la ligue B ;
--   · ~280 fausses « mise a jour » à CHAQUE passe (A réécrit, puis B réécrit),
--     0 vrai changement de score, de date ou de lieu : le journal, censé ne
--     compter que les vraies modifications, ne le faisait plus.
-- Le collégial n'a pas le cas (0 mise à jour à la 2e passe) : correctif neutre
-- pour lui.
--
-- ── LA RÈGLE ─────────────────────────────────────────────────────────────────
-- Un match appartient à la ligue de son rseq_league_id (posé à l'INSERT, jamais
-- réécrit). Ses métadonnées de ligue ne sont réécrites QUE par cette ligue. La
-- même condition entre dans le WHERE de détection : sinon une ligne serait
-- comptée « mise a jour » sans que rien ne change.
-- Tout le reste (score, date, lieu, équipes, phase, n° de match) reste mis à
-- jour par n'importe quelle ligue qui sert le match : c'est le même match.
--
-- Au premier passage après ce correctif, chaque match partagé est réécrit UNE
-- fois par sa ligue d'origine (réparation) ; les passes suivantes rendent 0.
--
-- Définition de départ : celle de la PROD (md5 b80086230a7faa8c29f7da9a60440c5f,
-- identique au dépôt 20260917203126). Signature inchangée (uuid, uuid, jsonb) :
-- CREATE OR REPLACE, l'ACL survit — le gate le prouve quand même.

create or replace function public.rseq_sync_apply_games(p_run_id uuid, p_league_id uuid, p_games jsonb)
 RETURNS TABLE(vus integer, inseres integer, maj integer)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
      division text, category text, sex_type text,
      source_nom text
    )
  ),
  resolu as (
    select s.*,
           th.id as home_team_id,
           tv.id as visitor_team_id
    from src s
    left join public.teams th on th.rseq_team_id = s.home_rseq_team_id
    left join public.teams tv on tv.rseq_team_id = s.visitor_rseq_team_id
  ),
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
      source_nom, collecte_le,
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
      coalesce(r.source_nom, 'RSEQ'), now(),
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
      -- Métadonnées de LIGUE : réécrites seulement si le match appartient déjà
      -- à la ligue qui passe. Un match inter-sections (servi par deux ligues)
      -- garde celles de sa ligue d'origine, celle de son rseq_league_id.
      league_name        = case when games.rseq_league_id = excluded.rseq_league_id
                                then excluded.league_name else games.league_name end,
      division           = case when games.rseq_league_id = excluded.rseq_league_id
                                then excluded.division else games.division end,
      category           = case when games.rseq_league_id = excluded.rseq_league_id
                                then excluded.category else games.category end,
      sex_type           = case when games.rseq_league_id = excluded.rseq_league_id
                                then excluded.sex_type else games.sex_type end,
      phase              = excluded.phase,
      source_nom         = excluded.source_nom,
      updated_at         = now()
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
      -- Même condition dans la détection : sans elle, la ligne serait comptée
      -- « mise a jour » sans rien changer, et le journal resterait bruité.
      or (games.rseq_league_id = excluded.rseq_league_id and (
             games.league_name  is distinct from excluded.league_name
          or games.division     is distinct from excluded.division
          or games.category     is distinct from excluded.category
          or games.sex_type     is distinct from excluded.sex_type))
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

  -- « VU CETTE SEMAINE », hors de l'upsert et hors du journal. Porte sur TOUTES
  -- les lignes servies par la passe, modifiees ou non — c'est le sens meme de
  -- la colonne. `updated_at` reste intact : une ligne inchangee ne devient pas
  -- une ligne modifiee parce qu'on l'a relue.
  update public.games g
     set collecte_le = now()
    from jsonb_to_recordset(p_games) as x(rseq_game_id uuid)
   where g.rseq_game_id = x.rseq_game_id;

  return query select v_vus, coalesce(v_ins, 0), coalesce(v_maj, 0);
end;
$function$;

-- ── GATES ────────────────────────────────────────────────────────────────────
do $$
declare
  vus  text[];
  veut text[] := array['postgres', 'service_role'];
  v_n  int;
begin
  -- ACL : liste COMPLÈTE triée (règle du 2026-09-07).
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.rseq_sync_apply_games(uuid, uuid, jsonb)'::regprocedure;
  if vus is distinct from veut then
    raise exception 'NEXUS: ACL de rseq_sync_apply_games = %, attendu %', vus, veut;
  end if;

  -- Une seule signature : CREATE OR REPLACE n'a pas créé de surcharge.
  select count(*) into v_n from pg_proc
   where pronamespace = 'public'::regnamespace and proname = 'rseq_sync_apply_games';
  if v_n <> 1 then
    raise exception 'NEXUS: % signature(s) de rseq_sync_apply_games, attendu 1', v_n;
  end if;

  -- La garde est bien dans la définition en place (SET et WHERE : 5 occurrences).
  select (length(d) - length(replace(d, 'games.rseq_league_id = excluded.rseq_league_id', '')))
         / length('games.rseq_league_id = excluded.rseq_league_id')
    into v_n
    from (select pg_get_functiondef('public.rseq_sync_apply_games(uuid, uuid, jsonb)'::regprocedure) d) x;
  if v_n <> 5 then
    raise exception 'NEXUS: garde des matchs partages trouvee % fois, attendu 5 (4 SET + 1 WHERE)', v_n;
  end if;

  raise notice 'NEXUS: apply_games — garde des matchs partages en place (5), ACL %', vus;
end $$;
