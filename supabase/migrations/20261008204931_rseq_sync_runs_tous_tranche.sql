-- Veille RSEQ, correctif de découverte — 2/4 : journal des passages (rseq_sync_runs).
-- (APPLIQUÉE en prod le 2026-10-08 sous cette version, GO BP — fichier renommé depuis sa version locale 2026100821x00)
-- (LOCAL — non appliquée en prod ; plan § 2, décision BP 2026-10-08 : valeur « Tous » pour la découverte.)
--
-- * La découverte v2 couvre Secondaire ET Collégial en un seul balayage : une ligne de journal, secteur « Tous ».
--   « Tous » n'est admis QUE pour mode = 'decouverte' ; une passe garde un secteur explicite.
-- * Colonne tranche : découverte 1–3 (tiers de régions : 1 = 0–4, 2 = 5–9, 3 = 10–14) ; passe secondaire 1–4
--   (quarts équilibrés des ligues, décision BP 2026-10-08 : mer/jeu/ven/sam). NULL pour la passe collégiale
--   et pour les lignes historiques.
-- Additive : une colonne nullable, une contrainte posée NOT VALID puis validée sur l'existant.

alter table public.rseq_sync_runs add column if not exists tranche smallint;
alter table public.rseq_sync_runs drop constraint if exists rseq_sync_runs_tranche_chk;
alter table public.rseq_sync_runs add constraint rseq_sync_runs_tranche_chk
  check (tranche is null or (mode = 'decouverte' and tranche between 1 and 3) or (mode = 'passe' and tranche between 1 and 4));
alter table public.rseq_sync_runs drop constraint if exists rseq_sync_runs_secteur_chk;
alter table public.rseq_sync_runs add constraint rseq_sync_runs_secteur_chk
  check (secteur in ('Collégial', 'Secondaire') or (secteur = 'Tous' and mode = 'decouverte')) not valid;
alter table public.rseq_sync_runs validate constraint rseq_sync_runs_secteur_chk;

do $gate$
begin
  if exists (select 1 from pg_constraint where conrelid = 'public.rseq_sync_runs'::regclass
               and conname in ('rseq_sync_runs_secteur_chk', 'rseq_sync_runs_tranche_chk') and not convalidated) then
    raise exception 'NEXUS: contrainte de rseq_sync_runs non validée';
  end if;
end $gate$;
