-- État des objets AVANT la migration 20261016080000_lectures_sans_plafond (lecture seule). Relevé en prod et en
-- local ; le lot de prod exige le même état de départ, et le rollback doit y ramener.
--  · les fonctions dont elle dépend ou qu'elle reproduit (processus_cartes, acces_carte_lecture,
--    carte_lecture_ok), sur leur texte NORMALISÉ (sans commentaires ni espaces : le texte brut peut différer) ;
--  · l'absence des seize nouvelles fonctions ;
--  · les policies de cartes_prospect et cartes_prospect_notes (la règle que cartes_par_ids reproduit).
select md5(string_agg(x, E'\n' order by x collate "C")) as etat, count(*) as n_elements
from (
  select 'fn:' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')|' || p.prosecdef::text
         || '|' || p.provolatile::text || '|' || coalesce(array_to_string(p.proconfig, ','), '') || '|'
         || pg_get_function_result(p.oid) || '|'
         || case when p.proname in ('processus_cartes', 'acces_carte_lecture', 'carte_lecture_ok')
                 then 'norm:' || md5(btrim(regexp_replace(regexp_replace(replace(p.prosrc, chr(13), ''), '--[^\n]*', '', 'g'), '\s+', ' ', 'g')))
                 else md5(p.prosrc) end
         || '|' || array_to_string(array(select coalesce(nullif(split_part(a, '=', 1), ''), 'PUBLIC')
                                          from unnest(p.proacl::text[]) a order by 1), ',') as x
    from pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('processus_cartes', 'acces_carte_lecture', 'carte_lecture_ok',
                       'athletes_par_ids', 'team_athletes_par_athletes', 'recruiter_favorites_par_athletes',
                       'recruiter_athlete_views_par_athletes', 'conversations_par_athletes',
                       'athlete_suggestions_par_athletes', 'recruiter_activity_log_par_athletes', 'teams_par_ids',
                       'games_par_ids', 'games_des_equipes', 'cartes_par_ids', 'users_par_ids', 'schools_par_ids',
                       'messages_par_conversations', 'team_athletes_par_equipes', 'team_coaches_par_equipes')
  union all
  select 'pol:' || c.relname || '|' || po.polname || '|' || po.polcmd::text || '|' || po.polpermissive::text || '|'
         || coalesce(pg_get_expr(po.polqual, po.polrelid), '') || '|' || coalesce(pg_get_expr(po.polwithcheck, po.polrelid), '')
    from pg_policy po
    join pg_class c on c.oid = po.polrelid
   where po.polrelid in ('public.cartes_prospect'::regclass, 'public.cartes_prospect_notes'::regclass)
) t;
