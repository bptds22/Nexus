-- ════════════════════════════════════════════════════════════════════════════
-- Non-régression prod après le chantier cégep (29 oct. 2026, prod = main 7dd4d73) — LECTURE SEULE.
-- UNE transaction, terminée par ROLLBACK. Un COMMIT est rendu impossible : une contrainte différée sur une
-- table temporaire lève une exception au moment du COMMIT (voir « Garde »). Lancer SANS -1, en postgres.
--
-- Comptes RÉELS de prod, un par rôle, choisis par requête (seuls des id tronqués sont affichés) : athlète du
-- secondaire, parent, coach (avec équipe), recruteur collégial, partenaire approuvé, admin, anonyme.
-- Chaque sonde bascule de rôle (authenticated + request.jwt.claims, ou anon) dans un bloc annulé (NX000).
--
-- « Attendu » d'une lecture = calcul DIRECT fait en postgres (sans RLS) :
--   • union des policies PERMISSIVES de la table qui existaient AVANT le chantier (celles créées par le
--     chantier sont exclues par leur nom), évaluée avec l'identité du compte ;
--   • moins ce que le chantier doit retirer, calculé à part : les universités (schools/teams) pour tout
--     non-admin, les cégépiens (athletes/team_athletes) pour un recruteur collégial, et 0 programme
--     universitaire (table née du chantier) pour tout non-admin.
-- Obtenu = ce que le compte lit réellement sous RLS.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-nonreg-prod-lecture-seule';
select now() as debut, current_user, current_setting('server_version') as version;

-- ── Garde : aucun COMMIT possible ────────────────────────────────────────────
create temp table _garde_commit (x int) on commit delete rows;
create function pg_temp.refuser_commit() returns trigger language plpgsql as $$
begin
  raise exception 'NEXUS: COMMIT interdit — ce test de non-régression est en lecture seule';
end $$;
create constraint trigger _garde_commit_t after insert on _garde_commit
  deferrable initially deferred for each row execute function pg_temp.refuser_commit();
insert into _garde_commit values (1);

do $$
begin
  if current_user <> 'postgres' then raise exception 'NEXUS: lancer en postgres, pas en %', current_user; end if;
  if exists (select 1 from pg_extension where extname in ('http', 'dblink')) then
    raise exception 'NEXUS: extension http/dblink présente : un appel synchrone pourrait sortir de la transaction';
  end if;
  if (select relpersistence::text || relkind::text from pg_class where oid = 'net.http_request_queue'::regclass) <> 'ur' then
    raise exception 'NEXUS: net.http_request_queue n''est plus une table ordinaire';
  end if;
end $$;

-- ── 1. Interrupteurs ─────────────────────────────────────────────────────────
select key, value from public.app_settings where key like 'lancement_%' order by key;

-- ── Comptes et cibles ────────────────────────────────────────────────────────
create temp table _c on commit drop as
select
  (select u.id from public.users u
     where u.role = 'ATHLETE' and u.status = 'ACTIF'
       and exists (select 1 from public.athletes a join public.schools s on s.id = a.school_id
                    join public.team_athletes ta on ta.athlete_id = a.id
                   where a.user_id = u.id and a.status = 'ACTIF' and s.type = 'SECONDAIRE')
     order by u.id limit 1) as u_athlete,
  (select u.id from public.users u
     where u.role = 'PARENT' and u.status = 'ACTIF'
       and exists (select 1 from public.parent_athletes pa where pa.parent_user_id = u.id)
     order by u.id limit 1) as u_parent,
  (select u.id from public.users u
     where u.role = 'COACH' and u.status = 'ACTIF' and u.context = 'scolaire'
       and exists (select 1 from public.team_coaches tc join public.teams t on t.id = tc.team_id
                    join public.schools s on s.id = t.school_id
                   where tc.coach_id = u.id and t.school_id = u.school_id and s.type = 'SECONDAIRE'
                     and exists (select 1 from public.team_athletes ta where ta.team_id = t.id))
     order by u.id limit 1) as u_coach,
  (select u.id from public.users u
     where u.role = 'RECRUTEUR' and u.status = 'ACTIF' and u.context = 'collegial'
     order by (select coalesce((select tier from public.subscriptions s where s.user_id = u.id and s.status = 'active'
                                 order by s.created_at desc limit 1), 'free') in ('pro', 'all_star')) desc, u.id
     limit 1) as u_recruteur,
  (select u.id from public.users u join public.media_partners mp on mp.user_id = u.id
     where u.role = 'PARTNER' and u.status = 'ACTIF' and mp.status = 'APPROVED'
     order by u.id limit 1) as u_partenaire,
  (select u.id from public.users u where u.role = 'ADMIN' and u.status = 'ACTIF' order by u.id limit 1) as u_admin,
  array(select s.id from public.schools s where s.type = 'UNIVERSITE') as univ,
  array(select t.id from public.teams t join public.schools s on s.id = t.school_id where s.type = 'UNIVERSITE') as univ_eq,
  array(select a.id from public.athletes a join public.schools s on s.id = a.school_id where s.type = 'CEGEP') as ceg;
