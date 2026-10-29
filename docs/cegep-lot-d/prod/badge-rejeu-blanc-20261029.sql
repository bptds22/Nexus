-- ════════════════════════════════════════════════════════════════════════════
-- Badge du cégépien auto_cegep (suite C1b, décision BP 2026-10-29) — REJEU À BLANC (finit par ROLLBACK), version 20261029150000.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer.mjs <date> <rejeu-blanc|apply> badge (migration et rollback
-- embarqués, LF, md5 gardés). Lancer SANS -1, en postgres.
--
-- UNE transaction : gardes → témoin (1re fiche auto_cegep vérifiée sans date) → essai « avis » AVANT →
-- migration → fiche témoin comparée (seule la date change) → essais APRÈS (avis, nouveau cégépien témoin,
-- chaque essai défait aussitôt, NX000) → aucun avis écrit → rollback BADGE joué et vérifié → ROLLBACK. Aucun nom affiché.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-rejeu-blanc-badge-auto-cegep';
select now() as debut, current_user, current_setting('server_version') as version;

do $$
declare v text;
begin
  if current_user <> 'postgres' then raise exception 'NEXUS: lancer en postgres, pas en %', current_user; end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '20261029150000') then
    raise exception 'NEXUS: version 20261029150000 déjà inscrite';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '20261029150000' then raise exception 'NEXUS: version 20261029150000 pas après la dernière (%) — régénérer', v; end if;
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
select '20261029150000'::text as version,
       $nexus_mig$-- ════════════════════════════════════════════════════════════════════════════
-- Badge du cégépien vérifié automatiquement (suite du lot C1b cégep, décision BP 2026-10-29).
--
-- Défaut : verification_auto_cegep() pose verified = true sans last_profile_validation. La re-validation
-- mensuelle (lib/utils/profileValidation.ts, ensure_validation_notice()) tient une date absente pour « due » :
-- après le 15 du mois, le badge est caché (tableau de bord, profil, liste du coach) et l'athlète reçoit
-- « Ton badge vérifié a été désactivé ». En prod au 2026-10-29 : 1 fiche auto_cegep, date absente, 0 avis envoyé.
--
-- Contenu :
--   1. verification_auto_cegep() : même corps (C1b, md5 f987bdbe8ec4fadf9ff174364ce0635c) + une ligne — la vérification automatique
--      date aussi last_profile_validation (now(), sauf si une date est déjà là). Propriétaire, droits et
--      trigger inchangés (create or replace).
--   2. Rattrapage : les fiches vérifiées auto_cegep sans date reçoivent verified_at (le moment de la
--      vérification). Seule cette colonne change ; aucun trigger d'athletes n'écrit d'avis sur elle.
--
-- Rollback : supabase/rollback/20261029150000_rollback_badge_auto_cegep_validation.sql
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.verification_auto_cegep()'::regprocedure)
     is distinct from 'f987bdbe8ec4fadf9ff174364ce0635c' then
    raise exception 'NEXUS: verification_auto_cegep n''est pas le corps du lot C1b';
  end if;
end $$;

create or replace function public.verification_auto_cegep()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  -- Seul un NOUVEL ancrage est regardé, comme le verrou du lot C0 : une ligne qui garde son école
  -- passe telle quelle.
  if tg_op = 'UPDATE' and old.school_id is not distinct from new.school_id then
    return new;
  end if;
  if new.school_id is not null
     and exists (select 1 from public.schools s where s.id = new.school_id and s.type::text = 'CEGEP') then
    if not coalesce(new.verified, false) then
      new.verified := true;
      new.verification_method := 'auto_cegep';
      new.verified_at := now();
      new.verified_by := null;
      -- Daté comme une confirmation de profil : sans date, la re-validation mensuelle le tient pour expiré
      -- après le 15 (badge caché, avis « Ton badge vérifié a été désactivé »).
      new.last_profile_validation := coalesce(new.last_profile_validation, now());
    end if;
  elsif tg_op = 'UPDATE' and old.verification_method = 'auto_cegep' then
    -- Le crochet ne valait que pour le cégep : il ne suit pas l'athlète ailleurs.
    new.verified := false;
    new.verification_method := null;
    new.verified_at := null;
    new.verified_by := null;
  end if;
  return new;
end;
$function$;

update public.athletes
   set last_profile_validation = verified_at
 where verification_method = 'auto_cegep'
   and verified is true
   and last_profile_validation is null
   and verified_at is not null;

do $$
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.verification_auto_cegep()'::regprocedure)
     is distinct from '69e278f765c30134b31f523a85477e7f' then
    raise exception 'NEXUS: nouveau corps de verification_auto_cegep inattendu';
  end if;
end $$;

do $$
begin
  if exists (select 1 from public.athletes where verification_method = 'auto_cegep' and verified is true
               and last_profile_validation is null) then
    raise exception 'NEXUS: une fiche auto_cegep vérifiée reste sans date de validation';
  end if;
end $$;
$nexus_mig$::text as contenu,
       $nexus_rb$-- Rollback de 20261029150000_badge_auto_cegep_validation : corps C1b d'origine (md5 f987bdbe8ec4fadf9ff174364ce0635c) et dates du
-- rattrapage retirées (fiches auto_cegep dont la date vaut exactement verified_at, ce que pose aussi la
-- nouvelle fonction : une vérification faite entre l'apply et le rollback perd donc sa date, comme avant).

do $$
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.verification_auto_cegep()'::regprocedure)
     is distinct from '69e278f765c30134b31f523a85477e7f' then
    raise exception 'NEXUS: verification_auto_cegep n''est pas le corps de 20261029150000';
  end if;
end $$;

create or replace function public.verification_auto_cegep()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  -- Seul un NOUVEL ancrage est regardé, comme le verrou du lot C0 : une ligne qui garde son école
  -- passe telle quelle.
  if tg_op = 'UPDATE' and old.school_id is not distinct from new.school_id then
    return new;
  end if;
  if new.school_id is not null
     and exists (select 1 from public.schools s where s.id = new.school_id and s.type::text = 'CEGEP') then
    if not coalesce(new.verified, false) then
      new.verified := true;
      new.verification_method := 'auto_cegep';
      new.verified_at := now();
      new.verified_by := null;
    end if;
  elsif tg_op = 'UPDATE' and old.verification_method = 'auto_cegep' then
    -- Le crochet ne valait que pour le cégep : il ne suit pas l'athlète ailleurs.
    new.verified := false;
    new.verification_method := null;
    new.verified_at := null;
    new.verified_by := null;
  end if;
  return new;
end;
$function$;

update public.athletes
   set last_profile_validation = null
 where verification_method = 'auto_cegep'
   and last_profile_validation = verified_at;

do $$
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.verification_auto_cegep()'::regprocedure)
     is distinct from 'f987bdbe8ec4fadf9ff174364ce0635c' then
    raise exception 'NEXUS: corps C1b non restauré';
  end if;
end $$;
$nexus_rb$::text as rollback;
do $apply$
begin
  if (select md5(contenu) from _m) <> '0170b2063498dc8c5bc960d0ba942059' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _m);
  end if;
  if (select md5(rollback) from _m) <> '5d9245627d1fc40d145443e2aac0865d' then
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
