#!/bin/bash
# Preuve de la réparation unique sur nexus_copie : réparation → rollback → réparation, empreintes à chaque étape.
set -u
P="psql -U postgres -d nexus_copie -X -v ON_ERROR_STOP=1"
etat() {
  $P -tA -F ' = ' -c "
  select 'team_ids_md5 (ne doit JAMAIS changer)', md5(string_agg(coalesce(home_team_id::text,'-') || coalesce(visitor_team_id::text,'-'), '|' order by id)) from public.games
  union all select 'rseq_ids_md5', md5(string_agg(coalesce(home_rseq_team_id::text,'-') || coalesce(visitor_rseq_team_id::text,'-'), '|' order by id)) from public.games
  union all select 'autres colonnes md5', md5(string_agg((to_jsonb(g) - 'home_team_id' - 'visitor_team_id' - 'home_rseq_team_id' - 'visitor_rseq_team_id')::text, '|' order by g.id)) from public.games g
  union all select 'côtés incohérents', ((select count(*) from public.games g join public.teams t on t.id = g.home_team_id where t.rseq_team_id is not null and t.rseq_team_id is distinct from g.home_rseq_team_id)
                                       + (select count(*) from public.games g join public.teams t on t.id = g.visitor_team_id where t.rseq_team_id is not null and t.rseq_team_id is distinct from g.visitor_rseq_team_id))::text
  union all select 'admin_operations', count(*)::text from public.admin_operations"
}
echo "== AVANT"; etat | tee /tmp/veille/rep-0.txt
echo "== RÉPARATION"; $P -q -f /tmp/veille/reparation-copie.sql 2>&1 | grep -E 'NOTICE|ERROR'; etat | tee /tmp/veille/rep-1.txt
echo "-- relancer la réparation (doit être refusée : plus rien à réaligner)"; $P -q -f /tmp/veille/reparation-copie.sql 2>&1 | grep -E 'NOTICE|ERROR'
echo "== ROLLBACK"; $P -q -f /tmp/veille/reparation-copie.rollback.sql 2>&1 | grep -E 'NOTICE|ERROR'; etat | tee /tmp/veille/rep-2.txt
echo "-- AVANT vs APRÈS ROLLBACK (seul admin_operations doit différer) :"; diff /tmp/veille/rep-0.txt /tmp/veille/rep-2.txt
echo "== RÉPARATION de nouveau"; $P -q -f /tmp/veille/reparation-copie.sql 2>&1 | grep -E 'NOTICE|ERROR'; etat