alter table _c add column recruteur_pro boolean, add column eq_coach uuid, add column ta_coach_athlete uuid,
  add column ta_coach_sport uuid, add column a_athlete uuid, add column enfant uuid,
  add column cible_sec uuid, add column cible_foot uuid, add column cible_part uuid;
update _c set
  recruteur_pro = coalesce((select tier from public.subscriptions s where s.user_id = u_recruteur and s.status = 'active'
                             order by s.created_at desc limit 1), 'free') in ('pro', 'all_star'),
  eq_coach = (select t.id from public.team_coaches tc join public.teams t on t.id = tc.team_id
               join public.users u on u.id = tc.coach_id
              where tc.coach_id = u_coach and t.school_id = u.school_id
                and exists (select 1 from public.team_athletes ta where ta.team_id = t.id)
              order by t.id limit 1),
  a_athlete = (select a.id from public.athletes a where a.user_id = u_athlete),
  enfant = (select pa.athlete_id from public.parent_athletes pa where pa.parent_user_id = u_parent order by pa.athlete_id limit 1);
update _c set
  ta_coach_athlete = (select ta.athlete_id from public.team_athletes ta where ta.team_id = eq_coach order by ta.athlete_id limit 1),
  ta_coach_sport = (select ta.sport_id from public.team_athletes ta where ta.team_id = eq_coach order by ta.athlete_id limit 1);

-- Cibles du recruteur collégial : un athlète du secondaire HORS football (contactable) et un du secondaire EN
-- football, tous deux ACTIF, pas déjà dans ses favoris, sans conversation existante avec lui.
create temp table _cand on commit drop as
select a.id, (sp.nom ilike 'football%') as foot
  from public.athletes a join public.schools s on s.id = a.school_id left join public.sports sp on sp.id = a.sport_id
 where s.type = 'SECONDAIRE' and a.status = 'ACTIF' and coalesce(a.is_showcase, false) = false
   and not exists (select 1 from public.recruiter_favorites f where f.athlete_id = a.id and f.recruiter_id = (select u_recruteur from _c))
   and not exists (select 1 from public.conversations c where c.athlete_id = a.id and c.recruiter_id = (select u_recruteur from _c));
select set_config('request.jwt.claims', json_build_object('sub', (select u_recruteur from _c), 'role', 'authenticated')::text, true);
update _c set
  cible_sec = (select id from _cand where not foot and public.is_athlete_contactable(id) order by id limit 1),
  cible_foot = (select id from _cand where foot order by id limit 1),
  cible_part = (select a.id from public.athletes a join public.schools s on s.id = a.school_id
                 where s.type = 'SECONDAIRE' and a.status = 'ACTIF' and public.is_partner_eligible_athlete(a.id)
                 order by a.id limit 1);
select set_config('request.jwt.claims', '', true);

