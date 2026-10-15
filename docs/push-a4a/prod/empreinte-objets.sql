-- Empreinte des objets de la migration push A4a TELS QU'ILS SONT EN BASE (corps, droits, colonnes, triggers,
-- cron, policy). Calculée en local après application du fichier testé ; le lot de prod exige la MÊME
-- empreinte avant de valider (sinon tout est annulé).
select md5(string_agg(x, E'\n' order by x collate "C")) as empreinte_objets, count(*) as n_elements
from (
  select 'fn:' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' || p.prosecdef::text
         || '|' || p.provolatile::text || '|' || coalesce(array_to_string(p.proconfig, ','), '') || '|'
         || pg_get_function_result(p.oid) || '|' || p.prosrc
         || '|' || array_to_string(array(select coalesce(nullif(split_part(a, '=', 1), ''), 'PUBLIC')
                                          from unnest(p.proacl::text[]) a order by 1), ',') as x
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and (p.proname like 'push\_%' or p.proname in ('appliquer_badges_saisie', 'prospect_partenaire_proposer', 'claim_school_athletes'))
  union all
  select 'tbl:' || c.relname || '|' || c.relrowsecurity::text || '|'
         || array_to_string(array(select distinct coalesce(nullif(split_part(a, '=', 1), ''), 'PUBLIC') || '=' || split_part(split_part(a, '=', 2), '/', 1)
                                    from unnest(c.relacl::text[]) a order by 1), ',')
    from pg_class c
   where c.relnamespace = 'public'::regnamespace and c.relname in ('push_file', 'push_envois', 'push_preferences')
  union all
  select 'col:' || table_name || '.' || column_name || '|' || data_type || '|' || is_nullable || '|'
         || coalesce(column_default, '') || '|' || coalesce(is_identity, '')
    from information_schema.columns
   where table_schema = 'public' and table_name in ('push_file', 'push_envois', 'push_preferences')
  union all
  select 'con:' || conrelid::regclass::text || '|' || pg_get_constraintdef(oid)
    from pg_constraint where conrelid in ('public.push_file'::regclass, 'public.push_envois'::regclass, 'public.push_preferences'::regclass)
  union all
  select 'trg:' || tgname || '|' || tgrelid::regclass::text || '|' || tgfoid::regproc::text || '|' || tgtype::text || '|' || tgenabled::text
    from pg_trigger where tgname like 'trg\_push\_%'
  union all
  select 'cron:' || jobname || '|' || schedule || '|' || command || '|' || active::text from cron.job where jobname = 'push-file-envoi'
  union all
  select 'pol:' || polname || '|' || polcmd::text || '|' || array_to_string(array(select rolname from pg_roles where oid = any (polroles) order by 1), ',')
         || '|' || coalesce(pg_get_expr(polqual, polrelid), '')
    from pg_policy where polrelid = 'public.push_preferences'::regclass
) t;
