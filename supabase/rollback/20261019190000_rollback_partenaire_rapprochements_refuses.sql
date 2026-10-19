-- Rollback de 20261019190000 : retire la lecture des propositions refusées du partenaire et
-- « Proposer de nouveau ». Aucune donnée touchée : une paire déjà reproposée reste CADUC (état permis).
\set ON_ERROR_STOP 1
begin;
do $$
begin
  if to_regprocedure('public.partenaire_rapprochement_reproposer(uuid,uuid)') is null then
    raise exception 'NEXUS: 20261019190000 absente — rien à défaire';
  end if;
end $$;
drop function public.partenaire_rapprochement_reproposer(uuid, uuid);
drop function public.partenaire_rapprochements_refuses();
commit;
