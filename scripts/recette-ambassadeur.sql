-- ═══════════════════════════════════════════════════════════════════════════
-- RECETTE /AMBASSADEUR — 11 sondes, base LOCALE Docker uniquement.
--
-- Crée des fixtures jetables (@recette.local), prouve, puis nettoie. À lancer
-- avec ON_ERROR_STOP=1 : toute sonde qui échoue arrête le script.
--
-- NE JAMAIS LANCER CE FICHIER SUR LE CLOUD. Il insère des comptes et des
-- athlètes, et son bloc final supprime des lignes.
-- ═══════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP on

-- ── Nettoyage préalable (rejeu) ─────────────────────────────────────────
-- L'ORDRE COMPTE. athletes.user_id est ON DELETE SET NULL : supprimer
-- auth.users ne supprime PAS les fiches, il les ORPHELINE. Les athlètes
-- partent donc en premier, sinon le DELETE sur schools bute sur
-- athletes_school_id_fkey — et une fiche orpheline survivrait à la recette.
delete from public.athletes where email like '%@recette.local';
delete from auth.users where email like '%@recette.local';
delete from public.teams   where name = 'Recette Equipe';
delete from public.schools where name = 'Recette Ambassadeur';

-- ═══ SEED ════════════════════════════════════════════════════════════════
\echo '--- SEED ---'

-- École + équipe de recette
insert into public.schools (id, name, type, region)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Recette Ambassadeur', 'SECONDAIRE', 'Lanaudiere');

insert into public.teams (id, school_id, sport_id, name)
select 'aaaaaaaa-0000-0000-0000-000000000002',
       'aaaaaaaa-0000-0000-0000-000000000001',
       (select id from public.sports order by nom limit 1),
       'Recette Equipe';

-- Identité de service — ABSENTE de la base locale (0 ligne constatée le
-- 2026-09-15), alors qu'elle existe en prod (equipe@nexussports.ca). Sans
-- elle, ambassadeur_basculer_badge lève. C'est un ÉCART LOCAL/CLOUD à
-- connaître : toute recette du badge doit la semer d'abord.
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at)
values ('bbbbbbbb-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-000000000000',
        'authenticated', 'authenticated', 'service@recette.local', '', now(), now(), now());
-- UPSERT obligatoire : le trigger `on_auth_user_created` a DÉJÀ créé la ligne
-- public.users au moment de l'INSERT dans auth.users. L'insérer à la main lève
-- users_email_key. (Écart de plomberie qu'il faut connaître pour toute recette
-- qui sème des comptes.)
insert into public.users (id, email, role, first_name, last_name, is_service_identity)
values ('bbbbbbbb-0000-0000-0000-00000000000f', 'service@recette.local', 'ADMIN',
        'Equipe', 'Recette', true)
on conflict (id) do update set role = excluded.role, first_name = excluded.first_name,
  last_name = excluded.last_name, is_service_identity = excluded.is_service_identity;

-- Acteurs : 1 parrain, 1 second parrain, 1 coach, 1 admin, 8 filleuls
do $$
declare
  v_spec record;
