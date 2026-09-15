-- ═══════════════════════════════════════════════════════════════════════════
-- SEED DE DÉMONSTRATION — /athlete/ambassadeur et /admin/ambassadeurs
--
-- BASE LOCALE DOCKER UNIQUEMENT. Crée des comptes connectables pour jouer le
-- flux à l'écran, puis se nettoie avec scripts/clean-demo-ambassadeur.sql.
--
-- ⚠ Les mots de passe sont en clair dans ce fichier PARCE QUE la base locale
-- est jetable et qu'aucun de ces comptes n'existe ailleurs. Ne jamais rejouer
-- sur le cloud.
--
--   ambassadeur@demo.local / demo1234   (athlète, le parrain)
--   admin@demo.local       / demo1234   (administrateur plateforme)
-- ═══════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

-- Nettoyage préalable. L'ORDRE COMPTE : athletes.user_id est ON DELETE SET
-- NULL, supprimer auth.users orpheline les fiches au lieu de les supprimer.
delete from public.athletes where email like '%@demo.local';
delete from auth.users  where email like '%@demo.local';
delete from public.teams   where name = 'Demo Cyclones M18';
delete from public.schools where name = 'Polyvalente de la Demo';

insert into public.schools (id, name, type, region, city)
values ('dddddddd-0000-0000-0000-000000000001', 'Polyvalente de la Demo',
        'SECONDAIRE', 'Lanaudiere', 'Repentigny');

insert into public.teams (id, school_id, sport_id, name)
select 'dddddddd-0000-0000-0000-000000000002',
       'dddddddd-0000-0000-0000-000000000001',
       (select id from public.sports where nom = 'Football' limit 1),
       'Demo Cyclones M18';

-- Identité de service : absente du local, présente en prod. Sans elle, la
-- bascule du badge lève.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values ('eeeeeeee-0000-0000-0000-0000000000ff', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'service@demo.local',
        crypt('demo1234', gen_salt('bf')), now(), now(), now(), '{}'::jsonb, '{}'::jsonb);
insert into public.users (id, email, role, first_name, last_name, is_service_identity)
values ('eeeeeeee-0000-0000-0000-0000000000ff', 'service@demo.local', 'ADMIN',
        'Equipe', 'Nexus', true)
on conflict (id) do update set is_service_identity = true, role = excluded.role,
  first_name = excluded.first_name, last_name = excluded.last_name;

-- Comptes. raw_user_meta_data porte le rôle : le garde de app/athlete/layout.tsx
-- le lit DANS LE JWT (zéro requête), pas dans public.users.
do $$
declare s record;
begin
  for s in
    select * from (values
      ('eeeeeeee-0000-0000-0000-000000000001'::uuid,'ambassadeur@demo.local','Maxime','Cote',   'ATHLETE'),
      ('eeeeeeee-0000-0000-0000-0000000000aa'::uuid,'admin@demo.local',      'Bruno', 'Admin',  'ADMIN'),
      ('ffffffff-0000-0000-0000-000000000001'::uuid,'lea@demo.local',        'Lea',   'Gagnon', 'ATHLETE'),
      ('ffffffff-0000-0000-0000-000000000002'::uuid,'tom@demo.local',        'Tom',   'Bergeron','ATHLETE'),
      ('ffffffff-0000-0000-0000-000000000003'::uuid,'zoe@demo.local',        'Zoe',   'Lavoie', 'ATHLETE'),
      ('ffffffff-0000-0000-0000-000000000004'::uuid,'noah@demo.local',       'Noah',  'Fortin', 'ATHLETE'),
      ('ffffffff-0000-0000-0000-000000000005'::uuid,'emma@demo.local',       'Emma',  'Roy',    'ATHLETE'),
      ('ffffffff-0000-0000-0000-000000000006'::uuid,'liam@demo.local',       'Liam',  'Dube',   'ATHLETE'),
      -- La PAIRE D'HOMONYMES : même prénom, même nom, même école. Elle existe
      -- pour de vrai en prod (1 paire sur 99) ; ici elle alimente la file admin.
      ('ffffffff-0000-0000-0000-000000000007'::uuid,'sam1@demo.local',       'Samuel','Tremblay','ATHLETE'),
      ('ffffffff-0000-0000-0000-000000000008'::uuid,'sam2@demo.local',       'Samuel','Tremblay','ATHLETE')
    ) as t(id,email,prenom,nom,role)
  loop
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                            email_confirmed_at, created_at, updated_at,
                            raw_app_meta_data, raw_user_meta_data)
    values (s.id, '00000000-0000-0000-0000-000000000000', 'authenticated',
            'authenticated', s.email, crypt('demo1234', gen_salt('bf')),
            now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb,
            jsonb_build_object('role', s.role));
    insert into public.users (id, email, role, first_name, last_name, onboarding_complete)
    values (s.id, s.email, s.role::user_role, s.prenom, s.nom, true)
    on conflict (id) do update set role = excluded.role, first_name = excluded.first_name,
      last_name = excluded.last_name, onboarding_complete = true;
  end loop;
