-- Empreinte des objets de la migration 20261016040000_coachs_nommables TELS QU'ILS SONT EN BASE : les trois
-- nouvelles fonctions (corps COMPLETS, droits, réglages) + les deux dont elles dépendent (texte normalisé,
-- comme dans etat-avant.sql). Calculée en local après application du fichier testé ; le lot de prod exige
-- la MÊME empreinte avant de valider (sinon tout est annulé).
select md5(string_agg(x, E'\n' order by x collate "C")) as empreinte_objets, count(*) as n_elements
from (
  select 'fn:' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' || p.prosecdef::text
         || '|' || p.provolatile::text || '|' || coalesce(array_to_string(p.proconfig, ','), '') || '|'
         || pg_get_function_result(p.oid) || '|'
         || case when p.proname in ('coach_nommable', 'resolve_team_join_token')
                 then 'norm:' || md5(btrim(regexp_replace(regexp_replace(replace(p.prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
                 else p.prosrc end
         || '|' || array_to_string(array(select coalesce(nullif(split_part(a, '=', 1), ''), 'PUBLIC')
                                          from unnest(p.proacl::text[]) a order by 1), ',') as x
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('coach_nommable', 'resolve_team_join_token',
                       'coachs_nommables_ecole', 'coachs_nommables_equipe', 'apercu_code_equipe')
) t;
