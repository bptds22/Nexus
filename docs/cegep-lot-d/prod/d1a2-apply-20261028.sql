-- ════════════════════════════════════════════════════════════════════════════
-- Lot D1a2 cégep — APPLY RÉEL EN PROD (sur GO BP seulement, après le rejeu à blanc), version 20261028020000.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer.mjs <date> <rejeu-blanc|apply> d1a2 (migration et rollback
-- embarqués, LF, md5 gardés). Lancer SANS -1, en postgres.
--
-- UNE transaction : gardes → AVANT : ids_universites() appelable par /rpc (chaque rôle reçoit l'id d'une
-- université témoin) → migration → APRÈS : fonction absente de l'API (public, /rpc, GraphQL), policies
-- toujours justes (matrice par rôle), verrou par référence sur les 11 colonnes (refus pour un compte non
-- admin, admin exempté) → inscription (schema_migrations + admin_operations) → COMMIT. Université et équipe témoins créées DANS chaque essai, défaites aussitôt.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-apply-cegep-d1a2';
select now() as debut, current_user, current_setting('server_version') as version;

do $$
declare v text;
begin
  if current_user <> 'postgres' then
    raise exception 'NEXUS: lancer en postgres, pas en %', current_user;
  end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '20261028020000') then
    raise exception 'NEXUS: version 20261028020000 déjà inscrite';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '20261028020000' then raise exception 'NEXUS: version 20261028020000 pas après la dernière (%) — régénérer', v; end if;
  if exists (select 1 from public.admin_operations where operation in ('MIGRATION_CEGEP_LOT_D1A2_DEFINER', 'ROLLBACK_CEGEP_LOT_D1A2_DEFINER')) then
    raise exception 'NEXUS: le lot D1a2 a déjà laissé une trace dans admin_operations';
  end if;
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261028010000')
     or to_regprocedure('public.ids_universites()') is null
     or (select count(*) from pg_policies where policyname = 'universites_masquees' and permissive = 'RESTRICTIVE') <> 2 then
    raise exception 'NEXUS: préalable D1a absent';
  end if;
  if to_regnamespace('nexus_prive') is not null then
    raise exception 'NEXUS: le schéma nexus_prive existe déjà';
  end if;
  if exists (select 1 from public.schools where type = 'UNIVERSITE') then
    raise exception 'NEXUS: des universités existent déjà (D1 avant D1a2 ?)';
  end if;
end $$;
select max(version) as derniere_version from supabase_migrations.schema_migrations;

-- ── Témoins (identifiants seulement, jamais affichés) ────────────────────────
create temp table _t on commit drop as
select (select u.id from public.users u join public.athletes a on a.user_id = u.id where u.role = 'ATHLETE'::public.user_role order by u.id limit 1) as u_ath,
       (select u.id from public.users u where u.role = 'COACH'::public.user_role and u.school_id is not null order by u.id limit 1) as u_coach,
       (select u.id from public.users u where u.role = 'RECRUTEUR'::public.user_role and u.onboarding_complete order by u.id limit 1) as u_rec,
       (select u.id from public.users u where u.role = 'PARTNER'::public.user_role order by u.id limit 1) as u_part,
       (select u.id from public.users u where u.role = 'PARENT'::public.user_role order by u.id limit 1) as u_par,
       (select u.id from public.users u where u.role = 'ADMIN'::public.user_role order by u.id limit 1) as u_adm,
       coalesce((select c.unite_sport_id from public.cartes_prospect c order by c.id limit 1),
                (select t.sport_id from public.teams t order by t.id limit 1)) as sport,
       '00000000-0000-4000-8000-0000000d1a21'::uuid as univ,
       '00000000-0000-4000-8000-0000000d1a22'::uuid as univ_team;
do $$
begin
  if exists (select 1 from _t where u_ath is null or u_coach is null or u_rec is null or u_part is null or u_par is null or u_adm is null or sport is null) then
    raise exception 'NEXUS: un témoin manque';
  end if;
