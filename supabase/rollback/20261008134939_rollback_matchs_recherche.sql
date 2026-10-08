-- Rollback de 20261008134939_matchs_recherche (carte des matchs, lot B, 3/3).
-- À jouer EN PREMIER (avant 2/3 et 1/3). Aucune donnée : la page web se tait
-- (message d'erreur de chargement) tant que le web du lot B est en ligne.
drop function if exists public.matchs_recherche(date, date, text, text[], text);

do $$
begin
  if to_regprocedure('public.matchs_recherche(date, date, text, text[], text)') is not null then
    raise exception 'NEXUS: matchs_recherche toujours présente après rollback';
  end if;
end $$;
