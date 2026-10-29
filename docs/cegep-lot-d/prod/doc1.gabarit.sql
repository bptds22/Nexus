-- ════════════════════════════════════════════════════════════════════════════
-- Doctorats de premier cycle au catalogue des programmes universitaires (demande BP 2026-10-29) — @@TITRE@@,
-- version @@VERSION@@. Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer.mjs <date> <rejeu-blanc|apply> doc1 (migration
-- et rollback embarqués, LF, md5 gardés). Lancer SANS -1, en postgres.
--
-- UNE transaction : gardes → empreinte des programmes AVANT → migration → programmes existants identiques, attendu =
-- obtenu par université → essais avec un recruteur universitaire témoin (compte neuf, Université Laval) et l'admin,
-- chaque essai défait aussitôt (NX000) → @@SUITE@@. Aucun nom de personne affiché.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '180s';
set local search_path = public, extensions;
set local application_name = 'nexus-@@MODE@@-doctorats-1er-cycle';
select now() as debut, current_user, current_setting('server_version') as version;

do $$
declare v text;
begin
  if current_user <> 'postgres' then raise exception 'NEXUS: lancer en postgres, pas en %', current_user; end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '@@VERSION@@') then
    raise exception 'NEXUS: version @@VERSION@@ déjà inscrite';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '@@VERSION@@' then raise exception 'NEXUS: version @@VERSION@@ pas après la dernière (%) — régénérer', v; end if;
  if exists (select 1 from public.admin_operations where operation in ('MIGRATION_DOCTORATS_1ER_CYCLE', 'ROLLBACK_DOCTORATS_1ER_CYCLE')) then
    raise exception 'NEXUS: ce lot a déjà laissé une trace dans admin_operations';
  end if;
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261028150000') then
    raise exception 'NEXUS: préalable E3 (cycle libre) absent';
  end if;
end $$;
select max(version) as derniere_version, public.lancement_universitaire_actif() as interrupteur_on
  from supabase_migrations.schema_migrations;

create temp table _t on commit drop as
select (select s.id from public.schools s where s.name = 'Université Laval' and s.type = 'UNIVERSITE') as univ,
       (select u.id from public.users u where u.role = 'ADMIN'::public.user_role and u.is_platform_admin order by u.id limit 1) as u_adm,
       '00000000-0000-4000-8000-0000000d0c01'::uuid as neuf,
       public.lancement_universitaire_actif() as on_initial;
alter table _t add column v_seed uuid;
do $$ begin
  if exists (select 1 from _t where univ is null or u_adm is null) then raise exception 'NEXUS: un témoin manque'; end if;
end $$;

create temp table _avant on commit drop as
select count(*) n, md5(string_agg(id::text || school_id || name || cycle || coalesce(cycle_libelle, '') || coalesce(faculte, '')
                                  || coalesce(lien, '') || source || position || is_displayed, ',' order by id)) empreinte
  from public.university_programs;

-- ── La migration, texte gardé par son md5 ────────────────────────────────────
create temp table _m on commit drop as
select '@@VERSION@@'::text as version,
       $nexus_mig$@@MIGRATION@@$nexus_mig$::text as contenu,
       $nexus_rb$@@ROLLBACK@@$nexus_rb$::text as rollback;
do $apply$
begin
  if (select md5(contenu) from _m) <> '@@MD5_MIGRATION@@' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _m);
  end if;
  if (select md5(rollback) from _m) <> '@@MD5_ROLLBACK@@' then
    raise exception 'NEXUS: texte du rollback altéré (md5 %)', (select md5(rollback) from _m);
  end if;
  execute (select contenu from _m);
end $apply$;
set local search_path = public, extensions;

