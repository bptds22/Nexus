-- 20260917203126_games_source_tracabilite
--
-- APPLIQUEE en PROD le 2026-09-17 via MCP apply_migration, sur GO de BP.
-- Nom de fichier aligne sur la version REELLE assignee par MCP (redigee sous
-- 20260917230000). md5 de la RPC identique prod / local apres apply.
-- Compteurs apres remplissage : 2 372 collegial courant (16 sept.),
-- 47 743 reste RSEQ (24 juillet), 446 civils (15 aout). 0 ligne sans source.
--
-- ── POURQUOI ─────────────────────────────────────────────────────────────────
-- /recruteur/calendrier affiche un bandeau global : « Base sur le calendrier
-- officiel RSEQ » + « Mis a jour le <MAX(games.updated_at)> ». Les deux sont
-- faux pour une partie des matchs (diagnostic du 2026-09-17) :
--   · 446 matchs viennent de QUATRE sites civils (LFMM, QMFL, QBFL, QMJFL),
--     pas du RSEQ — 274 d'entre eux sont a venir ;
--   · la date affichee est le MAXIMUM toutes lignes confondues. Le secondaire
--     n'a pas bouge depuis le 2026-07-24, le civil depuis le 2026-08-15, mais
--     l'ecran annonce la date de la derniere passe collegiale.
-- Un recruteur qui se deplace merite de savoir D'OU vient l'information et
-- QUAND elle a ete relevee. Decision BP 2026-09-17 : source et fraicheur PAR
-- MATCH, bandeau global retire.
--
-- ── LES TROIS COLONNES ───────────────────────────────────────────────────────
--   source_nom   'RSEQ' | 'LFMM' | 'QMFL' | 'QBFL' | 'QMJFL' (liste fermee)
--   source_url   l'URL de verification — REMPLIE POUR LE CIVIL SEULEMENT.
--                Cote RSEQ elle se DERIVE de rseq_league_id :
--                https://diffusion.s1.rseq.ca/api/LeagueApi/GenerateLeagueCalendar?leagueId=<guid>
--                1 484 GUID distincts pour 50 115 matchs : la stocker aurait
--                repete la meme chaine 50 000 fois (~4,6 Mo sur une table de
--                28 Mo) et impose une reecriture massive le jour ou le RSEQ
--                change d'adresse. Le motif vit une seule fois, dans
--                lib/calendar/sourceMatch.ts.
--   collecte_le  QUAND LA SOURCE A ETE CONSULTEE — et surtout PAS quand la
--                ligne a change. C'est toute la difference avec `updated_at`,
--                et c'est ce que le recruteur doit lire : un match inchange
--                depuis trois semaines mais revu mercredi dernier est FRAIS.
--
-- Le lien par ligue a ete verifie en direct le 2026-09-17, saison courante ET
-- saison passee : HTTP 200, Content-Disposition attachment, fichier .xlsx
-- valide (122 a 125 Ko). Il couvre donc les 50 115 lignes RSEQ.
-- C'est un FICHIER, pas une page : le libelle a l'ecran dit « (Excel) » et
-- jamais « voir ce match ».

alter table public.games
  add column source_nom  text,
  add column source_url  text,
  add column collecte_le timestamptz;

alter table public.games
  add constraint games_source_nom_chk
  check (source_nom is null or source_nom in ('RSEQ', 'LFMM', 'QMFL', 'QBFL', 'QMJFL'));

comment on column public.games.source_nom  is
  'Origine de la ligne : RSEQ (API de diffusion) ou une des 4 ligues civiles. Liste fermee par games_source_nom_chk.';
comment on column public.games.source_url  is
  'URL de verification. Remplie pour le CIVIL seulement — cote RSEQ le lien se derive de rseq_league_id (lib/calendar/sourceMatch.ts).';
comment on column public.games.collecte_le is
  'Date a laquelle la SOURCE a ete consultee pour cette ligne. N''est PAS updated_at (derniere modification) : une ligne revue et inchangee reste fraiche.';

-- ── REMPLISSAGE ──────────────────────────────────────────────────────────────
-- 1. RSEQ, saison courante, collegial : la seule population que la veille
--    relit chaque semaine. On connait la date exacte — celle de la derniere
--    passe reussie, pas une approximation.
update public.games g
   set source_nom  = 'RSEQ',
       collecte_le = r.finished_at
  from (select saison, finished_at from public.rseq_sync_runs
         where statut = 'DONE' and finished_at is not null
         order by finished_at desc limit 1) r
 where g.rseq_league_id is not null
   and g.sector = 'Collégial'
   and g.season = r.saison;

-- 2. Tout le reste du RSEQ (secondaire, primaire, saisons passees). Ces lignes
--    n'ont ete ecrites QU'UNE FOIS, au chargement : leur date d'ecriture EST
--    leur date de collecte. C'est une approximation, et elle est honnete —
--    elle ne peut que sous-estimer la fraicheur, jamais la surestimer.
update public.games
   set source_nom  = 'RSEQ',
       collecte_le = updated_at
 where rseq_league_id is not null
   and collecte_le is null;

