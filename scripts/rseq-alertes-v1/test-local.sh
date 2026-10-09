#!/usr/bin/env bash
# Test LOCAL de 2-fermer.sql et 3-rollback.sql, dans une transaction enveloppante ANNULÉE.
# Rien ne persiste dans la base locale (données de test de BP).
#   bash test-local.sh            → cas nominal : clôture, vérif, rollback, vérif
#   bash test-local.sh garde      → une alerte « à clore » devient incomplète : la clôture doit refuser
set -euo pipefail
cd "$(dirname "$0")"
CAS="${1:-nominal}"
T=$(mktemp -d)
sed '/^begin;$/d; /^commit;$/d' 2-fermer.sql > "$T/fermer.sql"
sed '/^begin;$/d; /^commit;$/d' 3-rollback.sql > "$T/rollback.sql"
IDS_CLORE=$(grep -oE "'[0-9a-f-]{36}'" 2-fermer.sql | tr -d "'" | sort)
cat > "$T/harnais.sql" <<EOF
\set ON_ERROR_STOP on
begin;
-- Le compte admin n'existe pas en local : on en emprunte un, le temps de la transaction.
update public.users set email = 'bptds22@gmail.com' where id = (select id from public.users order by created_at limit 1);
-- Les alertes locales ouvertes de ce type sont mises de côté (annulé à la fin).
update public.rseq_sync_alerts set statut = 'X_TEST' where statut = 'OUVERTE' and type = 'NOUVELLES_EQUIPES';
create temp table _equipes as select rseq_team_id from public.teams where rseq_team_id is not null order by rseq_team_id limit 2;
-- 16 alertes complètes (ids de prod), 16 incomplètes (une équipe absente).
insert into public.rseq_sync_alerts (id, type, cle, statut, resume, payload)
select x::uuid, 'NOUVELLES_EQUIPES', 'test|clore|' || x, 'OUVERTE', 'test',
       jsonb_build_object('equipes', (select jsonb_agg(jsonb_build_object('rseq_team_id', rseq_team_id)) from _equipes))
  from unnest(string_to_array('$(echo $IDS_CLORE | tr ' ' ',')', ',')) x;
insert into public.rseq_sync_alerts (id, type, cle, statut, resume, payload)
select gen_random_uuid(), 'NOUVELLES_EQUIPES', 'test|garder|' || g, 'OUVERTE', 'test',
       jsonb_build_object('equipes', jsonb_build_array(
         jsonb_build_object('rseq_team_id', (select rseq_team_id from _equipes limit 1)),
         jsonb_build_object('rseq_team_id', gen_random_uuid())))
  from generate_series(1, 16) g;
EOF
if [ "$CAS" = garde ]; then
  cat >> "$T/harnais.sql" <<EOF
update public.rseq_sync_alerts set payload = jsonb_set(payload, '{equipes}', payload->'equipes' || jsonb_build_array(jsonb_build_object('rseq_team_id', gen_random_uuid())))
 where id = '$(echo "$IDS_CLORE" | head -1)';
\echo '--- clôture (doit REFUSER) ---'
\i /tmp/rseq-v1-fermer.sql
EOF
else
  cat >> "$T/harnais.sql" <<'EOF'
select 'AVANT' as etape, statut, count(*) from public.rseq_sync_alerts where cle like 'test|%' group by 2 order by 2;
\echo '--- clôture ---'
\i /tmp/rseq-v1-fermer.sql
select 'APRES_CLOTURE' as etape, split_part(cle, '|', 2) as groupe, statut, count(*), count(*) filter (where traite_par is not null and note like 'Clôture du 2026-10-09%') as note_ok
  from public.rseq_sync_alerts where cle like 'test|%' group by 2, 3 order by 2, 3;
select 'ADMIN_OP' as etape, operation, details->>'nb' as nb, jsonb_array_length(details->'alertes') as alertes from public.admin_operations where operation like 'ALERTES_RSEQ_V1%';
\echo '--- rollback ---'
\i /tmp/rseq-v1-rollback.sql
select 'APRES_ROLLBACK' as etape, split_part(cle, '|', 2) as groupe, statut, count(*), count(*) filter (where traite_par is null and traite_le is null and note is null) as vierges
  from public.rseq_sync_alerts where cle like 'test|%' group by 2, 3 order by 2, 3;
select 'ADMIN_OPS' as etape, operation, count(*) from public.admin_operations where operation like 'ALERTES_RSEQ_V1%' group by 2 order by 2;
\echo '--- rollback rejoué (doit REFUSER) ---'
\set ON_ERROR_STOP off
\i /tmp/rseq-v1-rollback.sql
EOF
fi
echo "rollback;" >> "$T/harnais.sql"
for f in fermer rollback harnais; do docker cp "$T/$f.sql" "supabase_db_Nexus:/tmp/rseq-v1-$f.sql" >/dev/null; done
MSYS_NO_PATHCONV=1 docker exec -e PGCLIENTENCODING=UTF8 supabase_db_Nexus psql -U postgres -d postgres -f /tmp/rseq-v1-harnais.sql 2>&1 || true
