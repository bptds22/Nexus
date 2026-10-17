-- Empreinte des objets de la migration compléments 1.4.5 TELS QU'ILS SONT EN BASE (corps, config,
-- droits, sécurité, retour). Calculée en local après application du fichier testé ; le lot de prod
-- exige la MÊME empreinte avant de valider (sinon tout est annulé).
select md5(string_agg(x, E'\n' order by x collate "C")) as empreinte_objets, count(*) as n_elements
from (
  select 'fn:' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' || p.prosecdef::text
         || '|' || p.provolatile::text || '|' || coalesce(array_to_string(p.proconfig, ','), '') || '|'
         || pg_get_function_result(p.oid) || '|' || p.prosrc
         || '|' || array_to_string(array(select coalesce(nullif(split_part(a, '=', 1), ''), 'PUBLIC')
                                          from unnest(p.proacl::text[]) a order by 1), ',') as x
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('non_contact_carte', 'partenaire_prospect_lien', 'lookup_invitable_athletes_by_email')
) t;
