-- Rollback de 20261028010000_cegep_lot_d1a_universites_masquees : retire les deux policies et la fonction.
-- ATTENTION : s'il existe des universités en base, elles redeviennent visibles partout (voir D1-AUDIT.md).
do $garde$
begin
  if to_regprocedure('public.ids_universites()') is null then
    raise exception 'NEXUS: 20261028010000 absente, rien à annuler';
  end if;
end $garde$;

drop policy universites_masquees on public.schools;
drop policy universites_masquees on public.teams;
drop function public.ids_universites();

do $garde$
begin
  if exists (select 1 from pg_policies where policyname = 'universites_masquees') then
    raise exception 'NEXUS: rollback D1a incomplet';
  end if;
  raise notice 'NEXUS: lot D1a cégep annulé';
end $garde$;
