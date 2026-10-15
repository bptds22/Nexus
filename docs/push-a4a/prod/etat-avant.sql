-- État des objets que la migration push A4a touche, SANS les commentaires des fonctions. Le même en prod
-- (avant la migration) et en local après le rollback = le rollback rend exactement l'état de prod.
select md5(string_agg(x, E'\n' order by x collate "C")) as etat, count(*) as n_elements
from (
  select 'fn:' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' || p.prosecdef::text
         || '|' || p.provolatile::text || '|' || coalesce(array_to_string(p.proconfig, ','), '') || '|'
         || md5(btrim(regexp_replace(regexp_replace(regexp_replace(replace(p.prosrc, chr(13), ''), '/\*.*?\*/', '', 'g'), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
         || '|' || array_to_string(array(select coalesce(nullif(split_part(a, '=', 1), ''), 'PUBLIC')
                                          from unnest(p.proacl::text[]) a order by 1), ',') as x
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and (p.proname like 'push\_%' or p.proname in ('appliquer_badges_saisie', 'prospect_partenaire_proposer', 'claim_school_athletes'))
  union all
  select 'tbl:' || relname from pg_class where relnamespace = 'public'::regnamespace and relname like 'push\_%'
  union all
  select 'trg:' || tgrelid::regclass::text || ':' || tgname from pg_trigger
   where not tgisinternal and tgrelid in ('public.evaluations'::regclass, 'public.partner_evaluations'::regclass, 'public.partner_athlete_badges'::regclass)
  union all
  select 'cron:' || jobname from cron.job where jobname like 'push%'
) t;
