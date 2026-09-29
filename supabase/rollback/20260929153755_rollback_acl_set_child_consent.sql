-- Rollback de 20260929153755_acl_set_child_consent : rétablit l'ACL d'avant,
-- {anon, authenticated, postgres, PUBLIC, service_role}.
-- ⚠ Rouvre la fonction à `anon` et `PUBLIC` (registre §51).

grant execute on function public.set_child_consent(uuid, text, boolean, text) to public, anon;

do $$
declare
  vus text[];
  veut text[] := array['PUBLIC', 'anon', 'authenticated', 'postgres', 'service_role'];
begin
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.set_child_consent(uuid, text, boolean, text)'::regprocedure;
  if vus is distinct from (select array_agg(v order by v) from unnest(veut) v) then
    raise exception 'NEXUS: ACL de set_child_consent = %, attendu %', vus, veut;
  end if;
end $$;
