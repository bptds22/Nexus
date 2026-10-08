-- Rollback de 20261008100100_matchs_ajoutes (carte des matchs, lot B, 2/3).
-- À jouer APRÈS le rollback de matchs_recherche (3/3), qui lit cette table.
-- Les matchs ajoutés par les unités partent avec la table (relever le compte
-- avant : select count(*) from public.matchs_ajoutes).
drop table if exists public.matchs_ajoutes;
drop function if exists public.matchs_ajoutes_poser_unite();

do $$
begin
  if to_regclass('public.matchs_ajoutes') is not null
     or to_regprocedure('public.matchs_ajoutes_poser_unite()') is not null then
    raise exception 'NEXUS: matchs_ajoutes toujours présente après rollback';
  end if;
end $$;
