-- Fixtures PREUVE lot 1 (adultes fictifs, ids 77770000-…). Équipe T = Les Estacades (football).
\set T '81e7d45a-e178-421d-82bb-60ffc8049109'
\set F '4b859bf1-5832-4258-897c-e094062926af'
insert into public.athletes (id, first_name, last_name, status, date_naissance, sport_id, school_id, parent_email, email) values
 ('77770000-0000-0000-0000-000000000001','Mathys','Prevost','ACTIF','2006-01-01',:'F','84cc3b3b-8582-48e8-9eb0-a7c917bf058f',null,null),
 ('77770000-0000-0000-0000-000000000002','Lea','Gagnonpreuve','ACTIF','2006-01-01',:'F','84cc3b3b-8582-48e8-9eb0-a7c917bf058f',null,null),
 ('77770000-0000-0000-0000-000000000003','Alexandre','Royepreuve','ACTIF','2006-01-01',:'F','84cc3b3b-8582-48e8-9eb0-a7c917bf058f',null,null),
 ('77770000-0000-0000-0000-000000000004','Jacob','Martelpreuve','ACTIF','2006-01-01',:'F',null,'parent.martel@preuve.local',null),
 ('77770000-0000-0000-0000-000000000005','Mathis','Lavoiepreuve','ACTIF','2006-01-01',:'F',null,'parent.lavoie@preuve.local',null),
 ('77770000-0000-0000-0000-000000000006','Noah','Inscritpreuve','ACTIF','2006-01-01',:'F',null,null,'deja.inscrit@preuve.local');
insert into public.team_athletes (team_id, athlete_id, sport_id) values
 (:'T','77770000-0000-0000-0000-000000000001',:'F'),
 (:'T','77770000-0000-0000-0000-000000000002',:'F'),
 (:'T','77770000-0000-0000-0000-000000000003',:'F');
select id, first_name, last_name, public.athlete_identity_ok(date_naissance, consentement_parental) ok from public.athletes where id::text like '77770000%' order by id;
