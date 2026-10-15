#!/bin/sh
# Envoie /tmp/lot.sql en UN SEUL message (psql -c) : une seule transaction implicite.
exec psql -X -U postgres -d postgres -At -c "$(cat /tmp/lot.sql)"
