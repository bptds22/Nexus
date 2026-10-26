-- Lot B2 cégep — fixtures LOCALES de la base jetable nexus_b2 (jamais en prod). Comptes et données
-- personnelles fictifs ; préfixe d'id b2000000-. Le compte admin reprend l'id du compte admin prod
-- (même convention que la copie RSEQ du 2026-10-08).
--   ADMIN              admin
--   R1                 recruteur collégial Pro (Cégep de l'Outaouais) — ne voit pas les cégépiens (lot A)
--   P1                 partenaire APPROVED — voit les cégépiens
--   ATH1 / A1          athlète cégépien, ACTIF, majeur, inscrit à une équipe « Collégial » 2025-2026 de
--                      l'Outaouais (volleyball) : équipe sœur d'une des 256 (9a2f90be…)
--   A2                 athlète ACTIF, majeur, SANS ancrage, inscrit à une autre équipe « Collégial »
--                      2025-2026 de l'Outaouais (volleyball) : CAS LIMITE que la sonde du dépistage doit
--                      voir changer (équipe sœur après B2)
--   A3                 athlète secondaire ACTIF (témoin hors périmètre)
--   jetons d'équipe    un sur l'équipe « Collégial », un sur une équipe secondaire, un sur une des 256
--   invitation         une invitation PENDING pour A1 (jeton B2TEST1)
\set ON_ERROR_STOP 1
begin;
set local session_replication_role = replica;
-- Rejouable : on retire d'abord les fixtures d'un passage précédent.
delete from public.team_invitations where transfer_token = 'B2TEST1';
delete from public.team_join_tokens where code in ('B2CGPA', 'B2NVXA', 'B2SECA');
delete from public.team_athletes where athlete_id::text like 'b2000000-%';
delete from public.athletes where id::text like 'b2000000-%';
delete from public.media_partners where user_id::text like 'b2000000-%';
delete from public.subscriptions where user_id::text like 'b2000000-%';
delete from public.users where id::text like 'b2000000-%' or id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0';


insert into public.users (id, email, role, status, school_id, sport_id, first_name, last_name, is_platform_admin, onboarding_complete)
values
  ('f51384b5-a2c2-4827-9137-8aa8d29a1fe0', 'admin-b2@exemple.test', 'ADMIN', 'ACTIF', null, null, 'Admin', 'B2', true, true),
  ('b2000000-0000-4000-8000-000000000001', 'r1-b2@exemple.test', 'RECRUTEUR', 'ACTIF',
     (select id from public.schools where name = 'Cégep de l''Outaouais' and type = 'CEGEP'),
     '063752bb-e786-4009-ac46-bb3c4eccfdee', 'Recrue', 'Un', false, true),
  ('b2000000-0000-4000-8000-000000000003', 'p1-b2@exemple.test', 'PARTNER', 'ACTIF', null, null, 'Parte', 'Naire', false, true),
  ('b2000000-0000-4000-8000-000000000004', 'ath1-b2@exemple.test', 'ATHLETE', 'ACTIF', null, null, 'Athle', 'Un', false, true);

insert into public.subscriptions (user_id, tier, status, tier_source)
values ('b2000000-0000-4000-8000-000000000001', 'pro', 'active', 'admin_grant');

insert into public.media_partners (user_id, organization_name, contact_name, contact_email, status, approved_at)
values ('b2000000-0000-4000-8000-000000000003', 'Partenaire fictif B2', 'Contact', 'p1-b2@exemple.test', 'APPROVED', now());

insert into public.athletes (id, user_id, school_id, first_name, last_name, date_naissance, status, sport_id, consentement_parental)
values
  ('b2000000-0000-4000-8000-0000000000a1', 'b2000000-0000-4000-8000-000000000004',
     (select id from public.schools where name = 'Cégep de l''Outaouais' and type = 'CEGEP'),
     'Athle', 'Un', '2004-05-01', 'ACTIF', '063752bb-e786-4009-ac46-bb3c4eccfdee', false),
  ('b2000000-0000-4000-8000-0000000000a2', null, null, 'Athle', 'Deux', '2004-06-01', 'ACTIF',
     '063752bb-e786-4009-ac46-bb3c4eccfdee', false),
  ('b2000000-0000-4000-8000-0000000000a3', null,
     (select t.school_id from public.teams t join public.schools s on s.id = t.school_id
       where s.type = 'SECONDAIRE' and t.age_group = 'Juvénile' and t.sport_id = '063752bb-e786-4009-ac46-bb3c4eccfdee'
       order by t.id limit 1),
     'Athle', 'Trois', '2005-01-01', 'ACTIF', '063752bb-e786-4009-ac46-bb3c4eccfdee', false);

insert into public.team_athletes (team_id, athlete_id, sport_id)
values
  ('99789942-ca26-403d-a71f-68d38a01b763', 'b2000000-0000-4000-8000-0000000000a1', '063752bb-e786-4009-ac46-bb3c4eccfdee'),
  ('7b271d71-5ea3-4bb2-b707-3f6909216efa', 'b2000000-0000-4000-8000-0000000000a2', '063752bb-e786-4009-ac46-bb3c4eccfdee'),
  ((select t.id from public.teams t join public.schools s on s.id = t.school_id
     where s.type = 'SECONDAIRE' and t.age_group = 'Juvénile' and t.sport_id = '063752bb-e786-4009-ac46-bb3c4eccfdee'
     order by t.id limit 1),
   'b2000000-0000-4000-8000-0000000000a3', '063752bb-e786-4009-ac46-bb3c4eccfdee');

insert into public.team_join_tokens (team_id, code, created_by)
values
  ('99789942-ca26-403d-a71f-68d38a01b763', 'B2CGPA', 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0'),
  ('9a2f90be-563f-424c-8eb2-f96bbb64f324', 'B2NVXA', 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0'),
  ((select t.id from public.teams t join public.schools s on s.id = t.school_id
     where s.type = 'SECONDAIRE' and t.age_group = 'Juvénile' order by t.id limit 1),
   'B2SECA', 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0');

insert into public.team_invitations (team_id, athlete_id, status, transfer_token)
values ((select t.id from public.teams t join public.schools s on s.id = t.school_id
          where s.type = 'SECONDAIRE' and t.age_group = 'Juvénile' order by t.id limit 1),
        'b2000000-0000-4000-8000-0000000000a1', 'PENDING', 'B2TEST1');

set local session_replication_role = origin;
commit;
select 'fixtures' as quoi, (select count(*) from public.users) as users, (select count(*) from public.athletes) as athletes,
       (select count(*) from public.team_athletes) as team_athletes, (select count(*) from public.team_join_tokens) as jetons,
       (select count(*) from public.team_invitations) as invitations;
