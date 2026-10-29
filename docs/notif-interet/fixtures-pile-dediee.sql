-- Fixtures SYNTHÉTIQUES de la pile dédiée « NexusNotif » (:56322) — jamais ailleurs.
--
-- La pile porte le schéma public + nexus_prive de la prod (pg_dump --schema-only, lecture seule)
-- et quatre référentiels sans donnée personnelle (sports, positions, badges, app_settings).
-- Ces fixtures recréent les comptes que le banc A5 cherche par courriel, plus ceux du banc
-- « intérêt recruteur ». Aucune personne réelle : domaines exemple.test / demo.local / preuve.local.
--   psql "host=127.0.0.1 port=56322 dbname=postgres user=postgres password=postgres" \
--        -X -v ON_ERROR_STOP=1 -f docs/notif-interet/fixtures-pile-dediee.sql
\set ON_ERROR_STOP 1
begin;

do $$
begin
  -- Une pile qui a déjà des fiches n'est pas la pile dédiée (la pile :54321 en a des centaines).
  if (select count(*) from public.athletes) > 0 or (select count(*) from public.users) > 0 then
    raise exception 'NEXUS: fixtures réservées à une pile vide (NexusNotif)';
  end if;
end $$;

-- ── Établissements et équipe ────────────────────────────────────────────────
insert into public.schools (id, name, type, region, city) values
  ('b0000000-0000-4000-8000-000000000501', 'École secondaire du Banc', 'SECONDAIRE', 'Montréal', 'Montréal'),
  ('b0000000-0000-4000-8000-000000000502', 'Cégep du Banc',            'CEGEP',      'Montréal', 'Montréal'),
  ('b0000000-0000-4000-8000-000000000503', 'Cégep du Banc 2',          'CEGEP',      'Montréal', 'Laval');

insert into public.teams (id, school_id, sport_id, name)
select 'b0000000-0000-4000-8000-000000000601', 'b0000000-0000-4000-8000-000000000501', s.id, 'Banc Juvénile'
  from public.sports s where s.nom = 'Football';

-- ── Comptes (auth puis public) ──────────────────────────────────────────────
create temp table _comptes (id uuid, email text, role public.user_role, prenom text, nom text, ecole uuid,
                            statut public.account_status) on commit drop;
insert into _comptes values
  ('b0000000-0000-4000-8000-000000000101', 'marc.desrosiers@exemple.test', 'COACH',     'Marc',  'Desrosiers', 'b0000000-0000-4000-8000-000000000501', 'ACTIF'),
  ('b0000000-0000-4000-8000-000000000102', 'luc.arsenault@exemple.test',   'COACH',     'Luc',   'Arsenault',  'b0000000-0000-4000-8000-000000000502', 'ACTIF'),
  ('b0000000-0000-4000-8000-000000000103', 'admin@demo.local',             'ADMIN',     'Admin', 'Banc',       null,                                   'ACTIF'),
  ('b0000000-0000-4000-8000-000000000104', 'p1.partenaire@preuve.local',   'PARTNER',   'Paule', 'Preuve',     null,                                   'ACTIF'),
  ('b0000000-0000-4000-8000-000000000201', 'felix.gauthier@exemple.test',  'ATHLETE',   'Félix', 'Gauthier',   'b0000000-0000-4000-8000-000000000501', 'ACTIF'),
  ('b0000000-0000-4000-8000-000000000202', 'mathis.demo@exemple.test',     'ATHLETE',   'Mathis','Demo',       'b0000000-0000-4000-8000-000000000501', 'ACTIF'),
  ('b0000000-0000-4000-8000-000000000203', 'a1.athlete@preuve.local',      'ATHLETE',   'Alix',  'Un',         'b0000000-0000-4000-8000-000000000501', 'ACTIF'),
  ('b0000000-0000-4000-8000-000000000204', 'tom@demo.local',               'ATHLETE',   'Tom',   'Demo',       'b0000000-0000-4000-8000-000000000501', 'ACTIF'),
  ('b0000000-0000-4000-8000-000000000205', 'lea@demo.local',               'ATHLETE',   'Léa',   'Demo',       'b0000000-0000-4000-8000-000000000501', 'ACTIF'),
  ('b0000000-0000-4000-8000-000000000206', 'noah@demo.local',              'ATHLETE',   'Noah',  'Demo',       'b0000000-0000-4000-8000-000000000501', 'ACTIF'),
  ('b0000000-0000-4000-8000-000000000207', 'zoe.interet@exemple.test',     'ATHLETE',   'Zoé',   'Interet',    'b0000000-0000-4000-8000-000000000501', 'ACTIF'),
  ('b0000000-0000-4000-8000-000000000301', 'r1.recruteur@exemple.test',    'RECRUTEUR', 'Rémi',  'Un',         'b0000000-0000-4000-8000-000000000502', 'ACTIF'),
  ('b0000000-0000-4000-8000-000000000302', 'r2.recruteur@exemple.test',    'RECRUTEUR', 'Rose',  'Deux',       'b0000000-0000-4000-8000-000000000503', 'ACTIF'),
  ('b0000000-0000-4000-8000-000000000303', 'r3.inactif@exemple.test',      'RECRUTEUR', 'René',  'Trois',      'b0000000-0000-4000-8000-000000000502', 'DESACTIVE'),
  ('b0000000-0000-4000-8000-000000000304', 'r4.collegue@exemple.test',     'RECRUTEUR', 'Rita',  'Quatre',     'b0000000-0000-4000-8000-000000000502', 'ACTIF'),
  ('b0000000-0000-4000-8000-000000000305', 'r5.equipe@nexussports.test',   'RECRUTEUR', 'Équipe','Nexus',      null,                                   'ACTIF');