do $$ begin
  if exists (select 1 from _c where u_athlete is null or u_parent is null or u_coach is null or u_recruteur is null
               or u_partenaire is null or u_admin is null or eq_coach is null or ta_coach_athlete is null
               or enfant is null or cible_sec is null or cible_foot is null or cible_part is null) then
    raise exception 'NEXUS: un compte ou une cible manque';
  end if;
  if (select cardinality(ceg) from _c) = 0 then raise exception 'NEXUS: aucun cégépien en prod pour tester le masquage'; end if;
  if (select cardinality(univ) from _c) = 0 then raise exception 'NEXUS: aucune université en prod pour tester le masquage'; end if;
end $$;

create temp table _r on commit drop as
select * from (values
  ('athlète', 'authenticated', (select u_athlete from _c)),
  ('parent', 'authenticated', (select u_parent from _c)),
  ('coach', 'authenticated', (select u_coach from _c)),
  ('recruteur collégial', 'authenticated', (select u_recruteur from _c)),
  ('partenaire', 'authenticated', (select u_partenaire from _c)),
  ('admin', 'authenticated', (select u_admin from _c)),
  ('anonyme', 'anon', null::uuid)) v(role_lib, role_pg, uid);
select role_lib as role, left(uid::text, 8) as compte from _r;
select cardinality(univ) as universites, cardinality(univ_eq) as equipes_univ, cardinality(ceg) as cegepiens,
       recruteur_pro, left(eq_coach::text, 8) as equipe_coach, left(cible_sec::text, 8) as cible_secondaire,
       left(cible_foot::text, 8) as cible_football, left(cible_part::text, 8) as cible_partenaire from _c;

-- ── Calcul direct (postgres, sans RLS) ───────────────────────────────────────
create function pg_temp.union_pre(p_table text, p_anon boolean, p_filtre text default null) returns bigint
language plpgsql as $$
declare v text; n bigint;
begin
  select string_agg('(' || qual || ')', ' or ') into v
    from pg_policies
   where schemaname = 'public' and tablename = p_table and permissive = 'PERMISSIVE'
     and cmd in ('SELECT', 'ALL') and qual is not null
     and roles && (case when p_anon then array['public', 'anon'] else array['public', 'authenticated'] end)::name[]
     and policyname not in ('universites_lisibles_cegepiens', 'university_programs_read', 'university_programs_write');
  if v is null then return 0; end if;
  execute format('select count(*) from public.%I where (%s)%s', p_table, v,
                 case when p_filtre is null then '' else ' and (' || p_filtre || ')' end) into n;
  return n;
end $$;

create temp table _att (role_lib text, objet text, attendu bigint, explication text) on commit drop;
create function pg_temp.attendus() returns void language plpgsql as $$
declare r record; c record; anon boolean; recr boolean; adm boolean;
  f_ceg_a constant text := 'school_id in (select id from public.schools where type = ''CEGEP'')';
  f_ceg_ta constant text := 'athlete_id in (select a.id from public.athletes a join public.schools s on s.id = a.school_id where s.type = ''CEGEP'')';
  f_univ_s constant text := 'type = ''UNIVERSITE''';
  f_univ_t constant text := 'school_id in (select id from public.schools where type = ''UNIVERSITE'')';
