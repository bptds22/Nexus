-- docs/rseq-veille-secondaire-retour-arriere.sql
-- ============================================================================
-- RETOUR ARRIÈRE — veille RSEQ secondaire (lots 1 à 3 du 2026-09-18).
--
-- À N'EXÉCUTER QUE SI la mise en prod échoue et qu'il faut rendre la veille
-- COLLÉGIALE à son état d'avant, d'ici le mercredi suivant. Ce n'est PAS une
-- migration : ce fichier vit dans docs/ pour qu'un `db reset` ne le rejoue
-- jamais. Voir docs/rseq-veille-secondaire-mise-en-prod.md, section 6.
--
-- VA DE PAIR avec le redéploiement de l'ANCIENNE fonction :
--   git show a0e8aca:supabase/functions/rseq-weekly-sync/index.ts
-- (l'ancienne fonction n'envoie ni p_secteur, ni ?secteur=, ni `mode`).
--
-- Ce que ce script RESTAURE (définitions relevées EN PROD le 2026-09-18 avant
-- toute écriture, md5 vérifiés identiques) :
--   · rseq_family_key(sport, division) à 2 arguments ;
--   · les 4 RPC à leur ancienne signature, detect_matchs_retires à son ancien
--     corps ;
--   · la vue rseq_ligues_a_appeler collégiale seule (DROP + CREATE : on ne
--     peut pas retirer la colonne `origine` par CREATE OR REPLACE) ;
--   · les clés de famille sans secteur (veille et alertes collégiales) ;
--   · le cron d'origine (un seul travail, sans paramètre) ;
--   · un défaut 'passe' sur rseq_sync_runs.mode — l'ancienne fonction ne
--     l'écrit pas, et la colonne est NOT NULL.
--
-- Ce qu'il LAISSE en place, inerte pour l'ancienne fonction :
--   · la table rseq_ligues_publiees et rseq_decouverte_upsert ;
--   · le correctif des matchs partagés dans rseq_sync_apply_games (neutre
--     pour le collégial, prouvé : 0/0/0) ;
--   · les colonnes rseq_watch_leagues.secteur, rseq_sync_runs.mode/detail ;
--   · les alertes secondaires déjà levées (clés « secondaire|… ») : l'ancien
--     code ne les relit jamais. À traiter ou fermer à la main.
--
-- Une transaction. Tout gate qui lève annule l'ensemble.
-- ============================================================================

begin;

-- ── 1. Cron : retour au travail unique, sans paramètre ──────────────────────
select cron.unschedule(jobname) from cron.job
 where jobname in ('rseq-decouverte-secondaire', 'rseq-veille-secondaire');

select cron.schedule(
  'rseq-veille-hebdo',
  '55 7 * * 3',
  $job$
  select net.http_post(
    url := 'https://nrloizyemulbhujrqhgx.supabase.co/functions/v1/rseq-weekly-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-rseq-secret', (select decrypted_secret from vault.decrypted_secrets
                         where name = 'RSEQ_SYNC_SECRET')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 5000
  );
  $job$
);

-- ── 2. Journal : l'ancienne fonction n'écrit pas `mode` ─────────────────────
alter table public.rseq_sync_runs alter column mode set default 'passe';

-- ── 3. Vue : DROP d'abord (elle dépend de la clé à 3 arguments) ─────────────
drop view public.rseq_ligues_a_appeler;

-- ── 4. Les 4 RPC : retrait des signatures « secteur » ───────────────────────
drop function public.rseq_sync_apply_standings(uuid, uuid, text, text, jsonb);
drop function public.rseq_sync_detect_teams(uuid, uuid, text, text, text, jsonb);
drop function public.rseq_sync_detect_familles(uuid, text, text);
drop function public.rseq_sync_detect_mapping(uuid, text, text);

