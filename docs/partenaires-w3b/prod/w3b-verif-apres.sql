-- W3b en prod — vérifications APRÈS le commit, LECTURE SEULE.
-- Une requête, une ligne JSON ; lançable par psql ou par le connecteur MCP
-- execute_sql. Chaque contrôle porte « obtenu » et « attendu ».
select json_build_object(
  'enregistrement', json_build_object(
     'obtenu', (select version || ' ' || name from supabase_migrations.schema_migrations where name = 'w3b_partenaire_badges_nexus'),
     'attendu', '20261014180000 w3b_partenaire_badges_nexus'),
  'colonnes', json_build_object(
     'obtenu', (select string_agg(column_name || ':' || is_nullable, ', ' order by column_name) from information_schema.columns
                 where table_schema = 'public' and table_name = 'partner_athlete_badges'
                   and column_name in ('partner_id', 'badge_id', 'partner_badge_id')),
     'attendu', 'badge_id:YES, partner_badge_id:YES, partner_id:NO'),
  'poses', json_build_object(
     'obtenu', (select count(*) || ' poses, ' || count(*) filter (where partner_id is null) || ' sans partenaire, '
                       || count(*) filter (where badge_id is not null) || ' Nexus' from public.partner_athlete_badges),
     'attendu', '<n> poses, 0 sans partenaire, 0 Nexus'),
  'droits', (select json_object_agg(p.oid::regprocedure::text,
               (select string_agg(a.grantee::regrole::text || ':' || a.privilege_type, ',' order by a.grantee::regrole::text)
                  from aclexplode(p.proacl) a))
             from pg_proc p where p.pronamespace = 'public'::regnamespace
              and p.proname in ('partenaire_badges_nexus_admissibles', 'partenaire_attribuer_badge_nexus', 'partenaire_attribuer_badge',
                                'retirer_badge_partenaire', 'coach_masquer_badge_partenaire', 'badges_partenaires_athlete')),
  'droits_attendus', 'authenticated:EXECUTE,postgres:EXECUTE,service_role:EXECUTE (x6)',
  'badge_plafond', json_build_object(
     'md5', md5(pg_get_functiondef('public.badge_plafond()'::regprocedure)),
     'md5_attendu', '171a82c74237a5a6d9c5f50c74f44d5e'),
  'm10', json_build_object(
     'md5', md5(pg_get_functiondef('public.ambassadeur_recalculer_paliers()'::regprocedure)),
     'md5_attendu', '481cf443a2db040fd840a1e229b325f2'),
  'journal', json_build_object(
     'obtenu', (select count(*) from public.admin_operations where operation = 'MIGRATION_W3B_PARTENAIRE_BADGES_NEXUS'),
     'attendu', 1)
) as verif_w3b;