begin
  for v_spec in
    select * from (values
      ('bbbbbbbb-0000-0000-0000-000000000001'::uuid, 'parrain@recette.local',  'Parrain', 'Un',    'ATHLETE'),
      ('bbbbbbbb-0000-0000-0000-000000000002'::uuid, 'parrain2@recette.local', 'Parrain', 'Deux',  'ATHLETE'),
      ('bbbbbbbb-0000-0000-0000-000000000003'::uuid, 'coach@recette.local',    'Coach',   'Recette','COACH'),
      ('bbbbbbbb-0000-0000-0000-000000000004'::uuid, 'admin@recette.local',    'Admin',   'Recette','ADMIN'),
      ('cccccccc-0000-0000-0000-000000000001'::uuid, 'f1@recette.local', 'Alpha',  'Un',    'ATHLETE'),
      ('cccccccc-0000-0000-0000-000000000002'::uuid, 'f2@recette.local', 'Beta',   'Deux',  'ATHLETE'),
      ('cccccccc-0000-0000-0000-000000000003'::uuid, 'f3@recette.local', 'Gamma',  'Trois', 'ATHLETE'),
      ('cccccccc-0000-0000-0000-000000000004'::uuid, 'f4@recette.local', 'Delta',  'Quatre','ATHLETE'),
      ('cccccccc-0000-0000-0000-000000000005'::uuid, 'f5@recette.local', 'Epsilon','Cinq',  'ATHLETE'),
      ('cccccccc-0000-0000-0000-000000000006'::uuid, 'f6@recette.local', 'Zeta',   'Six',   'ATHLETE'),
      ('cccccccc-0000-0000-0000-000000000007'::uuid, 'h1@recette.local', 'Homo',   'Nyme',  'ATHLETE'),
      ('cccccccc-0000-0000-0000-000000000008'::uuid, 'h2@recette.local', 'Homo',   'Nyme',  'ATHLETE'),
      ('cccccccc-0000-0000-0000-000000000009'::uuid, 'civil@recette.local','Civil','Neuf',  'ATHLETE')
    ) as t(id, email, prenom, nom, role)
  loop
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                            email_confirmed_at, created_at, updated_at)
    values (v_spec.id, '00000000-0000-0000-0000-000000000000', 'authenticated',
            'authenticated', v_spec.email, '', now(), now(), now());
    insert into public.users (id, email, role, first_name, last_name)
    values (v_spec.id, v_spec.email, v_spec.role::user_role, v_spec.prenom, v_spec.nom)
    on conflict (id) do update set role = excluded.role,
      first_name = excluded.first_name, last_name = excluded.last_name;
  end loop;
end $$;

update public.users set is_platform_admin = true
 where id = 'bbbbbbbb-0000-0000-0000-000000000004';

-- Fiches athlètes. date_naissance adulte + parent_email NULL : on ne réveille
-- pas trg_notify_parent_on_minor (qui part en pg_net).
insert into public.athletes (id, user_id, first_name, last_name, email, school_id,
                             coach_id, status, date_naissance)
select u.id, u.id, u.first_name, u.last_name, u.email,
       case when u.id = 'cccccccc-0000-0000-0000-000000000009' then null::uuid
            else 'aaaaaaaa-0000-0000-0000-000000000001'::uuid end,
       'bbbbbbbb-0000-0000-0000-000000000003'::uuid,
       'ACTIF', date '2005-01-01'
  from public.users u
 where u.email like '%@recette.local' and u.role = 'ATHLETE';

-- L'athlète « civil » n'a PAS d'école : il ne sera trouvable que par ÉQUIPE.
insert into public.team_athletes (team_id, athlete_id, sport_id)
select 'aaaaaaaa-0000-0000-0000-000000000002',
       'cccccccc-0000-0000-0000-000000000009',
       (select sport_id from public.teams where id = 'aaaaaaaa-0000-0000-0000-000000000002');

\echo 'seed ok'

-- ═══ SONDE 1 — concordance forte, CONFIRMEE, compteur à 1 ════════════════
\echo '--- S1 concordance courriel ---'
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}';
select public.ambassadeur_revendiquer('Alpha','Un','F1@Recette.Local') as s1;
commit;

do $$
declare v_s text; v_n int;
begin
  select statut into v_s from public.ambassadeur_revendications
   where parrain_athlete_id='bbbbbbbb-0000-0000-0000-000000000001'
     and filleul_athlete_id='cccccccc-0000-0000-0000-000000000001';
  if v_s is distinct from 'CONFIRMEE' then raise exception 'S1 KO: statut=%', v_s; end if;
  select n into v_n from public.ambassadeur_tentatives
   where athlete_id='bbbbbbbb-0000-0000-0000-000000000001'
     and jour=(now() at time zone 'America/Montreal')::date;
  if v_n <> 1 then raise exception 'S1 KO: compteur=% au lieu de 1', v_n; end if;
  raise notice 'S1 OK — CONFIRMEE, compteur 1, courriel en casse mixte accepte';
