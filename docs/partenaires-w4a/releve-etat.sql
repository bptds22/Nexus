-- Empreinte du schéma touché par W4a : sert à prouver que le retour arrière ramène
-- EXACTEMENT l'état d'avant. Une ligne par aspect ; comparer deux sorties à l'identique.
select 'fonctions public', md5(string_agg(p.oid::regprocedure::text || ':' || md5(replace(pg_get_functiondef(p.oid), E'\r', ''))
                                           || ':' || coalesce(p.proacl::text, ''), ',' order by p.oid::regprocedure::text))
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind in ('f', 'p')
union all
select 'triggers', md5(string_agg(tgrelid::regclass::text || ':' || tgname || ':' || pg_get_triggerdef(oid), ',' order by tgrelid::regclass::text, tgname))
  from pg_trigger where not tgisinternal
union all
select 'contraintes', md5(string_agg(conrelid::regclass::text || ':' || conname || ':' || pg_get_constraintdef(oid), ',' order by conrelid::regclass::text, conname))
  from pg_constraint where connamespace = 'public'::regnamespace
union all
select 'tables public', md5(string_agg(relname || ':' || coalesce(relacl::text, '') || ':' || relrowsecurity, ',' order by relname))
  from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'
union all
select 'politiques', md5(string_agg(tablename || ':' || policyname || ':' || coalesce(qual, '') || ':' || coalesce(with_check, ''), ',' order by tablename, policyname))
  from pg_policies where schemaname = 'public'
union all
select 'cron', md5(string_agg(jobname || ':' || schedule || ':' || command, ',' order by jobname)) from cron.job
union all
select 'notifications athlète', count(*)::text from public.athlete_notifications
union all
select 'évaluations partenaire', count(*)::text || ' / ' || (select count(*) from public.partner_athlete_badges)::text from public.partner_evaluations;