end $$;

create function pg_temp.prep() returns void language plpgsql as $$
begin
  insert into public.schools (id, name, type, city) select univ, 'Université témoin D1a2', 'UNIVERSITE', 'Québec' from _t;
  insert into public.teams (id, school_id, sport_id, name, season, age_group)
    select univ_team, univ, sport, 'Équipe témoin D1a2', '2026-2027', 'Universitaire' from _t;
end $$;
create function pg_temp.compte(q text) returns text language plpgsql as $$
declare n bigint;
begin
  execute q into n; return n::text;
exception when insufficient_privilege then return 'refusé';
end $$;
create function pg_temp.jwt(p_role text, p_uid uuid) returns void language plpgsql as $$
begin
  if p_role = 'anon' then
    perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
    perform set_config('role', 'anon', true);
  else
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
  end if;
end $$;
-- Ce que le rôle obtient de ids_universites() par /rpc : « reçoit l'id témoin », « reçoit sans l'id », « absente ».
create function pg_temp.rpc_ids(p_role text, p_uid uuid) returns text language plpgsql as $$
declare v uuid[];
begin
  begin
    perform pg_temp.prep();
    perform pg_temp.jwt(p_role, p_uid);
    execute 'select public.ids_universites()' into v;
    raise exception using errcode = 'NX000',
      message = case when '00000000-0000-4000-8000-0000000d1a21'::uuid = any (v) then 'reçoit l''id témoin' else 'reçoit sans l''id' end;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when undefined_function then return 'absente';
    when insufficient_privilege then return 'refusé';
    when others then return 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 60);
  end;
end $$;
-- Ce que le rôle VOIT : « écoles univ. / équipe univ. témoin / écoles hors univ. / équipes hors univ. ».
create function pg_temp.vu(p_role text, p_uid uuid) returns text language plpgsql as $$
declare v text;
begin
  begin
    perform pg_temp.prep();
    perform pg_temp.jwt(p_role, p_uid);
    v := pg_temp.compte('select count(*) from public.schools where type = ''UNIVERSITE''') || ' / ' ||
         pg_temp.compte('select count(*) from public.teams where id = ''00000000-0000-4000-8000-0000000d1a22''') || ' / ' ||
         pg_temp.compte('select count(*) from public.schools where type <> ''UNIVERSITE''') || ' / ' ||
         pg_temp.compte('select count(*) from public.teams where id <> ''00000000-0000-4000-8000-0000000d1a22''');
    raise exception using errcode = 'NX000', message = v;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 60);
  end;
end $$;
create function pg_temp.matrice() returns table (o int, role text, rpc text, vu text) language sql as $$
  select 1, 'anon (site public)', pg_temp.rpc_ids('anon', null), pg_temp.vu('anon', null)
  union all select 2, 'athlète', pg_temp.rpc_ids('authenticated', u_ath), pg_temp.vu('authenticated', u_ath) from _t
  union all select 3, 'parent', pg_temp.rpc_ids('authenticated', u_par), pg_temp.vu('authenticated', u_par) from _t
  union all select 4, 'coach', pg_temp.rpc_ids('authenticated', u_coach), pg_temp.vu('authenticated', u_coach) from _t
  union all select 5, 'recruteur collégial', pg_temp.rpc_ids('authenticated', u_rec), pg_temp.vu('authenticated', u_rec) from _t
  union all select 6, 'partenaire', pg_temp.rpc_ids('authenticated', u_part), pg_temp.vu('authenticated', u_part) from _t
  union all select 7, 'admin', pg_temp.rpc_ids('authenticated', u_adm), pg_temp.vu('authenticated', u_adm) from _t;
$$;
create temp table _avant on commit drop as select * from pg_temp.matrice();
select 'AVANT' as phase, role, rpc as "ids_universites() par /rpc", vu as "univ / équipe univ / écoles / équipes" from _avant order by o;