end $$;

-- ═══ SONDE 11 — concordance par ÉQUIPE (athlète sans école) ══════════════
\echo '--- S11 concordance equipe ---'
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}';
select public.ambassadeur_revendiquer(
  'Civil','Neuf', null, null, 'aaaaaaaa-0000-0000-0000-000000000002') as s11;
commit;

do $$
declare v_s text; v_m text;
begin
  select statut, methode into v_s, v_m from public.ambassadeur_revendications
   where parrain_athlete_id='bbbbbbbb-0000-0000-0000-000000000001'
     and filleul_athlete_id='cccccccc-0000-0000-0000-000000000009';
  if v_s is distinct from 'CONFIRMEE' or v_m is distinct from 'nom_equipe' then
    raise exception 'S11 KO: statut=% methode=%', v_s, v_m;
  end if;
  raise notice 'S11 OK — athlete SANS ecole trouve par nom + equipe (methode nom_equipe)';
end $$;

-- ═══ SONDE 5 — auto-parrainage ═══════════════════════════════════════════
\echo '--- S5 auto-parrainage ---'
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}';
select public.ambassadeur_revendiquer('Parrain','Un','parrain@recette.local') as s5_courriel;
select public.ambassadeur_revendiquer('Parrain','Un', null,
       'aaaaaaaa-0000-0000-0000-000000000001') as s5_nom;
commit;

do $$
declare v_n int;
begin
  select count(*) into v_n from public.ambassadeur_revendications
   where parrain_athlete_id='bbbbbbbb-0000-0000-0000-000000000001'
     and filleul_athlete_id='bbbbbbbb-0000-0000-0000-000000000001';
  if v_n <> 0 then raise exception 'S5 KO: % auto-parrainage(s) ecrit(s)', v_n; end if;
  raise notice 'S5 OK — auto-parrainage refuse par courriel ET par nom, rien ecrit';
end $$;

-- ═══ SONDE 4 — homonymie → EN_ATTENTE + candidats, puis arbitrage ════════
\echo '--- S4 homonymie ---'
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}';
select public.ambassadeur_revendiquer('Homo','Nyme', null,
       'aaaaaaaa-0000-0000-0000-000000000001') as s4;
commit;

do $$
declare v_id uuid; v_s text; v_c int;
begin
  select id, statut, jsonb_array_length(candidats) into v_id, v_s, v_c
    from public.ambassadeur_revendications
   where parrain_athlete_id='bbbbbbbb-0000-0000-0000-000000000001'
     and prenom='Homo';
  if v_s is distinct from 'EN_ATTENTE' or v_c <> 2 then
    raise exception 'S4 KO: statut=% candidats=%', v_s, v_c;
  end if;
  raise notice 'S4a OK — EN_ATTENTE avec 2 candidats';
end $$;

-- arbitrage admin
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000004","role":"authenticated"}';
select public.ambassadeur_admin_trancher(
  (select id from public.ambassadeur_revendications
    where parrain_athlete_id='bbbbbbbb-0000-0000-0000-000000000001' and prenom='Homo'),
  'confirmer', 'cccccccc-0000-0000-0000-000000000007') as s4b;
commit;

do $$
declare v_s text; v_c jsonb;
begin
  select statut, candidats into v_s, v_c from public.ambassadeur_revendications
   where parrain_athlete_id='bbbbbbbb-0000-0000-0000-000000000001' and prenom='Homo';
  if v_s is distinct from 'CONFIRMEE' or v_c is not null then
    raise exception 'S4b KO: statut=% candidats=%', v_s, v_c;
  end if;
  raise notice 'S4b OK — admin a tranche, candidats effaces (minimisation)';
end $$;