-- Les programmes d'avant n'ont pas bougé (le lot est retiré de l'empreinte).
create temp table _apres on commit drop as
select count(*) n, md5(string_agg(id::text || school_id || name || cycle || coalesce(cycle_libelle, '') || coalesce(faculte, '')
                                  || coalesce(lien, '') || source || position || is_displayed, ',' order by id)) empreinte
  from public.university_programs where id not in (select id from _doc1);
select a.n as programmes_avant, p.n as autres_programmes_apres, a.empreinte = p.empreinte as identiques,
       (select count(*) from public.university_programs where cycle = 'doctorat_1er_cycle') as doctorats_1er_cycle
  from _avant a, _apres p;

-- Attendu (relevé) contre obtenu (base), par université.
create temp table _o on commit drop as
select d.universite, count(*) as attendus,
       (select count(*) from public.university_programs up join public.schools s on s.id = up.school_id
         where s.name = d.universite and s.type = 'UNIVERSITE' and up.cycle = 'doctorat_1er_cycle' and up.source = 'seed') as obtenus
  from _doc1 d group by d.universite;
select universite, attendus, obtenus, case when attendus = obtenus then 'ok' else 'ÉCART' end as "?" from _o order by universite;
update _t set v_seed = (select up.id from public.university_programs up where up.school_id = univ and up.cycle = 'doctorat_1er_cycle'
                         and up.id in (select id from _doc1) order by up.id limit 1);

-- ── Essais ───────────────────────────────────────────────────────────────────
create function pg_temp.essai(p_on boolean, p_uid uuid, p_quoi text) returns text language plpgsql as $$
declare t record; v text; n int;
begin
  select * into t from _t;
  begin
    update public.app_settings set value = case when p_on then 'true' else 'false' end where key = 'lancement_universitaire';
    insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', t.neuf, 'authenticated', 'authenticated', 'doc1-temoin@nexus.invalid', '{}', '{}', now(), now());
    update public.users set role = 'RECRUTEUR'::public.user_role, context = 'universitaire', school_id = t.univ,
           primary_team_id = null, onboarding_complete = true, role_claimed_at = now() where id = t.neuf;
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    begin
      if p_quoi = 'garde un doctorat pré-rempli, en ajoute un' then
        n := public.replace_university_programs(t.univ, jsonb_build_array(
               jsonb_build_object('id', t.v_seed, 'name', (select name from public.university_programs where id = t.v_seed),
                                  'cycle', 'doctorat_1er_cycle',
                                  'faculte', (select faculte from public.university_programs where id = t.v_seed),
                                  'lien', (select lien from public.university_programs where id = t.v_seed)),
               jsonb_build_object('name', 'Doctorat essai', 'cycle', 'doctorat_1er_cycle')), true);
        v := n || ' ; seed gardé ' || (select source from public.university_programs where id = t.v_seed);
      elsif p_quoi = 'doctorat pré-rempli renommé' then
        n := public.replace_university_programs(t.univ, jsonb_build_array(
               jsonb_build_object('id', t.v_seed, 'name', 'Doctorat renommé', 'cycle', 'doctorat_1er_cycle')), true);
        v := n || ' ; devient ' || (select source from public.university_programs where id = t.v_seed);
      elsif p_quoi = 'cycle inconnu' then
        n := public.replace_university_programs(t.univ, jsonb_build_array(jsonb_build_object('name', 'X', 'cycle', 'doctorat_2e_cycle')), true);
        v := n::text;
      elsif p_quoi = 'écriture directe doctorat 1er cycle avec libellé' then
        insert into public.university_programs (school_id, name, cycle, cycle_libelle) values (t.univ, 'Direct', 'doctorat_1er_cycle', 'X');
        v := 'écrit';
      elsif p_quoi = 'écriture directe doctorat 1er cycle' then
        insert into public.university_programs (school_id, name, cycle) values (t.univ, 'Direct', 'doctorat_1er_cycle');
        v := 'écrit';
      end if;
    exception
      when insufficient_privilege then v := 'refusé 42501';
      when check_violation then v := 'refusé 23514';
      when raise_exception then v := 'refusé P0001';
    end;
    raise exception using errcode = 'NX000', message = v;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 70);
  end;
end $$;
create temp table _e on commit drop as
select o, interrupteur, appelant, geste, attendu, pg_temp.essai(interrupteur = 'ON', uid, geste) as obtenu
  from (select x.*, row_number() over () as o from _t t, lateral (values
    ('ON',  'recruteur universitaire', t.neuf,  'garde un doctorat pré-rempli, en ajoute un',      '2 ; seed gardé seed'),
    ('ON',  'recruteur universitaire', t.neuf,  'doctorat pré-rempli renommé',                     '1 ; devient manuel'),
    ('ON',  'recruteur universitaire', t.neuf,  'cycle inconnu',                                   'refusé P0001'),
    ('ON',  'recruteur universitaire', t.neuf,  'écriture directe doctorat 1er cycle',             'écrit'),
    ('OFF', 'recruteur universitaire', t.neuf,  'garde un doctorat pré-rempli, en ajoute un',      'refusé 42501'),
    ('OFF', 'admin',                   t.u_adm, 'écriture directe doctorat 1er cycle avec libellé', 'refusé 23514'),
    ('OFF', 'admin',                   t.u_adm, 'écriture directe doctorat 1er cycle',             'écrit')
  ) x(interrupteur, appelant, uid, geste, attendu)) e;
