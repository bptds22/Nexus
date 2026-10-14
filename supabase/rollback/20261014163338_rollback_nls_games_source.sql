-- Rollback de 20261014163338_nls_games_source (rédigée sous 20261014143000)
--
-- Refusé s'il existe une ligne source_nom = 'NLS' : la contrainte d'avant la
-- refuserait, et retirer la source effacerait la provenance de matchs réels.
-- Défaire d'abord les lots NLS (scripts/nls-basketball/matchs/rollback-lot.sql),
-- ou garder la migration.
do $$
declare v_n int;
begin
  select count(*) into v_n from public.games where source_nom = 'NLS';
  if v_n <> 0 then
    raise exception 'NEXUS: % match(s) NLS en base — rollback de la migration refusé', v_n;
  end if;
end $$;

alter table public.games drop constraint games_source_nom_chk;
alter table public.games
  add constraint games_source_nom_chk
  check (source_nom is null or source_nom in ('RSEQ', 'LFMM', 'QMFL', 'QBFL', 'QMJFL'));

comment on column public.games.source_nom is
  'Origine de la ligne : RSEQ (API de diffusion) ou une des 4 ligues civiles. Liste fermee par games_source_nom_chk.';

do $$
declare v_def text;
begin
  select pg_get_constraintdef(oid) into v_def from pg_constraint
   where conrelid = 'public.games'::regclass and conname = 'games_source_nom_chk';
  if v_def like '%''NLS''%' then raise exception 'NEXUS: NLS encore admise : %', v_def; end if;
  raise notice 'NEXUS: rollback NLS games_source — contrainte d''avant';
end $$;