begin
  select * into c from _c;
  for r in select * from _r loop
    anon := r.role_pg = 'anon';
    adm := r.uid = c.u_admin;
    recr := r.uid = c.u_recruteur;
    perform set_config('request.jwt.claims',
      case when anon then '{"role":"anon"}' else json_build_object('sub', r.uid, 'role', 'authenticated')::text end, true);
    insert into _att values
      (r.role_lib, 'athletes', pg_temp.union_pre('athletes', anon) - case when recr then pg_temp.union_pre('athletes', anon, f_ceg_a) else 0 end,
         case when recr then 'règles d''avant, moins les cégépiens' else 'règles d''avant' end),
      (r.role_lib, 'athletes cégépiens', case when adm then pg_temp.union_pre('athletes', anon, f_ceg_a) when recr then 0
                                              else pg_temp.union_pre('athletes', anon, f_ceg_a) end,
         case when recr then 'recruteur collégial : 0' else 'règles d''avant' end),
      (r.role_lib, 'team_athletes', pg_temp.union_pre('team_athletes', anon) - case when recr then pg_temp.union_pre('team_athletes', anon, f_ceg_ta) else 0 end,
         case when recr then 'règles d''avant, moins les cégépiens' else 'règles d''avant' end),
      (r.role_lib, 'schools', pg_temp.union_pre('schools', anon) - case when adm then 0 else pg_temp.union_pre('schools', anon, f_univ_s) end,
         case when adm then 'toutes' else 'toutes sauf les universités' end),
      (r.role_lib, 'schools universités', case when adm then pg_temp.union_pre('schools', anon, f_univ_s) else 0 end,
         case when adm then 'admin : toutes' else '0' end),
      (r.role_lib, 'teams', pg_temp.union_pre('teams', anon) - case when adm then 0 else pg_temp.union_pre('teams', anon, f_univ_t) end,
         case when adm then 'toutes' else 'règles d''avant, sans les équipes universitaires' end),
      (r.role_lib, 'teams universitaires', case when adm then pg_temp.union_pre('teams', anon, f_univ_t) else 0 end,
         case when adm then 'admin : toutes' else '0' end),
      (r.role_lib, 'university_programs', case when adm then (select count(*) from public.university_programs) else 0 end,
         case when adm then 'admin : tous' else '0 (table du chantier)' end),
      (r.role_lib, 'conversations', pg_temp.union_pre('conversations', anon), 'règles d''avant (inchangées)'),
      (r.role_lib, 'messages', pg_temp.union_pre('messages', anon), 'règles d''avant (inchangées)'),
      (r.role_lib, 'recruiter_favorites', pg_temp.union_pre('recruiter_favorites', anon), 'règles d''avant (inchangées)'),
      (r.role_lib, 'recruiter_pipeline', pg_temp.union_pre('recruiter_pipeline', anon), 'règles d''avant (inchangées)'),
      (r.role_lib, 'athlete_notifications', pg_temp.union_pre('athlete_notifications', anon), 'règles d''avant (inchangées)'),
      (r.role_lib, 'parent_notifications', pg_temp.union_pre('parent_notifications', anon), 'règles d''avant (inchangées)'),
      (r.role_lib, 'parent_athletes', pg_temp.union_pre('parent_athletes', anon), 'règles d''avant (inchangées)');
  end loop;
  perform set_config('request.jwt.claims', '', true);
end $$;
select pg_temp.attendus();

-- Calcul MÉTIER indépendant des policies : un recruteur collégial voit les fiches ACTIF, sauf les cégépiens.
insert into _att
select 'recruteur collégial', 'athletes (règle métier)',
       (select count(*) from public.athletes a left join public.schools s on s.id = a.school_id
         where a.status = 'ACTIF' and coalesce(s.type, '') <> 'CEGEP'),
       'fiches ACTIF moins les cégépiens (sans passer par les policies)';

-- ── Sondes de lecture (sous le rôle du compte, bloc annulé) ──────────────────
create function pg_temp.sonde(p_role text, p_uid uuid, p_univ uuid[], p_univ_eq uuid[], p_ceg uuid[],
                              p_rpc text[][]) returns jsonb language plpgsql as $$
declare v jsonb; i int; n bigint; m bigint;
  p_lect constant text[][] := array[
    ['athletes', 'select count(*) from public.athletes'],
    ['athletes cégépiens', 'select count(*) from public.athletes where id = any($3)'],
    ['team_athletes', 'select count(*) from public.team_athletes'],
    ['schools', 'select count(*) from public.schools'],
    ['schools universités', 'select count(*) from public.schools where id = any($1)'],
    ['teams', 'select count(*) from public.teams'],
    ['teams universitaires', 'select count(*) from public.teams where id = any($2)'],
    ['university_programs', 'select count(*) from public.university_programs'],
    ['conversations', 'select count(*) from public.conversations'],
    ['messages', 'select count(*) from public.messages'],
    ['recruiter_favorites', 'select count(*) from public.recruiter_favorites'],
    ['recruiter_pipeline', 'select count(*) from public.recruiter_pipeline'],
    ['athlete_notifications', 'select count(*) from public.athlete_notifications'],
    ['parent_notifications', 'select count(*) from public.parent_notifications'],
    ['parent_athletes', 'select count(*) from public.parent_athletes']];
