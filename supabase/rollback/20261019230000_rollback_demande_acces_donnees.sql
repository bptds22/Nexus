-- Rollback de 20261019230000 : retire demander_acces_mes_donnees(). Les demandes déjà inscrites
-- dans loi25_portability_requests restent (ce sont de vraies demandes Loi 25 à traiter).
do $$
begin
  if to_regprocedure('public.demander_acces_mes_donnees()') is null then
    raise exception 'NEXUS: 20261019230000 absente — rien à défaire';
  end if;
end $$;

drop function public.demander_acces_mes_donnees();

do $$
begin
  if to_regprocedure('public.demander_acces_mes_donnees()') is not null then
    raise exception 'NEXUS: demander_acces_mes_donnees() est encore là';
  end if;
end $$;
