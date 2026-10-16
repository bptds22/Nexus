-- État des objets que la migration push A5 touche, corps EXACTS (md5 de prosrc, octet pour octet). Le même en
-- prod avant la migration et en local avant le lot (= après le rollback) : A5 part bien de l'état testé.
select md5(string_agg(x, E'\n' order by x collate "C")) as etat, count(*) as n_elements
from (
  select 'fn:' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' || p.prosecdef::text
         || '|' || p.provolatile::text || '|' || coalesce(array_to_string(p.proconfig, ','), '') || '|'
         || pg_get_function_result(p.oid) || '|' || md5(p.prosrc)
         || '|' || array_to_string(array(select coalesce(nullif(split_part(a, '=', 1), ''), 'PUBLIC')
                                          from unnest(p.proacl::text[]) a order by 1), ',') as x
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname like 'push\_%'
  union all
  select 'con:' || conname || '|' || pg_get_constraintdef(oid) || '|' || convalidated::text
    from pg_constraint where conrelid = 'public.athlete_notifications'::regclass and contype = 'c'
  union all
  select 'trg:' || tgrelid::regclass::text || ':' || tgname || '|' || tgfoid::regproc::text || '|' || tgenabled::text
    from pg_trigger where not tgisinternal
     and tgrelid in ('public.evaluations'::regclass, 'public.partner_evaluations'::regclass,
                     'public.partner_athlete_badges'::regclass, 'public.athlete_notifications'::regclass)
  union all
  select 'cron:' || jobname || '|' || schedule || '|' || command || '|' || active::text from cron.job where jobname like 'push%'
) t;
