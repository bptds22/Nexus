-- ════════════════════════════════════════════════════════════════════════════
-- Lot C1a cégep — REJEU À BLANC de la migration 20261027230000 (valeur auto_cegep de
-- verification_method). Fichier GÉNÉRÉ par scripts/cegep-lot-c1/generer.sh c1a <date> rejeu-blanc :
-- migration embarquée (LF), md5 gardé.
--
-- UNE transaction qui finit par ROLLBACK : RIEN n'est appliqué. Gardes → valeurs avant → migration →
-- valeurs après → empreinte (seul l'enum change) → ROLLBACK → relecture.
-- Gardes : lancé en postgres, interrupteur lancement_collegial OFF, valeur auto_cegep absente, version
-- non inscrite dans schema_migrations, dernière version = 20261027210000 (C0).
-- PAS DE ROLLBACK pour C1a : une valeur d'enum ne se retire pas sans réécrire le type ; seule, elle est
-- inerte (aucune ligne ne la porte, rien ne s'en sert tant que C1b n'est pas appliquée).
-- Lancer SANS -1, en postgres.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';
set local search_path = public, extensions;
set local application_name = 'nexus-rejeu-blanc-cegep-c1a';
select now() as debut, current_user, current_setting('server_version') as version;

do $$
declare v text;
begin
  if current_user <> 'postgres' then
    raise exception 'NEXUS: lancer en postgres, pas en %', current_user;
  end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '20261027230000') then
    raise exception 'NEXUS: version 20261027230000 déjà inscrite';
  end if;
  -- Gardes demandées par BP (2026-10-27) : interrupteur OFF, valeur absente.
  if to_regprocedure('public.lancement_collegial_actif()') is null then
    raise exception 'NEXUS: C0 absent (lancement_collegial_actif introuvable)';
  end if;
  if public.lancement_collegial_actif() then
    raise exception 'NEXUS: l''interrupteur lancement_collegial est ON — C1a se joue interrupteur OFF';
  end if;
  if exists (select 1 from pg_enum where enumtypid = 'public.verification_method'::regtype
                                     and enumlabel = 'auto_cegep') then
    raise exception 'NEXUS: la valeur auto_cegep existe déjà dans verification_method';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '20261027230000' then raise exception 'NEXUS: version 20261027230000 pas après la dernière (%) — régénérer', v; end if;
  if v <> '20261027210000' then raise exception 'NEXUS: dernière version % au lieu de 20261027210000 (C0)', v; end if;
end $$;

create function pg_temp.valeurs() returns text language sql as $$
  select string_agg(enumlabel, ',' order by enumsortorder) from pg_enum
   where enumtypid = 'public.verification_method'::regtype;
$$;
create function pg_temp.empreinte() returns table (ligne text) language sql as $$
  select 'F ' || p.oid::regprocedure::text || ' ' || md5(p.prosrc) || ' ' || coalesce(p.proacl::text, '·')
    from pg_proc p where p.pronamespace = 'public'::regnamespace
  union all
  select 'P ' || tablename || ' ' || policyname || ' ' || md5(coalesce(qual, '')) || ' ' || md5(coalesce(with_check, ''))
    from pg_policies where schemaname = 'public'
  union all
  select 'T ' || c.relname || ' ' || t.tgname || ' ' || md5(pg_get_triggerdef(t.oid))
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where not t.tgisinternal and c.relnamespace = 'public'::regnamespace;
$$;
create temp table _emp_avant on commit drop as select * from pg_temp.empreinte();
select pg_temp.valeurs() as valeurs_avant, (select count(*) from _emp_avant) as lignes_empreinte;

create temp table _c1a on commit drop as
select $nexus_mig$-- NON APPLIQUÉE EN PROD. Chantier cégep, LOT C1a (GO BP 2026-10-27, décision 4) : la valeur
-- « auto_cegep » de l'enum verification_method, pour reconnaître les cégépiens vérifiés
-- automatiquement et pouvoir les remettre en gris le jour où le coach collégial existera.
--
-- Migration À PART de C1b (le trigger qui s'en sert) : une valeur ajoutée à un enum ne peut pas être
-- utilisée dans la transaction qui l'ajoute. C1b ne peut donc être rejouée à blanc qu'une fois C1a
-- en prod.
--
-- Aucune ligne n'est écrite ; aucune fonction, policy ni trigger ne change. Une valeur d'enum ne se
-- retire pas sans réécrire le type : pas de rollback, la valeur reste inerte tant que C1b n'est pas
-- appliquée (aucune ligne ne la porte).

do $garde$
begin
  if exists (select 1 from pg_enum where enumtypid = 'public.verification_method'::regtype
                                     and enumlabel = 'auto_cegep') then
    raise exception 'NEXUS: 20261027230000 déjà appliquée (auto_cegep existe)';
  end if;
  if (select string_agg(enumlabel, ',' order by enumsortorder) from pg_enum
       where enumtypid = 'public.verification_method'::regtype) is distinct from 'auto,manuel_coach,manuel_directeur' then
    raise exception 'NEXUS: verification_method n''a pas les trois valeurs relevées le 2026-10-27';
  end if;
end $garde$;

alter type public.verification_method add value 'auto_cegep';

do $garde$
begin
  if (select string_agg(enumlabel, ',' order by enumsortorder) from pg_enum
       where enumtypid = 'public.verification_method'::regtype) is distinct from 'auto,manuel_coach,manuel_directeur,auto_cegep' then
    raise exception 'NEXUS: auto_cegep absente après la migration';
  end if;
  raise notice 'NEXUS: lot C1a cégep — valeur auto_cegep ajoutée à verification_method';
end $garde$;
$nexus_mig$::text as migration;
do $m$
begin
  if (select md5(migration) from _c1a) <> '3cfa1d46d1dbe918f3a103d31a6dec6a' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(migration) from _c1a);
  end if;
  execute (select migration from _c1a);
end $m$;
set local search_path = public, extensions;

create temp table _emp_apres on commit drop as select * from pg_temp.empreinte();
select pg_temp.valeurs() as valeurs_apres,
       (select count(*) from (select * from _emp_avant except select * from _emp_apres) x) as disparues,
       (select count(*) from (select * from _emp_apres except select * from _emp_avant) x) as apparues,
       (select count(*) from public.athletes where verification_method::text = 'auto_cegep') as fiches_auto_cegep;
do $$
begin
  if pg_temp.valeurs() is distinct from 'auto,manuel_coach,manuel_directeur,auto_cegep' then
    raise exception 'NEXUS: valeurs inattendues après la migration';
  end if;
  if exists (select * from _emp_avant except select * from _emp_apres)
     or exists (select * from _emp_apres except select * from _emp_avant) then
    raise exception 'NEXUS: la migration C1a change une fonction, une policy ou un trigger';
  end if;
end $$;
select 'VERDICT : seule la valeur auto_cegep s''ajoute ; aucune fonction, policy, trigger ni ligne ne change' as verdict,
       clock_timestamp() as avant_rollback;
rollback;

select (select string_agg(enumlabel, ',' order by enumsortorder) from pg_enum
         where enumtypid = 'public.verification_method'::regtype) as valeurs_hors_transaction,
       (select max(version) from supabase_migrations.schema_migrations) as derniere_version;
\echo '== ROLLBACK fait : rien n''est appliqué.'
