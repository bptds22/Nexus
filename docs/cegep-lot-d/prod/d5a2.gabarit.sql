-- ════════════════════════════════════════════════════════════════════════════
-- Lot D5a cégep (étape 2, programmes universitaires) — @@TITRE@@, version @@VERSION@@.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer.mjs <date> <rejeu-blanc|apply> d5a2 (migration et rollback
-- embarqués, LF, md5 gardés). Lancer SANS -1, en postgres.
--
-- UNE transaction : gardes → migration → essais (recruteur universitaire témoin, compte neuf ; comptes réels pour
-- les autres rôles), interrupteur OFF puis ON, chaque essai défait aussitôt (NX000) → @@SUITE@@. Aucun nom affiché.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-@@MODE@@-cegep-d5a2';
select now() as debut, current_user, current_setting('server_version') as version;

do $$
declare v text;
begin
  if current_user <> 'postgres' then
    raise exception 'NEXUS: lancer en postgres, pas en %', current_user;
  end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '@@VERSION@@') then
    raise exception 'NEXUS: version @@VERSION@@ déjà inscrite';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '@@VERSION@@' then raise exception 'NEXUS: version @@VERSION@@ pas après la dernière (%) — régénérer', v; end if;
  if exists (select 1 from public.admin_operations where operation in ('MIGRATION_CEGEP_LOT_D5A2', 'ROLLBACK_CEGEP_LOT_D5A2')) then
    raise exception 'NEXUS: le lot D5a étape 2 a déjà laissé une trace dans admin_operations';
  end if;
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261028070000') then
    raise exception 'NEXUS: préalable D5a étape 1 absent';
  end if;
  if to_regclass('public.university_programs') is not null or to_regprocedure('public.replace_university_programs(uuid,jsonb,boolean)') is not null then
    raise exception 'NEXUS: university_programs ou sa RPC existe déjà';
  end if;
end $$;
select max(version) as derniere_version, public.lancement_universitaire_actif() as interrupteur_on
  from supabase_migrations.schema_migrations;

-- ── Témoins (identifiants seulement) ─────────────────────────────────────────
create temp table _t on commit drop as
select (select s.id from public.schools s where s.type = 'UNIVERSITE' order by s.name limit 1) as univ,
       (select s.id from public.schools s where s.type = 'UNIVERSITE' order by s.name desc limit 1) as univ_autre,
       (select s.id from public.schools s where s.type = 'CEGEP' order by s.name limit 1) as cegep,
       (select u.id from public.users u where u.role = 'RECRUTEUR'::public.user_role and u.context is distinct from 'universitaire'
         and u.school_id is not null order by u.id limit 1) as u_rec,
       (select a.user_id from public.athletes a join public.users u on u.id = a.user_id where u.role = 'ATHLETE'::public.user_role
         order by a.user_id limit 1) as u_ath,
       (select u.id from public.users u where u.role = 'COACH'::public.user_role order by u.id limit 1) as u_coach,
       (select u.id from public.users u where u.role = 'ADMIN'::public.user_role and u.is_platform_admin order by u.id limit 1) as u_adm,
       '00000000-0000-4000-8000-0000000d5a02'::uuid as neuf,
       public.lancement_universitaire_actif() as on_initial;
do $$
begin
  if exists (select 1 from _t where univ is null or univ_autre is null or univ = univ_autre or cegep is null or u_rec is null
                or u_ath is null or u_coach is null or u_adm is null) then
    raise exception 'NEXUS: un témoin manque';
  end if;
end $$;

-- ── La migration, texte gardé par son md5 ────────────────────────────────────
create temp table _d5a2 on commit drop as
select '@@VERSION@@'::text as version,
       $nexus_mig$@@MIGRATION@@$nexus_mig$::text as contenu,
       $nexus_rb$@@ROLLBACK@@$nexus_rb$::text as rollback;
do $apply$
begin
  if (select md5(contenu) from _d5a2) <> '@@MD5_MIGRATION@@' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _d5a2);
  end if;
  if (select md5(rollback) from _d5a2) <> '@@MD5_ROLLBACK@@' then
    raise exception 'NEXUS: texte du rollback altéré (md5 %)', (select md5(rollback) from _d5a2);
  end if;
  execute (select contenu from _d5a2);
end $apply$;
set local search_path = public, extensions;