-- ═══ SONDE 10 — palier 3 franchi + notification ══════════════════════════
\echo '--- S10 palier 3 ---'
do $$
declare v_p int; v_notif int; v_notifie timestamptz;
begin
  select count(*) into v_p from public.ambassadeur_paliers
   where athlete_id='bbbbbbbb-0000-0000-0000-000000000001' and palier=3;
  if v_p <> 1 then raise exception 'S10 KO: palier 3 non franchi (3 confirmees attendues)'; end if;

  select count(*), max(notifie_le) into v_notif, v_notifie
    from public.athlete_notifications n, public.ambassadeur_paliers p
   where n.athlete_id='bbbbbbbb-0000-0000-0000-000000000001'
     and n.type='AMBASSADEUR_PALIER_3'
     and p.athlete_id=n.athlete_id and p.palier=3;
  if v_notif <> 1 then raise exception 'S10 KO: % notification(s) palier 3', v_notif; end if;
  if v_notifie is null then raise exception 'S10 KO: notifie_le reste NULL'; end if;
  raise notice 'S10a OK — palier 3 + notification AMBASSADEUR_PALIER_3 (notifie_le pose)';
end $$;

-- ═══ SONDE 2 — COURSE sur l'index unique ═════════════════════════════════
-- Parrain 2 revendique un filleul DÉJÀ confirmé par parrain 1.
-- Attendu : motif deja_parrainee, ET compteur de parrain 2 = 1 (le bloc
-- EXCEPTION est interne, il n'a pas annulé l'incrément).
\echo '--- S2 course ---'
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';
select public.ambassadeur_revendiquer('Alpha','Un','f1@recette.local') as s2;
commit;

do $$
declare v_n int; v_lignes int;
begin
  select n into v_n from public.ambassadeur_tentatives
   where athlete_id='bbbbbbbb-0000-0000-0000-000000000002'
     and jour=(now() at time zone 'America/Montreal')::date;
  if v_n is distinct from 1 then
    raise exception 'S2 KO: compteur du 2e parrain = % — le handler a annule l''increment !', v_n;
  end if;
  select count(*) into v_lignes from public.ambassadeur_revendications
   where parrain_athlete_id='bbbbbbbb-0000-0000-0000-000000000002';
  if v_lignes <> 0 then raise exception 'S2 KO: % ligne(s) ecrite(s) malgre la course', v_lignes; end if;
  raise notice 'S2 OK — deja_parrainee, aucune ligne, ET compteur conserve a 1';
end $$;

-- ═══ SONDE 3 — quota du jour ═════════════════════════════════════════════
-- Parrain 2 est à 1. On monte à 5, puis la 6e doit LEVER.
\echo '--- S3 quota ---'
begin; set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';
select public.ambassadeur_revendiquer('Beta','Deux','f2@recette.local'); commit;
begin; set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';
select public.ambassadeur_revendiquer('Gamma','Trois','f3@recette.local'); commit;
begin; set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';
select public.ambassadeur_revendiquer('Delta','Quatre','f4@recette.local'); commit;
begin; set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}';
select public.ambassadeur_revendiquer('Epsilon','Cinq','f5@recette.local'); commit;

