-- Lot B1 cégep : empreinte du catalogue public (fonctions, policies, triggers, droits des tables).
-- Sert à prouver que le rollback rend la base À L'OCTET : même empreinte avant et après un cycle.
select 'fonctions' as objet, count(*) as n,
       md5(string_agg(p.oid::regprocedure::text || ' ' || md5(p.prosrc) || ' ' || coalesce(array_to_string(p.proacl, ','), '')
                      || ' ' || coalesce(array_to_string(p.proconfig, ','), '') || ' ' || p.prosecdef::text || ' ' || p.provolatile::text,
                      '|' order by p.oid::regprocedure::text)) as empreinte
  from pg_proc p where p.pronamespace = 'public'::regnamespace
union all
select 'policies', count(*),
       md5(string_agg(tablename || '.' || policyname || ' ' || cmd || ' ' || permissive || ' ' || roles::text || ' '
                      || md5(coalesce(qual, '')) || ' ' || md5(coalesce(with_check, '')), '|' order by tablename, policyname))
  from pg_policies where schemaname = 'public'
union all
select 'triggers', count(*),
       md5(string_agg(c.relname || '.' || t.tgname || ' ' || md5(pg_get_triggerdef(t.oid)), '|' order by c.relname, t.tgname))
  from pg_trigger t join pg_class c on c.oid = t.tgrelid
 where c.relnamespace = 'public'::regnamespace and not t.tgisinternal
union all
select 'tables', count(*),
       md5(string_agg(c.relname || ' ' || coalesce(array_to_string(c.relacl, ','), '') || ' ' || c.relrowsecurity::text,
                      '|' order by c.relname))
  from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v', 'p');
