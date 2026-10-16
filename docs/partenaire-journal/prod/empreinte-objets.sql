-- Empreinte des objets de la migration journal partenaire TELS QU'ILS SONT EN BASE. Calculée en local après application du
-- fichier testé ; le lot de prod exige la MÊME empreinte avant de valider (sinon tout est annulé).
select md5(string_agg(x, E'\n' order by x collate "C")) as empreinte_objets, count(*) as n_elements
from (
  select 'fn:' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' || p.prosecdef::text
         || '|' || p.provolatile::text || '|' || coalesce(array_to_string(p.proconfig, ','), '') || '|'
         || pg_get_function_result(p.oid) || '|' || p.prosrc
         || '|' || array_to_string(array(select coalesce(nullif(split_part(a, '=', 1), ''), 'PUBLIC')
                                          from unnest(p.proacl::text[]) a order by 1), ',') as x
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname = 'partenaire_journaliser'
  union all
  select 'pol:' || c.relname || '|' || pol.polname || '|' || pol.polcmd::text
    from pg_policy pol join pg_class c on c.oid = pol.polrelid
   where c.relname in ('partner_profile_views', 'partner_card_downloads')
) t;
