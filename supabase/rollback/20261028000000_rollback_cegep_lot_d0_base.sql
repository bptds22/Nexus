-- Rollback de 20261028000000_cegep_lot_d0_base : retire le verrou, l'interrupteur, la colonne province et
-- rend aux trois CHECK leurs listes du 2026-10-27. Refuse s'il reste une université, un compte au contexte
-- universitaire ou un suivi RSEQ « Universitaire » : les retirer est une décision à part (sur GO).
do $garde$
begin
  if to_regprocedure('public.verrou_universites()') is null then
    raise exception 'NEXUS: 20261028000000 absente, rien à annuler';
  end if;
  if exists (select 1 from public.schools where type = 'UNIVERSITE') then
    raise exception 'NEXUS: des universités existent — rollback D0 refusé';
  end if;
  if exists (select 1 from public.users where context = 'universitaire') then
    raise exception 'NEXUS: des comptes ont le contexte universitaire — rollback D0 refusé';
  end if;
  if exists (select 1 from public.rseq_watch_leagues where secteur = 'Universitaire') then
    raise exception 'NEXUS: des suivis RSEQ universitaires existent — rollback D0 refusé';
  end if;
  if exists (select 1 from public.schools where province is distinct from 'QC') then
    raise exception 'NEXUS: des écoles hors Québec existent — rollback D0 refusé';
  end if;
end $garde$;

drop trigger trg_verrou_universites on public.athletes;
drop trigger trg_verrou_universites on public.team_athletes;
drop trigger trg_verrou_universites on public.users;
drop function public.verrou_universites();
drop function public.lancement_universitaire_actif();
delete from public.app_settings where key = 'lancement_universitaire';

alter table public.schools drop column province;

alter table public.schools drop constraint schools_type_check;
alter table public.schools add constraint schools_type_check
  check (type = any (array['SECONDAIRE'::text, 'CEGEP'::text, 'LIGUE_CIVILE'::text]));
alter table public.users drop constraint users_context_check;
alter table public.users add constraint users_context_check
  check (context = any (array['scolaire'::text, 'collegial'::text, 'ligue_civile'::text]));
alter table public.rseq_watch_leagues drop constraint rseq_watch_leagues_secteur_chk;
alter table public.rseq_watch_leagues add constraint rseq_watch_leagues_secteur_chk
  check (secteur = any (array['Collégial'::text, 'Secondaire'::text]));

do $garde$
begin
  if exists (select 1 from pg_trigger where tgname = 'trg_verrou_universites')
     or exists (select 1 from public.app_settings where key = 'lancement_universitaire')
     or exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'schools' and column_name = 'province') then
    raise exception 'NEXUS: rollback D0 incomplet';
  end if;
  raise notice 'NEXUS: lot D0 cégep annulé';
end $garde$;
