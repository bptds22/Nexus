-- Rollback de 20261017120000 : retire la lecture par lot des badges partenaire. Rien d'autre.
do $$
begin
  if to_regprocedure('public.badges_partenaires_athletes(uuid[])') is null then
    raise exception 'NEXUS: lot 20261017120000 absent — rien à défaire';
  end if;
end $$;

drop function public.badges_partenaires_athletes(uuid[]);
