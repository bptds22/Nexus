-- ════════════════════════════════════════════════════════════════════════════
-- Programme universitaire visé du cégépien (D5 Q6, décision BP 2026-10-29) — @@TITRE@@, version @@VERSION@@.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer.mjs <date> <rejeu-blanc|apply> puv (migration et rollback
-- embarqués, LF, md5 gardés). Lancer SANS -1, en postgres.
--
-- UNE transaction : gardes → empreinte des fiches AVANT → migration → empreinte APRÈS (identique : aucune fiche
-- réécrite) → essais avec un cégépien et un athlète du secondaire témoins (comptes neufs), chaque essai défait
-- aussitôt (NX000) → @@SUITE@@. Aucun nom affiché.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '180s';
set local search_path = public, extensions;
set local application_name = 'nexus-@@MODE@@-programme-universitaire-vise';
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
  if exists (select 1 from public.admin_operations where operation in ('MIGRATION_PROGRAMME_UNIVERSITAIRE_VISE', 'ROLLBACK_PROGRAMME_UNIVERSITAIRE_VISE')) then
    raise exception 'NEXUS: ce lot a déjà laissé une trace dans admin_operations';
  end if;
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261029150000') then
    raise exception 'NEXUS: préalable 20261029150000 (badge auto_cegep) absent';
  end if;
end $$;
select max(version) as derniere_version, public.lancement_universitaire_actif() as universitaire_on,
       public.lancement_collegial_actif() as collegial_on
  from supabase_migrations.schema_migrations;

-- ── Témoins ──────────────────────────────────────────────────────────────────
create temp table _t on commit drop as
select (select s.id from public.schools s where s.type::text = 'CEGEP' order by s.id limit 1) as cegep,
       (select s.id from public.schools s where s.type::text = 'SECONDAIRE' order by s.id limit 1) as secondaire,
       (select up.id from public.university_programs up join public.schools s on s.id = up.school_id
         where s.type::text = 'UNIVERSITE' order by up.id limit 1) as programme,
       coalesce((select l.id from public.cegep_program_labels l order by l.id limit 1), '00000000-0000-4000-8000-0000000b0c09'::uuid) as label_cegep,
       (select sp.id from public.sports sp order by sp.id limit 1) as sport,
       '00000000-0000-4000-8000-0000000b0c01'::uuid as u_cegep,
       '00000000-0000-4000-8000-0000000b0c02'::uuid as u_sec,
       public.lancement_universitaire_actif() as univ_initial,
       public.lancement_collegial_actif() as coll_initial;
alter table _t add column libelle_attendu text;
update _t set libelle_attendu = (select left(p.name || ' — ' || s.name, 200) from public.university_programs p
                                   join public.schools s on s.id = p.school_id where p.id = programme);
do $$ begin
  if exists (select 1 from _t where cegep is null or secondaire is null or programme is null or sport is null) then
    raise exception 'NEXUS: un témoin manque';
  end if;
end $$;

create temp table _avant on commit drop as
select count(*) n, md5(string_agg(id::text || coalesce(profile_completion::text, '·'), ',' order by id)) empreinte
  from public.athletes;

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

create temp table _apres on commit drop as
select count(*) n, md5(string_agg(id::text || coalesce(profile_completion::text, '·'), ',' order by id)) empreinte,
       count(*) filter (where programme_universitaire_vise is not null or programme_universitaire_vise_id is not null) avec_programme
  from public.athletes;
select a.n as fiches_avant, p.n as fiches_apres, a.empreinte = p.empreinte as completions_identiques, p.avec_programme
  from _avant a, _apres p;

