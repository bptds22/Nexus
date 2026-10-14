-- NLS — import des 622 matchs du 2026-10-14 en prod par psql — GARDES AVANT.
-- Exécuté dans LA MÊME transaction que l'import (psql -1, voir commande-psql.md).
-- Un RAISE « NEXUS: » annule TOUT. Lecture seule.
do $$
declare v_def text; n int;
begin
  select pg_get_constraintdef(oid) into v_def from pg_constraint where conname = 'games_source_nom_chk';
  if v_def not like '%''NLS''%' then
    raise exception 'NEXUS: la source NLS n''est pas admise (migration 20261014163338 absente) : %', v_def;
  end if;

  select count(*) into n from public.teams where league = 'No Limits Showcases' and season = '2026-2027';
  if n <> 107 then raise exception 'NEXUS: % équipe(s) NLS, attendu 107', n; end if;

  select count(*) into n from public.games where source_nom = 'NLS' or league_name = 'No Limits Showcases';
  if n <> 0 then raise exception 'NEXUS: % match(s) NLS déjà en base, attendu 0', n; end if;

  select count(*) into n from public.admin_operations where operation like 'NLS_MATCHS%';
  if n <> 0 then raise exception 'NEXUS: % ligne(s) NLS_MATCHS* au journal, attendu 0', n; end if;

  select count(*) into n from public.lieux_geocodes where nom_normalise ~ 'dalbe|trembles|boulogne|vianney';
  if n <> 6 then raise exception 'NEXUS: % gymnase(s) NLS géocodé(s), attendu 6', n; end if;

  raise notice 'NEXUS avant : source NLS admise, 107 équipes, 0 match, 6 gymnases — OK';
end $$;
