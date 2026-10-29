-- ════════════════════════════════════════════════════════════════════════════
-- Badge du cégépien auto_cegep (suite C1b, décision BP 2026-10-29) — @@TITRE@@, version @@VERSION@@.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer.mjs <date> <rejeu-blanc|apply> badge (migration et rollback
-- embarqués, LF, md5 gardés). Lancer SANS -1, en postgres.
--
-- UNE transaction : gardes → témoin (1re fiche auto_cegep vérifiée sans date) → essai « avis » AVANT →
-- migration → fiche témoin comparée (seule la date change) → essais APRÈS (avis, nouveau cégépien témoin,
-- chaque essai défait aussitôt, NX000) → aucun avis écrit → @@SUITE@@. Aucun nom affiché.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-@@MODE@@-badge-auto-cegep';
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
  if exists (select 1 from public.admin_operations where operation in ('MIGRATION_BADGE_AUTO_CEGEP', 'ROLLBACK_BADGE_AUTO_CEGEP')) then
    raise exception 'NEXUS: ce lot a déjà laissé une trace dans admin_operations';
  end if;
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261027230100') then
    raise exception 'NEXUS: préalable C1b (verification_auto_cegep) absent';
  end if;
end $$;
select max(version) as derniere_version, public.lancement_collegial_actif() as collegial_on
  from supabase_migrations.schema_migrations;

-- ── Témoins ──────────────────────────────────────────────────────────────────
create temp table _t on commit drop as
select (select a.id from public.athletes a where a.verification_method = 'auto_cegep' and a.verified is true
          and a.last_profile_validation is null order by a.verified_at, a.id limit 1) as a_temoin,
       (select count(*) from public.athletes a where a.verification_method = 'auto_cegep' and a.verified is true
          and a.last_profile_validation is null) as a_rattraper,
       (select s.id from public.schools s where s.type::text = 'CEGEP' order by s.id limit 1) as cegep,
       (select sp.id from public.sports sp order by sp.id limit 1) as sport,
       '00000000-0000-4000-8000-0000000ba001'::uuid as neuf,
       public.lancement_collegial_actif() as collegial_initial,
       (extract(day from (now() at time zone 'America/Montreal')) > 15) as apres_le_15,
       (select count(*) from public.athlete_notifications) as avis_avant;
alter table _t add column u_temoin uuid, add column ids_rattrapes uuid[];
update _t set u_temoin = (select user_id from public.athletes where id = a_temoin),
              ids_rattrapes = (select array_agg(a.id order by a.id) from public.athletes a where a.verification_method = 'auto_cegep'
                                 and a.verified is true and a.last_profile_validation is null);
do $$ begin
  if exists (select 1 from _t where a_temoin is null or u_temoin is null or cegep is null or sport is null) then
    raise exception 'NEXUS: un témoin manque';
  end if;
end $$;
select a_rattraper as fiches_a_rattraper, apres_le_15, collegial_initial from _t;

create temp table _fiche_avant on commit drop as
select to_jsonb(a) - 'last_profile_validation' - 'updated_at' - 'profile_completion' as reste, a.verified_at
  from public.athletes a where a.id = (select a_temoin from _t);

