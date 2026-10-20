-- ════════════════════════════════════════════════════════════════════════════
-- Chantier cégep, LOT A — données de test LOCALES SEULEMENT. Jamais en prod.
--
-- Usage (base locale JETABLE, jamais la base de travail de BP) :
--   psql -v ON_ERROR_STOP=1 -f scripts/cegep-lot-a-fixtures-locales.sql                 -- C ancré au SECONDAIRE
--   psql -v ON_ERROR_STOP=1 -v cegepien=1 -f scripts/cegep-lot-a-fixtures-locales.sql   -- C devient CÉGÉPIEN
-- Idempotent : la distribution n'est créée qu'une fois ; seul l'ancrage de C bascule.
--
-- Distribution (identifiants fixes, préfixe c0ce0a00-) :
--   R  recruteur collégial Pro — cégep X (Cégep André-Laurendeau), football
--   N  recruteur SANS école (gratuit)
--   A  admin
--   P  partenaire évaluateur football (APPROVED, peut_evaluer)
--   K  coach de S et de C
--   S  athlète du secondaire (Académie Antoine-Manseau), équipe secondaire TS
--   C  « cégépien » : équipe collégiale TC (cégep Y = Cégep Beauce-Appalaches), évaluation,
--      badge, opt-in partenaire, évaluation partenaire, dans le processus de R (relance +
--      visite), dans ses favoris, dans une liste, cible le cégep X, sur l'alignement du match
--      collégial G1. Ancrage : secondaire par défaut, cégep Y avec -v cegepien=1.
--   Cartes prospect de l'unité de R : « même prénom + même nom + même équipe » que C (deux
--   cartes : la proposition de l'une reste PROPOSEE, celle de l'autre est REFUSEE).
--   G1 match collégial TC (cégep Y) vs TX (cégep X) ; G2 match secondaire TS vs TS2.
--   Séance de dépistage de R sur G1 avec une note « n° 7 » à lier.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