-- ── Essais ───────────────────────────────────────────────────────────────────
-- Préparation commune, défaite à chaque essai : interrupteur posé ; recruteur universitaire témoin rattaché à
-- « univ » ; une ligne pré-remplie (seed) pour « univ » et une pour « univ_autre ».
create function pg_temp.essai(p_on boolean, p_role text, p_uid uuid, p_quoi text) returns text language plpgsql as $$
declare t record; v text; n int; v_seed uuid;
begin
  select * into t from _t;
  begin
    update public.app_settings set value = case when p_on then 'true' else 'false' end where key = 'lancement_universitaire';
    insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', t.neuf, 'authenticated', 'authenticated', 'd5a2-temoin@nexus.invalid', '{}', '{}', now(), now());
    update public.users set role = 'RECRUTEUR'::public.user_role, context = 'universitaire', school_id = t.univ,
           primary_team_id = null, onboarding_complete = true, role_claimed_at = now() where id = t.neuf;
    insert into public.university_programs (school_id, name, cycle, faculte, lien, source, source_url)
    values (t.univ, 'Baccalauréat essai pré-rempli', 'baccalaureat', 'Faculté essai', 'https://exemple.invalid/a', 'seed', 'https://exemple.invalid/liste')
    returning id into v_seed;
    insert into public.university_programs (school_id, name, cycle, source) values (t.univ_autre, 'Certificat essai autre', 'certificat', 'seed');
    if p_role = 'anon' then
      perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
      perform set_config('role', 'anon', true);
    elsif p_role <> 'postgres' then
      perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
    end if;
    begin
      if p_quoi = 'lire sa liste' then
        select count(*) into n from public.university_programs where school_id = t.univ; v := n || ' lue(s)';
      elsif p_quoi = 'lire toutes les listes' then
        select count(*) into n from public.university_programs; v := n || ' lue(s)';
      elsif p_quoi = 'remplacer sa liste (garde + 1 ajout)' then
        n := public.replace_university_programs(t.univ, jsonb_build_array(
               jsonb_build_object('id', v_seed, 'name', 'Baccalauréat essai pré-rempli', 'cycle', 'baccalaureat',
                                  'faculte', 'Faculté essai', 'lien', 'https://exemple.invalid/a'),
               jsonb_build_object('name', 'Certificat ajouté', 'cycle', 'certificat')));
        select v_n || ' ; seed gardé ' || (select source from public.university_programs where id = v_seed) into v
          from (select n as v_n) x;
      elsif p_quoi = 'modifier une ligne pré-remplie' then
        n := public.replace_university_programs(t.univ, jsonb_build_array(
               jsonb_build_object('id', v_seed, 'name', 'Baccalauréat essai renommé', 'cycle', 'baccalaureat')));
        v := n || ' ; devient ' || (select source from public.university_programs where id = v_seed);
      elsif p_quoi = 'remplacer l''autre université' then
        n := public.replace_university_programs(t.univ_autre, jsonb_build_array(jsonb_build_object('name', 'X', 'cycle', 'certificat')));
        v := n::text;
      elsif p_quoi = 'cycle invalide' then
        n := public.replace_university_programs(t.univ, jsonb_build_array(jsonb_build_object('name', 'X', 'cycle', 'maitrise')));
        v := n::text;
      elsif p_quoi = 'lien sans https' then
        n := public.replace_university_programs(t.univ, jsonb_build_array(jsonb_build_object('name', 'X', 'cycle', 'certificat', 'lien', 'http://x')));
        v := n::text;
      elsif p_quoi = 'liste vide sans accord' then
        n := public.replace_university_programs(t.univ, '[]'::jsonb);
        v := n::text;
      elsif p_quoi = 'liste vide avec accord' then
        n := public.replace_university_programs(t.univ, '[]'::jsonb, true);
        v := n::text;
      elsif p_quoi = 'écrire directement chez lui' then
        insert into public.university_programs (school_id, name, cycle) values (t.univ, 'Direct', 'certificat');
        v := 'écrit';
      elsif p_quoi = 'programme sur un cégep' then
        insert into public.university_programs (school_id, name, cycle) values (t.cegep, 'Direct', 'certificat');
        v := 'écrit';
      end if;
    exception
      when insufficient_privilege then v := 'refusé 42501';
      when check_violation then v := 'refusé 23514';
      when raise_exception then v := 'refusé P0001';
    end;
    raise exception using errcode = 'NX000', message = v;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 70);
  end;
