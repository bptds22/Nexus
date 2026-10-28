-- Relecture prod du lot D1a (après l'apply). Lecture de l'état, puis matrice par rôle avec une université
-- témoin créée DANS la transaction et défaite (ROLLBACK) : rien n'est écrit.
\set ON_ERROR_STOP 1
\pset null '·'
begin;
set local statement_timeout = '60s';

select (select count(*) from supabase_migrations.schema_migrations where version = '20261028010000') as d1a_inscrit,
       (select max(version) from supabase_migrations.schema_migrations) as derniere_version,
       (select count(*) from pg_policies where policyname = 'universites_masquees' and permissive = 'RESTRICTIVE') as policies_restrictives,
       (select count(*) from pg_proc where proname = 'ids_universites' and pronamespace = 'public'::regnamespace) as fonction,
       (select count(*) from public.admin_operations where operation = 'MIGRATION_CEGEP_LOT_D1A_MASQUAGE') as trace_admin,
       (select count(*) from public.schools where type = 'UNIVERSITE') as universites,
       (select count(*) from public.schools) as ecoles,
       (select count(*) from public.teams) as equipes;

create temp table _t on commit drop as
select (select u.id from public.users u join public.athletes a on a.user_id = u.id where u.role = 'ATHLETE'::public.user_role order by u.id limit 1) as u_ath,
       (select u.id from public.users u where u.role = 'COACH'::public.user_role and u.school_id is not null order by u.id limit 1) as u_coach,
       (select u.id from public.users u where u.role = 'RECRUTEUR'::public.user_role and u.onboarding_complete order by u.id limit 1) as u_rec,
       (select u.id from public.users u where u.role = 'PARTNER'::public.user_role order by u.id limit 1) as u_part,
       (select u.id from public.users u where u.role = 'PARENT'::public.user_role order by u.id limit 1) as u_par,
       (select u.id from public.users u where u.role = 'ADMIN'::public.user_role order by u.id limit 1) as u_adm,
       (select t.sport_id from public.teams t order by t.id limit 1) as sport;
insert into public.schools (id, name, type, city)
  values ('00000000-0000-4000-8000-00000000d1a1', 'Université témoin relecture', 'UNIVERSITE', 'Québec');
insert into public.teams (id, school_id, sport_id, name, season, age_group)
  select '00000000-0000-4000-8000-00000000d1a2', '00000000-0000-4000-8000-00000000d1a1', sport, 'Équipe témoin relecture', '2026-2027', 'Universitaire' from _t;

create function pg_temp.compte(q text) returns text language plpgsql as $$
declare n bigint;
begin
  execute q into n; return n::text;
exception when insufficient_privilege then return 'refusé';
end $$;
create function pg_temp.vu(p_role text, p_uid uuid) returns text language plpgsql as $$
declare v text;
begin
  begin
    if p_role = 'anon' then
      perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
      perform set_config('role', 'anon', true);
    else
      perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
    end if;
    v := pg_temp.compte('select count(*) from public.schools where type = ''UNIVERSITE''') || ' / ' ||
         pg_temp.compte('select count(*) from public.teams where id = ''00000000-0000-4000-8000-00000000d1a2''') || ' / ' ||
         pg_temp.compte('select count(*) from public.schools where type <> ''UNIVERSITE''') || ' / ' ||
         pg_temp.compte('select count(*) from public.teams where id <> ''00000000-0000-4000-8000-00000000d1a2''');
    raise exception using errcode = 'NX000', message = v;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 80);
  end;
end $$;
create temp table _m on commit drop as
  select 'anon (site public, visiteur)' as role, pg_temp.vu('anon', null) as vu
  union all select 'athlète', pg_temp.vu('authenticated', u_ath) from _t
  union all select 'parent', pg_temp.vu('authenticated', u_par) from _t
  union all select 'coach', pg_temp.vu('authenticated', u_coach) from _t
  union all select 'recruteur collégial', pg_temp.vu('authenticated', u_rec) from _t
  union all select 'partenaire', pg_temp.vu('authenticated', u_part) from _t
  union all select 'admin', pg_temp.vu('authenticated', u_adm) from _t;
select role, vu as "univ / équipe univ / écoles hors univ / équipes hors univ" from _m;
do $$
begin
  if exists (select 1 from _m where vu like 'ERREUR%') then raise exception 'NEXUS: un essai a échoué'; end if;
  if exists (select 1 from _m where role <> 'admin' and split_part(vu, ' / ', 1) || split_part(vu, ' / ', 2) not in ('00', '0refusé')) then
    raise exception 'NEXUS: un rôle non admin voit l''université témoin ou son équipe';
  end if;
  if (select split_part(vu, ' / ', 1) || '/' || split_part(vu, ' / ', 2) from _m where role = 'admin') <> '1/1' then
    raise exception 'NEXUS: l''admin ne voit pas l''université témoin';
  end if;
  raise notice 'NEXUS: relecture D1a conforme';
end $$;
rollback;
\echo '== ROLLBACK fait : université témoin défaite, rien n''est écrit.'
