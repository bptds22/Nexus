-- Relevé W2 (lecture seule). Lancer avant ET après 20261014133428.
\pset footer off
-- Par NOM, pas par signature : W2 ajoute un 16e paramètre (p_inclure_partenaires).
-- Avant W2 : 15 paramètres ; après : 16. Une seule ligne attendue dans les deux cas.
select 'recruiter_search_athletes.signature' as objet, p.oid::regprocedure::text as valeur
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'recruiter_search_athletes';
select 'recruiter_search_athletes.md5' as objet, md5(pg_get_functiondef(p.oid)) as valeur
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'recruiter_search_athletes';
select 'recruiter_search_athletes.acl' as objet, p.proacl::text as valeur
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'recruiter_search_athletes';
select 'recruiter_search_athletes.retour' as objet, pg_get_function_result(p.oid) as valeur
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = 'recruiter_search_athletes';
select 'partner_evaluations' as objet, coalesce(to_regclass('public.partner_evaluations')::text, 'absente') as valeur;
select 'fonctions_w2' as objet, p.oid::regprocedure::text || ' ' || coalesce(p.proacl::text, '') as valeur
  from pg_proc p where p.pronamespace = 'public'::regnamespace
   and p.proname in ('partenaire_evaluer_athlete', 'partenaire_evaluation_contexte', 'evaluations_partenaires_athlete');
-- Ce que W2 ne doit JAMAIS toucher.
select 'evaluations.lignes+md5' as objet, count(*)::text || ' ' || md5(coalesce(string_agg(id::text || cote_globale::text || updated_at::text, ',' order by id), '')) as valeur
  from public.evaluations;
select 'athletes.cote_globale_entraineur.md5' as objet,
       md5(coalesce(string_agg(id::text || ':' || coalesce(cote_globale_entraineur::text, '∅'), ',' order by id), '')) as valeur
  from public.athletes;
select 'calc_cote_globale.md5' as objet, md5(pg_get_functiondef('public.calc_cote_globale()'::regprocedure)) as valeur;
select 'triggers_evaluations' as objet, string_agg(tgname, ',' order by tgname) as valeur
  from pg_trigger where tgrelid = 'public.evaluations'::regclass and not tgisinternal;
select 'triggers_athletes' as objet, count(*)::text as valeur
  from pg_trigger where tgrelid = 'public.athletes'::regclass and not tgisinternal;