begin
  begin
    if p_role = 'anon' then
      perform set_config('request.jwt.claims', '{"role":"anon"}', true);
      perform set_config('role', 'anon', true);
    else
      perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
    end if;
    -- Lectures de tables : chacune dans son bloc (un refus de droit compte comme « rien de lisible »).
    v := '{}'::jsonb;
    for i in 1 .. array_length(p_lect, 1) loop
      begin
        execute p_lect[i][2] into n using p_univ, p_univ_eq, p_ceg;
        v := v || jsonb_build_object(p_lect[i][1], n::text);
      exception when others then
        v := v || jsonb_build_object(p_lect[i][1], 'refusé ' || sqlstate);
      end;
    end loop;
    -- Fonctions (RPC) utilisées par le web : chaque appel dans son propre bloc ; « total|cégépiens-ou-universités ».
    for i in 1 .. coalesce(array_length(p_rpc, 1), 0) loop
      begin
        execute p_rpc[i][2] into n, m using p_univ, p_univ_eq, p_ceg;
        v := v || jsonb_build_object('rpc ' || p_rpc[i][1], n::text || '|' || coalesce(m::text, '·'));
      exception when others then
        v := v || jsonb_build_object('rpc ' || p_rpc[i][1], 'ERREUR ' || sqlstate);
      end;
    end loop;
    raise exception using errcode = 'NX000', message = v::text;
  exception
    when sqlstate 'NX000' then return sqlerrm::jsonb;
    when others then return jsonb_build_object('erreur sonde', sqlstate || ' ' || left(sqlerrm, 80));
  end;
end $$;

create temp table _rpc (role_lib text, libelle text, sql text) on commit drop;
insert into _rpc values
  ('recruteur collégial', 'recruiter_search_athletes', 'select count(*), count(*) filter (where id = any($3)) from public.recruiter_search_athletes(p_limit => 1000)'),
  ('recruteur collégial', 'athletes_par_ids(cégépiens)', 'select count(*), null::bigint from public.athletes_par_ids($3)'),
  ('recruteur collégial', 'recruiter_athlete_cards(cégépiens)', 'select count(*), null::bigint from public.recruiter_athlete_cards($3)'),
  ('recruteur collégial', 'schools_par_ids(universités)', 'select count(*), null::bigint from public.schools_par_ids($1)'),
  ('recruteur collégial', 'teams_par_ids(équipes univ.)', 'select count(*), null::bigint from public.teams_par_ids($2)'),
  ('coach', 'get_coach_athletes', 'select count(*), count(*) filter (where athlete_id = any($3)) from public.get_coach_athletes(false)'),
  ('coach', 'schools_par_ids(universités)', 'select count(*), null::bigint from public.schools_par_ids($1)'),
  ('athlète', 'schools_par_ids(universités)', 'select count(*), null::bigint from public.schools_par_ids($1)'),
  ('athlète', 'teams_par_ids(équipes univ.)', 'select count(*), null::bigint from public.teams_par_ids($2)'),
  ('athlète', 'mes_criteres_parcours', 'select count(*), null::bigint from (select public.mes_criteres_parcours() j) x where j is not null'),
  ('parent', 'get_my_children', 'select count(*), count(*) filter (where athlete_id = any($3)) from public.get_my_children()'),
  ('parent', 'schools_par_ids(universités)', 'select count(*), null::bigint from public.schools_par_ids($1)'),
  ('partenaire', 'partner_newsroom_events', 'select count(*), count(*) filter (where athlete_id = any($3)) from public.partner_newsroom_events(p_limit => 1000)'),
  ('partenaire', 'partner_athlete_profile(cégépien)', 'select count(*), null::bigint from public.partner_athlete_profile(($3)[1])'),
  ('partenaire', 'schools_par_ids(universités)', 'select count(*), null::bigint from public.schools_par_ids($1)'),
  ('admin', 'schools_par_ids(universités)', 'select count(*), null::bigint from public.schools_par_ids($1)'),
  ('admin', 'athletes_par_ids(cégépiens)', 'select count(*), null::bigint from public.athletes_par_ids($3)'),
  ('anonyme', 'schools_par_ids(universités)', 'select count(*), null::bigint from public.schools_par_ids($1)'),
  ('anonyme', 'teams_par_ids(équipes univ.)', 'select count(*), null::bigint from public.teams_par_ids($2)'),
  ('anonyme', 'athletes_par_ids(cégépiens)', 'select count(*), null::bigint from public.athletes_par_ids($3)');

