-- ════════════════════════════════════════════════════════════════════════════
-- Lot C1a cégep — REJEU À BLANC de la migration @@VERSION@@ (valeur auto_cegep de
-- verification_method). Fichier GÉNÉRÉ par scripts/cegep-lot-c1/generer.sh c1a <date> rejeu-blanc :
-- migration embarquée (LF), md5 gardé.
--
-- UNE transaction qui finit par ROLLBACK : RIEN n'est appliqué. Gardes → valeurs avant → migration →
-- valeurs après → empreinte (seul l'enum change) → ROLLBACK → relecture.
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
  if exists (select 1 from supabase_migrations.schema_migrations where version = '@@VERSION@@') then
    raise exception 'NEXUS: version @@VERSION@@ déjà inscrite';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '@@VERSION@@' then raise exception 'NEXUS: version @@VERSION@@ pas après la dernière (%) — régénérer', v; end if;
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
select $nexus_mig$@@MIGRATION@@$nexus_mig$::text as migration;
do $m$
begin
  if (select md5(migration) from _c1a) <> '@@MD5_MIGRATION@@' then
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
