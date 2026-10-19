-- Rollback de 20261019150000 : retire la lecture des propositions refusées et « Proposer de nouveau ».
-- Aucune donnée touchée : une paire déjà reproposée reste PROPOSEE (état d'avant la migration permis).
\set ON_ERROR_STOP 1
begin;
do $$
begin
  if to_regprocedure('public.reproposer_rapprochement(uuid)') is null then
    raise exception 'NEXUS: 20261019150000 absente — rien à défaire';
  end if;
end $$;
drop function public.reproposer_rapprochement(uuid);
drop function public.rapprochements_refuses_unite();
commit;