create temp table _obt on commit drop as
select r.role_lib, pg_temp.sonde(r.role_pg, r.uid, c.univ, c.univ_eq, c.ceg,
         coalesce((select array_agg(array[p.libelle, p.sql] order by p.libelle) from _rpc p where p.role_lib = r.role_lib),
                  array[]::text[][])) as obtenu
  from _r r, _c c;

create temp table _lect on commit drop as
select a.role_lib, a.objet, a.attendu::text as attendu,
       coalesce(o.obtenu ->> a.objet, o.obtenu ->> replace(a.objet, ' (règle métier)', ''), o.obtenu ->> 'erreur sonde') as obtenu, a.explication
  from _att a join _obt o using (role_lib);

-- Attendus des fonctions : 0 cégépien et 0 université hors admin et partenaire ; parent = ses liens.
insert into _lect
select o.role_lib, k, case
         when o.role_lib = 'admin' and k = 'rpc schools_par_ids(universités)' then (select cardinality(univ) from _c)::text || '|·'
         when o.role_lib = 'admin' and k = 'rpc athletes_par_ids(cégépiens)' then (select cardinality(ceg) from _c)::text || '|·'
         when o.role_lib = 'parent' and k = 'rpc get_my_children' then
           (select count(*) from public.parent_athletes where parent_user_id = (select u_parent from _c))::text || '|0'
         when k = 'rpc athlete mes_criteres_parcours' or k = 'rpc mes_criteres_parcours' then '1|·'
         when k in ('rpc recruiter_search_athletes', 'rpc get_coach_athletes', 'rpc partner_newsroom_events') then '*|0'
         when o.role_lib = 'partenaire' and k = 'rpc partner_athlete_profile(cégépien)' then '*'
         else '0|·' end,
       o.obtenu ->> k,
       case when k = 'rpc partner_athlete_profile(cégépien)' then 'rapporté (le partenaire peut voir les cégépiens, lot A)'
            when k like 'rpc %' and o.obtenu ->> k like '%|%' and k in ('rpc recruiter_search_athletes', 'rpc get_coach_athletes', 'rpc partner_newsroom_events')
              then 'total libre, 0 cégépien' else 'fonction' end
  from _obt o, jsonb_object_keys(o.obtenu) k
 where k like 'rpc %';

select role_lib as role, objet, attendu, obtenu,
       case when attendu = obtenu then 'ok'
            when attendu = '0' and obtenu like 'refusé%' then 'ok (refusé)'
            when attendu = '0|·' and obtenu = 'ERREUR 42501' then 'ok (refusé)'
            when attendu = '*' then 'rapporté'
            when attendu like '*|%' and split_part(obtenu, '|', 2) = split_part(attendu, '|', 2) then 'ok'
            else 'ÉCART' end as "?", explication
  from _lect
 order by array_position(array['athlète','parent','coach','recruteur collégial','partenaire','admin','anonyme'], role_lib), objet;

