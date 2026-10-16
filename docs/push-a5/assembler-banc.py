import io, os
os.chdir(r'C:\tmp\nexus-a5')
a4 = io.open('docs/push-a4a/tests-push-a4a.sql', encoding='utf-8').read()
sec = io.open('docs/push-a5/tests-push-a5-section.sql', encoding='utf-8').read()
mig = io.open('supabase/migrations/20261016020000_push_a5_ouverture.sql', encoding='utf-8').read()
rb = io.open('supabase/rollback/20261016020000_rollback_push_a5_ouverture.sql', encoding='utf-8').read()

head = """-- Push A5 (20261016020000), base LOCALE — le banc A4a ENTIER rejoué APRÈS la migration A5,
-- plus la section A5 (C, N, G, D). Une transaction ANNULÉE à la fin : rien ne survit.
--   (généré par docs/push-a5/assembler-banc.py — ne pas éditer à la main)
--   docker cp supabase/migrations/20261016020000_push_a5_ouverture.sql supabase_db_Nexus:/tmp/a5.sql
--   docker cp docs/push-a5/tests-push-a5.sql supabase_db_Nexus:/tmp/tests-a5.sql
--   docker exec -e PGCLIENTENCODING=UTF8 supabase_db_Nexus psql -U postgres -d postgres -q -At -f /tmp/tests-a5.sql
"""
assert a4.count('\nbegin;\n') == 1
body = a4.replace('\nbegin;\n', '\nbegin;\n\\i /tmp/a5.sql\n', 1)
fin = "\nselect n, case when ok then 'OK' else 'ÉCHEC' end as res, test, detail from _res order by n;"
assert body.count(fin) == 1
body = body.replace(fin, '\n' + sec + fin, 1)
io.open('docs/push-a5/tests-push-a5.sql', 'w', encoding='utf-8', newline='\n').write(head + body)

# Rollback : migration puis rollback (sans ses begin/commit), dans UNE transaction annulée.
rb_corps = rb.replace('\nbegin;\n', '\n', 1).replace('\ncommit;\n', '\n', 1)
io.open('docs/push-a5/rollback-corps.sql', 'w', encoding='utf-8', newline='\n').write(rb_corps)
essai_rb = """-- Rollback A5 en local : migration, rollback, comparaison à l'état A4a. Transaction ANNULÉE.
--   docker cp ... rollback-corps.sql supabase_db_Nexus:/tmp/a5-rb.sql ; psql -f /tmp/essai-rollback-a5.sql
\\set ON_ERROR_STOP 1
begin;
create temp table _avant as
  select p.proname, md5(p.prosrc) as m, p.proacl::text as acl from pg_proc p
   where p.pronamespace = 'public'::regnamespace and p.proname like 'push%';
create temp table _check_avant as
  select pg_get_constraintdef(oid) as d from pg_constraint where conname = 'athlete_notifications_type_check';
\\i /tmp/a5.sql
select 'apres_migration', count(*) from pg_proc where proname = 'push_destination';
\\i /tmp/a5-rb.sql
select 'fonctions_identiques_a_A4a', (select count(*) from _avant) as avant,
       (select count(*) from _avant a join pg_proc p on p.proname = a.proname and p.pronamespace = 'public'::regnamespace
         where md5(p.prosrc) = a.m and p.proacl::text is not distinct from a.acl) as identiques,
       (select count(*) from pg_proc where pronamespace = 'public'::regnamespace and proname like 'push%') as maintenant;
select 'contrainte', (select d from _check_avant) = (select pg_get_constraintdef(oid) from pg_constraint where conname = 'athlete_notifications_type_check'),
       (select convalidated from pg_constraint where conname = 'athlete_notifications_type_check');
rollback;
"""
io.open('docs/push-a5/essai-rollback-a5.sql', 'w', encoding='utf-8', newline='\n').write(essai_rb)
print('ok')

# Variante pour une base DÉJÀ migrée (preuve du lot de prod, étape 5) : même banc, sans charger la migration.
migree = (head.replace("rejoué APRÈS la migration A5", "rejoué sur une base OÙ A5 EST DÉJÀ APPLIQUÉE")
          + a4.replace('\nbegin;\n', '\nbegin;\n', 1).replace(fin, '\n' + sec + fin, 1))
io.open('docs/push-a5/tests-push-a5-base-migree.sql', 'w', encoding='utf-8', newline='\n').write(migree)
print('ok migree')
