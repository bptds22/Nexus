-- W2 en prod — vérifications APRÈS le commit, LECTURE SEULE.
-- Deux requêtes indépendantes (lançables telles quelles par psql ou par le
-- connecteur MCP execute_sql). Chacune rend une ligne JSON ; « ok » doit être
-- true partout. Les gardes de w2-gardes-et-enregistrement.sql ont déjà vérifié
-- tout cela AVANT le commit : ici on le relit après coup.

-- ── A. Structure, droits, données intouchées, enregistrement (rôle postgres) ─
select json_build_object(
  'partner_evaluations', json_build_object(
     'obtenu', (select count(*) from public.partner_evaluations), 'attendu', 0),
  'peut_evaluer_true', json_build_object(
     'obtenu', (select count(*) from public.media_partners where peut_evaluer), 'attendu', 0),
  'recruiter_search_athletes', json_build_object(
     'signature', (select string_agg(p.oid::regprocedure::text, ' ; ') from pg_proc p
                    where p.pronamespace = 'public'::regnamespace and p.proname = 'recruiter_search_athletes'),
     'md5', (select string_agg(md5(pg_get_functiondef(p.oid)), ' ; ') from pg_proc p
              where p.pronamespace = 'public'::regnamespace and p.proname = 'recruiter_search_athletes'),
     'attendu', 'c15481a07a3b98e3ae72f8917763a45a'),
  'droits', (select json_object_agg(p.oid::regprocedure::text,
                (select string_agg(a.grantee::regrole::text || ':' || a.privilege_type, ',' order by a.grantee::regrole::text)
                   from aclexplode(p.proacl) a))
               from pg_proc p
              where p.pronamespace = 'public'::regnamespace
                and p.proname in ('partenaire_evaluer_athlete', 'partenaire_evaluation_contexte',
                                  'evaluations_partenaires_athlete', 'recruiter_search_athletes')),
  'droits_attendus', 'authenticated:EXECUTE,postgres:EXECUTE,service_role:EXECUTE (x4)',
  'table_privileges_directs', (select count(*) from pg_class c, aclexplode(c.relacl) a
                                where c.oid = 'public.partner_evaluations'::regclass
                                  and (a.grantee = 0 or a.grantee::regrole::text in ('anon', 'authenticated'))),
  'table_policies', (select count(*) from pg_policies where schemaname = 'public' and tablename = 'partner_evaluations'),
  'evaluations', json_build_object(
     'obtenu', (select count(*)::text || ' ' || md5(coalesce(string_agg(id::text || cote_globale::text || updated_at::text, ',' order by id), ''))
                  from public.evaluations),
     'attendu', '14 0ac022c953c3572bba6e0c0027a314dd'),
  'cotes_coach', json_build_object(
     'obtenu', (select md5(coalesce(string_agg(id::text || ':' || coalesce(cote_globale_entraineur::text, '∅'), ',' order by id), ''))
                  from public.athletes),
     'attendu', 'acc167b4fa2d9f635a5fac8aedbdaeae'),
  'calc_cote_globale', json_build_object(
     'obtenu', md5(pg_get_functiondef('public.calc_cote_globale()'::regprocedure)),
     'attendu', '48b9ec8b4fa8b972dddd1247f9f72fbc'),
  'schema_migrations_apres_w1', (select json_agg(json_build_object(
        'version', version, 'name', name, 'md5_statements', md5(statements[1]), 'created_by', created_by) order by version)
      from supabase_migrations.schema_migrations where version > '20261014021124'),
  'schema_migrations_md5_attendu', 'e82b6d9467689300ca44e50aed91394a',
  'admin_operations', (select json_agg(json_build_object('operation', operation, 'version', details->>'version', 'le', le))
                         from public.admin_operations where operation = 'MIGRATION_W2_PARTENAIRE_EVALUATEUR')
) as verif_structure;

-- ── B. Les 8 recherches de référence du recruteur Pro, SANS le paramètre ───
-- Sous le vrai rôle authenticated, JWT simulé de 16809ad4. Lancer dans une
-- transaction (set local) ; le connecteur MCP le fait déjà.
select set_config('request.jwt.claims',
  json_build_object('sub', '16809ad4-565c-40ca-8a35-106c073e1e01', 'role', 'authenticated')::text, true);
set local role authenticated;
select json_build_object(
  'defaut',      (select count(*)::text || ' ' || md5(coalesce(string_agg((to_jsonb(r) - 'cote_partenaire' - 'cote_partenaire_organisation')::text, '|' order by r.ordinality), '')) from public.recruiter_search_athletes() with ordinality r),
  'rating_desc', (select count(*)::text || ' ' || md5(coalesce(string_agg((to_jsonb(r) - 'cote_partenaire' - 'cote_partenaire_organisation')::text, '|' order by r.ordinality), '')) from public.recruiter_search_athletes(p_sort_by => 'rating_desc') with ordinality r),
  'name_asc',    (select count(*)::text || ' ' || md5(coalesce(string_agg((to_jsonb(r) - 'cote_partenaire' - 'cote_partenaire_organisation')::text, '|' order by r.ordinality), '')) from public.recruiter_search_athletes(p_sort_by => 'name_asc') with ordinality r),
  'grad_desc',   (select count(*)::text || ' ' || md5(coalesce(string_agg((to_jsonb(r) - 'cote_partenaire' - 'cote_partenaire_organisation')::text, '|' order by r.ordinality), '')) from public.recruiter_search_athletes(p_sort_by => 'grad_desc') with ordinality r),
  'min1',        (select count(*)::text || ' ' || md5(coalesce(string_agg((to_jsonb(r) - 'cote_partenaire' - 'cote_partenaire_organisation')::text, '|' order by r.ordinality), '')) from public.recruiter_search_athletes(p_min_rating => 1) with ordinality r),
  'min3_asc',    (select count(*)::text || ' ' || md5(coalesce(string_agg((to_jsonb(r) - 'cote_partenaire' - 'cote_partenaire_organisation')::text, '|' order by r.ordinality), '')) from public.recruiter_search_athletes(p_min_rating => 3, p_sort_by => 'rating_asc') with ordinality r),
  'min4',        (select count(*)::text || ' ' || md5(coalesce(string_agg((to_jsonb(r) - 'cote_partenaire' - 'cote_partenaire_organisation')::text, '|' order by r.ordinality), '')) from public.recruiter_search_athletes(p_min_rating => 4) with ordinality r),
  'verif_min4',  (select count(*)::text || ' ' || md5(coalesce(string_agg((to_jsonb(r) - 'cote_partenaire' - 'cote_partenaire_organisation')::text, '|' order by r.ordinality), '')) from public.recruiter_search_athletes(p_verified_only => true, p_min_rating => 4) with ordinality r),
  'attendus', json_build_object(
     'defaut', '181 b35ffc53a0fd59a0065956c9a01c916d', 'rating_desc', '181 b35ffc53a0fd59a0065956c9a01c916d',
     'name_asc', '181 49e807c6a22a709f6580d614c1d6ef67', 'grad_desc', '181 e6655cd5e5bd6f361d64c6ffd489e15c',
     'min1', '6 64c733e2609a4c0e45f925f53c5602ce', 'min3_asc', '6 9a490d395e90756044dff18fc3304fa3',
     'min4', '1 e2c22eac480ff88e8ec7f1717b83f532', 'verif_min4', '1 e2c22eac480ff88e8ec7f1717b83f532')
) as verif_recherches;
