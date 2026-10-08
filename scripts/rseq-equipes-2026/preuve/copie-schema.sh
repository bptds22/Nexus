#!/bin/bash
# Base jetable nexus_copie : schéma de la base locale, sans données. Ne touche pas à la base « postgres ».
set -u
psql -U supabase_admin -d postgres -qc 'drop database if exists nexus_copie' -c 'create database nexus_copie'
pg_dump -U supabase_admin -d postgres -s -f /tmp/schema_local.sql
psql -U supabase_admin -d nexus_copie -q -f /tmp/schema_local.sql > /tmp/restore.log 2>&1
echo "erreurs de restauration : $(grep -c ERROR /tmp/restore.log)"
grep ERROR /tmp/restore.log | sed 's/.*ERROR/ERROR/' | sort | uniq -c | sort -rn | head -10
psql -U supabase_admin -d nexus_copie -tAc "select 'fonctions public', count(*) from pg_proc where pronamespace='public'::regnamespace union all select 'policies', count(*) from pg_policy union all select 'tables public', count(*) from pg_tables where schemaname='public'"
psql -U supabase_admin -d postgres -tAc "select 'REF fonctions public', count(*) from pg_proc where pronamespace='public'::regnamespace union all select 'REF policies', count(*) from pg_policy union all select 'REF tables public', count(*) from pg_tables where schemaname='public'"
