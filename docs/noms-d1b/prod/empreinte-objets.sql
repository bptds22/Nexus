-- Empreinte des objets D1b TELS QU'ILS SONT EN BASE (corps des fonctions, dont la recherche
-- recruteur, colonnes nom_a_confirmer, triggers). Calculée en local après application du fichier
-- testé ; le lot de prod exige la MÊME empreinte avant de valider (sinon tout est annulé).
select md5(string_agg(x, E'\n' order by x collate "C")) as empreinte_objets, count(*) as n_elements
from (
  select 'fn:' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' || p.prosecdef::text
         || '|' || p.provolatile::text || '|' || coalesce(array_to_string(p.proconfig, ','), '') || '|'
         || pg_get_function_result(p.oid) || '|' || p.prosrc as x
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('couper_nom_complet', 'users_nom_google', 'athletes_nom_a_confirmer',
                       'mon_nom_a_confirmer', 'confirmer_mon_nom', 'recruiter_search_athletes')
  union all
  select 'col:' || table_name || '.' || column_name || '|' || data_type || '|' || coalesce(column_default, '')
         || '|' || is_nullable
    from information_schema.columns
   where table_schema = 'public' and column_name = 'nom_a_confirmer'
  union all
  select 'trg:' || pg_get_triggerdef(oid) from pg_trigger
   where tgname in ('trg_users_nom_google', 'trg_athletes_nom_a_confirmer')
) t;
