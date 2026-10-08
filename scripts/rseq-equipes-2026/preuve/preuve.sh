#!/bin/bash
# Preuve locale des lots sur la base jetable nexus_copie (copie prod du 2026-10-08). Jamais sur « postgres ».
# Usage (dans le conteneur) : bash /tmp/rseq/preuve/preuve.sh
set -u
DB=nexus_copie
P="psql -U supabase_admin -d $DB -v ON_ERROR_STOP=1 -X -q"
L=/tmp/rseq/lots
LOTS="01-football 02-flag-football 03-soccer 04-volleyball 05-basketball 06-futsal 07-baseball 08-rugby 09-ultimate-frisbee"
[ "$(psql -U supabase_admin -d $DB -tAc 'select current_database()')" = "$DB" ] || { echo "base $DB absente"; exit 1; }

$P -c "create table if not exists public._preuve_existantes as select id from public.teams"  # équipes de la copie, avant tout lot
echo "== 1. Empreintes AVANT";            $P -tA -F ' = ' -f /tmp/rseq/preuve/empreintes.sql | tee /tmp/rseq/avant.txt
echo "== 2. Temps de réponse AVANT";      $P -f /tmp/rseq/preuve/mesures.sql
echo "== 3. Lots, dans l'ordre (Football d'abord)"
for l in $LOTS; do $P -f $L/$l.sql 2>&1 | grep -E 'NOTICE|ERROR' ; done
echo "== 4. Empreintes APRÈS les 9 lots"; $P -tA -F ' = ' -f /tmp/rseq/preuve/empreintes.sql | tee /tmp/rseq/apres.txt
echo "== 5. Temps de réponse APRÈS";      $P -f /tmp/rseq/preuve/mesures.sql
echo "== 6. Gardes négatives"
echo "-- 6a. relancer le lot Football (attendu : refus, déjà en base)"
$P -f $L/01-football.sql 2>&1 | grep -E 'NOTICE|ERROR'
echo "-- 6b. rollback Football puis un côté de match en plus (la veille a bougé) → refus attendu"
$P -f $L/01-football.rollback.sql 2>&1 | grep -E 'NOTICE|ERROR'
$P <<'SQL' 2>&1 | grep -E 'NOTICE|ERROR|ROLLBACK'
begin;
insert into public.games (rseq_game_id, season, sector, sport, home_rseq_team_id, home_name_raw)
select gen_random_uuid(), '2026-2027', 'Secondaire', 'Football', home_rseq_team_id, 'preuve dérive'
  from public.games where sport = 'Football' and home_team_id is null and home_rseq_team_id = '007c4209-29af-43c5-842d-0deeb2f274ef' limit 1;
\i /tmp/rseq/lots/01-football.sql
rollback;
SQL
echo "-- 6c. une équipe 2026 posée à la main, même école+sport+catégorie+division qu'une ligne du lot → refus attendu"
$P <<'SQL' 2>&1 | grep -E 'NOTICE|ERROR|ROLLBACK'
begin;
insert into public.teams (school_id, sport_id, name, age_group, division, gender, season)
values ('8dbb6f3a-b683-4c96-9088-c5b5168dd970', '4b859bf1-5832-4258-897c-e094062926af', 'Preuve doublon', 'Cadet', 'Division 3', 'Masculin', '2026-2027');
\i /tmp/rseq/lots/01-football.sql
rollback;
SQL
echo "-- 6d. rollback refusé si une équipe du lot a reçu un coach"
$P -f $L/01-football.sql 2>&1 | grep -E 'NOTICE|ERROR'
$P <<'SQL' 2>&1 | grep -E 'NOTICE|ERROR|ROLLBACK'
begin;
set local session_replication_role = replica;  -- coach fictif, sans compte : seule la ligne team_coaches compte
insert into public.team_coaches (team_id, coach_id, role)
select id, gen_random_uuid(), 'head_coach' from public.teams where rseq_team_id = '007c4209-29af-43c5-842d-0deeb2f274ef';
set local session_replication_role = origin;
\i /tmp/rseq/lots/01-football.rollback.sql
rollback;
SQL
echo "== 7. Rollback des 9 lots (ordre inverse), puis empreintes = AVANT ?"
for l in $(echo $LOTS | tr ' ' '\n' | tac); do $P -f $L/$l.rollback.sql 2>&1 | grep -E 'NOTICE|ERROR' ; done
$P -tA -F ' = ' -f /tmp/rseq/preuve/empreintes.sql | tee /tmp/rseq/rollback.txt
echo "-- écarts AVANT / APRÈS ROLLBACK (seul admin_operations doit différer) :"
diff /tmp/rseq/avant.txt /tmp/rseq/rollback.txt
echo "== 8. Ré-application des 9 lots ; empreintes = APRÈS ?"
for l in $LOTS; do $P -f $L/$l.sql 2>&1 | grep -E 'NOTICE|ERROR' ; done
$P -tA -F ' = ' -f /tmp/rseq/preuve/empreintes.sql > /tmp/rseq/reapplique.txt
echo "-- écarts APRÈS / RÉ-APPLIQUÉ (seul admin_operations doit différer) :"
diff /tmp/rseq/apres.txt /tmp/rseq/reapplique.txt
echo "== 9. Contrôles finaux"
$P -tA -F ' | ' <<'SQL'
select 'équipes créées (2026, rseq, depuis la copie)', count(*) from public.teams where id not in (select id from public._preuve_existantes);
select 'côtés de match reliés à une équipe créée', (select count(*) from public.games g join public.teams t on t.id = g.home_team_id where t.id not in (select id from public._preuve_existantes))
                                              + (select count(*) from public.games g join public.teams t on t.id = g.visitor_team_id where t.id not in (select id from public._preuve_existantes));
select 'admin_operations par opération', string_agg(operation || ' ×' || n, ', ') from (select operation, count(*) n from public.admin_operations group by 1) x;
select 'accents (octets > caractères) sur les noms créés', count(*) filter (where octet_length(name) > char_length(name)) || ' / ' || count(*) filter (where name ~ '[^\x01-\x7F]')
  from public.teams where id not in (select id from public._preuve_existantes);
SQL
