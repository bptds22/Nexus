-- Veille RSEQ, correctif de découverte — 4/4 : les nouvelles équipes de la saison sont PROPOSÉES en alerte,
-- (APPLIQUÉE en prod le 2026-10-08 sous cette version, GO BP — fichier renommé depuis sa version locale 2026100821x00)
-- puis créées sur décision d'un admin. Jamais de création automatique (CLAUDE.md § « Pont RSEQ »).
-- (LOCAL — non appliquée en prod ; plan § 5, décision BP 2026-10-08.)
--
-- 1. rseq_proposition_equipe(...) : ce que les lots de l'audit calculaient, pour UNE équipe RSEQ — école par
--    InstitutionId (type SECONDAIRE ou CEGEP selon le secteur, exactement une école), sport Nexus, catégorie,
--    division, sexe normalisé, dédoublonnage (rseq_team_id, puis école + sport + catégorie + division + SEXE +
--    saison — le sexe ajouté sur décision BP du 2026-10-08 : sans lui, une équipe féminine était prise pour
--    le doublon de la masculine, 17 faux doublons sur 19 au collégial), côtés de match à relier, décision.
--    Lecture seule.
-- 2. rseq_sync_detect_teams : corps IDENTIQUE à la prod (md5 cf4b292d…), plus une clé « proposition » dans
--    chaque équipe des alertes NOUVELLES_EQUIPES (secondaire) et dans le payload NOUVELLE_EQUIPE (collégial).
--    Aucune écriture dans teams.
-- 3. rseq_creer_equipes_proposees(alertes) : SECURITY DEFINER, is_admin() seulement. Recalcule la proposition
--    AU MOMENT DE CRÉER (jamais celle, figée, du payload), crée les équipes « a_creer », relie les côtés de
--    match NULL par rseq_team_id, une ligne admin_operations EQUIPES_RSEQ_CREEES. Mêmes gardes que les lots :
--    nombres exacts (équipes créées = éligibles, côtés reliés = côtés relevés), sinon RIEN. Ne crée aucune école.
--    Les refus (école introuvable, doublon, sport absent) restent dans l'alerte, qui reste OUVERTE.

create or replace function public.rseq_proposition_equipe(
  p_rseq_team_id uuid, p_institution uuid, p_team_name text, p_league_id uuid, p_saison text, p_secteur text)
returns jsonb
language plpgsql
stable
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_sport text; v_cat text; v_div text; v_sexe text; v_ligue text;
  v_sport_nexus text; v_sport_id uuid;
  v_n_ecoles int; v_ecole uuid; v_ecole_nom text;
  v_age text; v_gender text; v_league text;
  v_deja uuid; v_doublon uuid; v_doublon_nom text; v_cotes int; v_decision text;
begin
  select l.sport, l.category, l.division, l.sex_type, l.league_name
    into v_sport, v_cat, v_div, v_sexe, v_ligue
    from public.rseq_ligues_a_appeler l where l.rseq_league_id = p_league_id limit 1;
  if v_sport is null then
    select g.sport, g.category, g.division, g.sex_type, g.league_name
      into v_sport, v_cat, v_div, v_sexe, v_ligue
      from public.games g where g.rseq_league_id = p_league_id limit 1;
  end if;

  v_sport_nexus := case v_sport when 'Ultimate' then 'Ultimate frisbee' else v_sport end;
  select s.id into v_sport_id from public.sports s where s.nom = v_sport_nexus;

  select count(*), min(sc.id::text)::uuid, min(sc.name) into v_n_ecoles, v_ecole, v_ecole_nom
    from public.schools sc
   where p_institution is not null and sc.rseq_institution_id = p_institution
     and sc.type = case p_secteur when 'Collégial' then 'CEGEP' else 'SECONDAIRE' end;
  if v_n_ecoles <> 1 then v_ecole := null; v_ecole_nom := null; end if;

  v_gender := case v_sexe when 'Garçons' then 'Masculin' when 'Filles' then 'Féminin' else nullif(v_sexe, '') end;
  v_age    := case when p_secteur = 'Collégial' then null else nullif(v_cat, '') end;
  v_div    := nullif(v_div, '');
  v_league := case when p_secteur = 'Collégial' and v_ligue is not null then v_ligue || ' (' || p_saison || ')' end;

  select t.id into v_deja from public.teams t where t.rseq_team_id = p_rseq_team_id;
  if v_ecole is not null and v_sport_id is not null then
    select t.id, t.name into v_doublon, v_doublon_nom
      from public.teams t
     where t.school_id = v_ecole and t.sport_id = v_sport_id and t.season = p_saison
       and coalesce(t.age_group, '') = coalesce(v_age, '')
       and regexp_replace(lower(coalesce(t.division, '')), '^division\s*', 'd')
         = regexp_replace(lower(coalesce(v_div, '')), '^division\s*', 'd')
       and coalesce(t.gender, '') = coalesce(v_gender, '')
     order by t.created_at limit 1;
  end if;
  select (select count(*) from public.games where home_team_id is null and home_rseq_team_id = p_rseq_team_id)
       + (select count(*) from public.games where visitor_team_id is null and visitor_rseq_team_id = p_rseq_team_id)
    into v_cotes;

  v_decision := case
    when v_deja is not null    then 'deja_en_base'
    when v_sport_id is null    then 'sport_absent'
    when v_ecole is null       then 'ecole_introuvable'
    when v_doublon is not null then 'doublon'
    else 'a_creer' end;

  return jsonb_build_object(
    'decision', v_decision, 'rseq_team_id', p_rseq_team_id, 'nom', p_team_name, 'saison', p_saison,
    'secteur', p_secteur, 'school_id', v_ecole, 'ecole', v_ecole_nom, 'ecoles_candidates', v_n_ecoles,
    'sport', v_sport_nexus, 'sport_id', v_sport_id, 'age_group', v_age, 'division', v_div, 'gender', v_gender,
    'league', v_league, 'equipe_existante', v_deja, 'doublon_team_id', v_doublon, 'doublon_nom', v_doublon_nom,
    'cotes_a_relier', v_cotes,
    'confiance', case when v_ecole is not null then 'haute (InstitutionId)' else 'introuvable' end);