select o, interrupteur, appelant, geste, attendu, obtenu, case when obtenu = attendu then 'ok' else 'ÉCART' end as "?"
  from _e order by o;

do $$
begin
  if exists (select 1 from _e where obtenu like 'ERREUR%') then raise exception 'NEXUS: un essai a échoué'; end if;
  if exists (select 1 from _e where obtenu <> attendu) then raise exception 'NEXUS: % essai(s) hors attendu', (select count(*) from _e where obtenu <> attendu); end if;
  if exists (select 1 from _o where attendus <> obtenus) then
    raise exception 'NEXUS: écart attendu / obtenu pour %', (select string_agg(universite, ', ') from _o where attendus <> obtenus);
  end if;
  if (select empreinte from _avant) is distinct from (select empreinte from _apres) then
    raise exception 'NEXUS: les programmes existants ont bougé';
  end if;
  if (select count(*) from public.university_programs where cycle = 'doctorat_1er_cycle') <> (select count(*) from _doc1) then
    raise exception 'NEXUS: nombre de doctorats de 1er cycle différent du relevé';
  end if;
  if public.lancement_universitaire_actif() is distinct from (select on_initial from _t) then
    raise exception 'NEXUS: l''interrupteur n''est pas revenu à son état initial';
  end if;
  if exists (select 1 from auth.users where id = (select neuf from _t)) then raise exception 'NEXUS: compte témoin resté'; end if;
  raise notice 'NEXUS: VERDICT doctorats — cycle « doctorat de 1er cycle » ajouté, % programmes pré-remplis, attendu = obtenu, programmes existants intacts',
    (select count(*) from _doc1);
end $$;
select 'VERDICT' as verdict, 'conforme' as resultat;
-- [[REJEU

do $rb$ begin execute (select rollback from _m); end $rb$;
do $$
begin
  if exists (select 1 from public.university_programs where id in (select id from _doc1)) then
    raise exception 'NEXUS: après rollback, un programme du lot reste';
  end if;
  if (select md5(string_agg(id::text || school_id || name || cycle || coalesce(cycle_libelle, '') || coalesce(faculte, '')
                            || coalesce(lien, '') || source || position || is_displayed, ',' order by id)) from public.university_programs)
     is distinct from (select empreinte from _avant) then
    raise exception 'NEXUS: après rollback, les programmes ne sont pas revenus à l''état d''avant';
  end if;
  raise notice 'NEXUS: rollback doctorats vérifié (lot retiré, contrainte et RPC E3 par md5, programmes identiques à avant)';
end $$;

rollback;
\echo '== ROLLBACK fait : rien n''est appliqué.'
-- REJEU]]
-- [[APPLY

do $$
begin
  if public.lancement_universitaire_actif() then raise exception 'NEXUS: l''interrupteur doit rester OFF'; end if;
end $$;
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'doctorats_premier_cycle', array[contenu], 'bptds22@gmail.com' from _m;
insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_DOCTORATS_1ER_CYCLE',
       'Catalogue universitaire : cycle « doctorat de 1er cycle » et doctorats professionnels pré-remplis, sources citées (GO BP)',
       jsonb_build_object('nom', 'doctorats_premier_cycle', 'version', version,
         'fichier', 'supabase/migrations/' || version || '_doctorats_premier_cycle.sql',
         'rollback', 'supabase/rollback/' || version || '_rollback_doctorats_premier_cycle.sql',
         'sources', 'docs/cegep-lot-d/doctorats-1er-cycle.json', 'programmes', (select count(*) from _doc1),
         'md5_fichier', '@@MD5_MIGRATION@@', 'md5_rollback', '@@MD5_ROLLBACK@@', 'voie', 'psql (session pooler)'),
       (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0')
  from _m;
do $$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '@@VERSION@@') then
    raise exception 'NEXUS: inscription schema_migrations absente';
  end if;
end $$;
select version as version_inscrite, clock_timestamp() as avant_commit from _m;
commit;
\echo '== COMMIT fait : doctorats de premier cycle au catalogue en prod (interrupteur OFF).'
-- APPLY]]