-- 3. Les quatre ligues civiles, en une instruction. `created_at` = le jour de
--    la lecture au navigateur (2026-08-15) ; rien ne les a relues depuis, et
--    l'ecran le dira desormais.
update public.games g
   set source_nom  = v.nom,
       source_url  = v.url,
       collecte_le = g.created_at
  from (values
    ('LFMM',  'https://www.lfmm.net/teams/default.asp?u=LFMM&s=football&p=schedule&viewseas=Fall_2026'),
    ('QMFL',  'https://qmfl.ca/league/qmfl/division/10/schedule'),
    ('QBFL',  'https://qbflzone.com/league/qbfl/division/10/schedule'),
    ('QMJFL', 'https://qmjfl.leaguesuite.com/league/quebec-major-junior-football-league/division/1/schedule')
  ) as v(nom, url)
 where g.rseq_league_id is null
   and g.league_name = v.nom;

-- ── LA VEILLE STAMPE LA COLLECTE A CHAQUE PASSAGE ────────────────────────────
-- CREATE OR REPLACE a signature identique (uuid, uuid, jsonb) : pas de DROP,
-- l'ACL {postgres, service_role} n'est pas emportee. Gate en fin de migration.
--
-- DEUX CHANGEMENTS, ET LE SECOND EST LE POINT DE CONCEPTION :
--   a) `source_nom` entre dans le recordset et dans l'upsert. Valeur constante
--      'RSEQ' posee par la normalisation — elle n'entre PAS dans le WHERE de
--      detection de changement, sinon elle serait comparee pour rien.
--   b) `collecte_le` est stampe par une instruction SEPAREE, APRES l'upsert.
--      Le mettre dans l'upsert aurait fait reecrire les 2 363 lignes a CHAQUE
--      passage : le WHERE ne retient que les lignes reellement modifiees, et
--      c'est ce qui rend le journal honnete (111 vraies modifications le
--      2026-09-16, pas 2 363 fausses). `updated_at` n'est pas touche par cette
--      seconde instruction — les deux colonnes gardent des sens distincts.
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
      league_name        = excluded.league_name,
      division           = excluded.division,
      category           = excluded.category,
      sex_type           = excluded.sex_type,
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
  v_n    int;
  vus    text[];
  veut   text[] := array['postgres','service_role'];
begin
  -- Les trois colonnes et la contrainte.
  select count(*) into v_n from information_schema.columns
   where table_schema = 'public' and table_name = 'games'
     and column_name in ('source_nom','source_url','collecte_le');
  if v_n <> 3 then
    raise exception 'NEXUS: games devait gagner 3 colonnes, % trouvee(s)', v_n;
  end if;
  if not exists (select 1 from pg_constraint
                  where conrelid = 'public.games'::regclass and conname = 'games_source_nom_chk') then
    raise exception 'NEXUS: contrainte games_source_nom_chk absente';
  end if;

  -- AUCUNE ligne ne doit rester sans source : le diagnostic du 2026-09-17 a
  -- montre 0 ligne hors RSEQ et hors des 4 ligues civiles. Si ce gate leve,
  -- c'est qu'une source inconnue est apparue depuis — il faut l'instruire,
  -- pas la laisser s'afficher sans provenance.
  select count(*) into v_n from public.games where source_nom is null;
  if v_n <> 0 then
    raise exception 'NEXUS: % match(s) sans source_nom apres remplissage', v_n;
  end if;

  select count(*) into v_n from public.games where collecte_le is null;
  if v_n <> 0 then
    raise exception 'NEXUS: % match(s) sans collecte_le apres remplissage', v_n;
  end if;

  -- Le civil porte son URL ; le RSEQ ne la porte PAS (elle se derive).
  select count(*) into v_n from public.games
   where source_nom <> 'RSEQ' and (source_url is null or source_url = '');
  if v_n <> 0 then
    raise exception 'NEXUS: % match(s) civils sans source_url', v_n;
  end if;
  select count(*) into v_n from public.games where source_nom = 'RSEQ' and source_url is not null;
  if v_n <> 0 then
    raise exception 'NEXUS: % match(s) RSEQ portent une source_url — elle doit etre derivee', v_n;
  end if;

  -- ACL de la RPC : liste complete, triee. CREATE OR REPLACE ne l'emporte pas,
  -- ce gate le prouve plutot que de le supposer.
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.rseq_sync_apply_games(uuid, uuid, jsonb)'::regprocedure;
  if vus is distinct from veut then
    raise exception 'NEXUS: ACL de rseq_sync_apply_games = %, attendu %', vus, veut;
  end if;

  raise notice 'NEXUS: tracabilite des matchs — 3 colonnes, 0 ligne sans source, ACL %', vus;
end $$;