do $$
declare v_n int; v_msg text;
begin
  select n into v_n from public.ambassadeur_tentatives
   where athlete_id='bbbbbbbb-0000-0000-0000-000000000002'
     and jour=(now() at time zone 'America/Montreal')::date;
  if v_n <> 5 then raise exception 'S3 KO: compteur=% avant la 6e', v_n; end if;

  begin
    perform set_config('request.jwt.claims',
      '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);
    perform public.ambassadeur_revendiquer('Zeta','Six','f6@recette.local');
    raise exception 'S3 KO: la 6e tentative N''A PAS leve';
  exception when raise_exception then
    v_msg := sqlerrm;
    if v_msg not like 'NEXUS:%' then raise exception 'S3 KO: message sans marqueur NEXUS: (%)', v_msg; end if;
    if v_msg ilike '%zeta%' or v_msg ilike '%f6@%' then
      raise exception 'S3 KO: LE TERME CHERCHE EST DANS LE MESSAGE (%) — fuite vers les journaux', v_msg;
    end if;
  end;
  raise notice 'S3 OK — 6e tentative refusee, message NEXUS: generique, sans le terme cherche';
end $$;

do $$
declare v_cols text;
begin
  select string_agg(column_name || ':' || data_type, ', ' order by ordinal_position)
    into v_cols from information_schema.columns
   where table_schema='public' and table_name='ambassadeur_tentatives';
  if v_cols like '%text%' or v_cols like '%character%' then
    raise exception 'S3 KO: ambassadeur_tentatives contient une colonne texte (%)', v_cols;
  end if;
  raise notice 'S3b OK — ambassadeur_tentatives ne porte AUCUNE colonne texte : %', v_cols;
end $$;

-- ═══ SONDE 6 — lecture directe interdite au parrain ══════════════════════
\echo '--- S6 RLS ---'
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}';
do $$
declare v_n int;
begin
  select count(*) into v_n from public.ambassadeur_revendications;
  if v_n <> 0 then raise exception 'S6 KO: le parrain lit % ligne(s) en direct', v_n; end if;
  select count(*) into v_n from public.ambassadeur_paliers;
  if v_n <> 0 then raise exception 'S6 KO: le parrain lit % palier(s) en direct', v_n; end if;
  raise notice 'S6 OK — 0 ligne en lecture directe (revendications ET paliers)';
end $$;
-- …mais la projection, elle, répond, et sans identité.
do $$
declare v jsonb;
begin
  v := public.ambassadeur_mon_tableau();
  if (v->>'confirmes')::int <> 3 then raise exception 'S6 KO: projection confirmes=%', v->>'confirmes'; end if;
  if v::text ilike '%filleul%' or v::text ilike '%candidat%' or v::text ilike '%methode%' then
    raise exception 'S6 KO: la projection laisse fuir de l''identite : %', v::text;
  end if;
  raise notice 'S6b OK — projection rend confirmes=3, sans filleul/candidats/methode';
end $$;
commit;

-- ═══ SONDE 7 — palier 5 atteint mais PLAFOND de badges ═══════════════════
\echo '--- S7 plafond ---'
-- REMISE À ZÉRO DU COMPTEUR — geste de HARNAIS, pas de produit.
-- Parrain 1 a consommé ses 5 recherches du jour (S1, S11, S5×2, S4) et la
-- suite lève « limite du jour » : la borne fonctionne, elle nous bloque nous.
-- On la neutralise pour la sonde suivante, en le disant.
delete from public.ambassadeur_tentatives
 where athlete_id = 'bbbbbbbb-0000-0000-0000-000000000001';

-- 2 confirmations de plus pour parrain 1 (il en a 3) → palier 5.
begin; set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}';
-- f6 et h2, PAS f2/f3 : parrain 2 les a déjà confirmés en S3, et
-- ambassadeur_filleul_unique_confirme est GLOBAL — « premier arrivé garde ».
-- (Le constater ici est en soi une preuve de la règle.)
select public.ambassadeur_revendiquer('Zeta','Six','f6@recette.local'); commit;
begin; set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}';
select public.ambassadeur_revendiquer('Homo','Nyme','h2@recette.local'); commit;

-- On remplit sa ligne : 5 badges vivants posés par le coach.
insert into public.athlete_badges (athlete_id, badge_id, contexte, attribue_par, origine)
select 'bbbbbbbb-0000-0000-0000-000000000001', b.id, null,
       'bbbbbbbb-0000-0000-0000-000000000003', 'saisie'
  from public.badges b
 where b.code in ('capitaine','qi','clutch','costaud','disponibilite');

-- Vérification du palier en superutilisateur (hors RLS).
do $$
begin
  if not exists (select 1 from public.ambassadeur_paliers
                  where athlete_id='bbbbbbbb-0000-0000-0000-000000000001' and palier=5) then
    raise exception 'S7 KO: palier 5 non franchi (5 confirmees attendues)';
  end if;
  raise notice 'S7a OK — palier 5 franchi';
