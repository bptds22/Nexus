-- Relecture prod du lot D1 (après l'apply) : ce que chaque rôle voit des 12 universités et de leurs équipes,
-- et les totaux ordinaires. Aucune donnée écrite (fonctions temporaires seulement), finit par ROLLBACK.
-- Aucun nom affiché.
\set ON_ERROR_STOP 1
\pset null '·'
begin;
set local statement_timeout = '60s';

select (select count(*) from public.schools where type = 'UNIVERSITE') as universites,
       (select count(*) from public.schools where type = 'UNIVERSITE' and province = 'QC') as universites_qc,
       (select count(*) from public.teams t join public.schools s on s.id = t.school_id where s.type = 'UNIVERSITE') as equipes_univ,
       (select count(*) from public.schools where type <> 'UNIVERSITE') as ecoles_ordinaires,
       (select count(*) from public.teams t join public.schools s on s.id = t.school_id where s.type <> 'UNIVERSITE') as equipes_ordinaires,
       (select count(*) from public.games g join public.teams t on t.id in (g.home_team_id, g.visitor_team_id)
          join public.schools s on s.id = t.school_id where s.type = 'UNIVERSITE') as matchs_univ,
       (select count(*) from public.admin_operations where operation = 'CEGEP_LOT_D1_UNIVERSITES') as trace;

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
         pg_temp.compte('select count(*) from public.teams where age_group = ''Universitaire''') || ' / ' ||
         pg_temp.compte('select count(*) from public.schools where type <> ''UNIVERSITE''') || ' / ' ||
         pg_temp.compte('select count(*) from public.teams where age_group is distinct from ''Universitaire''');
    raise exception using errcode = 'NX000', message = v;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 60);
  end;
end $$;
create temp table _m on commit drop as
  select 1 as o, 'anon (site public)' as role, pg_temp.vu('anon', null) as vu
  union all select 2, 'athlète', pg_temp.vu('authenticated', (select u.id from public.users u where u.role = 'ATHLETE'::public.user_role order by u.id limit 1))
  union all select 3, 'parent', pg_temp.vu('authenticated', (select u.id from public.users u where u.role = 'PARENT'::public.user_role order by u.id limit 1))
  union all select 4, 'coach', pg_temp.vu('authenticated', (select u.id from public.users u where u.role = 'COACH'::public.user_role order by u.id limit 1))
  union all select 5, 'recruteur collégial', pg_temp.vu('authenticated', (select u.id from public.users u where u.role = 'RECRUTEUR'::public.user_role order by u.id limit 1))
  union all select 6, 'partenaire', pg_temp.vu('authenticated', (select u.id from public.users u where u.role = 'PARTNER'::public.user_role order by u.id limit 1))
  union all select 7, 'admin', pg_temp.vu('authenticated', (select u.id from public.users u where u.role = 'ADMIN'::public.user_role order by u.id limit 1));
select role, vu as "univ / équipes univ / écoles hors univ / équipes hors univ" from _m order by o;
do $$
begin
  if exists (select 1 from _m where vu like 'ERREUR%') then raise exception 'NEXUS: un essai a échoué'; end if;
  if exists (select 1 from _m where role <> 'admin' and split_part(vu, ' / ', 1) || split_part(vu, ' / ', 2) not in ('00', '0refusé')) then
    raise exception 'NEXUS: un rôle non admin voit une université ou une équipe universitaire';
  end if;
  if (select split_part(vu, ' / ', 1) || '/' || split_part(vu, ' / ', 2) from _m where role = 'admin') <> '12/84' then
    raise exception 'NEXUS: l''admin ne voit pas 12 / 84';
  end if;
  raise notice 'NEXUS: relecture D1 conforme';
end $$;
rollback;
