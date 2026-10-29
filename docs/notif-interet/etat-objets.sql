-- État des objets touchés par 20261029170000 : fonctions (corps + droits), contraintes, déclencheurs.
select md5(string_agg(l, E'\n' order by l)) || '|' || count(*) from (
  select 'F ' || p.oid::regprocedure || ' ' || md5(p.prosrc) || ' ' || coalesce(array_to_string(p.proacl, ','), '-')
         || ' ' || p.prosecdef || ' ' || coalesce(array_to_string(p.proconfig, ','), '-') l
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and (p.proname like 'push%' or p.proname in ('parent_contact_envoyer_push', 'notify_athlete_favorited'))
  union all
  select 'C ' || conrelid::regclass || '.' || conname || ' ' || pg_get_constraintdef(oid) || ' ' || convalidated
    from pg_constraint where conrelid in ('public.push_file'::regclass, 'public.push_preferences'::regclass, 'public.athlete_notifications'::regclass)
  union all
  select 'T ' || c.relname || '.' || t.tgname || ' ' || pg_get_triggerdef(t.oid)
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where not t.tgisinternal and c.relname in ('recruiter_favorites', 'recruiter_list_members', 'recruiter_pipeline', 'recruiter_athlete_views')
) x;
