-- ════════════════════════════════════════════════════════════════════════════
-- Lot D2a cégep — @@TITRE@@, version @@VERSION@@.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer.mjs <date> <rejeu-blanc|apply> d2a (migration et rollback
-- embarqués, LF, md5 gardés). Lancer SANS -1, en postgres.
--
-- UNE transaction : gardes → migration → parcours d'inscription d'un compte témoin NEUF (créé dans chaque
-- essai, défait aussitôt avec l'interrupteur posé pour l'essai) : OFF / ON, universitaire / collégial, cas
-- refusés → ce que voient les rôles existants sous OFF et sous ON → @@SUITE@@. Aucun nom affiché.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-@@MODE@@-cegep-d2a';
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
  if exists (select 1 from public.admin_operations where operation in ('MIGRATION_CEGEP_LOT_D2A', 'ROLLBACK_CEGEP_LOT_D2A')) then
    raise exception 'NEXUS: le lot D2a a déjà laissé une trace dans admin_operations';
  end if;
  if to_regprocedure('nexus_prive.ids_universites()') is null
     or to_regprocedure('public.verrou_reference_universite()') is null then
    raise exception 'NEXUS: préalable D1a2 absent';
  end if;
  if (select count(*) from public.schools where type = 'UNIVERSITE') = 0 then
    raise exception 'NEXUS: préalable D1 absent (aucune université)';
  end if;
  if public.lancement_universitaire_actif() then
    raise exception 'NEXUS: lancement_universitaire est ON — D2a se pose interrupteur OFF';
  end if;
  if exists (select 1 from auth.users where id = '00000000-0000-4000-8000-0000000d2a01') then
    raise exception 'NEXUS: l''identifiant du compte témoin existe déjà';
  end if;
end $$;
select max(version) as derniere_version from supabase_migrations.schema_migrations;

-- ── Témoins (identifiants seulement) ─────────────────────────────────────────
create temp table _t on commit drop as
with u as (select s.id from public.schools s where s.type = 'UNIVERSITE'
            and exists (select 1 from public.teams t where t.school_id = s.id) order by s.name limit 1)
select (select id from u) as univ,
       (select t.id from public.teams t where t.school_id = (select id from u) order by t.id limit 1) as univ_team,
       (select count(*) from public.teams t where t.school_id = (select id from u) and t.is_active) as univ_n_equipes,
       (select t.id from public.teams t join public.schools s on s.id = t.school_id
         where s.type = 'UNIVERSITE' and s.id <> (select id from u) order by t.id limit 1) as autre_team,
       (select s.id from public.schools s where s.type = 'CEGEP' order by s.name limit 1) as cegep,
       (select count(*) from public.schools where type = 'UNIVERSITE') as n_univ,
       (select u.id from public.users u join public.athletes a on a.user_id = u.id where u.role = 'ATHLETE'::public.user_role order by u.id limit 1) as u_ath,
       (select u.id from public.users u where u.role = 'COACH'::public.user_role and u.school_id is not null order by u.id limit 1) as u_coach,
       (select u.id from public.users u where u.role = 'RECRUTEUR'::public.user_role and u.onboarding_complete order by u.id limit 1) as u_rec,
       (select u.id from public.users u where u.role = 'PARTNER'::public.user_role order by u.id limit 1) as u_part,
       (select u.id from public.users u where u.role = 'PARENT'::public.user_role order by u.id limit 1) as u_par,
       (select u.id from public.users u where u.role = 'ADMIN'::public.user_role order by u.id limit 1) as u_adm,
       '00000000-0000-4000-8000-0000000d2a01'::uuid as neuf;
do $$
begin
  if exists (select 1 from _t where univ is null or univ_team is null or autre_team is null or cegep is null
                or u_ath is null or u_coach is null or u_rec is null or u_part is null or u_par is null or u_adm is null) then
    raise exception 'NEXUS: un témoin manque';
  end if;
end $$;

-- ── La migration, texte gardé par son md5 ────────────────────────────────────
create temp table _d2a on commit drop as
select '@@VERSION@@'::text as version,
       $nexus_mig$@@MIGRATION@@$nexus_mig$::text as contenu,
       $nexus_rb$@@ROLLBACK@@$nexus_rb$::text as rollback;
do $apply$
begin
  if (select md5(contenu) from _d2a) <> '@@MD5_MIGRATION@@' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _d2a);
  end if;
  if (select md5(rollback) from _d2a) <> '@@MD5_ROLLBACK@@' then
    raise exception 'NEXUS: texte du rollback altéré (md5 %)', (select md5(rollback) from _d2a);
  end if;
  execute (select contenu from _d2a);
