-- Preuve 3 (nexus_copie) : une équipe fictive apparaît en PROPOSITION dans les alertes et n'est PAS créée ;
-- puis la RPC de création, par rôle, dans une transaction ANNULÉE.
\set ON_ERROR_STOP on
\pset footer off
-- Ligue réelle de la copie : un volleyball juvénile féminin secondaire de la saison.
select rseq_league_id as ligue, family_key as famille from public.rseq_ligues_a_appeler
 where sector = 'Secondaire' and sport = 'Volleyball' and category = 'Juvénile' and sex_type = 'Féminin'
 order by rseq_league_id limit 1 \gset
insert into public.rseq_sync_runs (declencheur, saison, secteur, mode, statut)
values ('manual', '2026-2027', 'Secondaire', 'passe', 'DONE') returning id as run \gset
select count(*) as equipes_avant from public.teams \gset

select public.rseq_sync_detect_teams(:'run', :'ligue', :'famille', '2026-2027', 'Secondaire', jsonb_build_array(
  jsonb_build_object('rseq_team_id', 'f1c71f00-0000-4000-8000-000000000001', 'team_name', 'FICTIVE preuve Saint-Joseph',
                     'team_code', 'FIC1', 'rseq_institution_id', '8ef51344-caf1-4a49-8931-b2b356baac31', 'vu_dans_teams', true),
  jsonb_build_object('rseq_team_id', 'f1c71f00-0000-4000-8000-000000000002', 'team_name', 'FICTIVE preuve école inconnue',
                     'team_code', 'FIC2', 'rseq_institution_id', '00000000-1111-4000-8000-000000000000', 'vu_dans_teams', true)
)) as alertes_levees;

\echo '== Propositions lues dans l''alerte NOUVELLES_EQUIPES'
select a.id as alerte, a.statut, e->>'team_name' as equipe, e->'proposition'->>'decision' as decision,
       e->'proposition'->>'ecole' as ecole, e->'proposition'->>'sport' as sport, e->'proposition'->>'age_group' as categorie,
       e->'proposition'->>'division' as division, e->'proposition'->>'gender' as sexe, e->'proposition'->>'confiance' as confiance,
       e->'proposition'->>'cotes_a_relier' as cotes
  from public.rseq_sync_alerts a, jsonb_array_elements(a.payload->'equipes') e
 where a.type = 'NOUVELLES_EQUIPES' and (e->>'rseq_team_id') like 'f1c71f00-%';
select a.id as alerte_fictive from public.rseq_sync_alerts a
 where a.type = 'NOUVELLES_EQUIPES' and a.payload @> '{"equipes":[{"rseq_team_id":"f1c71f00-0000-4000-8000-000000000001"}]}' \gset
\echo '== Créée ? (attendu : équipes inchangées, aucun rseq fictif dans teams)'
select :equipes_avant as equipes_avant, (select count(*) from public.teams) as equipes_apres,
       (select count(*) from public.teams where rseq_team_id::text like 'f1c71f00-%') as fictives_dans_teams;

\echo '== RPC, par rôle, dans une transaction ANNULÉE'
begin;
\echo '-- anon : pas de droit EXECUTE'
savepoint s1;
set local role anon;
\set ON_ERROR_STOP off
select public.rseq_creer_equipes_proposees(array[:'alerte_fictive']::uuid[]);
rollback to savepoint s1;
\echo '-- authenticated NON admin (sub inconnu de users) : refus 42501'
savepoint s2;
select set_config('request.jwt.claims', '{"sub":"0badc0de-0000-4000-8000-000000000000","role":"authenticated"}', true);
set local role authenticated;
select public.rseq_creer_equipes_proposees(array[:'alerte_fictive']::uuid[]);
rollback to savepoint s2;
\set ON_ERROR_STOP on
\echo '-- ADMIN (bptds22, role ADMIN dans la copie) : crée l''équipe « a_creer », refuse l''« introuvable », alerte reste OUVERTE'
select set_config('request.jwt.claims', '{"sub":"f51384b5-a2c2-4827-9137-8aa8d29a1fe0","role":"authenticated"}', true);
set local role authenticated;
select public.rseq_creer_equipes_proposees(array[:'alerte_fictive']::uuid[]) as resultat;
reset role;
select t.name, s.name as ecole, sp.nom as sport, t.age_group, t.division, t.gender, t.season, t.rseq_team_id
  from public.teams t join public.schools s on s.id = t.school_id join public.sports sp on sp.id = t.sport_id
 where t.rseq_team_id::text like 'f1c71f00-%';
select operation, details->>'equipes' as equipes, details->'refusees'->0->>'decision' as refus, par
  from public.admin_operations order by le desc limit 1;
select statut, note from public.rseq_sync_alerts where id = :'alerte_fictive';
\echo '-- ADMIN, second appel sur la même alerte : l''équipe créée est « deja_en_base », 0 créée, toujours 1 refus'
set local role authenticated;
select public.rseq_creer_equipes_proposees(array[:'alerte_fictive']::uuid[]) as resultat_second_appel;
reset role;
rollback;
\echo '== Après ROLLBACK (attendu : rien créé, alerte toujours OUVERTE)'
select (select count(*) from public.teams) as equipes, (select count(*) from public.teams where rseq_team_id::text like 'f1c71f00-%') as fictives,
       (select statut from public.rseq_sync_alerts where id = :'alerte_fictive') as statut_alerte;
