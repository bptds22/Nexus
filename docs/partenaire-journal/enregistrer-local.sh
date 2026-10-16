#!/bin/sh
# Enregistre 20261016150000 dans l'historique LOCAL, texte = le fichier testé (après psql -f /tmp/pj.sql).
psql -U postgres -d postgres -q -v ON_ERROR_STOP=1 -v fichier="$(cat /tmp/pj.sql)" -f /tmp/enr-pj.sql
psql -U postgres -d postgres -At -c "select version || ' ' || md5(statements[1]) from supabase_migrations.schema_migrations where version = '20261016150000'"