end $$;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}';
do $$
declare v jsonb;
begin
  -- ⚠ NE PAS tester le palier ICI : on est sous `set local role authenticated`
  -- avec le JWT du parrain, et la policy de ambassadeur_paliers est
  -- is_admin(). Un SELECT rendrait 0 ligne — pas parce que le palier manque,
  -- mais parce que la RLS le cache. (Piège payé pendant la recette : le
  -- symptôme « palier 5 non franchi » était un faux négatif de RLS.)
  -- La vérification se fait dans le bloc superutilisateur, juste au-dessus.
  v := public.ambassadeur_basculer_badge(true);
  if v->>'motif' is distinct from 'plafond' then
    raise exception 'S7 KO: motif=% au lieu de plafond (%)', v->>'motif', v::text;
  end if;
  if v::text ilike '%badge_plafond%' or v::text ilike '%NEXUS%' then
    raise exception 'S7 KO: le texte brut du trigger fuit : %', v::text;
  end if;
  raise notice 'S7 OK — palier 5 atteint, pose refusee motif=plafond, aucun texte de trigger';
end $$;
commit;

-- notification du palier 5
do $$
declare v_n int;
begin
  select count(*) into v_n from public.athlete_notifications
   where athlete_id='bbbbbbbb-0000-0000-0000-000000000001' and type='AMBASSADEUR_PALIER_5';
  if v_n <> 1 then raise exception 'S10b KO: % notification(s) palier 5', v_n; end if;
  raise notice 'S10b OK — notification AMBASSADEUR_PALIER_5 ecrite';
end $$;

-- ═══ SONDE 8 — badge pose, puis enregistrement du picker coach ═══════════
\echo '--- S8 survie au picker ---'
-- L'athlète libère une place, puis porte le badge.
update public.athlete_badges set retire_le=now(), retire_par='bbbbbbbb-0000-0000-0000-000000000003'
 where athlete_id='bbbbbbbb-0000-0000-0000-000000000001'
   and badge_id=(select id from public.badges where code='disponibilite')
   and retire_le is null;

begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}';
do $$
declare v jsonb;
begin
  v := public.ambassadeur_basculer_badge(true);
  if (v->>'ok')::boolean is not true then raise exception 'S8 KO: pose refusee %', v::text; end if;
  raise notice 'S8a OK — badge pose apres liberation d''une place';
end $$;
commit;

do $$
declare v_org text; v_auteur uuid;
begin
  select ab.origine, ab.attribue_par into v_org, v_auteur
    from public.athlete_badges ab join public.badges b on b.id=ab.badge_id
   where ab.athlete_id='bbbbbbbb-0000-0000-0000-000000000001'
     and b.code='ambassadeur' and ab.retire_le is null;
  if v_org <> 'systeme' then raise exception 'S8 KO: origine=%', v_org; end if;
  if v_auteur <> 'bbbbbbbb-0000-0000-0000-00000000000f' then
    raise exception 'S8 KO: attribue_par=% au lieu de l''identite de service', v_auteur;
  end if;
  raise notice 'S8b OK — origine systeme, auteur = identite de service';
end $$;

-- Le COACH enregistre son picker, sans le badge ambassadeur dans p_entrees.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000003","role":"authenticated"}';
select public.appliquer_badges_saisie('bbbbbbbb-0000-0000-0000-000000000001',
  '[{"code":"capitaine"},{"code":"qi"},{"code":"clutch"},{"code":"costaud"}]'::jsonb);
commit;

-- L'ADMIN enregistre le sien — portée « toute origine » depuis le 2026-08-26.
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000004","role":"authenticated"}';
select public.appliquer_badges_saisie('bbbbbbbb-0000-0000-0000-000000000001',
  '[{"code":"capitaine"},{"code":"qi"}]'::jsonb);
commit;

do $$
declare v_n int;
begin
  select count(*) into v_n from public.athlete_badges ab
    join public.badges b on b.id=ab.badge_id
   where ab.athlete_id='bbbbbbbb-0000-0000-0000-000000000001'
     and b.code='ambassadeur' and ab.retire_le is null;
  if v_n <> 1 then
    raise exception 'S8 KO: le badge ambassadeur a ete RETIRE par le picker (n=%)', v_n;
  end if;
  raise notice 'S8c OK — badge survit au picker COACH *et* au picker ADMIN';