-- ── 4. Écritures (chacune annulée aussitôt, NX000) ───────────────────────────
create function pg_temp.essai(p_role text, p_uid uuid, p_quoi text, p_a uuid, p_b uuid, p_c uuid) returns text
language plpgsql as $$
declare n int; v_conv uuid; v text;
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    perform set_config('role', p_role, true);
    if p_quoi = 'athlète modifie son profil' then
      update public.athletes set bio = bio where user_id = p_uid;
      get diagnostics n = row_count; v := 'lignes ' || n;
    elsif p_quoi = 'coach modifie son équipe' then
      update public.teams set name = name where id = p_a;
      get diagnostics n = row_count; v := 'lignes ' || n;
    elsif p_quoi = 'coach retire puis remet un athlète' then
      delete from public.team_athletes where team_id = p_a and athlete_id = p_b;
      get diagnostics n = row_count; v := 'retiré ' || n;
      insert into public.team_athletes (team_id, athlete_id, sport_id) values (p_a, p_b, p_c);
      get diagnostics n = row_count; v := v || ', remis ' || n;
    elsif p_quoi in ('favori + message, secondaire hors football', 'favori + message, secondaire football') then
      insert into public.recruiter_favorites (recruiter_id, athlete_id) values (p_uid, p_a);
      v := 'favori ok';
      begin
        insert into public.conversations (conversation_type, recruiter_id, athlete_id)
        values ('RECRUTEUR_ATHLETE', p_uid, p_a) returning id into v_conv;
        v := v || ', conversation acceptée';
        begin
          insert into public.messages (conversation_id, sender_id, content) values (v_conv, p_uid, 'essai non-régression (annulé)');
          v := v || ', message accepté';
        exception when others then v := v || ', message refusé ' || sqlstate;
        end;
      exception when others then v := v || ', conversation refusée ' || sqlstate;
      end;
    elsif p_quoi = 'favori sur un cégépien' then
      insert into public.recruiter_favorites (recruiter_id, athlete_id) values (p_uid, p_a);
      v := 'accepté';
    elsif p_quoi = 'conversation avec un cégépien' then
      insert into public.conversations (conversation_type, recruiter_id, athlete_id) values ('RECRUTEUR_ATHLETE', p_uid, p_a);
      v := 'acceptée';
    elsif p_quoi = 'parent lit son enfant' then
      v := 'activité ' || (public.get_child_activity(p_a) is not null)::text;
    elsif p_quoi = 'partenaire lit une fiche du secondaire' then
      select count(*) into n from public.partner_athlete_profile(p_a); v := 'lignes ' || n;
    end if;
    raise exception using errcode = 'NX000', message = v;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'refusé ' || sqlstate;
  end;
end $$;

create temp table _avant_ecr on commit drop as
select (select count(*) from net.http_request_queue) as http, (select count(*) from public.push_file) as push;

create temp table _e (o int, role text, geste text, attendu text, obtenu text) on commit drop;
insert into _e
select 1, 'athlète', 'athlète modifie son profil', 'lignes 1',
       pg_temp.essai('authenticated', u_athlete, 'athlète modifie son profil', null, null, null) from _c
union all
select 2, 'coach', 'coach modifie son équipe', 'lignes 1',
       pg_temp.essai('authenticated', u_coach, 'coach modifie son équipe', eq_coach, null, null) from _c
union all
select 3, 'coach', 'coach retire puis remet un athlète', 'retiré 1, remis 1',
       pg_temp.essai('authenticated', u_coach, 'coach retire puis remet un athlète', eq_coach, ta_coach_athlete, ta_coach_sport) from _c
union all
select 4, 'recruteur collégial', 'favori + message, secondaire hors football',
       'favori ok, conversation acceptée, ' || case when recruteur_pro then 'message accepté' else 'message refusé 42501' end,
       pg_temp.essai('authenticated', u_recruteur, 'favori + message, secondaire hors football', cible_sec, null, null) from _c
union all
select 5, 'recruteur collégial', 'favori + message, secondaire football', 'favori ok, conversation refusée 23514',
       pg_temp.essai('authenticated', u_recruteur, 'favori + message, secondaire football', cible_foot, null, null) from _c
union all
select 6, 'recruteur collégial', 'favori sur un cégépien', 'refusé 42501',
       pg_temp.essai('authenticated', u_recruteur, 'favori sur un cégépien', ceg[1], null, null) from _c
union all
select 7, 'recruteur collégial', 'conversation avec un cégépien', 'refusé 42501',
       pg_temp.essai('authenticated', u_recruteur, 'conversation avec un cégépien', ceg[1], null, null) from _c
union all
select 8, 'parent', 'parent lit son enfant', 'activité true',
       pg_temp.essai('authenticated', u_parent, 'parent lit son enfant', enfant, null, null) from _c
