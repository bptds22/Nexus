-- ════════════════════════════════════════════════════════════════════════════
-- Constat (lecture seule en effet) — qui peut créer, modifier ou supprimer une équipe de son école ?
-- Policies teams « Coaches create/update/delete teams » : school_id = current_user_school_id(), TO public, sans rôle.
-- Essai avec de VRAIS comptes (athlète, parent, coach, coach directeur, recruteur collégial), chaque geste défait
-- aussitôt (NX000), et la transaction entière finit par ROLLBACK. Aucun nom affiché. Lancer SANS -1, en postgres.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local application_name = 'nexus-constat-teams';

-- Témoins : un compte réel par rôle, rattaché à une école (non universitaire) qui a au moins une équipe.
create temp table _c on commit drop as
with ecole_ok as (select s.id from public.schools s where s.type <> 'UNIVERSITE' and exists (select 1 from public.teams t where t.school_id = s.id))
select * from (values
  ('athlète',             (select a.user_id from public.athletes a join public.users u on u.id = a.user_id
                            where u.role = 'ATHLETE'::public.user_role and a.school_id in (select id from ecole_ok) order by a.user_id limit 1)),
  ('parent',              (select u.id from public.users u where u.role = 'PARENT'::public.user_role
                            order by (u.school_id in (select id from ecole_ok)) desc nulls last, u.id limit 1)),
  ('coach',               (select u.id from public.users u where u.role = 'COACH'::public.user_role and not coalesce(u.is_school_admin, false)
                            and u.school_id in (select id from ecole_ok) order by u.id limit 1)),
  ('coach directeur',     (select u.id from public.users u where u.role = 'COACH'::public.user_role and u.is_school_admin
                            and u.school_id in (select id from ecole_ok) order by u.id limit 1)),
  ('recruteur collégial', (select u.id from public.users u where u.role = 'RECRUTEUR'::public.user_role and u.context is distinct from 'universitaire'
                            and u.school_id in (select id from ecole_ok) order by u.id limit 1))
) v(role, uid);
alter table _c add column ecole uuid, add column equipe uuid, add column sport uuid;
update _c set ecole = case when role = 'athlète' then (select school_id from public.athletes where user_id = uid)
                           else (select school_id from public.users where id = uid) end;
update _c set equipe = (select t.id from public.teams t where t.school_id = ecole order by t.id limit 1);
update _c set sport = (select sport_id from public.teams where id = equipe);
select role, uid is not null as compte_trouve, ecole is not null as ecole_rattachee, equipe is not null as equipe_trouvee from _c order by role;

create function pg_temp.geste(p_uid uuid, p_quoi text) returns text language plpgsql as $$
declare v text; n int; c record; v_neuve uuid;
begin
  select * into c from _c where uid = p_uid;
  begin
    if c.ecole is null then raise exception using errcode = 'NX000', message = 'sans école'; end if;
    -- équipe jetable créée en postgres pour l'essai de suppression (aucune dépendance)
    insert into public.teams (school_id, sport_id, name) values (c.ecole, c.sport, 'Constat essai jetable') returning id into v_neuve;
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    begin
      if p_quoi = 'créer' then
        insert into public.teams (school_id, sport_id, name) values (c.ecole, c.sport, 'Constat essai');
        v := 'OUI (créée)';
      elsif p_quoi = 'modifier' then
        update public.teams set name = name || '' where id = c.equipe;
        get diagnostics n = row_count; v := case when n > 0 then 'OUI (' || n || ')' else 'non (0 ligne)' end;
      elsif p_quoi = 'supprimer' then
        delete from public.teams where id = v_neuve;
        get diagnostics n = row_count; v := case when n > 0 then 'OUI (' || n || ')' else 'non (0 ligne)' end;
      end if;
    exception when insufficient_privilege or check_violation or with_check_option_violation or raise_exception then
      v := 'non (refusé ' || sqlstate || ')';
    end;
    raise exception using errcode = 'NX000', message = v;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 70);
  end;
end $$;

select role, pg_temp.geste(uid, 'créer') as creer, pg_temp.geste(uid, 'modifier') as modifier, pg_temp.geste(uid, 'supprimer') as supprimer
  from _c where uid is not null order by role;

-- Traces disponibles en base (aucune table d'audit sur teams) : compteurs cumulés et dates de modification.
select n_tup_ins, n_tup_upd, n_tup_del, stats_reset
  from pg_stat_user_tables join pg_stat_database on datname = current_database()
 where relid = 'public.teams'::regclass;

rollback;
\echo '== ROLLBACK fait : rien n''est appliqué.'