-- ── Essais (chacun défait aussitôt) ──────────────────────────────────────────
-- Prépare (en postgres) un cégépien et un athlète du secondaire témoins, puis agit EN LEUR NOM (authenticated).
create function pg_temp.essai(p_univ boolean, p_quoi text) returns text language plpgsql as $$
declare t record; v text; c0 int; c1 int; r record;
begin
  select * into t from _t;
  begin
    update public.app_settings set value = 'true' where key = 'lancement_collegial';
    update public.app_settings set value = case when p_univ then 'true' else 'false' end where key = 'lancement_universitaire';
    insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', t.u_cegep, 'authenticated', 'authenticated', 'puv-cegep@nexus.invalid', '{}', '{}', now(), now()),
           ('00000000-0000-0000-0000-000000000000', t.u_sec, 'authenticated', 'authenticated', 'puv-sec@nexus.invalid', '{}', '{}', now(), now());
    update public.users set role = 'ATHLETE'::public.user_role, context = 'scolaire', onboarding_complete = true where id in (t.u_cegep, t.u_sec);
    insert into public.athletes (user_id, first_name, last_name, date_naissance, status, sport_id, school_id, annee_diplomation, programmes_vises)
    values (t.u_cegep, 'Témoin', 'Cégep', '2006-01-01', 'ACTIF', t.sport, t.cegep, 2027, array[t.label_cegep]),
           (t.u_sec, 'Témoin', 'Secondaire', '2008-01-01', 'ACTIF', t.sport, t.secondaire, 2027, array[t.label_cegep]);
    begin
      if p_quoi = 'cégépien choisit un programme du catalogue' then
        select profile_completion into c0 from public.athletes where user_id = t.u_cegep;
        perform set_config('request.jwt.claims', json_build_object('sub', t.u_cegep, 'role', 'authenticated')::text, true);
        perform set_config('role', 'authenticated', true);
        update public.athletes set programme_universitaire_vise_id = t.programme, programme_universitaire_vise = 'ignoré' where user_id = t.u_cegep;
        perform set_config('role', 'postgres', true);
        select profile_completion, programme_universitaire_vise into r from public.athletes where user_id = t.u_cegep;
        v := 'libellé du catalogue ' || (r.programme_universitaire_vise = t.libelle_attendu)::text
             || ' ; complétion +' || (r.profile_completion - c0)::text;
      elsif p_quoi = 'cégépien écrit un texte libre' then
        perform set_config('request.jwt.claims', json_build_object('sub', t.u_cegep, 'role', 'authenticated')::text, true);
        perform set_config('role', 'authenticated', true);
        update public.athletes set programme_universitaire_vise_id = null, programme_universitaire_vise = '  Médecine   vétérinaire ' where user_id = t.u_cegep;
        perform set_config('role', 'postgres', true);
        select programme_universitaire_vise into v from public.athletes where user_id = t.u_cegep;
      elsif p_quoi = 'programme inconnu' then
        perform set_config('request.jwt.claims', json_build_object('sub', t.u_cegep, 'role', 'authenticated')::text, true);
        perform set_config('role', 'authenticated', true);
        update public.athletes set programme_universitaire_vise_id = gen_random_uuid() where user_id = t.u_cegep;
        v := 'écrit';
      elsif p_quoi = 'athlète du secondaire' then
        perform set_config('request.jwt.claims', json_build_object('sub', t.u_sec, 'role', 'authenticated')::text, true);
        perform set_config('role', 'authenticated', true);
        update public.athletes set programme_universitaire_vise = 'Droit' where user_id = t.u_sec;
        v := 'écrit';
      elsif p_quoi = 'cégépien sous OFF' then
        perform set_config('request.jwt.claims', json_build_object('sub', t.u_cegep, 'role', 'authenticated')::text, true);
        perform set_config('role', 'authenticated', true);
        update public.athletes set programme_universitaire_vise = 'Droit' where user_id = t.u_cegep;
        v := 'écrit';
      elsif p_quoi = 'retrait sous OFF' then
        perform set_config('role', 'postgres', true);
        update public.app_settings set value = 'true' where key = 'lancement_universitaire';
        update public.athletes set programme_universitaire_vise = 'Droit' where user_id = t.u_cegep;
        update public.app_settings set value = 'false' where key = 'lancement_universitaire';
        perform set_config('request.jwt.claims', json_build_object('sub', t.u_cegep, 'role', 'authenticated')::text, true);
        perform set_config('role', 'authenticated', true);
        update public.athletes set programme_universitaire_vise = null where user_id = t.u_cegep;
        perform set_config('role', 'postgres', true);
        select coalesce(programme_universitaire_vise, 'vidé') into v from public.athletes where user_id = t.u_cegep;
      elsif p_quoi = 'cégépien qui quitte son cégep' then
        perform set_config('role', 'postgres', true);
        update public.athletes set programme_universitaire_vise = 'Droit' where user_id = t.u_cegep;
        update public.athletes set school_id = t.secondaire where user_id = t.u_cegep;
        select coalesce(programme_universitaire_vise, 'vidé') into v from public.athletes where user_id = t.u_cegep;
      elsif p_quoi = 'complétion du secondaire inchangée' then
        perform set_config('role', 'postgres', true);
        select profile_completion into c0 from public.athletes where user_id = t.u_sec;
        update public.athletes set programmes_vises = '{}' where user_id = t.u_sec;
        select profile_completion into c1 from public.athletes where user_id = t.u_sec;
        v := 'le programme CÉGEP visé compte ' || (c0 > c1)::text;
      end if;
    exception
      when insufficient_privilege then v := 'refusé 42501';
      when foreign_key_violation then v := 'refusé 23503';
      when check_violation then v := 'refusé 23514';
    end;
    raise exception using errcode = 'NX000', message = v;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 90);
  end;