-- ── La migration, texte gardé par son md5 ────────────────────────────────────
create temp table _d1a2 on commit drop as
select '20261028020000'::text as version,
       $nexus_mig$-- Lot D1a2 cégep — les fonctions SECURITY DEFINER ne rendent rien d'universitaire.
-- Audit du 2026-10-28 (docs/cegep-lot-d/D1-AUDIT-DEFINER.md) : aucune fonction DEFINER ne cherche les
-- universités d'elle-même, mais plusieurs affichent le nom de l'école ou de l'équipe pointée par une ligne
-- qu'un client écrit (carte prospect, engagement, invitation, jeton…). Il suffisait de connaître l'identifiant
-- d'une université, et public.ids_universites() (D1a) le donnait à tout le monde par /rpc.
--   1. ids_universites() quitte l'API : schéma nexus_prive, que ni PostgREST ni pg_graphql n'exposent. Les
--      policies universites_masquees la lisent là. Plus aucun client ne peut connaître l'id d'une université.
--   2. Verrou par référence : aucune ligne écrite par un client ne peut pointer une université ou une équipe
--      universitaire dans les colonnes que ces fonctions affichent. Admin et service (auth.uid() nul) exemptés.
--      D2 relâchera ce qui doit l'être pour le recruteur universitaire, sous lancement_universitaire.

create schema if not exists nexus_prive;
revoke all on schema nexus_prive from public;
grant usage on schema nexus_prive to anon, authenticated, service_role;

create function nexus_prive.ids_universites() returns uuid[]
  language sql stable security definer
  set search_path = public set row_security = off
as $function$
  select coalesce(array_agg(s.id), '{}') from public.schools s where s.type = 'UNIVERSITE';
$function$;
revoke all on function nexus_prive.ids_universites() from public;
grant execute on function nexus_prive.ids_universites() to anon, authenticated, service_role;

alter policy universites_masquees on public.teams
  using ((select public.is_admin()) or not (school_id = any ((select nexus_prive.ids_universites())::uuid[])));

drop function public.ids_universites();

create function public.verrou_reference_universite() returns trigger
  language plpgsql security definer
  set search_path = public
as $function$
declare
  v_col text;
  v_id uuid;
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  foreach v_col in array tg_argv loop
    v_id := (to_jsonb(new) ->> v_col)::uuid;
    if v_id is null
       or (tg_op = 'UPDATE' and (to_jsonb(old) ->> v_col)::uuid is not distinct from v_id) then
      continue;
    end if;
    if exists (select 1 from public.schools s where s.id = v_id and s.type = 'UNIVERSITE')
       or exists (select 1 from public.teams t join public.schools s on s.id = t.school_id
                   where t.id = v_id and s.type = 'UNIVERSITE') then
      raise exception 'NEXUS: Les universités ne sont pas encore ouvertes sur Nexus. Ça arrive bientôt.'
        using errcode = '42501';
    end if;
  end loop;
  return new;
end;
$function$;
revoke all on function public.verrou_reference_universite() from public, anon, authenticated;

create trigger trg_verrou_reference_universite before insert or update of committed_school_id on public.athletes
  for each row execute function public.verrou_reference_universite('committed_school_id');
create trigger trg_verrou_reference_universite before insert or update of primary_team_id on public.users
  for each row execute function public.verrou_reference_universite('primary_team_id');
create trigger trg_verrou_reference_universite before insert or update of school_id, team_id on public.cartes_prospect
  for each row execute function public.verrou_reference_universite('school_id', 'team_id');
create trigger trg_verrou_reference_universite before insert or update of school_id, team_id on public.partenaire_prospects
  for each row execute function public.verrou_reference_universite('school_id', 'team_id');
create trigger trg_verrou_reference_universite before insert or update of school_id on public.commitment_requests
  for each row execute function public.verrou_reference_universite('school_id');
