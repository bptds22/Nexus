-- Enregistre la version 20261017010000 dans l'historique LOCAL après un `psql -f` de la migration
-- (le lot de prod, lui, s'enregistre lui-même). Le texte est passé par la variable psql :fichier.
insert into supabase_migrations.schema_migrations (version, name, statements)
values ('20261017010000', 'complements_1_4_5', array[:'fichier']);
