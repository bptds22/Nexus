-- État des objets AVANT la migration 20261016040000_coachs_nommables (lecture seule) : les deux fonctions
-- dont elle dépend (droits, réglages, corps) et l'absence des trois nouvelles. Relevé en prod et en local ;
-- le lot de prod exige le même état de départ, et le rollback doit y ramener.
-- Les deux fonctions dont on dépend sont comparées sur leur texte NORMALISÉ (sans commentaires ni espaces,
-- la normalisation des gardes de la migration) : leur texte brut diffère entre prod et local, à corps identique.
select md5(string_agg(x, E'\n' order by x collate "C")) as etat, count(*) as n_elements
from (
  select 'fn:' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' || p.prosecdef::text
         || '|' || p.provolatile::text || '|' || coalesce(array_to_string(p.proconfig, ','), '') || '|'
         || pg_get_function_result(p.oid) || '|'
         || case when p.proname in ('coach_nommable', 'resolve_team_join_token')
                 then 'norm:' || md5(btrim(regexp_replace(regexp_replace(replace(p.prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
                 else md5(p.prosrc) end
         || '|' || array_to_string(array(select coalesce(nullif(split_part(a, '=', 1), ''), 'PUBLIC')
                                          from unnest(p.proacl::text[]) a order by 1), ',') as x
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('coach_nommable', 'resolve_team_join_token',
                       'coachs_nommables_ecole', 'coachs_nommables_equipe', 'apercu_code_equipe')
) t;
