-- Rollback de 20261019170000 : retire depistage_profils_match. Aucune donnée touchée ;
-- l'appli revient d'elle-même à matchs_profils_nexus (fonction absente tolérée).
\set ON_ERROR_STOP 1
begin;
do $$
begin
  if to_regprocedure('public.depistage_profils_match(uuid)') is null then
    raise exception 'NEXUS: 20261019170000 absente — rien à défaire';
  end if;
end $$;
drop function public.depistage_profils_match(uuid);
commit;
