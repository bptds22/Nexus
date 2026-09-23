-- ═══════════════════════════════════════════════════════════════════════════
-- search_filter_events — la liste fermée accepte `meCiblent` (lot 5 cibles).
--
-- Le filtre « Te ciblent » (FiltresRecherche.meCiblent, ?me_ciblent=true)
-- n'était pas journalisé : le CHECK `search_filter_events_filtre_check` refuse
-- toute clé hors liste, et les événements partent PAR LOTS — une seule clé
-- refusée faisait échouer tout le lot, donc perdre aussi les autres filtres.
-- La page retirait donc `meCiblent` du journal ; ce retrait saute avec cette
-- migration.
--
-- ORDRE DE DÉPLOIEMENT : cette migration AVANT le code qui journalise
-- `meCiblent`. Dans l'autre sens, chaque lot contenant la clé échoue en prod.
--
-- Additive : on ÉLARGIT la liste (aucune ligne existante ne peut la violer).
-- Comparaison INTÉGRALE avant et après — jamais par inclusion (règle
-- transverse du 2026-09-07) : une liste qui aurait dérivé en prod arrête la
-- migration au lieu d'être écrasée en silence.
-- ═══════════════════════════════════════════════════════════════════════════

do $$
declare
  avant constant text[] := array[
    'search', 'sport', 'genderFilter', 'position', 'region',
    'promotion', 'orgType', 'leagueFilter', 'divisionFilter',
    'minGpa', 'minRating', 'sortBy', 'verifiedOnly',
    'withVideoOnly', 'withSportBadge', 'withAcademicBadge',
    'hideFavorites', 'filterOuvertDemenager', 'filterOuvertPrive',
    'filterOuvertAnglophone', 'offertParMonCegep', 'filterNewOnly',
    'progFilterIds',
    'reinitialiser', 'panneau_avance'];
  vus text[];
begin
  select array_agg(v order by v) into vus
    from pg_constraint c,
         lateral regexp_matches(pg_get_constraintdef(c.oid), '''([A-Za-z_]+)''::text', 'g') m,
         lateral (select m[1] as v) x
   where c.conrelid = 'public.search_filter_events'::regclass
     and c.conname = 'search_filter_events_filtre_check';
  if vus is distinct from (select array_agg(v order by v) from unnest(avant) v) then
    raise exception 'NEXUS: search_filter_events_filtre_check a dérivé — vu %, attendu %', vus, avant;
  end if;
end $$;

alter table public.search_filter_events
  drop constraint search_filter_events_filtre_check;

alter table public.search_filter_events
  add constraint search_filter_events_filtre_check
  check (filtre in (
    -- cles de lib/recherche/filtres-url.ts (FiltresRecherche)
    'search', 'sport', 'genderFilter', 'position', 'region',
    'promotion', 'orgType', 'leagueFilter', 'divisionFilter',
    'minGpa', 'minRating', 'sortBy', 'verifiedOnly',
    'withVideoOnly', 'withSportBadge', 'withAcademicBadge',
    'hideFavorites', 'filterOuvertDemenager', 'filterOuvertPrive',
    'filterOuvertAnglophone', 'offertParMonCegep', 'filterNewOnly',
    'meCiblent',
    'progFilterIds',
    -- gestes
    'reinitialiser', 'panneau_avance'));

do $$
declare
  veut constant text[] := array[
    'divisionFilter', 'filterNewOnly', 'filterOuvertAnglophone', 'filterOuvertDemenager',
    'filterOuvertPrive', 'genderFilter', 'hideFavorites', 'leagueFilter', 'meCiblent',
    'minGpa', 'minRating', 'offertParMonCegep', 'orgType', 'panneau_avance', 'position',
    'progFilterIds', 'promotion', 'region', 'reinitialiser', 'search', 'sortBy', 'sport',
    'verifiedOnly', 'withAcademicBadge', 'withSportBadge', 'withVideoOnly'];
  vus text[];
begin
  select array_agg(v order by v) into vus
    from pg_constraint c,
         lateral regexp_matches(pg_get_constraintdef(c.oid), '''([A-Za-z_]+)''::text', 'g') m,
         lateral (select m[1] as v) x
   where c.conrelid = 'public.search_filter_events'::regclass
     and c.conname = 'search_filter_events_filtre_check';
  -- Les deux côtés triés par la base (même collation) : l'ordre écrit
  -- ci-dessus ne compte pas.
  if vus is distinct from (select array_agg(v order by v) from unnest(veut) v) then
    raise exception 'NEXUS: search_filter_events_filtre_check = %, attendu %', vus, veut;
  end if;
end $$;
