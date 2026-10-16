-- Enregistre la version 20261016150000 dans l'historique LOCAL après un `psql -f` de la migration
-- (le lot de prod, lui, s'enregistre lui-même). Le texte est passé par la variable psql :fichier.
--   docker cp … /tmp/enr-pj.sql ; docker cp enregistrer-local.sh /tmp/ ; docker exec … sh /tmp/enregistrer-local.sh
insert into supabase_migrations.schema_migrations (version, name, statements)
values ('20261016150000', 'partenaire_journal', array[:'fichier']);
