-- Rollback 4/4 : retire la RPC de création et la fonction de proposition ; remet rseq_sync_detect_teams
-- à son corps prod d'avant (md5 pg_get_functiondef cf4b292d46e689daeb31beef3962e181), ACL inchangée.
begin;
drop function if exists public.rseq_creer_equipes_proposees(uuid[]);
create or replace function public.rseq_sync_detect_teams(p_run_id uuid, p_league_id uuid, p_family_key text, p_saison text, p_secteur text, p_teams jsonb)
 returns integer
 language plpgsql
 set search_path to 'public', 'pg_temp'
as $function$
declare
  v_n      integer := 0;
  v_sport  text;
  v_region text;
  v_cle    text;
begin
  if p_secteur is null or p_secteur not in ('Collégial', 'Secondaire') then
    raise exception 'rseq_sync_detect_teams : secteur invalide « % »', p_secteur;
  end if;

  if coalesce(jsonb_array_length(p_teams), 0) = 0 then
    return 0;
  end if;

  if p_secteur = 'Secondaire' then
    select v.sport, v.region into v_sport, v_region
      from public.rseq_ligues_a_appeler v
     where v.rseq_league_id = p_league_id
     limit 1;
    if v_sport is null then
      select max(g.sport), max(g.region) into v_sport, v_region
        from public.games g where g.rseq_league_id = p_league_id;
    end if;
    -- Segment « sport » de la clé de famille : même alias Ultimate.
    v_cle := 'secondaire|' ||
             split_part(public.rseq_family_key(p_secteur, v_sport, null), '|', 2) || '|' ||
             coalesce(v_region, '?') || '|' || p_saison;
  end if;

  with src as (
    select distinct on (x.rseq_team_id) x.*
    from jsonb_to_recordset(p_teams) as x(
      rseq_team_id uuid, team_name text, team_code text,
      rseq_institution_id uuid, team_pseudonym text, vu_dans_teams boolean
    )
    where x.rseq_team_id is not null
      and x.rseq_team_id <> '00000000-0000-0000-0000-000000000000'::uuid
    order by x.rseq_team_id
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
    where p_secteur = 'Collégial'
      and not exists (
        select 1 from public.teams t where t.rseq_team_id = s.rseq_team_id
      )
    on conflict (type, cle) where statut = 'OUVERTE' do nothing
    returning 1
  ),
  nouvelles as (
    select
      jsonb_agg(jsonb_build_object(
        'rseq_team_id', s.rseq_team_id,
        'team_name', s.team_name, 'team_code', s.team_code,
        'team_pseudonym', s.team_pseudonym,
        'rseq_institution_id', s.rseq_institution_id,
        'school_id', sc.id, 'ecole', sc.name,
        'ecole_prouvee', (sc.id is not null),
        'source', case when coalesce(s.vu_dans_teams, false) then 'Teams[]' else 'matchs' end,
        'rseq_league_id', p_league_id,
        'family_key', p_family_key
      ) order by s.team_name, s.rseq_team_id) as equipes,
      count(*)::int as n
    from src s
    left join lateral (
      select x.id, x.name from public.schools x
       where x.rseq_institution_id = s.rseq_institution_id
       limit 1
    ) sc on true
    where p_secteur = 'Secondaire'
      and not exists (
        select 1 from public.teams t where t.rseq_team_id = s.rseq_team_id
      )
      and not exists (
        select 1 from public.rseq_sync_alerts a
         where a.type = 'NOUVELLES_EQUIPES'
           and a.payload @> jsonb_build_object('equipes',
                 jsonb_build_array(jsonb_build_object('rseq_team_id', s.rseq_team_id)))
      )
  ),
  agrege as (
    insert into public.rseq_sync_alerts as al
      (run_id, type, cle, resume, payload)
    select
      p_run_id, 'NOUVELLES_EQUIPES', v_cle,
      coalesce(v_sport, '?') || ' secondaire — ' || coalesce(v_region, '?') || ' : ' ||
      n.n || ' equipe(s) a importer, ' ||
      (select count(*) from jsonb_array_elements(n.equipes) e
        where (e->>'ecole_prouvee')::boolean) || ' ecole(s) prouvee(s) par InstitutionId',
      jsonb_build_object(
        'secteur', p_secteur, 'sport', v_sport, 'region', v_region,
        'saison', p_saison, 'equipes', n.equipes
      )
    from nouvelles n
    where n.n > 0
    on conflict (type, cle) where statut = 'OUVERTE' do update set
      payload = jsonb_set(al.payload, '{equipes}',
                          (al.payload->'equipes') || (excluded.payload->'equipes')),
      resume  = coalesce(v_sport, '?') || ' secondaire — ' || coalesce(v_region, '?') || ' : ' ||
                jsonb_array_length((al.payload->'equipes') || (excluded.payload->'equipes')) ||
                ' equipe(s) a importer, ' ||
                (select count(*) from jsonb_array_elements(
                   (al.payload->'equipes') || (excluded.payload->'equipes')) e
                  where (e->>'ecole_prouvee')::boolean) ||
                ' ecole(s) prouvee(s) par InstitutionId'
    returning (xmax = 0) as creee
  ),
  connues as (
    select t.id as team_id, s.rseq_team_id, s.team_name, t.division as div_connue
    from src s
    join public.teams t on t.rseq_team_id = s.rseq_team_id
  ),
  familles_connues as (
    select c.team_id, c.rseq_team_id, c.team_name,
           array_agg(distinct public.rseq_family_key(g.sector, g.sport, g.division)) as familles
    from connues c
    join public.games g
      on g.home_rseq_team_id = c.rseq_team_id
      or g.visitor_rseq_team_id = c.rseq_team_id
    where g.sector = p_secteur
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
       + (select count(*) from agrege where creee)
       + (select count(*) from derive)
       + (select count(*) from mapping)
  into v_n;

  return coalesce(v_n, 0);
end;
$function$;
drop function if exists public.rseq_proposition_equipe(uuid, uuid, text, uuid, text, text);
do $gate$
begin
  if md5(pg_get_functiondef('public.rseq_sync_detect_teams(uuid,uuid,text,text,text,jsonb)'::regprocedure)) <> 'cf4b292d46e689daeb31beef3962e181' then
    raise exception 'NEXUS: rseq_sync_detect_teams remise ≠ prod d''avant (md5 %)',
      md5(pg_get_functiondef('public.rseq_sync_detect_teams(uuid,uuid,text,text,text,jsonb)'::regprocedure));
  end if;
end $gate$;
commit;
