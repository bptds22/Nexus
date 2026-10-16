-- État des objets AVANT la migration 20261016060000_processus_cartes_rpc (lecture seule). Relevé en prod et en
-- local ; le lot de prod exige le même état de départ, et le rollback doit y ramener.
--  · les fonctions dont elle dépend ou qu'elle reproduit (unite_pipeline, carte_lecture_ok, acces_carte_lecture),
--    sur leur texte NORMALISÉ (sans commentaires ni espaces : le texte brut peut différer entre prod et local) ;
--  · l'absence des quatre nouvelles (processus_*) ;
--  · les policies de cartes_prospect et cartes_prospect_notes (la règle que les lectures DEFINER reproduisent).
select md5(string_agg(x, E'\n' order by x collate "C")) as etat, count(*) as n_elements
from (
  select 'fn:' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' || p.prosecdef::text
         || '|' || p.provolatile::text || '|' || coalesce(array_to_string(p.proconfig, ','), '') || '|'
         || pg_get_function_result(p.oid) || '|'
         || case when p.proname in ('unite_pipeline', 'carte_lecture_ok', 'acces_carte_lecture')
                 then 'norm:' || md5(btrim(regexp_replace(regexp_replace(replace(p.prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
                 else md5(p.prosrc) end
         || '|' || array_to_string(array(select coalesce(nullif(split_part(a, '=', 1), ''), 'PUBLIC')
                                          from unnest(p.proacl::text[]) a order by 1), ',') as x
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('unite_pipeline', 'carte_lecture_ok', 'acces_carte_lecture',
                       'processus_cartes', 'processus_dernieres_notes_cartes', 'processus_dernieres_notes',
                       'processus_notes_export')
  union all
  select 'pol:' || c.relname || '|' || po.polname || '|' || po.polcmd::text || '|' || po.polpermissive::text || '|'
         || coalesce(pg_get_expr(po.polqual, po.polrelid), '') || '|' || coalesce(pg_get_expr(po.polwithcheck, po.polrelid), '')
    from pg_policy po
    join pg_class c on c.oid = po.polrelid
   where po.polrelid in ('public.cartes_prospect'::regclass, 'public.cartes_prospect_notes'::regclass)
) t;