union all
select 9, 'partenaire', 'partenaire lit une fiche du secondaire', 'lignes 1',
       pg_temp.essai('authenticated', u_partenaire, 'partenaire lit une fiche du secondaire', cible_part, null, null) from _c;
select o, role, geste, attendu, obtenu, case when obtenu = attendu then 'ok' else 'ÉCART' end as "?" from _e order by o;

-- Coachs qui écrivent encore leurs équipes : TOUS les coachs liés à une équipe de leur école.
create temp table _coachs on commit drop as
select distinct on (tc.coach_id) tc.coach_id, t.id as equipe
  from public.team_coaches tc join public.teams t on t.id = tc.team_id join public.users u on u.id = tc.coach_id
 where u.role = 'COACH' and t.school_id = u.school_id
 order by tc.coach_id, t.id;
select count(*) as coachs_testes,
       count(*) filter (where pg_temp.essai('authenticated', coach_id, 'coach modifie son équipe', equipe, null, null) = 'lignes 1') as ecrivent_leur_equipe
  from _coachs;

-- Ce que les déclencheurs ont mis en file pendant les écritures : tout disparaît avec le ROLLBACK
-- (net.http_request_queue est une table ordinaire ; pg_net ne lit que les lignes validées).
select (select count(*) from net.http_request_queue) - http as requetes_http_en_file_annulees,
       (select count(*) from public.push_file) - push as push_en_file_annules
  from _avant_ecr;

-- ── 5. Black-out du secondaire inchangé ──────────────────────────────────────
create temp table _bo on commit drop as
select a.id, (s.type is not distinct from 'CEGEP') as cegepien,
       (select b.id from public.blackout_periods b
         where b.actif and coalesce(a.is_showcase, false) = false
           and (now() at time zone 'America/Montreal')::date between b.date_debut and b.date_fin
           and (b.sport_id is null or a.sport_id is null or a.sport_id = b.sport_id)
           and ((b.promo_min is null and b.promo_max is null) or a.annee_diplomation is null
                or ((b.promo_min is null or a.annee_diplomation >= b.promo_min)
                    and (b.promo_max is null or a.annee_diplomation <= b.promo_max)))
         order by b.date_fin desc, b.date_debut asc limit 1) as ancienne_regle,
       (select g.id from public.get_active_blackout(a.id) g) as un_argument,
       (select g.id from public.get_active_blackout(a.id, (select u_recruteur from _c)) g) as avec_recruteur_collegial
  from public.athletes a left join public.schools s on s.id = a.school_id;
select cegepien, count(*) as fiches,
       count(*) filter (where ancienne_regle is not null) as sous_black_out_ancienne_regle,
       count(*) filter (where un_argument is distinct from ancienne_regle) as ecarts_1_argument,
       count(*) filter (where avec_recruteur_collegial is distinct from ancienne_regle) as ecarts_recruteur_collegial
  from _bo group by cegepien order by cegepien;

-- ── Verdict ──────────────────────────────────────────────────────────────────
do $$
declare n int;
begin
  if exists (select 1 from public.app_settings where key in ('lancement_collegial', 'lancement_universitaire', 'lancement_civil')
               and value::text not in ('false', '"false"')) then
    raise notice 'NEXUS: ÉCART — un interrupteur n''est pas à OFF';
  end if;
  select count(*) into n from _lect
   where not (attendu = obtenu or attendu = '*' or (attendu = '0' and obtenu like 'refusé%')
              or (attendu = '0|·' and obtenu = 'ERREUR 42501')
              or (attendu like '*|%' and split_part(obtenu, '|', 2) = split_part(attendu, '|', 2)));
  raise notice 'NEXUS: lectures hors attendu : %', n;
  select count(*) into n from _e where obtenu <> attendu;
  raise notice 'NEXUS: écritures hors attendu : %', n;
  select count(*) into n from _bo where not cegepien
    and (un_argument is distinct from ancienne_regle or avec_recruteur_collegial is distinct from ancienne_regle);
  raise notice 'NEXUS: black-out, fiches non cégépiennes en écart : %', n;
end $$;

rollback;
\echo '== ROLLBACK fait : rien n''est écrit en prod.'
