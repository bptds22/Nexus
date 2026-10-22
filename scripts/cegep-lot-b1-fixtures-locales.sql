-- ════════════════════════════════════════════════════════════════════════════
-- Chantier cégep, LOT B1 — données de test LOCALES SEULEMENT. Jamais en prod.
--
-- Usage (base JETABLE, jamais la base de travail de BP), AVANT la migration du lot :
--   psql -v ON_ERROR_STOP=1 -f scripts/cegep-lot-b1-fixtures-locales.sql
-- Idempotent : ne fait rien si la distribution existe déjà.
-- Mot de passe de tous les comptes : NexusTest123!
--
-- Distribution (identifiants fixes, préfixe c0ce0b10-) :
--   RC  recruteur COLLÉGIAL Pro, rattaché au cégep Y (Cégep Beauce-Appalaches)
--   AD  admin
--   KO  coach du secondaire, onboarding fait (Académie Antoine-Manseau), entraîneur-chef de TS
--   KS  coach « scolaire » qui n'a pas fini son onboarding
--   KC  coach « ligue civile » qui n'a pas fini son onboarding
--   KL  coach DÉJÀ rattaché au cégep Y avant le lot (cas qui n'existe pas en prod : 0) —
--       users.school_id + school_coaches + une réclamation de direction en attente
--   AT  athlète (compte), pour la liste d'attente refusée aux autres rôles
--   Équipes : TY football cégep Y, TS football Manseau (KO), TS2 football Greaves (sans coach),
--             TCIV football club civil « 5 Majeur »
--   Athlètes sans coach : AY ancré cégep Y, AS ancré Manseau
--   Invitation en attente de RC (cégep Y), jeton 'jeton-b1-invitation-cegep'
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

do $$
begin
  if exists (select 1 from auth.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0') then
    raise exception 'NEXUS: base PROD détectée — fixtures locales refusées';
  end if;
end $$;

begin;

do $$
declare
  v_foot uuid := (select id from public.sports where nom = 'Football');
  v_y    uuid := (select id from public.schools where type = 'CEGEP' and name = 'Cégep Beauce-Appalaches');
  v_s1   uuid := (select id from public.schools where type = 'SECONDAIRE' and name = 'Académie Antoine-Manseau');
  v_s2   uuid := (select id from public.schools where type = 'SECONDAIRE' and name = 'Académie adventiste Greaves');
  v_civ  uuid := (select id from public.schools where type = 'LIGUE_CIVILE' and name = '5 Majeur');
  r record;
begin
  if v_foot is null or v_y is null or v_s1 is null or v_s2 is null or v_civ is null then
    raise exception 'NEXUS fixtures B1: référence introuvable (foot %, Y %, s1 %, s2 %, civ %)', v_foot, v_y, v_s1, v_s2, v_civ;
  end if;

  if exists (select 1 from auth.users where id = 'c0ce0b10-0000-4000-8000-000000000001') then
    raise notice 'NEXUS fixtures B1: distribution déjà en place';
    return;
  end if;

  -- ── Comptes (handle_new_auth_user crée public.users avec rôle et contexte) ──
  for r in select * from (values
      ('c0ce0b10-0000-4000-8000-000000000001'::uuid, 'lotb1.recruteur@fixture-cegep.test',   'RECRUTEUR', 'collegial',    'Rita',  'Collegiale'),
      ('c0ce0b10-0000-4000-8000-000000000002'::uuid, 'lotb1.admin@fixture-cegep.test',       'ADMIN',     null,           'Ada',   'Admin'),
      ('c0ce0b10-0000-4000-8000-000000000003'::uuid, 'lotb1.coach@fixture-cegep.test',       'COACH',     'scolaire',     'Karim', 'Secondaire'),
      ('c0ce0b10-0000-4000-8000-000000000004'::uuid, 'lotb1.coachsec@fixture-cegep.test',    'COACH',     'scolaire',     'Sonia', 'Nouvelle'),
      ('c0ce0b10-0000-4000-8000-000000000005'::uuid, 'lotb1.coachcivil@fixture-cegep.test',  'COACH',     'ligue_civile', 'Cyril', 'Civil'),
      ('c0ce0b10-0000-4000-8000-000000000006'::uuid, 'lotb1.coachcegep@fixture-cegep.test',  'COACH',     'scolaire',     'Luc',   'Legacy'),
      ('c0ce0b10-0000-4000-8000-000000000007'::uuid, 'lotb1.athlete@fixture-cegep.test',     'ATHLETE',   null,           'Alex',  'Athlete')
    ) as t(id, email, role, ctx, prenom, nom) loop
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change, email_change_token_new,
                            email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values (r.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', r.email,
            extensions.crypt('NexusTest123!', extensions.gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}',
            jsonb_strip_nulls(jsonb_build_object('role', r.role, 'context', r.ctx, 'first_name', r.prenom, 'last_name', r.nom)),
            now(), now(), '', '', '', '', '', '', '', '');
    insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (r.id::text, r.id, jsonb_build_object('sub', r.id::text, 'email', r.email, 'email_verified', true),
            'email', now(), now(), now());
  end loop;

  -- RC : recruteur collégial Pro, cégep Y
  update public.users set onboarding_complete = true, school_id = v_y, sport_id = v_foot, role_claimed_at = now()
   where id = 'c0ce0b10-0000-4000-8000-000000000001';
  update public.subscriptions set tier = 'pro', status = 'active', tier_source = 'admin_grant'
   where user_id = 'c0ce0b10-0000-4000-8000-000000000001';
  -- AD : admin
  update public.users set onboarding_complete = true, is_platform_admin = true
   where id = 'c0ce0b10-0000-4000-8000-000000000002';
  -- KO : coach du secondaire, onboarding fait
  update public.users set onboarding_complete = true, school_id = v_s1, sport = 'Football', role_claimed_at = now()
   where id = 'c0ce0b10-0000-4000-8000-000000000003';
  insert into public.school_coaches (school_id, coach_id, role, sport)
  values (v_s1, 'c0ce0b10-0000-4000-8000-000000000003', 'COACH', 'Football');
  -- KS, KC : rôle choisi, onboarding pas fini
  update public.users set role_claimed_at = now()
   where id in ('c0ce0b10-0000-4000-8000-000000000004', 'c0ce0b10-0000-4000-8000-000000000005');
  -- KL : coach déjà rattaché au cégep Y AVANT le lot
  update public.users set onboarding_complete = true, school_id = v_y, sport = 'Football', role_claimed_at = now()
   where id = 'c0ce0b10-0000-4000-8000-000000000006';
  insert into public.school_coaches (school_id, coach_id, role, sport)
  values (v_y, 'c0ce0b10-0000-4000-8000-000000000006', 'COACH', 'Football');
  insert into public.admin_claims (user_id, school_id, claim_type, status)
  values ('c0ce0b10-0000-4000-8000-000000000006', v_y, 'DIRECTEUR', 'PENDING');

  -- ── Équipes ──
  insert into public.teams (id, school_id, sport_id, name, division, league, season, is_active, age_group, gender) values
    ('c0ce0b10-0000-4000-8000-0000000000b1', v_y,   v_foot, 'Fixture B1 Condors (cégep Y)', 'D2', 'RSEQ collégial',  '2026-2027', true, 'Collégial', 'Masculin'),
    ('c0ce0b10-0000-4000-8000-0000000000b2', v_s1,  v_foot, 'Fixture B1 Manseau Juvénile',  'D1', 'RSEQ secondaire', '2026-2027', true, 'Juvénile',  'Masculin'),
    ('c0ce0b10-0000-4000-8000-0000000000b3', v_s2,  v_foot, 'Fixture B1 Greaves Juvénile',  'D1', 'RSEQ secondaire', '2026-2027', true, 'Juvénile',  'Masculin'),
    ('c0ce0b10-0000-4000-8000-0000000000b4', v_civ, v_foot, 'Fixture B1 5 Majeur M18',      'AA', 'Ligue civile',    '2026-2027', true, 'M18',       'Masculin');
  insert into public.team_coaches (team_id, coach_id, role)
  values ('c0ce0b10-0000-4000-8000-0000000000b2', 'c0ce0b10-0000-4000-8000-000000000003', 'head_coach');

  -- ── Athlètes sans coach ──
  insert into public.athletes (id, school_id, coach_id, first_name, last_name, date_naissance, genre, email,
                               sport_id, annee_diplomation, status, consentement_parental)
  values
    ('c0ce0b10-0000-4000-8000-0000000000a1', v_y,  null, 'Yann',  'Cegep',      '2007-05-01', 'Masculin',
     'lotb1.yann@fixture-cegep.test', v_foot, 2025, 'ACTIF', true),
    ('c0ce0b10-0000-4000-8000-0000000000a2', v_s1, null, 'Simon', 'Secondaire', '2008-05-01', 'Masculin',
     'lotb1.simon@fixture-cegep.test', v_foot, 2026, 'ACTIF', true);

  -- ── Invitation en attente du recruteur collégial (porte le cégep Y) ──
  insert into public.invitations (token, email, invited_by, school_id, locale, status, expires_at)
  values ('jeton-b1-invitation-cegep', 'lotb1.invite@fixture-cegep.test', 'c0ce0b10-0000-4000-8000-000000000001',
          v_y, 'fr-CA', 'PENDING', now() + interval '30 days');
end $$;

commit;

select u.email, u.role, u.context, s.type as type_ecole, s.name as ecole, u.onboarding_complete
  from public.users u left join public.schools s on s.id = u.school_id
 where u.email like 'lotb1.%' order by u.email;
