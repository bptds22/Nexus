-- ════════════════════════════════════════════════════════════════════════════
-- Chantier cégep, LOT B1 — preuves par rôle, LOCALES SEULEMENT (pile jetable, fixtures B1).
-- Se joue à l'identique AVANT et APRÈS la migration ; on compare les deux sorties.
-- Chaque sonde s'exécute dans une sous-transaction TOUJOURS annulée : rien n'est écrit.
-- Rôles réels : authenticated + request.jwt.claims (jamais superuser pour l'acte prouvé) ;
-- l'inscription (écriture de GoTrue dans auth.users) se joue en postgres : supabase_auth_admin
-- n'est pas accessible à postgres dans la pile ; les triggers d'inscription sont les mêmes.
-- ════════════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP on
\pset footer off

do $$
begin
  if exists (select 1 from auth.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0') then
    raise exception 'NEXUS: base PROD détectée';
  end if;
end $$;

create or replace function pg_temp.sonde(p_uid uuid, p_action text, p_check text default null)
returns text language plpgsql as $f$
declare v text;
begin
  begin
    if p_uid is not null then
      perform set_config('request.jwt.claims',
                         json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
    end if;
    if p_check is null then
      execute p_action into v;
    else
      execute p_action;
      perform set_config('role', 'postgres', true);
      execute p_check into v;
    end if;
    raise exception using errcode = 'NXOK1', message = coalesce(v, '(null)');
  exception
    when sqlstate 'NXOK1' then return 'OK    ' || sqlerrm;
    when sqlstate 'NXOK2' then return 'OK    ' || sqlerrm;   -- bilan d'une sonde en plusieurs gestes
    when others then return 'REFUS ' || sqlstate || ' ' || sqlerrm;
  end;
end $f$;

-- Texte d'une inscription GoTrue (auth.users).
create or replace function pg_temp.sql_inscription(p_id uuid, p_email text, p_meta jsonb)
returns text language sql as $f$
  select format($q$insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
      email_change, email_change_token_new, email_change_token_current, phone_change, phone_change_token,
      reauthentication_token)
    values (%L, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', %L, '', now(),
      '{"provider":"email","providers":["email"]}', %L, now(), now(), '', '', '', '', '', '', '', '')$q$,
    p_id, p_email, p_meta::text);
$f$;

-- ── (a) Dormance : empreintes des tables touchées et rattachements par rôle ──
select 'a. empreinte ' || t as preuve, md5(string_agg(x, '|' order by x)) as resultat from (
  select 'users' t, to_jsonb(u)::text x from public.users u
  union all select 'school_coaches', to_jsonb(s)::text from public.school_coaches s
  union all select 'team_coaches', to_jsonb(c)::text from public.team_coaches c
  union all select 'teams', to_jsonb(e)::text from public.teams e
  union all select 'admin_claims', to_jsonb(a)::text from public.admin_claims a
  union all select 'athletes', to_jsonb(a)::text from public.athletes a
  union all select 'invitations', to_jsonb(i)::text from public.invitations i
) z group by t order by 1;

select 'a. rattachements ' || src || ' ' || role || ' -> ' || type_ecole as preuve, n::text as resultat from (
  select 'users.school_id' src, u.role::text role, coalesce(s.type::text, '(aucune)') type_ecole, count(*) n
    from public.users u left join public.schools s on s.id = u.school_id group by 2, 3
  union all
  select 'school_coaches', u.role::text, s.type::text, count(*)
    from public.school_coaches sc join public.schools s on s.id = sc.school_id join public.users u on u.id = sc.coach_id group by 2, 3
  union all
  select 'team_coaches', u.role::text, s.type::text, count(*)
    from public.team_coaches tc join public.teams t on t.id = tc.team_id join public.schools s on s.id = t.school_id
    join public.users u on u.id = tc.coach_id group by 2, 3
  union all
  select 'athletes.coach_id', u.role::text, s.type::text, count(*)
    from public.athletes a join public.schools s on s.id = a.school_id join public.users u on u.id = a.coach_id group by 2, 3
  union all
  select 'admin_claims', u.role::text, s.type::text, count(*)
    from public.admin_claims c join public.schools s on s.id = c.school_id join public.users u on u.id = c.user_id group by 2, 3
) z order by 1;

-- ── Sondes ──
select preuve, resultat from (values

-- (b) les 9 chemins : un COACH qui vise un cégep
('b.A  KS onboarding école = cégep Y (finish_coach_school_onboarding)',
 pg_temp.sonde('c0ce0b10-0000-4000-8000-000000000004',
   $s$select public.finish_coach_school_onboarding(p_school_id => 'eab74df7-0aa6-438d-b5d8-2bcca8f6048a', p_region => null,
      p_sport => 'Football', p_first_name => 'Sonia', p_last_name => 'Nouvelle', p_phone => null, p_bio => null,
      p_experience_years => 1, p_photo_url => null, p_team_id => null, p_director_choice => 'owner',
      p_rprp_accepted => true, p_invite_email => null)->>'ok'$s$)),

('b.A2 KS onboarding école secondaire + équipe du cégep (p_team_id = TY)',
 pg_temp.sonde('c0ce0b10-0000-4000-8000-000000000004',
   $s$select public.finish_coach_school_onboarding(p_school_id => '59ff9e48-65a4-40f7-a8da-793bc7da1e98', p_region => null,
      p_sport => 'Football', p_first_name => 'Sonia', p_last_name => 'Nouvelle', p_phone => null, p_bio => null,
      p_experience_years => 1, p_photo_url => null, p_team_id => 'c0ce0b10-0000-4000-8000-0000000000b1',
      p_director_choice => 'owner', p_rprp_accepted => true, p_invite_email => null)->>'ok'$s$)),

('b.B1 inscription COACH avec l''invitation du recruteur collégial (cégep Y)',
 pg_temp.sonde(null,
   $s$do $d$ declare q text := pg_temp.sql_inscription('c0ce0b10-0000-4000-8000-0000000000e1', 'lotb1.invite@fixture-cegep.test',
          '{"role":"COACH","context":"scolaire","invitation_token":"jeton-b1-invitation-cegep"}');
        begin execute q; end $d$$s$,
   $s$select u.role || ' / école ' || coalesce(s.type::text, 'aucune') || ' / invitation ' || i.status
        from public.users u left join public.schools s on s.id = u.school_id
        cross join public.invitations i
       where u.id = 'c0ce0b10-0000-4000-8000-0000000000e1' and i.token = 'jeton-b1-invitation-cegep'$s$)),

('b.B2 inscription par l''invitation (rôle par défaut) puis choix du rôle COACH',
 pg_temp.sonde(null,
   $s$do $d$ declare q text := pg_temp.sql_inscription('c0ce0b10-0000-4000-8000-0000000000e2', 'lotb1.invite@fixture-cegep.test',
          '{"invitation_token":"jeton-b1-invitation-cegep"}');
        begin
          execute q;
          perform set_config('request.jwt.claims', '{"sub":"c0ce0b10-0000-4000-8000-0000000000e2","role":"authenticated"}', true);
          perform set_config('role', 'authenticated', true);
          perform public.claim_signup_role('COACH', 'scolaire');
        end $d$$s$,
   $s$select u.role || ' / école ' || coalesce(s.type::text, 'aucune')
        from public.users u left join public.schools s on s.id = u.school_id
       where u.id = 'c0ce0b10-0000-4000-8000-0000000000e2'$s$)),

('b.C/E KO PATCH de son users.school_id vers le cégep Y',
 pg_temp.sonde('c0ce0b10-0000-4000-8000-000000000003',
   $s$with m as (update public.users set school_id = 'eab74df7-0aa6-438d-b5d8-2bcca8f6048a'
                 where id = 'c0ce0b10-0000-4000-8000-000000000003' returning 1) select count(*)::text from m$s$)),

('b.D  KO insère school_coaches sur le cégep Y',
 pg_temp.sonde('c0ce0b10-0000-4000-8000-000000000003',
   $s$with m as (insert into public.school_coaches (school_id, coach_id, role)
                 values ('eab74df7-0aa6-438d-b5d8-2bcca8f6048a', 'c0ce0b10-0000-4000-8000-000000000003', 'COACH') returning 1)
      select count(*)::text from m$s$)),

('b.F  KL (coach déjà au cégep Y) crée une équipe sous le cégep',
 pg_temp.sonde('c0ce0b10-0000-4000-8000-000000000006',
   $s$with m as (insert into public.teams (school_id, sport_id, name, season, is_active)
                 values ('eab74df7-0aa6-438d-b5d8-2bcca8f6048a', (select id from public.sports where nom = 'Football'),
                         'Sonde B1 équipe cégep', '2026-2027', true) returning 1) select count(*)::text from m$s$)),

('b.G  KO rejoint l''équipe du cégep TY (team_coaches)',
 pg_temp.sonde('c0ce0b10-0000-4000-8000-000000000003',
   $s$with m as (insert into public.team_coaches (team_id, coach_id, role)
                 values ('c0ce0b10-0000-4000-8000-0000000000b1', 'c0ce0b10-0000-4000-8000-000000000003', 'assistant') returning 1)
      select count(*)::text from m$s$)),

('b.H  KC onboarding civil, club 5 Majeur + équipe du cégep (p_team_id = TY)',
 pg_temp.sonde('c0ce0b10-0000-4000-8000-000000000005',
   $s$select public.finish_coach_civil_onboarding(p_club_id => '29e0440f-0543-4463-a6c1-a14c27012349', p_club_name => null,
      p_club_city => null, p_club_region => null, p_sport => 'Football', p_first_name => 'Cyril', p_last_name => 'Civil',
      p_phone => null, p_bio => null, p_experience_years => 1, p_photo_url => null,
      p_team_id => 'c0ce0b10-0000-4000-8000-0000000000b1', p_team_name => null, p_team_age_group => null,
      p_team_gender => null, p_team_division => null, p_director_choice => 'owner', p_rprp_accepted => true,
      p_invite_email => null)->>'ok'$s$)),

('b.I1 KO réclame la direction du cégep Y (admin_claims)',
 pg_temp.sonde('c0ce0b10-0000-4000-8000-000000000003',
   $s$with m as (insert into public.admin_claims (user_id, school_id, claim_type, status)
                 values ('c0ce0b10-0000-4000-8000-000000000003', 'eab74df7-0aa6-438d-b5d8-2bcca8f6048a', 'DIRECTEUR', 'PENDING') returning 1)
      select count(*)::text from m$s$)),

('b.I2 AD approuve la réclamation de direction de KL (cégep Y, en attente d''avant)',
 pg_temp.sonde('c0ce0b10-0000-4000-8000-000000000002',
   $s$with m as (update public.admin_claims set status = 'APPROVED', reviewed_at = now(),
                        reviewer_id = 'c0ce0b10-0000-4000-8000-000000000002'
                 where user_id = 'c0ce0b10-0000-4000-8000-000000000006' and status = 'PENDING' returning 1)
      select count(*)::text from m$s$)),

('b.J1 KO crée un athlète ancré au cégep Y',
 pg_temp.sonde('c0ce0b10-0000-4000-8000-000000000003',
   $s$with m as (insert into public.athletes (school_id, coach_id, first_name, last_name, sport_id, status)
                 values ('eab74df7-0aa6-438d-b5d8-2bcca8f6048a', 'c0ce0b10-0000-4000-8000-000000000003', 'Sonde', 'Cegep',
                         (select id from public.sports where nom = 'Football'), 'ACTIF') returning 1)
      select count(*)::text from m$s$)),

('b.J2 KL réclame l''athlète AY ancré au cégep Y (claim_school_athletes)',
 pg_temp.sonde('c0ce0b10-0000-4000-8000-000000000006',
   $s$select public.claim_school_athletes(array['c0ce0b10-0000-4000-8000-0000000000a1']::uuid[])::text$s$)),

('b.K  AD change le rôle du recruteur collégial RC (cégep Y) en COACH',
 pg_temp.sonde('c0ce0b10-0000-4000-8000-000000000002',
   $s$with m as (update public.users set role = 'COACH' where id = 'c0ce0b10-0000-4000-8000-000000000001' returning 1)
      select count(*)::text from m$s$)),

-- (c) secondaire et civil : comme avant
('c.1  KS onboarding école secondaire Manseau + nouvelle équipe',
 pg_temp.sonde('c0ce0b10-0000-4000-8000-000000000004',
   $s$select public.finish_coach_school_onboarding(p_school_id => '59ff9e48-65a4-40f7-a8da-793bc7da1e98', p_region => null,
      p_sport => 'Football', p_first_name => 'Sonia', p_last_name => 'Nouvelle', p_phone => null, p_bio => null,
      p_experience_years => 1, p_photo_url => null, p_team_id => null, p_director_choice => 'owner',
      p_rprp_accepted => true, p_invite_email => null, p_team_name => 'Sonde B1 Sonia', p_team_age_group => 'Cadet',
      p_team_gender => 'Masculin', p_team_division => 'D2') - 'team_id' - 'season'$s$)),

('c.2  KC onboarding civil, club 5 Majeur + son équipe TCIV',
 pg_temp.sonde('c0ce0b10-0000-4000-8000-000000000005',
   $s$select public.finish_coach_civil_onboarding(p_club_id => '29e0440f-0543-4463-a6c1-a14c27012349', p_club_name => null,
      p_club_city => null, p_club_region => null, p_sport => 'Football', p_first_name => 'Cyril', p_last_name => 'Civil',
      p_phone => null, p_bio => null, p_experience_years => 1, p_photo_url => null,
      p_team_id => 'c0ce0b10-0000-4000-8000-0000000000b4', p_team_name => null, p_team_age_group => null,
      p_team_gender => null, p_team_division => null, p_director_choice => 'owner', p_rprp_accepted => true,
      p_invite_email => null) - 'season'$s$)),

('c.3  KO crée une équipe sous son école secondaire',
 pg_temp.sonde('c0ce0b10-0000-4000-8000-000000000003',
   $s$with m as (insert into public.teams (school_id, sport_id, name, season, is_active)
                 values ('59ff9e48-65a4-40f7-a8da-793bc7da1e98', (select id from public.sports where nom = 'Football'),
                         'Sonde B1 équipe secondaire', '2026-2027', true) returning 1) select count(*)::text from m$s$)),

('c.4  KO rejoint l''équipe secondaire TS2 (Greaves)',
 pg_temp.sonde('c0ce0b10-0000-4000-8000-000000000003',
   $s$with m as (insert into public.team_coaches (team_id, coach_id, role)
                 values ('c0ce0b10-0000-4000-8000-0000000000b3', 'c0ce0b10-0000-4000-8000-000000000003', 'assistant') returning 1)
      select count(*)::text from m$s$)),

('c.5  KO crée un athlète ancré à son école secondaire',
 pg_temp.sonde('c0ce0b10-0000-4000-8000-000000000003',
   $s$with m as (insert into public.athletes (school_id, coach_id, first_name, last_name, sport_id, status)
                 values ('59ff9e48-65a4-40f7-a8da-793bc7da1e98', 'c0ce0b10-0000-4000-8000-000000000003', 'Sonde', 'Secondaire',
                         (select id from public.sports where nom = 'Football'), 'ACTIF') returning 1)
      select count(*)::text from m$s$)),

('c.6  KO réclame l''athlète AS de son école (claim_school_athletes)',
 pg_temp.sonde('c0ce0b10-0000-4000-8000-000000000003',
   $s$select public.claim_school_athletes(array['c0ce0b10-0000-4000-8000-0000000000a2']::uuid[])::text$s$)),

('c.7  KO réclame la direction intérimaire de son école secondaire',
 pg_temp.sonde('c0ce0b10-0000-4000-8000-000000000003',
   $s$with m as (insert into public.admin_claims (user_id, school_id, claim_type, status)
                 values ('c0ce0b10-0000-4000-8000-000000000003', '59ff9e48-65a4-40f7-a8da-793bc7da1e98', 'INTERIM', 'PENDING') returning 1)
      select count(*)::text from m$s$)),

('c.8  KO modifie son profil (téléphone)',
 pg_temp.sonde('c0ce0b10-0000-4000-8000-000000000003',
   $s$with m as (update public.users set phone = '418-555-0101' where id = 'c0ce0b10-0000-4000-8000-000000000003' returning 1)
      select count(*)::text from m$s$)),

('c.9  KL (déjà au cégep Y, ligne d''avant) modifie son profil (téléphone) ; AY (cégep, sans coach) après',
 pg_temp.sonde('c0ce0b10-0000-4000-8000-000000000006',
   $s$update public.users set phone = '418-555-0102' where id = 'c0ce0b10-0000-4000-8000-000000000006'$s$,
   $s$select 'profil sauvé ; AY pris en charge automatiquement : '
          || (select (coach_id is not null)::text from public.athletes where id = 'c0ce0b10-0000-4000-8000-0000000000a1')$s$)),

('c.10 KO modifie son profil (téléphone) ; AS (secondaire, sans coach) après',
 pg_temp.sonde('c0ce0b10-0000-4000-8000-000000000003',
   $s$update public.users set phone = '418-555-0104' where id = 'c0ce0b10-0000-4000-8000-000000000003'$s$,
   $s$select 'profil sauvé ; AS pris en charge automatiquement : '
          || (select (coach_id = 'c0ce0b10-0000-4000-8000-000000000003')::text from public.athletes where id = 'c0ce0b10-0000-4000-8000-0000000000a2')$s$)),

-- (d) recruteur collégial rattaché à son cégep : pas touché
('d.1  RC invite un collègue (invitation qui porte le cégep Y)',
 pg_temp.sonde('c0ce0b10-0000-4000-8000-000000000001',
   $s$with m as (insert into public.invitations (token, email, invited_by, school_id, locale, status, expires_at)
                 values ('sonde-b1', 'sonde@fixture-cegep.test', 'c0ce0b10-0000-4000-8000-000000000001',
                         'eab74df7-0aa6-438d-b5d8-2bcca8f6048a', 'fr-CA', 'PENDING', now() + interval '7 days') returning 1)
      select count(*)::text from m$s$)),

('d.2  inscription RECRUTEUR avec l''invitation du cégep Y',
 pg_temp.sonde(null,
   $s$do $d$ declare q text := pg_temp.sql_inscription('c0ce0b10-0000-4000-8000-0000000000e3', 'lotb1.invite@fixture-cegep.test',
          '{"role":"RECRUTEUR","context":"collegial","invitation_token":"jeton-b1-invitation-cegep"}');
        begin execute q; end $d$$s$,
   $s$select u.role || ' / école ' || coalesce(s.type::text, 'aucune') || ' / invitation ' || i.status
        from public.users u left join public.schools s on s.id = u.school_id
        cross join public.invitations i
       where u.id = 'c0ce0b10-0000-4000-8000-0000000000e3' and i.token = 'jeton-b1-invitation-cegep'$s$)),

('d.3  RC modifie son profil (téléphone)',
 pg_temp.sonde('c0ce0b10-0000-4000-8000-000000000001',
   $s$with m as (update public.users set phone = '418-555-0103' where id = 'c0ce0b10-0000-4000-8000-000000000001' returning 1)
      select count(*)::text from m$s$)),

('d.4  RC réclame la direction intérimaire de son cégep',
 pg_temp.sonde('c0ce0b10-0000-4000-8000-000000000001',
   $s$with m as (insert into public.admin_claims (user_id, school_id, claim_type, status)
                 values ('c0ce0b10-0000-4000-8000-000000000001', 'eab74df7-0aa6-438d-b5d8-2bcca8f6048a', 'INTERIM', 'PENDING') returning 1)
      select count(*)::text from m$s$)),

('d.5  RC crée une équipe sous son cégep',
 pg_temp.sonde('c0ce0b10-0000-4000-8000-000000000001',
   $s$with m as (insert into public.teams (school_id, sport_id, name, season, is_active)
                 values ('eab74df7-0aa6-438d-b5d8-2bcca8f6048a', (select id from public.sports where nom = 'Football'),
                         'Sonde B1 équipe recruteur', '2026-2027', true) returning 1) select count(*)::text from m$s$)),

('d.6  RC lit l''équipe du cégep et ses entraîneurs',
 pg_temp.sonde('c0ce0b10-0000-4000-8000-000000000001',
   $s$select (select count(*) from public.teams where id = 'c0ce0b10-0000-4000-8000-0000000000b1')::text || ' équipe, '
          || (select count(*) from public.team_coaches where team_id = 'c0ce0b10-0000-4000-8000-0000000000b1')::text || ' entraîneur(s)'$s$)),

('d.7  import RSEQ (service, sans appelant) crée une équipe de cégep',
 pg_temp.sonde(null,
   $s$with m as (insert into public.teams (school_id, sport_id, name, season, is_active)
                 values ('eab74df7-0aa6-438d-b5d8-2bcca8f6048a', (select id from public.sports where nom = 'Football'),
                         'Sonde B1 import', '2026-2027', true) returning 1) select count(*)::text from m$s$)),

-- (e) liste d'attente (n'existe qu'après la migration)
('e.1  KO s''inscrit, puis se réinscrit (idempotent), puis RC s''inscrit',
 pg_temp.sonde(null,
   $s$do $d$ declare r1 boolean; r2 boolean; r3 boolean; n_ko bigint; n_rc bigint; n_ad bigint; n_at text; n_anon text; n_dir text;
      begin
        perform set_config('request.jwt.claims', '{"sub":"c0ce0b10-0000-4000-8000-000000000003","role":"authenticated"}', true);
        perform set_config('role', 'authenticated', true);
        r1 := public.inscrire_liste_attente_collegiale('onboarding_coach');
        r2 := public.inscrire_liste_attente_collegiale('onboarding_coach');
        select count(*) into n_ko from public.liste_attente_gestion_collegiale;
        begin
          insert into public.liste_attente_gestion_collegiale (user_id, source) values ('c0ce0b10-0000-4000-8000-000000000005', 'direct');
          n_dir := 'insertion directe PASSÉE';
        exception when others then n_dir := 'insertion directe ' || sqlstate;
        end;
        perform set_config('role', 'postgres', true);
        perform set_config('request.jwt.claims', '{"sub":"c0ce0b10-0000-4000-8000-000000000001","role":"authenticated"}', true);
        perform set_config('role', 'authenticated', true);
        r3 := public.inscrire_liste_attente_collegiale('parametres_recruteur');
        select count(*) into n_rc from public.liste_attente_gestion_collegiale;
        perform set_config('role', 'postgres', true);
        perform set_config('request.jwt.claims', '{"sub":"c0ce0b10-0000-4000-8000-000000000002","role":"authenticated"}', true);
        perform set_config('role', 'authenticated', true);
        select count(*) into n_ad from public.liste_attente_gestion_collegiale;
        perform set_config('role', 'postgres', true);
        perform set_config('request.jwt.claims', '{"sub":"c0ce0b10-0000-4000-8000-000000000007","role":"authenticated"}', true);
        perform set_config('role', 'authenticated', true);
        begin
          perform public.inscrire_liste_attente_collegiale('bouton_m_avertir');
          n_at := 'athlète inscrit PASSÉ';
        exception when others then n_at := 'athlète ' || sqlstate;
        end;
        perform set_config('role', 'postgres', true);
        perform set_config('role', 'anon', true);
        begin
          perform count(*) from public.liste_attente_gestion_collegiale;
          n_anon := 'anon lit PASSÉ';
        exception when others then n_anon := 'anon ' || sqlstate;
        end;
        perform set_config('role', 'postgres', true);
        raise exception using errcode = 'NXOK2', message = format(
          'KO 1re=%s 2e=%s, KO voit %s ligne(s), %s ; RC 1re=%s, RC voit %s ligne(s) ; admin voit %s ; %s ; %s',
          r1, r2, n_ko, n_dir, r3, n_rc, n_ad, n_at, n_anon);
      end $d$$s$,
   $s$select 'jamais atteint'$s$))

) as t(preuve, resultat)
order by 1;
