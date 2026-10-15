-- D1 — RETRAIT complet (local ; en prod seulement sur GO de BP). Une transaction.
--   docker cp docs/doublons-d1/rollback-d1.sql supabase_db_Nexus:/tmp/rollback-d1.sql
--   docker exec -e PGCLIENTENCODING=UTF8 supabase_db_Nexus psql -U postgres -d postgres -v ON_ERROR_STOP=1 -1 -f /tmp/rollback-d1.sql
-- Ne touche à AUCUNE fiche athlète : retire le trigger, les 3 fonctions, les 2 tables (et leur
-- contenu : la file et le journal), la tâche de purge et l'enregistrement de la version.

drop trigger if exists trg_doublons_probables_noter on public.athletes;
drop function if exists public.doublons_probables_noter();
drop function if exists public.inscription_doublon_possible(text, text, date);
drop function if exists public.coach_athletes_meme_identite(text, text, date);
drop table if exists public.doublons_verifications;
drop table if exists public.doublons_probables;
select cron.unschedule(jobid) from cron.job where jobname = 'doublons-verifications-purge';
delete from supabase_migrations.schema_migrations where version = '20261015094834';

do $$
begin
  if to_regclass('public.doublons_probables') is not null or to_regclass('public.doublons_verifications') is not null
     or exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace
                  and proname in ('doublons_probables_noter', 'inscription_doublon_possible', 'coach_athletes_meme_identite'))
     or exists (select 1 from pg_trigger where tgname = 'trg_doublons_probables_noter')
     or exists (select 1 from cron.job where jobname = 'doublons-verifications-purge')
     or exists (select 1 from supabase_migrations.schema_migrations where version = '20261015094834') then
    raise exception 'NEXUS: retrait D1 incomplet';
  end if;
  raise notice 'NEXUS D1 retiré : aucun objet D1 restant';
end $$;