create trigger trg_verrou_reference_universite before insert or update of school_id on public.invitations
  for each row execute function public.verrou_reference_universite('school_id');
create trigger trg_verrou_reference_universite before insert or update of team_id on public.team_invitations
  for each row execute function public.verrou_reference_universite('team_id');
create trigger trg_verrou_reference_universite before insert or update of team_id on public.team_join_tokens
  for each row execute function public.verrou_reference_universite('team_id');
create trigger trg_verrou_reference_universite before insert or update of team_id on public.team_coaches
  for each row execute function public.verrou_reference_universite('team_id');
create trigger trg_verrou_reference_universite before insert or update of school_id on public.school_coaches
  for each row execute function public.verrou_reference_universite('school_id');
$nexus_mig$::text as contenu,
       $nexus_rb$-- Rollback du lot D1a2 cégep : retire le verrou par référence et remet ids_universites() dans public (état D1a).
drop trigger if exists trg_verrou_reference_universite on public.athletes;
drop trigger if exists trg_verrou_reference_universite on public.users;
drop trigger if exists trg_verrou_reference_universite on public.cartes_prospect;
drop trigger if exists trg_verrou_reference_universite on public.partenaire_prospects;
drop trigger if exists trg_verrou_reference_universite on public.commitment_requests;
drop trigger if exists trg_verrou_reference_universite on public.invitations;
drop trigger if exists trg_verrou_reference_universite on public.team_invitations;
drop trigger if exists trg_verrou_reference_universite on public.team_join_tokens;
drop trigger if exists trg_verrou_reference_universite on public.team_coaches;
drop trigger if exists trg_verrou_reference_universite on public.school_coaches;
drop function if exists public.verrou_reference_universite();

create function public.ids_universites() returns uuid[]
  language sql stable security definer
  set search_path = public set row_security = off
as $function$
  select coalesce(array_agg(s.id), '{}') from public.schools s where s.type = 'UNIVERSITE';
$function$;
revoke all on function public.ids_universites() from public;
grant execute on function public.ids_universites() to anon, authenticated, service_role;

alter policy universites_masquees on public.teams
  using ((select public.is_admin()) or not (school_id = any ((select public.ids_universites())::uuid[])));

drop function nexus_prive.ids_universites();
drop schema nexus_prive;
$nexus_rb$::text as rollback;
do $apply$
begin
  if (select md5(contenu) from _d1a2) <> 'bd3fb17ec415b81d75945e023aac42f0' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _d1a2);
  end if;
  if (select md5(rollback) from _d1a2) <> 'ecf09088f59266acf962b09ea99eaf2c' then
    raise exception 'NEXUS: texte du rollback altéré (md5 %)', (select md5(rollback) from _d1a2);
  end if;
  execute (select contenu from _d1a2);
end $apply$;
set local search_path = public, extensions;

create temp table _apres on commit drop as select * from pg_temp.matrice();
select 'APRÈS' as phase, a.role, a.rpc as "ids_universites() par /rpc", a.vu as "univ / équipe univ / écoles / équipes",
       case when split_part(a.vu, ' / ', 3) = split_part(b.vu, ' / ', 3) and split_part(a.vu, ' / ', 4) = split_part(b.vu, ' / ', 4)
            then '=' else 'CHANGE' end as hors_univ_vs_avant
  from _apres a join _avant b using (o) order by o;

-- Exposition : rien d'universitaire dans le schéma que /rpc sert (public), ni dans le schéma GraphQL.
create function pg_temp.graphql_champs(p_role text, p_uid uuid) returns text language plpgsql as $$
declare v text;
begin
  begin
    perform pg_temp.jwt(p_role, p_uid);
    perform set_config('search_path', 'public, extensions', true);
    select graphql.resolve('query { idsUniversites }')::text into v;
    raise exception using errcode = 'NX000',
      message = case when v like '%Unknown field%idsUniversites%' then 'rien d''universitaire' else 'expose ids_universites : ' || left(v, 40) end;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 60);
  end;
