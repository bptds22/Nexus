-- Rollback de 20261026210000_civil_sources_lot1 — remet la base EXACTEMENT comme avant.
--
-- Refuse s'il reste des données du chantier civil : on ne défait pas la base sous un
-- import (défaire d'abord les lots 2 à 5, chacun par son propre rollback).
-- À lancer en une transaction : psql -1 -v ON_ERROR_STOP=1 -f <ce fichier>

do $garde$
begin
  if to_regclass('public.equipes_sources') is null or to_regclass('public.organisations_sources') is null then
    raise exception 'NEXUS: le lot 1 civil n''est pas appliqué';
  end if;
  if exists (select 1 from public.equipes_sources) or exists (select 1 from public.organisations_sources) then
    raise exception 'NEXUS: correspondances présentes — défaire les lots d''import d''abord';
  end if;
  if exists (select 1 from public.games
              where source_match_id is not null or statut_source is not null
                 or source_nom in ('SPORDLE', 'MBL', 'KREEZEE')) then
    raise exception 'NEXUS: des matchs civils SPORDLE / MBL / KREEZEE existent — défaire le lot 5 d''abord';
  end if;
end $garde$;

drop table public.equipes_sources;
drop table public.organisations_sources;

alter table public.games drop constraint games_source_nom_chk;
alter table public.games
  add constraint games_source_nom_chk
  check (source_nom is null or source_nom in ('RSEQ', 'LFMM', 'QMFL', 'QBFL', 'QMJFL', 'NLS'));
comment on column public.games.source_nom is
  'Origine de la ligne : RSEQ (API de diffusion), une des 4 ligues civiles de football, ou NLS (No Limits Showcases, basketball). Liste fermee par games_source_nom_chk.';

drop index public.games_identite_civile;
create unique index games_identite_civile
  on public.games (league_name, season, category, division, zone, game_date,
                   least(home_name_raw, visitor_name_raw), greatest(home_name_raw, visitor_name_raw))
  where rseq_game_id is null;

drop index public.games_source_match_uidx;
alter table public.games drop constraint games_source_match_id_chk;
alter table public.games drop constraint games_statut_source_chk;
alter table public.games drop column source_match_id, drop column statut_source;

do $garde$
begin
  if (select pg_get_constraintdef(oid) from pg_constraint
       where conrelid = 'public.games'::regclass and conname = 'games_source_nom_chk') is distinct from
     'CHECK (((source_nom IS NULL) OR (source_nom = ANY (ARRAY[''RSEQ''::text, ''LFMM''::text, ''QMFL''::text, ''QBFL''::text, ''QMJFL''::text, ''NLS''::text]))))' then
    raise exception 'NEXUS: games_source_nom_chk non restaurée';
  end if;
  if (select indexdef from pg_indexes where schemaname = 'public' and indexname = 'games_identite_civile') is distinct from
     'CREATE UNIQUE INDEX games_identite_civile ON public.games USING btree (league_name, season, category, division, zone, game_date, LEAST(home_name_raw, visitor_name_raw), GREATEST(home_name_raw, visitor_name_raw)) WHERE (rseq_game_id IS NULL)' then
    raise exception 'NEXUS: games_identite_civile non restauré';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'games'
              and column_name in ('source_match_id', 'statut_source')) then
    raise exception 'NEXUS: colonnes encore présentes';
  end if;
  raise notice 'NEXUS: lot 1 civil défait';
end $garde$;