end $$;

-- ═══ SONDE 9 — le badge n'est proposable par aucun picker ════════════════
\echo '--- S9 hors picker ---'
do $$
declare v_actif boolean; v_src text;
begin
  select actif into v_actif from public.badges where code='ambassadeur';
  if v_actif then raise exception 'S9 KO: le badge est ACTIF — il apparaitrait dans les 7 pickers'; end if;

  select pg_get_functiondef(p.oid) into v_src from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='appliquer_badges_saisie';
  if v_src not like '%ab.origine <> ''systeme''%' then
    raise exception 'S9 KO: la RPC ne protege pas l''origine systeme';
  end if;
  raise notice 'S9 OK — actif=false (badgesPourSport filtre dessus) + origine systeme hors remplacement';
end $$;

-- ═══ Annulation admin d'une CONFIRMEE ════════════════════════════════════
\echo '--- S12 annulation admin ---'
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000004","role":"authenticated"}';
select public.ambassadeur_admin_trancher(
  (select id from public.ambassadeur_revendications
    where parrain_athlete_id='bbbbbbbb-0000-0000-0000-000000000001'
      and filleul_athlete_id='cccccccc-0000-0000-0000-000000000001'),
  'annuler', null, 'Fraude constatee — recette') as s12;
commit;

do $$
declare v_conf int; v_p int;
begin
  select count(*) into v_conf from public.ambassadeur_revendications
   where parrain_athlete_id='bbbbbbbb-0000-0000-0000-000000000001' and statut='CONFIRMEE';
  if v_conf <> 4 then raise exception 'S12 KO: % confirmees au lieu de 4', v_conf; end if;
  select count(*) into v_p from public.ambassadeur_paliers
   where athlete_id='bbbbbbbb-0000-0000-0000-000000000001';
  if v_p <> 2 then raise exception 'S12 KO: % paliers — ils devaient rester acquis', v_p; end if;
  raise notice 'S12 OK — compteur retombe a 4, paliers 3 et 5 conserves, index libere';
end $$;

-- ═══ Garde admin sur la RPC d'arbitrage ══════════════════════════════════
\echo '--- S13 garde admin ---'
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-0000-0000-000000000001","role":"authenticated"}';
do $$
begin
  perform public.ambassadeur_admin_trancher(
    (select id from public.ambassadeur_revendications limit 1), 'rejeter', null, 'tentative');
  raise exception 'S13 KO: un athlete a pu trancher';
exception when raise_exception then
  if sqlerrm like 'S13 KO%' then raise; end if;
  raise notice 'S13 OK — arbitrage refuse a un non-admin (%)', sqlerrm;
end $$;
commit;

\echo ''
\echo '════════ TOUTES LES SONDES SONT PASSEES ════════'
\echo ''

-- ═══ NETTOYAGE ═══════════════════════════════════════════════════════════
\echo '--- nettoyage des fixtures ---'
-- Même ordre qu'en tête : les fiches d'abord (ON DELETE SET NULL, pas CASCADE).
delete from public.athletes where email like '%@recette.local';
delete from auth.users where email like '%@recette.local';
delete from public.teams   where id = 'aaaaaaaa-0000-0000-0000-000000000002';
delete from public.schools where id = 'aaaaaaaa-0000-0000-0000-000000000001';

do $$
declare v_a int; v_r int; v_b int;
begin
  select count(*) into v_a from public.athletes;
  select count(*) into v_r from public.ambassadeur_revendications;
  select count(*) into v_b from public.athlete_badges;
  if v_a <> 0 or v_r <> 0 or v_b <> 0 then
    raise exception 'NETTOYAGE INCOMPLET: athletes=% revendications=% badges=%', v_a, v_r, v_b;
  end if;
  raise notice 'Nettoyage OK — base locale rendue a son etat initial (0 athlete).';
end $$;