end $$;
create temp table _e on commit drop as
select o, interrupteur, appelant, geste, attendu, pg_temp.essai(interrupteur = 'ON', role, uid, geste) as obtenu
  from (select x.*, row_number() over () as o from _t t, lateral (values
    ('OFF', 'recruteur universitaire', 'authenticated', t.neuf,   'lire sa liste',                         '0 lue(s)'),
    ('OFF', 'recruteur universitaire', 'authenticated', t.neuf,   'remplacer sa liste (garde + 1 ajout)',  'refusé 42501'),
    ('ON',  'recruteur universitaire', 'authenticated', t.neuf,   'lire sa liste',                         '1 lue(s)'),
    ('ON',  'recruteur universitaire', 'authenticated', t.neuf,   'lire toutes les listes',                '1 lue(s)'),
    ('ON',  'recruteur universitaire', 'authenticated', t.neuf,   'remplacer sa liste (garde + 1 ajout)',  '2 ; seed gardé seed'),
    ('ON',  'recruteur universitaire', 'authenticated', t.neuf,   'modifier une ligne pré-remplie',        '1 ; devient manuel'),
    ('ON',  'recruteur universitaire', 'authenticated', t.neuf,   'remplacer l''autre université',         'refusé 42501'),
    ('ON',  'recruteur universitaire', 'authenticated', t.neuf,   'cycle invalide',                        'refusé P0001'),
    ('ON',  'recruteur universitaire', 'authenticated', t.neuf,   'lien sans https',                       'refusé P0001'),
    ('ON',  'recruteur universitaire', 'authenticated', t.neuf,   'liste vide sans accord',                'refusé P0001'),
    ('ON',  'recruteur universitaire', 'authenticated', t.neuf,   'liste vide avec accord',                '0'),
    ('ON',  'recruteur universitaire', 'authenticated', t.neuf,   'écrire directement chez lui',           'écrit'),
    ('ON',  'recruteur collégial',     'authenticated', t.u_rec,  'lire toutes les listes',                '0 lue(s)'),
    ('ON',  'recruteur collégial',     'authenticated', t.u_rec,  'remplacer sa liste (garde + 1 ajout)',  'refusé 42501'),
    ('ON',  'recruteur collégial',     'authenticated', t.u_rec,  'écrire directement chez lui',           'refusé 42501'),
    ('ON',  'athlète',                 'authenticated', t.u_ath,  'lire toutes les listes',                '0 lue(s)'),
    ('ON',  'coach',                   'authenticated', t.u_coach,'lire toutes les listes',                '0 lue(s)'),
    ('ON',  'anon',                    'anon',          null,     'lire toutes les listes',                'refusé 42501'),
    ('ON',  'anon',                    'anon',          null,     'remplacer sa liste (garde + 1 ajout)',  'refusé 42501'),
    ('OFF', 'admin',                   'authenticated', t.u_adm,  'lire toutes les listes',                '2 lue(s)'),
    ('OFF', 'admin',                   'authenticated', t.u_adm,  'remplacer sa liste (garde + 1 ajout)',  '2 ; seed gardé seed'),
    ('OFF', 'postgres (import)',       'postgres',      null,     'programme sur un cégep',                'refusé 23514')
  ) x(interrupteur, appelant, role, uid, geste, attendu)) e;
select o, interrupteur, appelant, geste, attendu, obtenu, case when obtenu = attendu then 'ok' else 'ÉCART' end as "?"
  from _e order by o;

do $$
begin
  if exists (select 1 from _e where obtenu like 'ERREUR%') then raise exception 'NEXUS: un essai a échoué'; end if;
  if exists (select 1 from _e where obtenu <> attendu) then raise exception 'NEXUS: % essai(s) hors attendu', (select count(*) from _e where obtenu <> attendu); end if;
  if public.lancement_universitaire_actif() is distinct from (select on_initial from _t) then
    raise exception 'NEXUS: l''interrupteur n''est pas revenu à son état initial';
  end if;
  if exists (select 1 from auth.users where id = (select neuf from _t)) then raise exception 'NEXUS: compte témoin resté'; end if;
  if exists (select 1 from public.university_programs) then raise exception 'NEXUS: une ligne d''essai est restée'; end if;
  raise notice 'NEXUS: VERDICT D5a étape 2 — programmes universitaires : admin, ou le recruteur universitaire de SA liste sous ON ; personne d''autre ne lit ni n''écrit';
end $$;
select 'VERDICT' as verdict, 'conforme' as resultat;
-- [[REJEU

do $rb$ begin execute (select rollback from _d5a2); end $rb$;
do $$
begin
  if to_regclass('public.university_programs') is not null or to_regprocedure('public.replace_university_programs(uuid,jsonb,boolean)') is not null
     or to_regprocedure('nexus_prive.university_programs_ecole_universite()') is not null then
    raise exception 'NEXUS: après rollback, un objet du lot D5a étape 2 reste';
  end if;
  raise notice 'NEXUS: rollback D5a étape 2 vérifié (table, RPC et déclencheur retirés)';
end $$;

rollback;
\echo '== ROLLBACK fait : rien n''est appliqué.'
-- REJEU]]
-- [[APPLY

do $$
begin
  if public.lancement_universitaire_actif() then raise exception 'NEXUS: l''interrupteur doit rester OFF'; end if;
end $$;
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'cegep_lot_d5a_programmes_universitaires', array[contenu], 'bptds22@gmail.com' from _d5a2;

insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_CEGEP_LOT_D5A2',
       'Chantier cégep, lot D5a étape 2 : table university_programs et RPC replace_university_programs (admin, ou le recruteur universitaire de sa liste sous ON) (GO BP)',
       jsonb_build_object('nom', 'cegep_lot_d5a_programmes_universitaires', 'version', version,
         'fichier', 'supabase/migrations/' || version || '_cegep_lot_d5a_programmes_universitaires.sql',
         'rollback', 'supabase/rollback/' || version || '_rollback_cegep_lot_d5a_programmes_universitaires.sql',
         'md5_fichier', '@@MD5_MIGRATION@@', 'md5_rollback', '@@MD5_ROLLBACK@@', 'voie', 'psql (session pooler)'),
       (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0')
  from _d5a2;
do $$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '@@VERSION@@') then
    raise exception 'NEXUS: inscription schema_migrations absente';
  end if;
end $$;
select version as version_inscrite, clock_timestamp() as avant_commit from _d5a2;
commit;
\echo '== COMMIT fait : lot D5a étape 2 cégep en prod (programmes universitaires, table vide, interrupteur OFF).'
-- APPLY]]