end $$;
create temp table _expo on commit drop as
select 'fonctions *universite* dans public' as quoi,
       (select coalesce(string_agg(p.proname, ', '), 'aucune') from pg_proc p
         where p.pronamespace = 'public'::regnamespace and p.proname ilike '%universite%'
           and pg_get_function_result(p.oid) <> 'trigger'
           and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))) as resultat
union all select 'GraphQL (anon)', pg_temp.graphql_champs('anon', null)
union all select 'GraphQL (athlète)', pg_temp.graphql_champs('authenticated', (select u_ath from _t))
union all select 'nexus_prive.ids_universites : exécutable par authenticated',
       has_function_privilege('authenticated', 'nexus_prive.ids_universites()', 'execute')::text;
select * from _expo;

-- Verrou par référence : écriture « comme une fonction DEFINER » (claims d'un compte, RLS hors jeu) vers
-- l'université ou l'équipe témoin. Compte non admin → refus attendu ; admin → accepté (exempté).
create function pg_temp.ecrit(p_uid uuid, p_sql text) returns text language plpgsql as $$
declare n bigint;
begin
  begin
    perform pg_temp.prep();
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    execute p_sql;
    get diagnostics n = row_count;
    raise exception using errcode = 'NX000', message = 'accepté ' || n;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return case when sqlerrm like 'NEXUS: Les universités ne sont pas encore ouvertes%' then 'REFUSÉ (verrou)'
                                 else 'autre refus ' || sqlstate || ' ' || left(sqlerrm, 50) end;
  end;
end $$;
create temp table _ecr (o int, tbl text, col text, cible text, filtre text default '') on commit drop;
insert into _ecr (o, tbl, col, cible) values
  (1, 'athletes', 'committed_school_id', 'univ'), (2, 'users', 'primary_team_id', 'univ_team'),
  (3, 'cartes_prospect', 'school_id', 'univ'), (4, 'cartes_prospect', 'team_id', 'univ_team'),
  (5, 'partenaire_prospects', 'school_id', 'univ'), (6, 'partenaire_prospects', 'team_id', 'univ_team'),
  (7, 'commitment_requests', 'school_id', 'univ'), (8, 'invitations', 'school_id', 'univ'),
  (9, 'team_invitations', 'team_id', 'univ_team'), (10, 'team_join_tokens', 'team_id', 'univ_team'),
  (11, 'team_coaches', 'team_id', 'univ_team'), (12, 'school_coaches', 'school_id', 'univ');
update _ecr set filtre = format('where unite_sport_id = %L', (select sport from _t)) where tbl = 'cartes_prospect';
create temp table _verrou on commit drop as
select e.o, e.tbl || '.' || e.col as colonne,
       (select count(*) from pg_trigger g where g.tgrelid = ('public.' || e.tbl)::regclass
           and g.tgname = 'trg_verrou_reference_universite' and not g.tgisinternal) as trigger,
       pg_temp.ecrit(t.u_coach, format('update public.%I set %I = %L where ctid = (select ctid from public.%I %s limit 1)',
         e.tbl, e.col, case e.cible when 'univ' then t.univ else t.univ_team end, e.tbl, e.filtre)) as non_admin,
       pg_temp.ecrit(t.u_adm, format('update public.%I set %I = %L where ctid = (select ctid from public.%I %s limit 1)',
         e.tbl, e.col, case e.cible when 'univ' then t.univ else t.univ_team end, e.tbl, e.filtre)) as admin
  from _ecr e cross join _t t;
select colonne, trigger, non_admin, admin from _verrou order by o;

-- Coût de la policy sur la lecture la plus large (recruteur : toutes les équipes), médiane de 5.
create function pg_temp.duree_recruteur() returns numeric language plpgsql as $$
declare t0 timestamptz; d numeric[] := '{}'; i int; n bigint; u uuid := (select u_rec from _t);
begin
  for i in 1..5 loop
    begin
      perform pg_temp.jwt('authenticated', u);
      t0 := clock_timestamp();
      select count(*) into n from public.teams;
      d := d || (extract(epoch from clock_timestamp() - t0) * 1000)::numeric;
      raise exception using errcode = 'NX000';
    exception when sqlstate 'NX000' then null;
    end;
  end loop;
  return (select percentile_cont(0.5) within group (order by x) from unnest(d) x);
end $$;
select round(pg_temp.duree_recruteur(), 1) as recruteur_toutes_equipes_ms_apres;

do $$
begin
  if exists (select 1 from _avant where vu like 'ERREUR%' or rpc like 'ERREUR%')
     or exists (select 1 from _apres where vu like 'ERREUR%' or rpc like 'ERREUR%') then
    raise exception 'NEXUS: un essai a échoué';
  end if;
  if exists (select 1 from _apres where rpc <> 'absente') then
    raise exception 'NEXUS: ids_universites() est encore appelable dans public';
  end if;
  if exists (select 1 from _apres where role <> 'admin' and split_part(vu, ' / ', 1) || split_part(vu, ' / ', 2) not in ('00', '0refusé')) then
    raise exception 'NEXUS: un rôle non admin voit encore l''université ou son équipe';
  end if;
  if (select split_part(vu, ' / ', 1) || '/' || split_part(vu, ' / ', 2) from _apres where role = 'admin') <> '1/1' then
    raise exception 'NEXUS: l''admin ne voit plus l''université ou son équipe';
  end if;
  if exists (select 1 from _apres a join _avant b using (o)
              where split_part(a.vu, ' / ', 3) <> split_part(b.vu, ' / ', 3) or split_part(a.vu, ' / ', 4) <> split_part(b.vu, ' / ', 4)) then
    raise exception 'NEXUS: un rôle ne voit plus les mêmes écoles ou équipes ordinaires';
  end if;
  if exists (select 1 from _expo where resultat not in ('aucune', 'rien d''universitaire', 'true')) then
    raise exception 'NEXUS: une fonction universitaire reste exposée (voir le tableau d''exposition)';
  end if;
  if exists (select 1 from _verrou where trigger <> 1
                or (non_admin like 'accepté%' and non_admin <> 'accepté 0')
                or admin like 'REFUSÉ (verrou)%') then
    raise exception 'NEXUS: le verrou par référence ne tient pas (voir le tableau)';
  end if;
  raise notice 'NEXUS: VERDICT D1a2 — ids_universites hors API, policies justes pour chaque rôle, verrou par référence tenu';
end $$;
select 'VERDICT' as verdict, 'conforme' as resultat;

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'cegep_lot_d1a2_definer', array[contenu], 'bptds22@gmail.com' from _d1a2;

insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_CEGEP_LOT_D1A2_DEFINER',
       'Chantier cégep, lot D1a2 : ids_universites() hors API (nexus_prive) et verrou par référence sur 11 colonnes, avant l''import D1 (GO BP)',
       jsonb_build_object('nom', 'cegep_lot_d1a2_definer', 'version', version,
         'fichier', 'supabase/migrations/' || version || '_cegep_lot_d1a2_definer.sql',
         'rollback', 'supabase/rollback/' || version || '_rollback_cegep_lot_d1a2_definer.sql',
         'md5_fichier', 'bd3fb17ec415b81d75945e023aac42f0', 'md5_rollback', 'ecf09088f59266acf962b09ea99eaf2c', 'voie', 'psql (session pooler)'),
       (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0')
  from _d1a2;
do $$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261028020000') then
    raise exception 'NEXUS: inscription schema_migrations absente';
  end if;
end $$;
select version as version_inscrite, clock_timestamp() as avant_commit from _d1a2;
commit;
\echo '== COMMIT fait : lot D1a2 cégep en prod (fonctions DEFINER fermées aux universités).'