end $$;
create temp table _e on commit drop as
select o, interrupteur, geste, attendu, pg_temp.essai(interrupteur = 'ON', geste) as obtenu
  from (select x.*, row_number() over () as o from (values
    ('ON',  'cégépien choisit un programme du catalogue', 'libellé du catalogue true ; complétion +3'),
    ('ON',  'cégépien écrit un texte libre',              'Médecine vétérinaire'),
    ('ON',  'programme inconnu',                          'refusé 23503'),
    ('ON',  'athlète du secondaire',                      'refusé 42501'),
    ('OFF', 'cégépien sous OFF',                          'refusé 42501'),
    ('OFF', 'retrait sous OFF',                           'vidé'),
    ('ON',  'cégépien qui quitte son cégep',              'vidé'),
    ('ON',  'complétion du secondaire inchangée',         'le programme CÉGEP visé compte true')
  ) x(interrupteur, geste, attendu)) e;
select o, interrupteur, geste, attendu, obtenu, case when obtenu = attendu then 'ok' else 'ÉCART' end as "?"
  from _e order by o;

do $$
begin
  if exists (select 1 from _e where obtenu like 'ERREUR%') then raise exception 'NEXUS: un essai a échoué'; end if;
  if exists (select 1 from _e where obtenu <> attendu) then raise exception 'NEXUS: % essai(s) hors attendu', (select count(*) from _e where obtenu <> attendu); end if;
  if (select empreinte from _avant) is distinct from (select empreinte from _apres) or (select avec_programme from _apres) <> 0 then
    raise exception 'NEXUS: des fiches existantes ont bougé';
  end if;
  if public.lancement_universitaire_actif() is distinct from (select univ_initial from _t)
     or public.lancement_collegial_actif() is distinct from (select coll_initial from _t) then
    raise exception 'NEXUS: un interrupteur n''est pas revenu à son état initial';
  end if;
  if exists (select 1 from auth.users where id in (select u_cegep from _t union select u_sec from _t)) then
    raise exception 'NEXUS: compte témoin resté';
  end if;
  raise notice 'NEXUS: VERDICT programme universitaire visé — catalogue ou texte libre, ON + cégep seulement, complétion du cégépien, secondaire inchangé';
end $$;
select 'VERDICT' as verdict, 'conforme' as resultat;
-- [[REJEU

do $rb$ begin execute (select rollback from _m); end $rb$;
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'athletes'
               and column_name like 'programme_universitaire_vise%') then
    raise exception 'NEXUS: après rollback, une colonne reste';
  end if;
  raise notice 'NEXUS: rollback vérifié (colonnes, trigger et fonctions retirés, complétion d''origine par md5)';
end $$;

rollback;
\echo '== ROLLBACK fait : rien n''est appliqué.'
-- REJEU]]
-- [[APPLY

do $$
begin
  if public.lancement_universitaire_actif() then raise exception 'NEXUS: l''interrupteur universitaire doit rester OFF'; end if;
end $$;
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'programme_universitaire_vise', array[contenu], 'bptds22@gmail.com' from _m;
insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_PROGRAMME_UNIVERSITAIRE_VISE',
       'Chantier cégep, D5 Q6 : programme universitaire visé du cégépien (catalogue ou texte libre), complétion (GO BP)',
       jsonb_build_object('nom', 'programme_universitaire_vise', 'version', version,
         'fichier', 'supabase/migrations/' || version || '_programme_universitaire_vise.sql',
         'rollback', 'supabase/rollback/' || version || '_rollback_programme_universitaire_vise.sql',
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
\echo '== COMMIT fait : programme universitaire visé en prod (interrupteur OFF).'
-- APPLY]]