end $apply$;
set local search_path = public, extensions;

-- ── Outils d'essai ───────────────────────────────────────────────────────────
-- Une étape : « ok <valeur> » ou « refusé <sqlstate> <message> ». Le rôle courant est celui de l'appelant.
create function pg_temp.etape(p_sql text) returns text language plpgsql as $$
declare v text;
begin
  execute p_sql into v;
  return 'ok ' || coalesce(v, '·');
exception when others then
  return 'refusé ' || sqlstate || ' ' || left(sqlerrm, 60);
end $$;
-- Parcours complet d'un compte NEUF, défait aussitôt. p_ctx : contexte demandé à claim_signup_role.
create function pg_temp.parcours(p_on boolean, p_ctx text, p_ecole uuid, p_equipe uuid) returns text
language plpgsql as $$
declare r text[] := '{}'; v_neuf uuid := (select neuf from _t); v_univ uuid := (select univ from _t);
begin
  begin
    update public.app_settings set value = case when p_on then 'true' else 'false' end where key = 'lancement_universitaire';
    insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', v_neuf, 'authenticated', 'authenticated', 'd2a-temoin@nexus.invalid',
            '{}', '{}', now(), now());
    perform set_config('request.jwt.claims', json_build_object('sub', v_neuf, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    r := r || pg_temp.etape(format('select (public.claim_signup_role(''RECRUTEUR'', %L))->>''context''', p_ctx));
    r := r || pg_temp.etape('select count(*)::text from public.universites_inscription()');
    r := r || pg_temp.etape(format('select count(*)::text from public.equipes_universite_inscription(%L)', v_univ));
    r := r || pg_temp.etape(format(
      'select (public.finish_recruiter_onboarding(%L, %L, ''Football'', ''Témoin'', ''D2a'', null, null, null, null, ''owner'', true, null))->>''ok''',
      p_ecole, p_equipe));
    -- Ce qu'il voit ensuite : univ. visibles / la sienne / équipes de la sienne / équipes des autres univ.
    r := r || pg_temp.etape(format(
      'select (select count(*) from public.schools where type = ''UNIVERSITE'') || ''/'' ||
              (select count(*) from public.schools where id = %1$L) || ''/'' ||
              (select count(*) from public.teams where school_id = %1$L) || ''/'' ||
              (select count(*) from public.teams t where t.age_group = ''Universitaire'' and t.school_id <> %1$L)', v_univ));
    raise exception using errcode = 'NX000', message = array_to_string(r, ' | ');
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 80) || ' après ' || array_to_string(r, ' | ');
  end;
end $$;

create temp table _parcours on commit drop as
select 1 as o, 'A. OFF, universitaire, son université' as cas,
       pg_temp.parcours(false, 'universitaire', univ, univ_team) as resultat from _t
union all select 2, 'B. ON, universitaire, son université + son équipe', pg_temp.parcours(true, 'universitaire', univ, univ_team) from _t
union all select 3, 'C. ON, universitaire, un cégep', pg_temp.parcours(true, 'universitaire', cegep, null) from _t
union all select 4, 'D. ON, universitaire, équipe d''une autre université', pg_temp.parcours(true, 'universitaire', univ, autre_team) from _t
union all select 5, 'E. OFF, collégial (régression), un cégep', pg_temp.parcours(false, null, cegep, null) from _t
union all select 6, 'F. ON, collégial, une université', pg_temp.parcours(true, null, univ, null) from _t;
select cas, resultat as "claim | univ. | équipes | finish | vu u/sienne/ses éq./autres" from _parcours order by o;

-- Ce que voient les rôles existants (OFF, puis ON posé dans l'essai) : univ. / équipes univ. / écoles / équipes.
create function pg_temp.compte(q text) returns text language plpgsql as $$
declare n bigint;
begin
  execute q into n; return n::text;
exception when insufficient_privilege then return 'refusé';
end $$;
create function pg_temp.vu(p_on boolean, p_role text, p_uid uuid) returns text language plpgsql as $$
declare v text;
begin
  begin
    update public.app_settings set value = case when p_on then 'true' else 'false' end where key = 'lancement_universitaire';
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
create temp table _vu on commit drop as
select o, role, pg_temp.vu(false, r, uid) as off, pg_temp.vu(true, r, uid) as "on"
  from (select 1 as o, 'anon (site public)' as role, 'anon' as r, null::uuid as uid
        union all select 2, 'athlète', 'authenticated', u_ath from _t
        union all select 3, 'parent', 'authenticated', u_par from _t
        union all select 4, 'coach', 'authenticated', u_coach from _t
        union all select 5, 'recruteur collégial', 'authenticated', u_rec from _t
        union all select 6, 'partenaire', 'authenticated', u_part from _t
        union all select 7, 'admin', 'authenticated', u_adm from _t) x;
select role, off as "OFF : univ / équipes univ / écoles / équipes", "on" as "ON" from _vu order by o;

-- Un recruteur collégial existant, sous ON, ne se rattache pas à une université (verrou D2a), même en écriture directe.
create function pg_temp.ecrit(p_on boolean, p_uid uuid, p_sql text) returns text language plpgsql as $$
declare n bigint;
begin
  begin
    update public.app_settings set value = case when p_on then 'true' else 'false' end where key = 'lancement_universitaire';
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    execute p_sql;
    get diagnostics n = row_count;
    raise exception using errcode = 'NX000', message = 'accepté ' || n;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'refusé ' || sqlstate || ' ' || left(sqlerrm, 70);
  end;
end $$;
create temp table _verrou on commit drop as
select 'recruteur collégial → school_id université (ON)' as essai,
       pg_temp.ecrit(true, u_rec, format('update public.users set school_id = %L where id = %L', univ, u_rec)) as resultat from _t
union all
select 'recruteur collégial → contexte universitaire (ON)',
       pg_temp.ecrit(true, u_rec, format('update public.users set context = ''universitaire'' where id = %L', u_rec)) from _t
union all
select 'recruteur collégial → primary_team_id équipe univ. (ON)',
       pg_temp.ecrit(true, u_rec, format('update public.users set primary_team_id = %L where id = %L', univ_team, u_rec)) from _t;
select * from _verrou;

-- Coût des policies sur la lecture la plus large (recruteur collégial : toutes les équipes), médiane de 5.
create function pg_temp.duree_recruteur() returns numeric language plpgsql as $$
declare t0 timestamptz; d numeric[] := '{}'; i int; n bigint; u uuid := (select u_rec from _t);
begin
  for i in 1..5 loop
    begin
      perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
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
declare t record; p text;
begin
  select * into t from _t;
  if exists (select 1 from _parcours where resultat like 'ERREUR%') then raise exception 'NEXUS: un parcours a échoué'; end if;
  -- A : OFF → tout refusé, rien vu.
  p := (select resultat from _parcours where o = 1);
  if p not like 'refusé 42501 NEXUS: Les universités%| refusé 42501%| refusé 42501%| refusé %WRONG_ROLE_OR_CONTEXT%| ok 0/0/0/0' then
    raise exception 'NEXUS: A (OFF universitaire) : %', p;
  end if;
  -- B : ON → contexte universitaire, 12 universités, ses équipes, inscription faite, il ne voit que la sienne.
  p := (select resultat from _parcours where o = 2);
  if p <> format('ok universitaire | ok %s | ok %s | ok true | ok 1/1/%s/0', t.n_univ, t.univ_n_equipes,
                 (select count(*) from public.teams where school_id = t.univ)) then
    raise exception 'NEXUS: B (ON universitaire) : %', p;
  end if;
  if (select resultat from _parcours where o = 3) not like 'ok universitaire |%| refusé %INVALID_UNIVERSITE%' then
    raise exception 'NEXUS: C (cégep choisi par un recruteur universitaire) : %', (select resultat from _parcours where o = 3);
  end if;
  if (select resultat from _parcours where o = 4) not like 'ok universitaire |%| refusé %INVALID_TEAM%' then
    raise exception 'NEXUS: D (équipe d''une autre université) : %', (select resultat from _parcours where o = 4);
  end if;
  if (select resultat from _parcours where o = 5) not like 'ok collegial | refusé 42501%| refusé 42501%| ok true | ok 0/0/0/0' then
    raise exception 'NEXUS: E (régression collégiale) : %', (select resultat from _parcours where o = 5);
  end if;
  if (select resultat from _parcours where o = 6) not like 'ok collegial | refusé 42501%| refusé 42501%| refusé %INVALID_CEGEP%| ok 0/0/0/0' then
    raise exception 'NEXUS: F (collégial vers une université) : %', (select resultat from _parcours where o = 6);
  end if;
  if exists (select 1 from _vu where off like 'ERREUR%' or "on" like 'ERREUR%') then raise exception 'NEXUS: un essai de vue a échoué'; end if;
  if exists (select 1 from _vu where role <> 'admin'
               and (split_part(off, ' / ', 1) || split_part(off, ' / ', 2) not in ('00', '0refusé')
                 or split_part("on", ' / ', 1) || split_part("on", ' / ', 2) not in ('00', '0refusé'))) then
    raise exception 'NEXUS: un rôle existant non admin voit une université';
  end if;
  if exists (select 1 from _vu where split_part(off, ' / ', 3) <> split_part("on", ' / ', 3)
                                  or split_part(off, ' / ', 4) <> split_part("on", ' / ', 4)) then
    raise exception 'NEXUS: les écoles ou équipes ordinaires changent avec l''interrupteur';
  end if;
  if exists (select 1 from _verrou where resultat like 'accepté%' and resultat <> 'accepté 0') then
    raise exception 'NEXUS: un recruteur collégial peut se rattacher à une université';
  end if;
  raise notice 'NEXUS: VERDICT D2a — OFF tout fermé ; ON inscription universitaire complète, il ne voit que son université ; collégial inchangé';
end $$;
select 'VERDICT' as verdict, 'conforme' as resultat;
-- [[REJEU

create temp table _avant_rb on commit drop as select o, off from _vu;
do $rb$ begin execute (select rollback from _d2a); end $rb$;
set local search_path = public, extensions;
do $$
begin
  if to_regprocedure('public.universites_inscription()') is not null
     or to_regprocedure('nexus_prive.mon_universite()') is not null
     or exists (select 1 from pg_proc where proname = 'claim_signup_role' and prosrc like '%universitaire%')
     or exists (select 1 from pg_proc where proname = 'finish_recruiter_onboarding' and prosrc like '%INVALID_UNIVERSITE%')
     or exists (select 1 from pg_proc where proname = 'verrou_universites' and prosrc like '%Lot D2a%')
     or exists (select 1 from pg_proc where proname = 'verrou_reference_universite' and prosrc like '%primary_team_id%')
     or exists (select 1 from pg_policies where policyname = 'universites_masquees' and qual like '%mon_universite%') then
    raise exception 'NEXUS: après rollback, un objet D2a reste en place';
  end if;
  if exists (select 1 from _avant_rb a where a.off <> pg_temp.vu(false, case when a.o = 1 then 'anon' else 'authenticated' end,
               (select case a.o when 2 then u_ath when 3 then u_par when 4 then u_coach when 5 then u_rec when 6 then u_part when 7 then u_adm end from _t))) then
    raise exception 'NEXUS: après rollback, la vue des rôles a changé';
  end if;
  raise notice 'NEXUS: rollback D2a vérifié (objets retirés, vue des rôles identique)';
end $$;

rollback;
\echo '== ROLLBACK fait : rien n''est appliqué.'
-- REJEU]]
-- [[APPLY

do $$
begin
  if public.lancement_universitaire_actif() then raise exception 'NEXUS: l''interrupteur doit rester OFF'; end if;
  if exists (select 1 from auth.users where id = (select neuf from _t)) then raise exception 'NEXUS: compte témoin resté'; end if;
end $$;
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'cegep_lot_d2a_recruteur_universitaire', array[contenu], 'bptds22@gmail.com' from _d2a;

insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_CEGEP_LOT_D2A',
       'Chantier cégep, lot D2a : inscription du recruteur universitaire côté base, sous lancement_universitaire (OFF) (GO BP)',
       jsonb_build_object('nom', 'cegep_lot_d2a_recruteur_universitaire', 'version', version,
         'fichier', 'supabase/migrations/' || version || '_cegep_lot_d2a_recruteur_universitaire.sql',
         'rollback', 'supabase/rollback/' || version || '_rollback_cegep_lot_d2a_recruteur_universitaire.sql',
         'md5_fichier', '@@MD5_MIGRATION@@', 'md5_rollback', '@@MD5_ROLLBACK@@', 'voie', 'psql (session pooler)'),
       (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0')
  from _d2a;
do $$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '@@VERSION@@') then
    raise exception 'NEXUS: inscription schema_migrations absente';
  end if;
end $$;
select version as version_inscrite, clock_timestamp() as avant_commit from _d2a;
commit;
\echo '== COMMIT fait : lot D2a cégep en prod (inscription du recruteur universitaire, interrupteur OFF).'
-- APPLY]]
