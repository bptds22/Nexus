-- Fixtures LOCALES « profils Nexus dans ce match » (lot A+). Match 3f927293
-- (2026-10-10 15:30, Collège Laval) : domicile 57c594e7, visiteur 5d4bb7e9.
-- Tous suffixés « Cprofils » ; nettoyage : 9-nettoyer.sql.
begin;
insert into public.athletes (id, first_name, last_name, status, date_naissance, consentement_parental, verified, sport_id, position_id, annee_diplomation) values
  ('77770000-0000-0000-0000-0000000000e1', 'Mineur',    'Cprofils', 'ACTIF',     '2011-03-01', false, false, '4b859bf1-5832-4258-897c-e094062926af', '0d8ed2ce-a0c6-4d06-a921-3aef5dda94f6', 2028),
  ('77770000-0000-0000-0000-0000000000e2', 'Consenti',  'Cprofils', 'ACTIF',     '2011-05-01', true,  false, '4b859bf1-5832-4258-897c-e094062926af', '0d8ed2ce-a0c6-4d06-a921-3aef5dda94f6', 2028),
  ('77770000-0000-0000-0000-0000000000e3', 'Majeur',    'Cprofils', 'ACTIF',     '2005-01-01', false, false, '4b859bf1-5832-4258-897c-e094062926af', 'a0127a71-4cb7-408f-a765-7e37397c3bc3', 2026),
  ('77770000-0000-0000-0000-0000000000e4', 'Desactive', 'Cprofils', 'DESACTIVE', '2005-01-01', false, true,  '4b859bf1-5832-4258-897c-e094062926af', null, 2026),
  ('77770000-0000-0000-0000-0000000000e5', 'Visiteur',  'Cprofils', 'ACTIF',     '2006-06-01', false, true,  '4b859bf1-5832-4258-897c-e094062926af', null, 2027);
insert into public.team_athletes (team_id, athlete_id, sport_id) values
  ('57c594e7-fae7-4dd5-a133-e73453e5d251', '77770000-0000-0000-0000-0000000000e1', '4b859bf1-5832-4258-897c-e094062926af'),
  ('57c594e7-fae7-4dd5-a133-e73453e5d251', '77770000-0000-0000-0000-0000000000e2', '4b859bf1-5832-4258-897c-e094062926af'),
  ('57c594e7-fae7-4dd5-a133-e73453e5d251', '77770000-0000-0000-0000-0000000000e3', '4b859bf1-5832-4258-897c-e094062926af'),
  ('57c594e7-fae7-4dd5-a133-e73453e5d251', '77770000-0000-0000-0000-0000000000e4', '4b859bf1-5832-4258-897c-e094062926af'),
  ('5d4bb7e9-3247-477b-911b-caa3815e4f9a', '77770000-0000-0000-0000-0000000000e5', '4b859bf1-5832-4258-897c-e094062926af');
-- Le majeur non vérifié est SUIVI par l'unité de r3 (« dont 1 suivi »).
insert into public.recruiter_pipeline (recruiter_id, athlete_id, stage)
values ('22222222-0000-0000-0000-00000000003a', '77770000-0000-0000-0000-0000000000e3', 'IDENTIFIE');
commit;
