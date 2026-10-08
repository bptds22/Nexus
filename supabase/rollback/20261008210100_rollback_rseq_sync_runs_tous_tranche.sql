-- Rollback 2/4. Les lignes de découverte « Tous » empêcheraient de reposer une contrainte plus stricte :
-- il n'y en a pas d'autre. On retire la contrainte et la colonne (les tranches journalisées sont perdues).
begin;
alter table public.rseq_sync_runs drop constraint if exists rseq_sync_runs_secteur_chk;
alter table public.rseq_sync_runs drop constraint if exists rseq_sync_runs_tranche_chk;
alter table public.rseq_sync_runs drop column if exists tranche;
commit;
