-- Rollback de 20261008020241_matchs_profils_nexus (carte des matchs, lot A+).
-- La fonction n'a aucune dépendance en base : seul l'écran web l'appelle, et
-- il se tait (aucune pastille) si l'appel échoue.
drop function if exists public.matchs_profils_nexus(uuid[]);

do $$
begin
  if to_regprocedure('public.matchs_profils_nexus(uuid[])') is not null then
    raise exception 'NEXUS: matchs_profils_nexus toujours présente après rollback';
  end if;
end $$;