end;
$function$;

revoke all on function public.rseq_proposition_equipe(uuid, uuid, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.rseq_proposition_equipe(uuid, uuid, text, uuid, text, text) to service_role;

-- 2. rseq_sync_detect_teams : corps prod + « proposition ». Seules deux expressions changent (marquées ⟵).
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
        'family_key', p_family_key, 'saison', p_saison,
        'proposition', public.rseq_proposition_equipe(s.rseq_team_id, s.rseq_institution_id, s.team_name, p_league_id, p_saison, p_secteur)  -- ⟵
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
        'family_key', p_family_key,
        'proposition', public.rseq_proposition_equipe(s.rseq_team_id, s.rseq_institution_id, s.team_name, p_league_id, p_saison, p_secteur)  -- ⟵
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

-- 3. Création sur décision d'un admin.
create or replace function public.rseq_creer_equipes_proposees(p_alerte_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := auth.uid();
  v_cand jsonb; v_elig jsonb; v_refus jsonb;
  n_alertes int; n_att int; n_ins int; n_h0 int; n_v0 int; n_h int; n_v int; n_ops0 int; n_ops1 int;
begin
  if not public.is_admin() then
    raise exception 'NEXUS: rseq_creer_equipes_proposees est réservée aux administrateurs' using errcode = '42501';
  end if;
  if p_alerte_ids is null or cardinality(p_alerte_ids) = 0 then
    raise exception 'NEXUS: aucune alerte demandée';
  end if;
  select count(*) into n_alertes from public.rseq_sync_alerts
   where id = any(p_alerte_ids) and statut = 'OUVERTE' and type in ('NOUVELLES_EQUIPES', 'NOUVELLE_EQUIPE');
  if n_alertes <> (select count(distinct x) from unnest(p_alerte_ids) x) then
    raise exception 'NEXUS: alerte absente, déjà traitée ou d''un autre type';
  end if;

  -- Candidates, proposition RECALCULÉE maintenant.
  with brut as (
    select a.id as alerte_id, (e->>'rseq_team_id')::uuid as rid,
           nullif(e->>'rseq_institution_id', '')::uuid as inst, e->>'team_name' as nom,
           (e->>'rseq_league_id')::uuid as ligue, a.payload->>'saison' as saison,
           coalesce(a.payload->>'secteur', 'Secondaire') as secteur
      from public.rseq_sync_alerts a, jsonb_array_elements(a.payload->'equipes') e
     where a.id = any(p_alerte_ids) and a.type = 'NOUVELLES_EQUIPES'
    union all
    select a.id, a.rseq_team_id, a.rseq_institution_id, a.payload->>'team_name', a.rseq_league_id,
           a.payload->>'saison', 'Collégial'
      from public.rseq_sync_alerts a
     where a.id = any(p_alerte_ids) and a.type = 'NOUVELLE_EQUIPE'
  ), une as (
    select distinct on (rid) * from brut where rid is not null order by rid, alerte_id
  )
  select coalesce(jsonb_agg(jsonb_build_object('alerte_id', u.alerte_id,
           'p', public.rseq_proposition_equipe(u.rid, u.inst, u.nom, u.ligue, u.saison, u.secteur))), '[]'::jsonb)
    into v_cand from une u;

  select coalesce(jsonb_agg(c), '[]'::jsonb) into v_elig
    from jsonb_array_elements(v_cand) c where c->'p'->>'decision' = 'a_creer';
  select coalesce(jsonb_agg(jsonb_build_object('alerte_id', c->'alerte_id', 'rseq_team_id', c->'p'->'rseq_team_id',
           'nom', c->'p'->'nom', 'decision', c->'p'->'decision', 'doublon_team_id', c->'p'->'doublon_team_id')), '[]'::jsonb)
    into v_refus
    from jsonb_array_elements(v_cand) c where c->'p'->>'decision' not in ('a_creer', 'deja_en_base');
  n_att := jsonb_array_length(v_elig);

  select count(*) into n_h0 from public.games g
   where g.home_team_id is null and g.home_rseq_team_id in (select (c->'p'->>'rseq_team_id')::uuid from jsonb_array_elements(v_elig) c);
  select count(*) into n_v0 from public.games g
   where g.visitor_team_id is null and g.visitor_rseq_team_id in (select (c->'p'->>'rseq_team_id')::uuid from jsonb_array_elements(v_elig) c);
  select count(*) into n_ops0 from public.admin_operations;

  insert into public.teams (school_id, sport_id, name, age_group, division, gender, season, league, rseq_team_id)
  select (c->'p'->>'school_id')::uuid, (c->'p'->>'sport_id')::uuid, c->'p'->>'nom', c->'p'->>'age_group',
         c->'p'->>'division', c->'p'->>'gender', c->'p'->>'saison', c->'p'->>'league', (c->'p'->>'rseq_team_id')::uuid
    from jsonb_array_elements(v_elig) c;
  get diagnostics n_ins = row_count;

  update public.games g set home_team_id = t.id
    from public.teams t
   where t.rseq_team_id in (select (c->'p'->>'rseq_team_id')::uuid from jsonb_array_elements(v_elig) c)
     and g.home_rseq_team_id = t.rseq_team_id and g.home_team_id is null;
  get diagnostics n_h = row_count;
  update public.games g set visitor_team_id = t.id
    from public.teams t
   where t.rseq_team_id in (select (c->'p'->>'rseq_team_id')::uuid from jsonb_array_elements(v_elig) c)
     and g.visitor_rseq_team_id = t.rseq_team_id and g.visitor_team_id is null;
  get diagnostics n_v = row_count;

  insert into public.admin_operations (operation, motif, details, par)
  values ('EQUIPES_RSEQ_CREEES', 'Équipes RSEQ créées sur proposition de la veille, décision d''un admin',
          jsonb_build_object('alertes', to_jsonb(p_alerte_ids), 'equipes', n_ins, 'cotes_domicile', n_h,
                             'cotes_visiteur', n_v, 'refusees', v_refus,
                             'rseq_team_ids', (select jsonb_agg(c->'p'->'rseq_team_id') from jsonb_array_elements(v_elig) c)),
          v_uid);
  select count(*) into n_ops1 from public.admin_operations;

  if n_ins <> n_att or n_h <> n_h0 or n_v <> n_v0 or n_ops1 - n_ops0 <> 1 then
    raise exception 'NEXUS: garde échouée (équipes %/%, domicile %/%, visiteur %/%, ops +%) — rien écrit',
      n_ins, n_att, n_h, n_h0, n_v, n_v0, n_ops1 - n_ops0;
  end if;

  -- Une alerte n'est traitée que si plus rien n'y reste à trancher.
  update public.rseq_sync_alerts a
     set statut = 'TRAITEE', traite_le = now(), traite_par = v_uid,
         note = 'Équipes créées sur proposition (rseq_creer_equipes_proposees)'
   where a.id = any(p_alerte_ids)
     and not exists (select 1 from jsonb_array_elements(v_refus) r where (r->>'alerte_id')::uuid = a.id);
  update public.rseq_sync_alerts a
     set note = 'À trancher par BP : ' || (select string_agg((r->>'nom') || ' (' || (r->>'decision') || ')', ', ')
                                             from jsonb_array_elements(v_refus) r where (r->>'alerte_id')::uuid = a.id)
   where a.id = any(p_alerte_ids)
     and exists (select 1 from jsonb_array_elements(v_refus) r where (r->>'alerte_id')::uuid = a.id);

  return jsonb_build_object('equipes_creees', n_ins, 'cotes_domicile', n_h, 'cotes_visiteur', n_v, 'refusees', v_refus);
end;
$function$;

revoke all on function public.rseq_creer_equipes_proposees(uuid[]) from public, anon, authenticated;
grant execute on function public.rseq_creer_equipes_proposees(uuid[]) to authenticated, service_role;

-- Gates : ACL des trois fonctions en liste COMPLÈTE triée.
do $gate$
declare f regprocedure; veut text[]; vus text[];
begin
  for f, veut in select * from (values
    ('public.rseq_proposition_equipe(uuid,uuid,text,uuid,text,text)'::regprocedure, array['postgres', 'service_role']),
    ('public.rseq_sync_detect_teams(uuid,uuid,text,text,text,jsonb)'::regprocedure, array['postgres', 'service_role']),
    ('public.rseq_creer_equipes_proposees(uuid[])'::regprocedure, array['authenticated', 'postgres', 'service_role'])) v
  loop
    select array_agg(g order by g) into vus
      from (select distinct coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
              from unnest((select proacl from pg_proc where oid = f)::text[]) x) t;
    if vus is distinct from veut then
      raise exception 'NEXUS: ACL % = %, attendu %', f, vus, veut;
    end if;
  end loop;
  if not (select prosecdef from pg_proc where oid = 'public.rseq_creer_equipes_proposees(uuid[])'::regprocedure) then
    raise exception 'NEXUS: rseq_creer_equipes_proposees doit être SECURITY DEFINER';
  end if;
end $gate$;
