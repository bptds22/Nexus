-- ════════════════════════════════════════════════════════════════════════════
-- Lot D1a2 cégep — @@TITRE@@, version @@VERSION@@.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer.mjs <date> <rejeu-blanc|apply> d1a2 (migration et rollback
-- embarqués, LF, md5 gardés). Lancer SANS -1, en postgres.
--
-- UNE transaction : gardes → AVANT : ids_universites() appelable par /rpc (chaque rôle reçoit l'id d'une
-- université témoin) → migration → APRÈS : fonction absente de l'API (public, /rpc, GraphQL), policies
-- toujours justes (matrice par rôle), verrou par référence sur les 11 colonnes (refus pour un compte non
-- admin, admin exempté) → @@SUITE@@. Université et équipe témoins créées DANS chaque essai, défaites aussitôt.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-@@MODE@@-cegep-d1a2';
select now() as debut, current_user, current_setting('server_version') as version;

do $$
declare v text;
begin
  if current_user <> 'postgres' then
    raise exception 'NEXUS: lancer en postgres, pas en %', current_user;
  end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '@@VERSION@@') then
    raise exception 'NEXUS: version @@VERSION@@ déjà inscrite';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '@@VERSION@@' then raise exception 'NEXUS: version @@VERSION@@ pas après la dernière (%) — régénérer', v; end if;
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
select '@@VERSION@@'::text as version,
       $nexus_mig$@@MIGRATION@@$nexus_mig$::text as contenu,
       $nexus_rb$@@ROLLBACK@@$nexus_rb$::text as rollback;
do $apply$
begin
  if (select md5(contenu) from _d1a2) <> '@@MD5_MIGRATION@@' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _d1a2);
  end if;
  if (select md5(rollback) from _d1a2) <> '@@MD5_ROLLBACK@@' then
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
-- [[REJEU

do $rb$ begin execute (select rollback from _d1a2); end $rb$;
set local search_path = public, extensions;
create temp table _apres_rb on commit drop as select * from pg_temp.matrice();
do $$
begin
  if exists (select 1 from _apres_rb r join _avant a using (o) where r.vu <> a.vu or r.rpc <> a.rpc)
     or to_regnamespace('nexus_prive') is not null
     or exists (select 1 from pg_trigger where tgname = 'trg_verrou_reference_universite') then
    raise exception 'NEXUS: après rollback, l''état d''avant n''est pas retrouvé';
  end if;
  raise notice 'NEXUS: rollback D1a2 vérifié (matrice et appel /rpc identiques à AVANT, schéma et verrou retirés)';
end $$;

rollback;
\echo '== ROLLBACK fait : rien n''est appliqué.'
-- REJEU]]
-- [[APPLY

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'cegep_lot_d1a2_definer', array[contenu], 'bptds22@gmail.com' from _d1a2;

insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_CEGEP_LOT_D1A2_DEFINER',
       'Chantier cégep, lot D1a2 : ids_universites() hors API (nexus_prive) et verrou par référence sur 11 colonnes, avant l''import D1 (GO BP)',
       jsonb_build_object('nom', 'cegep_lot_d1a2_definer', 'version', version,
         'fichier', 'supabase/migrations/' || version || '_cegep_lot_d1a2_definer.sql',
         'rollback', 'supabase/rollback/' || version || '_rollback_cegep_lot_d1a2_definer.sql',
         'md5_fichier', '@@MD5_MIGRATION@@', 'md5_rollback', '@@MD5_ROLLBACK@@', 'voie', 'psql (session pooler)'),
       (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0')
  from _d1a2;
do $$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '@@VERSION@@') then
    raise exception 'NEXUS: inscription schema_migrations absente';
  end if;
end $$;
select version as version_inscrite, clock_timestamp() as avant_commit from _d1a2;
commit;
\echo '== COMMIT fait : lot D1a2 cégep en prod (fonctions DEFINER fermées aux universités).'
-- APPLY]]
