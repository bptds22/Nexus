-- W4a en prod — vérifications APRÈS le commit, LECTURE SEULE.
-- Une requête, une ligne JSON ; lançable par psql ou par le connecteur MCP
-- execute_sql. Chaque contrôle porte « obtenu » et « attendu ».
select json_build_object(
  'enregistrement', json_build_object(
     'obtenu', (select version || ' ' || name from supabase_migrations.schema_migrations where name = 'w4a_prospects_partenaire'),
     'attendu', '20261014200739 w4a_prospects_partenaire'),
  'tables', json_build_object(
     'obtenu', (select string_agg(c.relname || ':rls=' || c.relrowsecurity || ':lignes=' ||
                  (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', c.relname), false, true, '')))[1]::text,
                  ', ' order by c.relname)
                  from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and c.relname like 'partenaire_prospects%'),
     'attendu', 'partenaire_prospects:rls=true:lignes=0, partenaire_prospects_issues:rls=true:lignes=0, partenaire_prospects_journal:rls=true:lignes=0, partenaire_prospects_rapprochements:rls=true:lignes=0'),
  'politiques', json_build_object(
     'obtenu', (select count(*) from pg_policies where schemaname = 'public' and tablename like 'partenaire_prospects%'),
     'attendu', 0),
  'fonctions_par_acl', json_build_object(
     'obtenu', (select json_object_agg(acl, n) from (
                  select acl, count(*) as n from (
                    select (select string_agg(g, ',' order by g) from (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                              from unnest(p.proacl::text[]) x) u) as acl
                      from pg_proc p where p.pronamespace = 'public'::regnamespace
                       and (p.proname like 'prospect_partenaire%' or p.proname like 'partenaire_prospect%'
                            or p.proname like 'admin_prospect%'
                            or p.proname in ('admin_loi25_prospects_partenaires', 'purger_prospects_partenaire'))) s
                   group by acl) t),
     'attendu', '{"anon,authenticated,postgres,service_role": 1, "authenticated,postgres,service_role": 17, "postgres,service_role": 13}'),
  'trigger_optin', json_build_object(
     'obtenu', (select tgenabled::text || ' ' || pg_get_triggerdef(oid) from pg_trigger where tgname = 'trg_prospect_partenaire_sur_optin'),
     'attendu', 'O CREATE TRIGGER trg_prospect_partenaire_sur_optin AFTER UPDATE OF partner_visibility_opt_in, partner_visibility_parental_consent ON public.athletes … WHEN ((new.partner_visibility_opt_in AND …'),
  'triggers_athletes', json_build_object(
     'obtenu', (select count(*) from pg_trigger where tgrelid = 'public.athletes'::regclass and not tgisinternal),
     'attendu', 18),
  'cron', json_build_object(
     'obtenu', (select string_agg(schedule || ' ' || command || ' actif=' || active, '; ') from cron.job where jobname = 'prospects-partenaire-purge-quotidienne'),
     'attendu', '50 8 * * * select public.purger_prospects_partenaire() actif=true'),
  'notifications', json_build_object(
     'obtenu', (select pg_get_constraintdef(oid) like '%''AMBASSADEUR_PALIER_5''::text, ''PARTENAIRE_EVALUATION''::text]%'
                  from pg_constraint where conrelid = 'public.athlete_notifications'::regclass and conname = 'athlete_notifications_type_check'),
     'attendu', true),
  'fonctions_w2_w3_w3b', json_build_object(
     'md5', (select md5(string_agg(md5(replace(pg_get_functiondef(p.oid), E'\r', '')), ',' order by p.proname))
               from pg_proc p where p.pronamespace = 'public'::regnamespace
                and p.proname in ('partenaire_evaluer_athlete', 'partenaire_attribuer_badge', 'partenaire_attribuer_badge_nexus',
                                  'partenaire_peut_evaluer', 'is_partner_eligible_athlete', 'set_my_partner_visibility',
                                  'badge_refuser_doublon_partenaire')),
     'md5_attendu', '4fc94502a18e9a1d5fc0fd89829879ec'),
  'journal', json_build_object(
     'obtenu', (select count(*) from public.admin_operations where operation = 'MIGRATION_W4A_PROSPECTS_PARTENAIRE'),
     'attendu', 1)
) as verif_w4a;
