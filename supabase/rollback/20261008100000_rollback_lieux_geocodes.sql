-- Rollback de 20261008100000_lieux_geocodes (carte des matchs, lot B, 1/3).
-- À jouer APRÈS le rollback de matchs_recherche (3/3), qui lit cette table et
-- appelle lieu_normalise. Les lignes géocodées partent avec la table : le
-- CSV revu par BP (scripts/carte-matchs-lot-b/) permet de les réécrire.
drop table if exists public.lieux_geocodes;
drop function if exists public.lieu_normalise(text);

do $$
begin
  if to_regclass('public.lieux_geocodes') is not null
     or to_regprocedure('public.lieu_normalise(text)') is not null then
    raise exception 'NEXUS: lieux_geocodes ou lieu_normalise toujours présents après rollback';
  end if;
end $$;