-- ── Essais (chacun défait aussitôt) ──────────────────────────────────────────
create function pg_temp.essai(p_quoi text) returns text language plpgsql as $$
declare t record; v text; r record;
begin
  select * into t from _t;
  begin
    if p_quoi = 'avis badge pour la fiche témoin' then
      perform set_config('request.jwt.claims', json_build_object('sub', t.u_temoin, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      v := 'avis créé ' || public.ensure_validation_notice()::text;
    elsif p_quoi = 'nouveau cégépien' then
      update public.app_settings set value = 'true' where key = 'lancement_collegial';
      insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
      values ('00000000-0000-0000-0000-000000000000', t.neuf, 'authenticated', 'authenticated', 'badge-temoin@nexus.invalid', '{}', '{}', now(), now());
      update public.users set role = 'ATHLETE'::public.user_role, context = 'scolaire', onboarding_complete = true where id = t.neuf;
      insert into public.athletes (user_id, first_name, last_name, date_naissance, status, sport_id, school_id, annee_diplomation)
      values (t.neuf, 'Témoin', 'Badge', '2006-01-01', 'ACTIF', t.sport, t.cegep, 2027);
      select a.verified, a.verification_method, a.last_profile_validation is not distinct from a.verified_at as date_ok,
             a.last_profile_validation >= date_trunc('month', now()) as ce_mois
        into r from public.athletes a where a.user_id = t.neuf;
      perform set_config('request.jwt.claims', json_build_object('sub', t.neuf, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      v := 'vérifié ' || r.verified || ' ' || r.verification_method || ' ; date = vérification ' || r.date_ok
           || ' ; ce mois ' || r.ce_mois || ' ; avis créé ' || public.ensure_validation_notice()::text;
    end if;
    raise exception using errcode = 'NX000', message = v;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 90);
  end;
end $$;

create temp table _e on commit drop as
select 1 as o, 'AVANT' as moment, 'avis badge pour la fiche témoin'::text as geste,
       'avis créé ' || (select apres_le_15 from _t)::text as attendu,
       pg_temp.essai('avis badge pour la fiche témoin') as obtenu;

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

insert into _e
select 2, 'APRÈS', 'avis badge pour la fiche témoin', 'avis créé false', pg_temp.essai('avis badge pour la fiche témoin')
union all
select 3, 'APRÈS', 'nouveau cégépien', 'vérifié true auto_cegep ; date = vérification true ; ce mois true ; avis créé false',
       pg_temp.essai('nouveau cégépien');
select o, moment, geste, attendu, obtenu, case when obtenu = attendu then 'ok' else 'ÉCART' end as "?" from _e order by o;

select (select count(*) from public.athletes a where a.id = any((select ids_rattrapes from _t)::uuid[]) and a.last_profile_validation = a.verified_at) as fiches_rattrapees,
       (select reste from _fiche_avant) = (select to_jsonb(a) - 'last_profile_validation' - 'updated_at' - 'profile_completion'
                                             from public.athletes a where a.id = (select a_temoin from _t)) as temoin_reste_identique,
       (select count(*) from public.athlete_notifications) - (select avis_avant from _t) as avis_ecrits;

do $$
begin
  if exists (select 1 from _e where obtenu like 'ERREUR%') then raise exception 'NEXUS: un essai a échoué'; end if;
  if exists (select 1 from _e where obtenu <> attendu) then raise exception 'NEXUS: % essai(s) hors attendu', (select count(*) from _e where obtenu <> attendu); end if;
  if (select count(*) from public.athletes a where a.id = any((select ids_rattrapes from _t)::uuid[]) and a.last_profile_validation = a.verified_at)
     <> (select a_rattraper from _t) then
    raise exception 'NEXUS: rattrapage incomplet';
  end if;
  if (select reste from _fiche_avant) is distinct from (select to_jsonb(a) - 'last_profile_validation' - 'updated_at' - 'profile_completion'
                                                          from public.athletes a where a.id = (select a_temoin from _t)) then
    raise exception 'NEXUS: la fiche témoin a changé ailleurs que sa date de validation';
  end if;
  if (select count(*) from public.athlete_notifications) <> (select avis_avant from _t) then raise exception 'NEXUS: un avis a été écrit'; end if;
  if public.lancement_collegial_actif() is distinct from (select collegial_initial from _t) then
    raise exception 'NEXUS: l''interrupteur collégial n''est pas revenu à son état initial';
  end if;
  if exists (select 1 from auth.users where id = (select neuf from _t)) then raise exception 'NEXUS: compte témoin resté'; end if;
  raise notice 'NEXUS: VERDICT badge auto_cegep — fiches datées, nouveau cégépien daté, aucun avis « badge désactivé »';
end $$;
select 'VERDICT' as verdict, 'conforme' as resultat;
-- [[REJEU

do $rb$ begin execute (select rollback from _m); end $rb$;
do $$
begin
  if exists (select 1 from public.athletes a where a.id = any((select ids_rattrapes from _t)::uuid[]) and a.last_profile_validation is not null) then
    raise exception 'NEXUS: après rollback, une date de rattrapage reste';
  end if;
  raise notice 'NEXUS: rollback vérifié (corps C1b par md5, dates du rattrapage retirées)';
end $$;

rollback;
\echo '== ROLLBACK fait : rien n''est appliqué.'
-- REJEU]]
-- [[APPLY

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'badge_auto_cegep_validation', array[contenu], 'bptds22@gmail.com' from _m;
insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_BADGE_AUTO_CEGEP',
       'Badge du cégépien vérifié automatiquement : la vérification date aussi last_profile_validation ; fiches existantes rattrapées (GO BP)',
       jsonb_build_object('nom', 'badge_auto_cegep_validation', 'version', m.version,
         'fichier', 'supabase/migrations/' || m.version || '_badge_auto_cegep_validation.sql',
         'rollback', 'supabase/rollback/' || m.version || '_rollback_badge_auto_cegep_validation.sql',
         'md5_fichier', '@@MD5_MIGRATION@@', 'md5_rollback', '@@MD5_ROLLBACK@@', 'voie', 'psql (session pooler)',
         'fiches_rattrapees', t.ids_rattrapes),
       (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0')
  from _m m, _t t;
do $$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '@@VERSION@@') then
    raise exception 'NEXUS: inscription schema_migrations absente';
  end if;
end $$;
select version as version_inscrite, clock_timestamp() as avant_commit from _m;
commit;
\echo '== COMMIT fait : badge auto_cegep daté en prod.'
-- APPLY]]
