\pset pager off
\echo '=== rapprochement_candidats(null, carte) pour les 6 cartes de rapprochement ==='
select c.prenom||' '||c.nom as carte, coalesce(a.first_name||' '||a.last_name,'—') as athlete, r.critere, r.force
  from public.cartes_prospect c
  left join lateral public.rapprochement_candidats(null, c.id) r on true
  left join public.athletes a on a.id = r.athlete_id
 where c.nom like '%preuve' or c.nom = 'Prevost'
   and true
 order by c.created_at;
\echo '=== file de rapprochement → evaluer_rapprochements(1000) → table rapprochements ==='
select public.evaluer_rapprochements(1000) as evaluees;
select c.prenom||' '||c.nom as carte, a.first_name||' '||a.last_name as athlete, r.critere, r.force, r.statut
  from public.rapprochements r join public.cartes_prospect c on c.id=r.carte_id join public.athletes a on a.id=r.athlete_id
 where a.id::text like '77770000%' order by c.created_at;
\echo '=== fusion simulée de C10 (garde levée sous postgres) ==='
begin;
select set_config('nexus.fusion_carte','on',true);
update public.cartes_prospect set fusionnee_le = now(), fusionnee_avec = '77770000-0000-0000-0000-000000000006' where nom = 'Fusionpreuve' returning id, fusionnee_le is not null as fusionnee;
commit;
