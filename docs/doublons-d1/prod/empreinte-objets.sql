-- Empreinte des objets D1 TELS QU'ILS SONT EN BASE (corps des fonctions, colonnes, index,
-- contraintes, trigger, tâche de purge). Calculée en local après application du fichier testé ;
-- le lot de prod exige la MÊME empreinte avant de valider (sinon tout est annulé).
select md5(string_agg(x, E'\n' order by x collate "C")) as empreinte_objets, count(*) as n_elements
from (
  select 'fn:' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' || p.prosecdef::text
         || '|' || p.provolatile::text || '|' || coalesce(array_to_string(p.proconfig, ','), '') || '|'
         || pg_get_function_result(p.oid) || '|' || p.prosrc as x
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('doublons_probables_noter', 'inscription_doublon_possible', 'coach_athletes_meme_identite')
  union all
  select 'col:' || table_name || '.' || column_name || '|' || data_type || '|' || coalesce(column_default, '')
         || '|' || is_nullable || '|' || is_identity
    from information_schema.columns
   where table_schema = 'public' and table_name in ('doublons_probables', 'doublons_verifications')
  union all
  select 'idx:' || indexdef from pg_indexes
   where schemaname = 'public' and tablename in ('doublons_probables', 'doublons_verifications')
  union all
  select 'con:' || conrelid::regclass::text || '|' || conname || '|' || pg_get_constraintdef(oid) from pg_constraint
   where conrelid in (select oid from pg_class where relnamespace = 'public'::regnamespace
                        and relname in ('doublons_probables', 'doublons_verifications'))
  union all
  select 'trg:' || pg_get_triggerdef(oid) from pg_trigger where tgname = 'trg_doublons_probables_noter'
  union all
  select 'cron:' || schedule || '|' || command from cron.job where jobname = 'doublons-verifications-purge'
) t;
