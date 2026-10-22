-- Rollback de 20261022213100_admin_comptes_connectes.
-- Retire la fonction. Aucune donnée touchée. Le QG affiche alors une erreur sur
-- l'onglet Croissance : rejouer ce rollback seulement avec le retour de l'app.

do $$
begin
  if to_regprocedure('public.admin_comptes_connectes(timestamptz, timestamptz)') is null then
    raise exception 'NEXUS: 20261022213100 absente';
  end if;
end $$;

drop function public.admin_comptes_connectes(timestamptz, timestamptz);