insert into auth.users (id, email, aud, role, email_confirmed_at, created_at, updated_at)
select id, email, 'authenticated', 'authenticated', now(), now(), now() from _comptes;

insert into public.users (id, email, role, first_name, last_name, school_id, status, onboarding_complete, sport_id)
select c.id, c.email, c.role, c.prenom, c.nom, c.ecole, c.statut, true,
       case when c.role in ('RECRUTEUR', 'COACH') then (select id from public.sports where nom = 'Football') end
  from _comptes c where c.email <> 'luc.arsenault@exemple.test';

-- Luc, coach rattaché à un CÉGEP : la porte B1 (porte_coach_cegep) l'interdit depuis le 2026-10-27.
-- Le cas A5 E4 (« un coach collégial n'est jamais nommé ») vise ces comptes HÉRITÉS : on le pose
-- sans triggers, comme il existait avant la porte.
set local session_replication_role = replica;
insert into public.users (id, email, role, first_name, last_name, school_id, status, onboarding_complete, sport_id)
select c.id, c.email, c.role, c.prenom, c.nom, c.ecole, c.statut, true, (select id from public.sports where nom = 'Football')
  from _comptes c where c.email = 'luc.arsenault@exemple.test';
set local session_replication_role = origin;

-- Le sport d'un recruteur ne tient pas à l'insertion du compte (déclencheur de users) : posé
-- ensuite, comme l'onboarding le fait. Sans lui, pas d'unité (cégep × sport).
update public.users set sport_id = (select id from public.sports where nom = 'Football')
 where role = 'RECRUTEUR' and school_id is not null;

-- Partenaire approuvé.
insert into public.media_partners (id, user_id, organization_name, contact_name, contact_email, status)
values ('b0000000-0000-4000-8000-000000000701', 'b0000000-0000-4000-8000-000000000104',
        'Média Preuve', 'Paule Preuve', 'p1.partenaire@preuve.local', 'APPROVED');

-- ── Fiches athlètes (+ une fiche SANS compte) ───────────────────────────────
insert into public.athletes (id, user_id, first_name, last_name, school_id, coach_id, sport_id, status,
                             date_naissance, annee_diplomation)
select ('b0000000-0000-4000-8000-0000000004' || right(c.id::text, 2))::uuid, c.id, c.prenom, c.nom, c.ecole,
       case when c.ecole = 'b0000000-0000-4000-8000-000000000501' then 'b0000000-0000-4000-8000-000000000101'::uuid end,
       (select id from public.sports where nom = 'Football'), 'ACTIF', date '2008-03-01', 2027
  from _comptes c where c.role = 'ATHLETE';

insert into public.athletes (id, user_id, first_name, last_name, school_id, sport_id, status, date_naissance, annee_diplomation)
select 'b0000000-0000-4000-8000-000000000499', null, 'Sans', 'Compte', 'b0000000-0000-4000-8000-000000000501',
       (select id from public.sports where nom = 'Football'), 'ACTIF', date '2008-03-01', 2027;

-- Félix et Mathis dans l'équipe de Marc.
insert into public.team_coaches (team_id, coach_id)
values ('b0000000-0000-4000-8000-000000000601', 'b0000000-0000-4000-8000-000000000101');
insert into public.team_athletes (team_id, athlete_id, sport_id)
select 'b0000000-0000-4000-8000-000000000601', a.id, a.sport_id
  from public.athletes a where a.user_id in ('b0000000-0000-4000-8000-000000000201', 'b0000000-0000-4000-8000-000000000202');

-- Un jeton d'appareil pour Zoé (banc intérêt recruteur) ; ceux du banc A5 sont posés par le banc.
insert into public.device_tokens (user_id, token, platform)
values ('b0000000-0000-4000-8000-000000000207', 'jeton-banc-interet-zoe', 'ios');

select 'fixtures : ' || (select count(*) from public.users) || ' comptes, '
       || (select count(*) from public.athletes) || ' fiches, '
       || (select count(*) from public.schools) || ' établissements';
commit;