-- ── 5. Définitions d'origine, relevées en prod le 2026-09-18 ────────────────
CREATE OR REPLACE FUNCTION public.rseq_family_key(p_sport text, p_division text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case
           when lower(coalesce(p_sport,'')) like 'ultimate%' then 'ultimate'
           else lower(coalesce(p_sport,''))
         end || '|' || coalesce(nullif(p_division,''), '-');
$function$;

CREATE OR REPLACE FUNCTION public.rseq_sync_apply_standings(p_run_id uuid, p_league_id uuid, p_saison text, p_standings jsonb)
 RETURNS TABLE(vus integer, inseres integer, maj integer)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.rseq_sync_detect_teams(p_run_id uuid, p_league_id uuid, p_family_key text, p_saison text, p_teams jsonb)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_n integer := 0;
begin
  if coalesce(jsonb_array_length(p_teams), 0) = 0 then
    return 0;
  end if;

  with src as (
    select * from jsonb_to_recordset(p_teams) as x(
      rseq_team_id uuid, team_name text, team_code text,
      rseq_institution_id uuid, team_pseudonym text, vu_dans_teams boolean
    )
    where rseq_team_id is not null
      and rseq_team_id <> '00000000-0000-0000-0000-000000000000'::uuid
  ),
  inconnues as (
    insert into public.rseq_sync_alerts
      (run_id, type, cle, rseq_league_id, rseq_team_id, rseq_institution_id,
       family_key, school_id, resume, payload)
    select
      p_run_id, 'NOUVELLE_EQUIPE', s.rseq_team_id::text,
      p_league_id, s.rseq_team_id, s.rseq_institution_id, p_family_key,
      sc.id,
      coalesce(s.team_name, '?') || ' (' || coalesce(s.team_code,'?') || ') — ' ||
      case
        when sc.id is not null then 'ecole PROUVEE par InstitutionId : ' || sc.name
        when s.rseq_institution_id is not null then 'INSTITUTION INCONNUE ' || s.rseq_institution_id::text
        else 'RATTACHEMENT A ETABLIR A LA MAIN — absente de Teams[], aucun InstitutionId publie'
      end,
      jsonb_build_object(
        'team_name', s.team_name, 'team_code', s.team_code,
        'team_pseudonym', s.team_pseudonym,
        'rseq_institution_id', s.rseq_institution_id,
        'vu_dans_teams', coalesce(s.vu_dans_teams, false),
        'source', case when coalesce(s.vu_dans_teams, false) then 'Teams[]' else 'matchs' end,
        'ecole_prouvee', (sc.id is not null),
        'family_key', p_family_key, 'saison', p_saison
      )
    from src s
    left join public.schools sc on sc.rseq_institution_id = s.rseq_institution_id
    where not exists (
        select 1 from public.teams t where t.rseq_team_id = s.rseq_team_id
      )
    on conflict (type, cle) where statut = 'OUVERTE' do nothing
    returning 1
  ),
  connues as (
    select t.id as team_id, s.rseq_team_id, s.team_name, t.division as div_connue
    from src s
    join public.teams t on t.rseq_team_id = s.rseq_team_id
  ),
  familles_connues as (
    select c.team_id, c.rseq_team_id, c.team_name,
           array_agg(distinct public.rseq_family_key(g.sport, g.division)) as familles
    from connues c
    join public.games g
      on g.home_rseq_team_id = c.rseq_team_id
      or g.visitor_rseq_team_id = c.rseq_team_id
    where g.sector = 'Collégial'
      and g.rseq_league_id is distinct from p_league_id
    group by c.team_id, c.rseq_team_id, c.team_name
  ),
  derive as (
    insert into public.rseq_sync_alerts
      (run_id, type, cle, rseq_league_id, rseq_team_id, family_key,
       team_id, resume, payload)
    select
      p_run_id, 'CHANGEMENT_DIVISION',
      f.rseq_team_id::text || '|' || p_family_key,
      p_league_id, f.rseq_team_id, p_family_key, f.team_id,
      coalesce(f.team_name,'?') || ' apparait en « ' || p_family_key ||
      ' », connue en « ' || array_to_string(f.familles, ', ') || ' »',
      jsonb_build_object(
        'familles_connues', f.familles,
        'famille_courante', p_family_key,
        'saison', p_saison
      )
    from familles_connues f
    where not (p_family_key = any(f.familles))
    on conflict (type, cle) where statut = 'OUVERTE' do nothing
    returning 1
  ),
  mapping as (
    insert into public.rseq_sync_alerts
      (run_id, type, cle, rseq_league_id, rseq_team_id, rseq_institution_id,
       family_key, team_id, school_id, resume, payload)
    select
      p_run_id, 'MAPPING_DERIVE',
      s.rseq_team_id::text || '|institution',
      p_league_id, s.rseq_team_id, s.rseq_institution_id, p_family_key,
      t.id, t.school_id,
      coalesce(s.team_name, '?') || ' — ' ||
      case
        when sc.id is null then
          'InstitutionId ' || s.rseq_institution_id::text ||
          ' INCONNU de schools ; equipe rattachee a « ' || coalesce(ec.name,'?') ||
          ' », dont le pont d''ecole est absent'
        else
          'InstitutionId pointe « ' || sc.name ||
          ' » alors que l''equipe est rattachee a « ' || coalesce(ec.name,'?') || ' »'
      end,
      jsonb_build_object(
        'cas', case when sc.id is null then 'C_institution_inconnue' else 'B_institution_divergente' end,
        'team_name', s.team_name,
        'rseq_institution_id', s.rseq_institution_id,
        'ecole_actuelle', ec.name,
        'ecole_publiee', sc.name,
        'family_key', p_family_key, 'saison', p_saison
      )
    from src s
    join public.teams t   on t.rseq_team_id = s.rseq_team_id
    left join public.schools ec on ec.id = t.school_id
    left join public.schools sc on sc.rseq_institution_id = s.rseq_institution_id
    where s.rseq_institution_id is not null
      and (sc.id is null or sc.id is distinct from t.school_id)
    on conflict (type, cle) where statut = 'OUVERTE' do nothing
    returning 1
  )
  select (select count(*) from inconnues)
       + (select count(*) from derive)
       + (select count(*) from mapping)
  into v_n;

  return coalesce(v_n, 0);
end;
$function$;

CREATE OR REPLACE FUNCTION public.rseq_sync_detect_familles(p_run_id uuid, p_saison text)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_n integer := 0;
begin
  update public.rseq_watch_leagues w
     set nb_ligues = coalesce(v.n, 0),
         statut    = case when coalesce(v.n, 0) > 0 then 'ACTIVE' else 'DORMANTE' end,
         saison    = p_saison,
         last_ok_at = case when coalesce(v.n, 0) > 0 then now() else w.last_ok_at end,
         updated_at = now()
  from (
    select family_key, count(*)::int as n
    from public.rseq_ligues_a_appeler group by family_key
  ) v
  where v.family_key = w.family_key;

  update public.rseq_watch_leagues w
     set nb_ligues = 0,
         statut = 'DORMANTE',
         updated_at = now()
   where not exists (
     select 1 from public.rseq_ligues_a_appeler v where v.family_key = w.family_key
   );

  with ins as (
    insert into public.rseq_sync_alerts
      (run_id, type, cle, family_key, resume, payload)
    select
      p_run_id, 'FAMILLE_ATTENDUE_ABSENTE',
      w.family_key || '|' || p_saison,
      w.family_key,
      w.sport || coalesce(' ' || w.division, '') ||
      ' n''est toujours pas publiee (la saison passee, premier match le ' ||
      coalesce(w.attendu_vers::text, '?') || ')',
      jsonb_build_object(
        'sport', w.sport, 'division', w.division,
        'attendu_vers', w.attendu_vers, 'saison', p_saison
      )
    from public.rseq_watch_leagues w
    where w.statut = 'DORMANTE'
      and w.attendu_vers is not null
      and (w.attendu_vers + interval '1 year')::date <= current_date
    on conflict (type, cle) where statut = 'OUVERTE' do nothing
    returning 1
  )
  select coalesce((select count(*)::int from ins), 0) into v_n;

  return coalesce(v_n, 0);
end;
$function$;

CREATE OR REPLACE FUNCTION public.rseq_sync_detect_mapping(p_run_id uuid, p_saison text)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_n integer := 0;
begin
  if not exists (select 1 from public.rseq_ligues_a_appeler) then
    return 0;
  end if;

  with ins as (
    insert into public.rseq_sync_alerts
      (run_id, type, cle, rseq_team_id, team_id, school_id, family_key, resume, payload)
    select
      p_run_id, 'MAPPING_DERIVE',
      t.id::text || '|absente|' || p_saison,
      t.rseq_team_id, t.id, t.school_id,
      public.rseq_family_key(sp.nom, t.division),
      coalesce(s.name, '?') || ' — ' || coalesce(sp.nom, '?') ||
      coalesce(' ' || t.gender, '') || coalesce(' ' || nullif(t.division,''), '') ||
      ' : equipe pontee mais ABSENTE de toute ligue ' || p_saison,
      jsonb_build_object(
        'cas', 'A_absente_des_ligues',
        'rseq_team_id', t.rseq_team_id,
        'ecole', s.name, 'sport', sp.nom,
        'genre', t.gender, 'division', t.division,
        'saison', p_saison
      )
    from public.teams t
    join public.schools s on s.id = t.school_id
    left join public.sports sp on sp.id = t.sport_id
    where s.type = 'CEGEP'
      and t.season = p_saison
      and t.rseq_team_id is not null
      and not exists (
        select 1 from public.games g
        where g.sector = 'Collégial' and g.season = p_saison
          and (g.home_rseq_team_id = t.rseq_team_id
            or g.visitor_rseq_team_id = t.rseq_team_id)
      )
    on conflict (type, cle) where statut = 'OUVERTE' do nothing
    returning 1
  )
  select coalesce((select count(*)::int from ins), 0) into v_n;

  return coalesce(v_n, 0);
end;
$function$;

CREATE OR REPLACE FUNCTION public.rseq_sync_detect_matchs_retires(p_run_id uuid, p_league_id uuid, p_saison text, p_vus uuid[])
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  SEUIL_MASSE constant numeric := 0.40;
  v_base      integer;
  v_manquants integer;
  v_n         integer := 0;
begin
  if p_vus is null or coalesce(array_length(p_vus, 1), 0) = 0 then
    return 0;
  end if;

  select count(*) into v_base
  from public.games g
  where g.rseq_league_id = p_league_id and g.season = p_saison;

  if v_base = 0 then
    return 0;
  end if;

  select count(*) into v_manquants
  from public.games g
  where g.rseq_league_id = p_league_id and g.season = p_saison
    and not (g.rseq_game_id = any(p_vus));

  if v_manquants = 0 then
    return 0;
  end if;

  if v_manquants::numeric / v_base > SEUIL_MASSE then
    with ins as (
      insert into public.rseq_sync_alerts
        (run_id, type, cle, rseq_league_id, family_key, resume, payload)
      select
        p_run_id, 'MATCH_RETIRE',
        p_league_id::text || '|retrait-masse|' || p_saison,
        p_league_id,
        (select public.rseq_family_key(max(g.sport), max(g.division))
           from public.games g where g.rseq_league_id = p_league_id),
        'RETRAIT DE MASSE — ' || v_manquants || ' des ' || v_base ||
        ' matchs de « ' ||
        coalesce((select max(g.league_name) from public.games g
                   where g.rseq_league_id = p_league_id), p_league_id::text) ||
        ' » ne sont plus servis par l''API (' ||
        round(100.0 * v_manquants / v_base) || ' %). Ligue reorganisee, ou source en cause.',
        jsonb_build_object(
          'cas', 'retrait_de_masse',
          'manquants', v_manquants, 'base', v_base,
          'proportion', round(100.0 * v_manquants / v_base),
          'seuil_pct', 40, 'saison', p_saison
        )
      on conflict (type, cle) where statut = 'OUVERTE' do nothing
      returning 1
    )
    select coalesce((select count(*)::int from ins), 0) into v_n;

  else
    with ins as (
      insert into public.rseq_sync_alerts
        (run_id, type, cle, rseq_league_id, family_key, resume, payload)
      select
        p_run_id, 'MATCH_RETIRE',
        g.rseq_game_id::text || '|retire',
        p_league_id,
        public.rseq_family_key(g.sport, g.division),
        'Match retire du calendrier RSEQ : ' ||
        coalesce(g.home_name_raw,'?') || ' c. ' || coalesce(g.visitor_name_raw,'?') ||
        ' le ' || coalesce(g.game_date::text,'date inconnue') ||
        ' (' || coalesce(g.league_name,'?') || ')' ||
        case when g.is_played then ' — ATTENTION : ce match etait marque JOUE'
             else '' end,
        jsonb_build_object(
          'cas', 'retrait_ponctuel',
          'rseq_game_id', g.rseq_game_id,
          'game_date', g.game_date,
          'domicile', g.home_name_raw, 'visiteur', g.visitor_name_raw,
          'etait_joue', g.is_played,
          'score', case when g.is_played
                        then g.home_score::text || '-' || g.visitor_score::text
                        else null end,
          'league_name', g.league_name,
          'manquants_dans_la_ligue', v_manquants, 'base', v_base,
          'saison', p_saison
        )
      from public.games g
      where g.rseq_league_id = p_league_id and g.season = p_saison
        and not (g.rseq_game_id = any(p_vus))
      on conflict (type, cle) where statut = 'OUVERTE' do nothing
      returning 1
    )
    select coalesce((select count(*)::int from ins), 0) into v_n;
  end if;

  return coalesce(v_n, 0);
end;
$function$;

-- ACL d'origine (relevées en prod le 2026-09-18, bloc 0 du lot 1).
revoke all on function public.rseq_family_key(text, text) from public, anon;
grant execute on function public.rseq_family_key(text, text) to authenticated, service_role;
revoke all on function public.rseq_sync_apply_standings(uuid, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.rseq_sync_apply_standings(uuid, uuid, text, jsonb) to service_role;
revoke all on function public.rseq_sync_detect_teams(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.rseq_sync_detect_teams(uuid, uuid, text, text, jsonb) to service_role;
revoke all on function public.rseq_sync_detect_familles(uuid, text) from public, anon, authenticated;
grant execute on function public.rseq_sync_detect_familles(uuid, text) to service_role;
revoke all on function public.rseq_sync_detect_mapping(uuid, text) from public, anon, authenticated;
grant execute on function public.rseq_sync_detect_mapping(uuid, text) to service_role;

-- ── 6. Vue d'origine (collégial seul), security_invoker restaté ─────────────
create view public.rseq_ligues_a_appeler
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

-- ACL d'origine de la vue : anon, authenticated, postgres, service_role (arwdDxtm).
grant all on table public.rseq_ligues_a_appeler to anon, authenticated, service_role;

-- ── 7. Données : clés sans secteur ──────────────────────────────────────────
delete from public.rseq_watch_leagues where secteur = 'Secondaire';

update public.rseq_watch_leagues
   set family_key = public.rseq_family_key(sport, division),
       updated_at = now()
 where secteur = 'Collégial';

update public.rseq_sync_alerts
   set family_key = substr(family_key, length('collégial|') + 1)
 where family_key like 'collégial|%';

update public.rseq_sync_alerts
   set payload = jsonb_set(payload, '{family_key}',
                           to_jsonb(substr(payload->>'family_key', length('collégial|') + 1)))
 where payload->>'family_key' like 'collégial|%';

-- ── 8. Clé à 3 arguments : plus personne ne l'appelle ───────────────────────
drop function public.rseq_family_key(text, text, text);

-- ── 9. GATES ────────────────────────────────────────────────────────────────
do $$
declare
  vus  text[];
  veut text[];
  v_n  int;
  r    record;
begin
  for r in
    select * from (values
      ('public.rseq_family_key(text,text)',                              array['authenticated','postgres','service_role']),
      ('public.rseq_sync_apply_standings(uuid,uuid,text,jsonb)',         array['postgres','service_role']),
      ('public.rseq_sync_detect_teams(uuid,uuid,text,text,jsonb)',       array['postgres','service_role']),
      ('public.rseq_sync_detect_familles(uuid,text)',                    array['postgres','service_role']),
      ('public.rseq_sync_detect_mapping(uuid,text)',                     array['postgres','service_role']),
      ('public.rseq_sync_detect_matchs_retires(uuid,uuid,text,uuid[])',  array['postgres','service_role'])
    ) as t(sig, veut)
  loop
    select array_agg(t.g order by t.g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) t
     where pr.oid = r.sig::regprocedure;
    if vus is distinct from r.veut then
      raise exception 'RETOUR ARRIERE : ACL de % = %, attendu %', r.sig, vus, r.veut;
    end if;
  end loop;

  select array_agg(p.oid::regprocedure::text order by p.oid::regprocedure::text) into vus
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('rseq_family_key','rseq_sync_apply_standings','rseq_sync_detect_teams',
                       'rseq_sync_detect_familles','rseq_sync_detect_mapping','rseq_sync_detect_matchs_retires');
  veut := array[
    'rseq_family_key(text,text)',
    'rseq_sync_apply_standings(uuid,uuid,text,jsonb)',
    'rseq_sync_detect_familles(uuid,text)',
    'rseq_sync_detect_mapping(uuid,text)',
    'rseq_sync_detect_matchs_retires(uuid,uuid,text,uuid[])',
    'rseq_sync_detect_teams(uuid,uuid,text,text,jsonb)'
  ];
  if vus is distinct from veut then
    raise exception 'RETOUR ARRIERE : signatures = %, attendu %', vus, veut;
  end if;

  if not coalesce((select 'security_invoker=true' = any(reloptions) from pg_class
                    where oid = 'public.rseq_ligues_a_appeler'::regclass), false) then
    raise exception 'RETOUR ARRIERE : rseq_ligues_a_appeler sans security_invoker';
  end if;

  select array_agg(distinct t.g order by t.g) into vus
    from pg_class c,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(c.relacl::text[]) as x) t
   where c.oid = 'public.rseq_ligues_a_appeler'::regclass;
  if vus is distinct from array['anon','authenticated','postgres','service_role'] then
    raise exception 'RETOUR ARRIERE : ACL de la vue = %, attendu {anon,authenticated,postgres,service_role}', vus;
  end if;

  select count(*) into v_n from public.rseq_ligues_a_appeler where sector <> 'Collégial';
  if v_n <> 0 then
    raise exception 'RETOUR ARRIERE : % ligue(s) non collegiale(s) dans la vue', v_n;
  end if;

  select count(*) into v_n from public.rseq_watch_leagues
   where family_key is distinct from public.rseq_family_key(sport, division);
  if v_n <> 0 then
    raise exception 'RETOUR ARRIERE : % famille(s) de veille incoherente(s)', v_n;
  end if;

  select count(*) into v_n from public.rseq_sync_alerts where family_key like 'collégial|%';
  if v_n <> 0 then
    raise exception 'RETOUR ARRIERE : % alerte(s) collegiale(s) gardent le prefixe', v_n;
  end if;

  select array_agg(jobname || '|' || schedule order by jobname) into vus
    from cron.job where jobname like 'rseq%' or command like '%rseq-weekly-sync%';
  if vus is distinct from array['rseq-veille-hebdo|55 7 * * 3'] then
    raise exception 'RETOUR ARRIERE : travaux RSEQ = %, attendu {rseq-veille-hebdo|55 7 * * 3}', vus;
  end if;
  if exists (select 1 from cron.job where jobname = 'rseq-veille-hebdo' and command like '%?secteur%') then
    raise exception 'RETOUR ARRIERE : rseq-veille-hebdo porte encore ?secteur=';
  end if;

  raise notice 'RETOUR ARRIERE : gates OK — signatures, ACL, vue collegiale (% ligues), veille (% familles), cron d''origine',
    (select count(*) from public.rseq_ligues_a_appeler),
    (select count(*) from public.rseq_watch_leagues);
end $$;

commit;