-- Garde : jamais en prod (le compte admin prod n'existe pas dans une base locale).
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
  v_x    uuid := (select id from public.schools where type = 'CEGEP' and name = 'Cégep André-Laurendeau');
  v_y    uuid := (select id from public.schools where type = 'CEGEP' and name = 'Cégep Beauce-Appalaches');
  v_sec  uuid := (select id from public.schools where type = 'SECONDAIRE' and name = 'Académie Antoine-Manseau');
  v_sec2 uuid := (select id from public.schools where type = 'SECONDAIRE' and name = 'Académie adventiste Greaves');
  v_pos  uuid := (select id from public.positions where nom = 'Quart-arrière' and sport_id = (select id from public.sports where nom = 'Football'));
  v_badge uuid := (select id from public.badges where code = 'capitaine');
  v_partner uuid;
  r record;
begin
  if v_foot is null or v_x is null or v_y is null or v_sec is null or v_sec2 is null or v_pos is null or v_badge is null then
    raise exception 'NEXUS fixtures: référence introuvable (foot %, X %, Y %, sec %, sec2 %, pos %, badge %)',
      v_foot, v_x, v_y, v_sec, v_sec2, v_pos, v_badge;
  end if;

  if exists (select 1 from auth.users where id = 'c0ce0a00-0000-4000-8000-000000000001') then
    raise notice 'NEXUS fixtures: distribution déjà en place — seul l''ancrage de C est rejoué';
    return;
  end if;

  -- ── Comptes ──
  for r in select * from (values
      ('c0ce0a00-0000-4000-8000-000000000001'::uuid, 'lota.recruteur@fixture-cegep.test', 'RECRUTEUR', 'Rita',   'Collegiale'),
      ('c0ce0a00-0000-4000-8000-000000000002'::uuid, 'lota.sansecole@fixture-cegep.test', 'RECRUTEUR', 'Noe',    'Sansecole'),
      ('c0ce0a00-0000-4000-8000-000000000003'::uuid, 'lota.admin@fixture-cegep.test',     'ADMIN',     'Ada',    'Admin'),
      ('c0ce0a00-0000-4000-8000-000000000004'::uuid, 'lota.partenaire@fixture-cegep.test','PARTNER',   'Paule',  'Partenaire'),
      ('c0ce0a00-0000-4000-8000-000000000005'::uuid, 'lota.coach@fixture-cegep.test',     'COACH',     'Karim',  'Coach')
    ) as t(id, email, role, prenom, nom) loop
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                            raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                            confirmation_token, recovery_token, email_change, email_change_token_new,
                            email_change_token_current, phone_change, phone_change_token, reauthentication_token)
    values (r.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', r.email,
            extensions.crypt('NexusTest123!', extensions.gen_salt('bf')), now(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object('role', r.role, 'first_name', r.prenom, 'last_name', r.nom),
            now(), now(), '', '', '', '', '', '', '', '');
  end loop;

  update public.users set onboarding_complete = true, sport_id = v_foot
   where id in ('c0ce0a00-0000-4000-8000-000000000001', 'c0ce0a00-0000-4000-8000-000000000002',
                'c0ce0a00-0000-4000-8000-000000000004', 'c0ce0a00-0000-4000-8000-000000000005');
  update public.users set school_id = v_x where id = 'c0ce0a00-0000-4000-8000-000000000001';
  update public.users set school_id = v_sec where id = 'c0ce0a00-0000-4000-8000-000000000005';
  update public.users set onboarding_complete = true, is_platform_admin = true where id = 'c0ce0a00-0000-4000-8000-000000000003';
  update public.subscriptions set tier = 'pro', status = 'active', tier_source = 'admin_grant'
   where user_id = 'c0ce0a00-0000-4000-8000-000000000001';

  insert into public.media_partners (user_id, organization_name, contact_name, contact_email, status, approved_at,
                                     terms_accepted_at, terms_version, password_reset_completed_at, peut_evaluer)
  values ('c0ce0a00-0000-4000-8000-000000000004', 'Fixture Lot A Médias', 'Paule Partenaire',
          'lota.partenaire@fixture-cegep.test', 'APPROVED', now(), now(), 'v1', now(), true)
  returning id into v_partner;

  -- ── Équipes ──
  insert into public.teams (id, school_id, sport_id, name, division, league, season, is_active, age_group, gender) values
    ('c0ce0a00-0000-4000-8000-0000000000b1', v_y,    v_foot, 'Fixture Condors (cégep Y)',  'D2', 'RSEQ collégial', '2026-2027', true, 'Collégial', 'Masculin'),
    ('c0ce0a00-0000-4000-8000-0000000000b2', v_x,    v_foot, 'Fixture Boréal (cégep X)',   'D2', 'RSEQ collégial', '2026-2027', true, 'Collégial', 'Masculin'),
    ('c0ce0a00-0000-4000-8000-0000000000b3', v_sec,  v_foot, 'Fixture Manseau Juvénile',   'D1', 'RSEQ secondaire', '2026-2027', true, 'Juvénile', 'Masculin'),
    ('c0ce0a00-0000-4000-8000-0000000000b4', v_sec2, v_foot, 'Fixture Greaves Juvénile',   'D1', 'RSEQ secondaire', '2026-2027', true, 'Juvénile', 'Masculin');
  insert into public.team_coaches (team_id, coach_id)
  select t, 'c0ce0a00-0000-4000-8000-000000000005'
    from unnest(array['c0ce0a00-0000-4000-8000-0000000000b1', 'c0ce0a00-0000-4000-8000-0000000000b3']::uuid[]) t;

  -- ── Athlètes (majeurs : identité visible) ──
  insert into public.athletes (id, school_id, coach_id, first_name, last_name, date_naissance, genre, email,
                               sport_id, position_id, numero_jersey, annee_diplomation, status, verified,
                               partner_visibility_opt_in, consentement_parental, nom_a_confirmer)
  values
    ('c0ce0a00-0000-4000-8000-0000000000a1', v_sec, 'c0ce0a00-0000-4000-8000-000000000005', 'Samuel', 'Secondaire',
     '2008-03-01', 'Masculin', 'lota.samuel@fixture-cegep.test', v_foot, v_pos, '12', 2026, 'ACTIF', true, true, true, false),
    ('c0ce0a00-0000-4000-8000-0000000000a2', v_sec2, 'c0ce0a00-0000-4000-8000-000000000005', 'Cedric', 'Cegepien',
     '2006-05-01', 'Masculin', 'lota.cedric@fixture-cegep.test', v_foot, v_pos, '7', 2024, 'ACTIF', true, true, true, false);
  insert into public.team_athletes (team_id, athlete_id, sport_id, jersey_number) values
    ('c0ce0a00-0000-4000-8000-0000000000b3', 'c0ce0a00-0000-4000-8000-0000000000a1', v_foot, '12'),
    ('c0ce0a00-0000-4000-8000-0000000000b1', 'c0ce0a00-0000-4000-8000-0000000000a2', v_foot, '7');
  insert into public.evaluations (coach_id, athlete_id, leadership, discipline, cote_globale, rapport_entraineur) values
    ('c0ce0a00-0000-4000-8000-000000000005', 'c0ce0a00-0000-4000-8000-0000000000a1', 4, 4, 4, 'Fixture : rapport de S'),
    ('c0ce0a00-0000-4000-8000-000000000005', 'c0ce0a00-0000-4000-8000-0000000000a2', 5, 5, 5, 'Fixture : rapport de C');
  insert into public.athlete_badges (athlete_id, badge_id, attribue_par, contexte)
  select a, v_badge, 'c0ce0a00-0000-4000-8000-000000000005', 'Fixture'
    from unnest(array['c0ce0a00-0000-4000-8000-0000000000a1', 'c0ce0a00-0000-4000-8000-0000000000a2']::uuid[]) a;
  insert into public.partner_evaluations (partner_id, athlete_id, evalue_par, cote_globale) values
    (v_partner, 'c0ce0a00-0000-4000-8000-0000000000a2', 'c0ce0a00-0000-4000-8000-000000000004', 4);
  insert into public.athlete_targets (athlete_id, school_id, rank, status)
  select a, v_x, 1, 'CIBLE'
    from unnest(array['c0ce0a00-0000-4000-8000-0000000000a1', 'c0ce0a00-0000-4000-8000-0000000000a2']::uuid[]) a;

  -- ── Matchs ──
  insert into public.games (id, season, phase, sector, game_date, game_time, home_team_id, visitor_team_id,
                            home_name_raw, visitor_name_raw, venue, league_name, sport, division, category, zone, source_nom)
  values
    ('c0ce0a00-0000-4000-8000-0000000000c1', '2026-2027', 'Saison', 'Collégial', current_date + 3, '13:00',
     'c0ce0a00-0000-4000-8000-0000000000b1', 'c0ce0a00-0000-4000-8000-0000000000b2',
     'Fixture Condors (cégep Y)', 'Fixture Boréal (cégep X)', 'Stade fixture collégial', 'Fixture collégial', 'Football', 'D2', 'Collégial', '', 'RSEQ'),
    ('c0ce0a00-0000-4000-8000-0000000000c2', '2026-2027', 'Saison', 'Secondaire', current_date + 4, '13:00',
     'c0ce0a00-0000-4000-8000-0000000000b3', 'c0ce0a00-0000-4000-8000-0000000000b4',
     'Fixture Manseau Juvénile', 'Fixture Greaves Juvénile', 'Stade fixture secondaire', 'Fixture secondaire', 'Football', 'D1', 'Juvénile', '', 'RSEQ');

  -- ── Gestes du recruteur R (sous son identité : les déclencheurs lisent auth.uid()) ──
  perform set_config('request.jwt.claims',
    '{"sub":"c0ce0a00-0000-4000-8000-000000000001","role":"authenticated"}', true);

  insert into public.recruiter_pipeline (recruiter_id, athlete_id, stage, next_action_at, next_action_note, visit_at)
  select 'c0ce0a00-0000-4000-8000-000000000001', a, 'CONTACTE', current_date + 2, 'Fixture relance', now() + interval '5 days'
    from unnest(array['c0ce0a00-0000-4000-8000-0000000000a1', 'c0ce0a00-0000-4000-8000-0000000000a2']::uuid[]) a;
  insert into public.recruiter_favorites (recruiter_id, athlete_id)
  select 'c0ce0a00-0000-4000-8000-000000000001', a
    from unnest(array['c0ce0a00-0000-4000-8000-0000000000a1', 'c0ce0a00-0000-4000-8000-0000000000a2']::uuid[]) a;
  insert into public.recruiter_lists (id, recruiter_id, name)
  values ('c0ce0a00-0000-4000-8000-0000000000d1', 'c0ce0a00-0000-4000-8000-000000000001', 'Fixture liste lot A');
  insert into public.recruiter_list_members (list_id, athlete_id)
  select 'c0ce0a00-0000-4000-8000-0000000000d1', a
    from unnest(array['c0ce0a00-0000-4000-8000-0000000000a1', 'c0ce0a00-0000-4000-8000-0000000000a2']::uuid[]) a;

  -- Deux cartes « Cedric Cegepien » sur l'équipe de C : chacune déclenche une proposition.
  insert into public.cartes_prospect (id, prenom, nom, team_id, etape) values
    ('c0ce0a00-0000-4000-8000-0000000000e1', 'Cedric', 'Cegepien', 'c0ce0a00-0000-4000-8000-0000000000b1', 'IDENTIFIE'),
    ('c0ce0a00-0000-4000-8000-0000000000e2', 'Cedric', 'Cegepien', 'c0ce0a00-0000-4000-8000-0000000000b1', 'IDENTIFIE');

  -- Séance de dépistage sur G1 + une note « n° 7, côté A » à lier.
  insert into public.match_seances (id, cree_par, unite_cegep_id, unite_sport_id, game_id, equipe_a, equipe_b)
  values ('c0ce0a00-0000-4000-8000-0000000000f1', 'c0ce0a00-0000-4000-8000-000000000001', v_x, v_foot,
          'c0ce0a00-0000-4000-8000-0000000000c1', 'Fixture Condors (cégep Y)', 'Fixture Boréal (cégep X)');
  insert into public.match_notes (id, seance_id, auteur, cote, numero, texte, note_le)
  values (gen_random_uuid(), 'c0ce0a00-0000-4000-8000-0000000000f1', 'c0ce0a00-0000-4000-8000-000000000001', 'A', '7',
          'Fixture : bon bras', now());

  perform set_config('request.jwt.claims', '', true);

  -- Jeton d'agenda de R (flux iCal) : « jeton-fixture-lot-a ».
  insert into public.agenda_jetons (user_id, jeton_hash, unite_cegep_id, unite_sport_id)
  values ('c0ce0a00-0000-4000-8000-000000000001', public.agenda_hacher('jeton-fixture-lot-a'), v_x, v_foot);
end $$;

-- Les propositions passent d'ordinaire par une file (rapprochement_enfiler, traitée par
-- pg_cron) : on les calcule tout de suite. Idempotent (on conflict do nothing).
select public.rapprocher(null, 'c0ce0a00-0000-4000-8000-0000000000e1') as propositions_carte_1,
       public.rapprocher(null, 'c0ce0a00-0000-4000-8000-0000000000e2') as propositions_carte_2;

-- La proposition de la 2ᵉ carte est REFUSÉE (pour rapprochements_refuses_unite).
update public.rapprochements
   set statut = 'REFUSEE', decide_par = 'c0ce0a00-0000-4000-8000-000000000001', decide_le = now()
 where carte_id = 'c0ce0a00-0000-4000-8000-0000000000e2' and statut = 'PROPOSEE';

-- ── Ancrage de C : secondaire (défaut) ou cégep Y (-v cegepien=1) ──
\if :{?cegepien}
update public.athletes set school_id = (select id from public.schools where type = 'CEGEP' and name = 'Cégep Beauce-Appalaches')
 where id = 'c0ce0a00-0000-4000-8000-0000000000a2';
\else
update public.athletes set school_id = (select id from public.schools where type = 'SECONDAIRE' and name = 'Académie adventiste Greaves')
 where id = 'c0ce0a00-0000-4000-8000-0000000000a2';
\endif

select 'C ancré sur : ' || s.type || ' — ' || s.name as etat
  from public.athletes a join public.schools s on s.id = a.school_id
 where a.id = 'c0ce0a00-0000-4000-8000-0000000000a2';

commit;
