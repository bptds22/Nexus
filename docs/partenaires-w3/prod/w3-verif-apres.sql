-- W3 en prod — vérifications APRÈS le commit, LECTURE SEULE.
-- Une requête, une ligne JSON ; lançable telle quelle par psql ou par le
-- connecteur MCP execute_sql. Chaque contrôle porte « obtenu » et « attendu ».
-- Les gardes de w3-gardes-et-enregistrement.sql ont déjà vérifié tout cela
-- AVANT le commit (contre un relevé pris dans la même transaction) : ici on
-- le relit après coup. Valeurs attendues de badge_plafond et M10 = relevé
-- prod du 2026-10-14 (avant W3).

select json_build_object(
  'tables_w3_vides', json_build_object(
     'obtenu', json_build_object(
        'partner_badges', (select count(*) from public.partner_badges),
        'partner_athlete_badges', (select count(*) from public.partner_athlete_badges),
        'partner_evaluation_retraits', (select count(*) from public.partner_evaluation_retraits)),
     'attendu', '0 / 0 / 0'),
  'partner_evaluations', json_build_object(
     'obtenu', (select count(*) from public.partner_evaluations), 'attendu', 0),
  'peut_evaluer_true', json_build_object(
     'obtenu', (select count(*) from public.media_partners where peut_evaluer), 'attendu', 0),
  'recruiter_search_athletes_md5', json_build_object(
     'obtenu', (select string_agg(md5(pg_get_functiondef(p.oid)), ',') from pg_proc p
                 where p.pronamespace = 'public'::regnamespace and p.proname = 'recruiter_search_athletes'),
     'attendu', 'c15481a07a3b98e3ae72f8917763a45a'),
  'badge_plafond', json_build_object(
     'md5', md5(pg_get_functiondef('public.badge_plafond()'::regprocedure)),
     'md5_attendu', '171a82c74237a5a6d9c5f50c74f44d5e',
     'triggers_athlete_badges', (select string_agg(tgname || ':' || tgfoid::regproc::text || ':' || tgenabled::text, ',' order by tgname)
                                   from pg_trigger where tgrelid = 'public.athlete_badges'::regclass and not tgisinternal),
     'triggers_attendus', 'trg_athlete_badges_miroir:trg_badges_vers_distinctions:O,trg_badge_contexte_requis:badge_contexte_requis:O,trg_badge_plafond:badge_plafond:O'),
  'm10', json_build_object(
     'ambassadeur_recalculer_paliers_md5', md5(pg_get_functiondef('public.ambassadeur_recalculer_paliers()'::regprocedure)),
     'md5_attendu', '481cf443a2db040fd840a1e229b325f2',
     'trigger', (select string_agg(t.tgname || ':' || t.tgenabled::text, ',') from pg_trigger t
                  where t.tgrelid = 'public.ambassadeur_revendications'::regclass and t.tgname = 'trg_ambassadeur_paliers'),
     'trigger_attendu', 'trg_ambassadeur_paliers:O'),
  'droits_fonctions_w3', (select json_object_agg(p.oid::regprocedure::text,
                (select string_agg(a.grantee::regrole::text || ':' || a.privilege_type, ',' order by a.grantee::regrole::text)
                   from aclexplode(p.proacl) a))
               from pg_proc p
              where p.pronamespace = 'public'::regnamespace
                and p.proname in ('admin_badges_partenaire', 'admin_enregistrer_badge_partenaire', 'partenaire_mes_badges',
                                  'partenaire_attribuer_badge', 'retirer_badge_partenaire', 'coach_masquer_badge_partenaire',
                                  'badges_partenaires_athlete', 'retirer_evaluation_partenaire')),
  'droits_attendus', 'authenticated:EXECUTE,postgres:EXECUTE,service_role:EXECUTE (x8)',
  'tables_w3_policies_et_droits_directs', (select json_object_agg(c.relname, json_build_object(
        'rls', c.relrowsecurity,
        'policies', (select count(*) from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname),
        'droits_directs', (select count(*) from aclexplode(c.relacl) a
                            where a.grantee = 0 or a.grantee::regrole::text in ('anon', 'authenticated'))))
       from pg_class c where c.oid in ('public.partner_badges'::regclass, 'public.partner_athlete_badges'::regclass,
                                       'public.partner_evaluation_retraits'::regclass)),
  'tables_attendues', 'rls true, 0 policy, 0 droit direct (x3)',
  'bucket', (select row(public, file_size_limit, allowed_mime_types)::text from storage.buckets where id = 'partner-badges'),
  'bucket_attendu', '(t,524288,"{image/png,image/webp}")',
  'bucket_policies', (select string_agg(policyname || ':' || cmd || ':' || roles::text, ',' order by policyname)
                        from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'partner badges%'),
  'bucket_objets', (select count(*) from storage.objects where bucket_id = 'partner-badges'),
  'schema_migrations_apres_w2', (select json_agg(json_build_object(
        'version', version, 'name', name, 'md5_statements', md5(statements[1]), 'created_by', created_by) order by version)
      from supabase_migrations.schema_migrations where version > '20261014133428'),
  'schema_migrations_attendu', '20261014142700 w3_partenaire_badges_retrait, md5 e8287957202ba065efc271ea1ebd12f6',
  'admin_operations', (select json_agg(json_build_object('operation', operation, 'version', details->>'version', 'le', le))
                         from public.admin_operations where operation = 'MIGRATION_W3_PARTENAIRE_BADGES_RETRAIT')
) as verif_w3;