end $$;

update public.users set is_platform_admin = true
 where id = 'eeeeeeee-0000-0000-0000-0000000000aa';

-- ⚠ GOTRUE NE SAIT PAS LIRE UN NULL DANS CES QUATRE COLONNES.
-- Elles sont `nullable` et SANS défaut au schéma, mais le scanner Go de
-- GoTrue les attend en chaîne : un NULL fait répondre
-- « 500 Database error querying schema » au /token, sans autre indice —
-- l'erreur ne nomme ni la table ni la colonne. Un compte semé à la main est
-- donc CRÉÉ mais INCONNECTABLE, ce qui se diagnostique très mal.
-- (Les trois autres jetons — phone_change_token, email_change_token_current,
-- reauthentication_token — ont, eux, un défaut '' et n'ont rien besoin.)
update auth.users
   set confirmation_token     = coalesce(confirmation_token, ''),
       recovery_token         = coalesce(recovery_token, ''),
       email_change_token_new = coalesce(email_change_token_new, ''),
       email_change           = coalesce(email_change, '')
 where email like '%@demo.local';

-- Fiches athlètes. Majeurs + parent_email NULL : trg_notify_parent_on_minor
-- (qui part en pg_net) ne se réveille pas.
insert into public.athletes (id, user_id, first_name, last_name, email, school_id,
                             status, date_naissance, verified, profile_completion)
select u.id, u.id, u.first_name, u.last_name, u.email,
       'dddddddd-0000-0000-0000-000000000001'::uuid,
       'ACTIF', date '2006-03-11', true, 70
  from public.users u
 where u.email like '%@demo.local' and u.role = 'ATHLETE';

insert into public.team_athletes (team_id, athlete_id, sport_id)
select 'dddddddd-0000-0000-0000-000000000002', a.id,
       (select sport_id from public.teams where id = 'dddddddd-0000-0000-0000-000000000002')
  from public.athletes a where a.email like '%@demo.local';

-- Le parrain démarre à 2 confirmées : l'écran montre un état vivant, et la
-- 3e déclaration jouée à la main fait FRANCHIR le palier 3 sous les yeux.
insert into public.ambassadeur_revendications
  (parrain_athlete_id, prenom, nom, courriel_normalise, filleul_athlete_id,
   methode, statut, confirmee_le)
values
  ('eeeeeeee-0000-0000-0000-000000000001','Lea','Gagnon','lea@demo.local',
   'ffffffff-0000-0000-0000-000000000001','courriel','CONFIRMEE',now()),
  ('eeeeeeee-0000-0000-0000-000000000001','Tom','Bergeron','tom@demo.local',
   'ffffffff-0000-0000-0000-000000000002','courriel','CONFIRMEE',now());

do $$
declare v_n int;
begin
  select count(*) into v_n from public.athletes where email like '%@demo.local';
  raise notice 'NEXUS: seed demo pret — % athletes, parrain a 2 recrues.', v_n;
  raise notice '   athlete : ambassadeur@demo.local / demo1234';
  raise notice '   admin   : admin@demo.local / demo1234';
end $$;
