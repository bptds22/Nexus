-- ════════════════════════════════════════════════════════════════════════════
-- Lot E1 cégep (le cégépien voit et cible les universités sous ON) — @@TITRE@@, version @@VERSION@@.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer.mjs <date> <rejeu-blanc|apply> e1 (migration et rollback
-- embarqués, LF, md5 gardés). Lancer SANS -1, en postgres.
--
-- UNE transaction : gardes → balayage AVANT (ce que lisent des comptes réels) → migration → balayage APRÈS sous OFF
-- (identique) → essais OFF / ON avec des comptes réels (cégépien, athlète du secondaire, coach, recruteur collégial,
-- partenaire, admin) et un recruteur universitaire témoin (compte neuf) ; chaque essai défait aussitôt (NX000)
-- → @@SUITE@@. Aucun nom affiché.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '180s';
set local search_path = public, extensions;
set local application_name = 'nexus-@@MODE@@-cegep-e1';
select now() as debut, current_user, current_setting('server_version') as version;

do $$
declare v text;
begin
  if current_user <> 'postgres' then raise exception 'NEXUS: lancer en postgres, pas en %', current_user; end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '@@VERSION@@') then
    raise exception 'NEXUS: version @@VERSION@@ déjà inscrite';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '@@VERSION@@' then raise exception 'NEXUS: version @@VERSION@@ pas après la dernière (%) — régénérer', v; end if;
  if exists (select 1 from public.admin_operations where operation in ('MIGRATION_CEGEP_LOT_E1', 'ROLLBACK_CEGEP_LOT_E1')) then
    raise exception 'NEXUS: le lot E1 a déjà laissé une trace dans admin_operations';
  end if;
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261028090000') then
    raise exception 'NEXUS: préalable D5a étape 2 absent';
  end if;
end $$;
select max(version) as derniere_version, public.lancement_universitaire_actif() as interrupteur_on
  from supabase_migrations.schema_migrations;

-- ── Témoins (identifiants seulement) ─────────────────────────────────────────
create temp table _t on commit drop as
select (select u.id from public.users u join public.athletes a on a.user_id = u.id join public.schools s on s.id = a.school_id
         where u.role = 'ATHLETE'::public.user_role and s.type = 'CEGEP' order by u.id limit 1) as u_ceg,
       (select u.id from public.users u join public.athletes a on a.user_id = u.id join public.schools s on s.id = a.school_id
         where u.role = 'ATHLETE'::public.user_role and s.type = 'SECONDAIRE' order by u.id limit 1) as u_sec,
       (select u.id from public.users u where u.role = 'COACH'::public.user_role order by u.id limit 1) as u_coach,
       (select u.id from public.users u where u.role = 'RECRUTEUR'::public.user_role and u.context is distinct from 'universitaire'
         and u.school_id is not null order by u.id limit 1) as u_rec,
       (select u.id from public.users u where u.role = 'PARTNER'::public.user_role order by u.id limit 1) as u_part,
       (select u.id from public.users u where u.role = 'ADMIN'::public.user_role and u.is_platform_admin order by u.id limit 1) as u_adm,
       (select s.id from public.schools s where s.type = 'UNIVERSITE' and exists (select 1 from public.teams t where t.school_id = s.id)
         order by s.name limit 1) as univ,
       (select s.id from public.schools s where s.type = 'CEGEP' order by s.name limit 1) as cegep,
       '00000000-0000-4000-8000-0000000e1001'::uuid as neuf,
       public.lancement_universitaire_actif() as on_initial,
       (select count(*) from public.schools where type = 'UNIVERSITE') as n_univ,
       (select count(*) from public.teams t join public.schools s on s.id = t.school_id where s.type = 'UNIVERSITE') as n_eq,
       (select count(*) from public.university_programs) as n_prog;
alter table _t add column a_ceg uuid, add column a_sec uuid;
update _t set a_ceg = (select id from public.athletes where user_id = u_ceg limit 1), a_sec = (select id from public.athletes where user_id = u_sec limit 1);
do $$
begin
  if exists (select 1 from _t where u_ceg is null or u_sec is null or u_coach is null or u_rec is null or u_part is null
                or u_adm is null or univ is null or cegep is null or a_ceg is null or a_sec is null) then
    raise exception 'NEXUS: un témoin manque';
  end if;
end $$;

-- ── Ce que lit chaque compte : « universités / équipes univ. / programmes univ. » ───
create function pg_temp.lit(p_role text, p_uid uuid) returns text language plpgsql as $$
declare a int; b int; c int;
begin
  begin
    if p_role = 'anon' then
      perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
      perform set_config('role', 'anon', true);
    else
      perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
    end if;
    begin select count(*) into a from public.schools where type = 'UNIVERSITE'; exception when insufficient_privilege then a := -1; end;
    begin select count(*) into b from public.teams t where t.school_id = any (nexus_prive.ids_universites()); exception when insufficient_privilege then b := -1; end;
    begin select count(*) into c from public.university_programs; exception when insufficient_privilege then c := -1; end;
    raise exception using errcode = 'NX000', message = a || '/' || b || '/' || c;
  exception
    when sqlstate 'NX000' then return replace(sqlerrm, '-1', 'refusé');
    when others then return 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 70);
  end;
end $$;
create function pg_temp.balayage() returns table (o int, appelant text, lu text) language sql as $$
  select 1, 'cégépien', pg_temp.lit('authenticated', (select u_ceg from _t))
  union all select 2, 'athlète du secondaire', pg_temp.lit('authenticated', (select u_sec from _t))
  union all select 3, 'coach', pg_temp.lit('authenticated', (select u_coach from _t))
  union all select 4, 'recruteur collégial', pg_temp.lit('authenticated', (select u_rec from _t))
  union all select 5, 'partenaire', pg_temp.lit('authenticated', (select u_part from _t))
  union all select 6, 'anon', pg_temp.lit('anon', null)
  union all select 7, 'admin', pg_temp.lit('authenticated', (select u_adm from _t));
$$;
create temp table _avant on commit drop as select * from pg_temp.balayage();

-- ── La migration, texte gardé par son md5 ────────────────────────────────────
create temp table _e1 on commit drop as
select '@@VERSION@@'::text as version,
       $nexus_mig$@@MIGRATION@@$nexus_mig$::text as contenu,
       $nexus_rb$@@ROLLBACK@@$nexus_rb$::text as rollback;
do $apply$
begin
  if (select md5(contenu) from _e1) <> '@@MD5_MIGRATION@@' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _e1);
  end if;
  if (select md5(rollback) from _e1) <> '@@MD5_ROLLBACK@@' then
    raise exception 'NEXUS: texte du rollback altéré (md5 %)', (select md5(rollback) from _e1);
  end if;
  execute (select contenu from _e1);
end $apply$;
set local search_path = public, extensions;

create temp table _apres on commit drop as select * from pg_temp.balayage();
select a.appelant, a.lu as "avant (interrupteur tel quel)", p.lu as "après", case when a.lu = p.lu then 'identique' else 'CHANGÉ' end as "?"
  from _avant a join _apres p using (o) order by o;

-- ── Essais OFF / ON (chaque essai : interrupteur posé, geste, tout défait) ────
create function pg_temp.essai(p_on boolean, p_role text, p_uid uuid, p_quoi text) returns text language plpgsql as $$
declare t record; v text; n int;
begin
  select * into t from _t;
  begin
    update public.app_settings set value = case when p_on then 'true' else 'false' end where key = 'lancement_universitaire';
    insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', t.neuf, 'authenticated', 'authenticated', 'e1-temoin@nexus.invalid', '{}', '{}', now(), now());
    update public.users set role = 'RECRUTEUR'::public.user_role, context = 'universitaire', school_id = t.univ,
           primary_team_id = null, onboarding_complete = true, role_claimed_at = now() where id = t.neuf;
    -- cible préparée en postgres (sans utilisateur) pour l'essai « qui me ciblent »
    if p_quoi = 'qui me ciblent' then
      insert into public.athlete_targets (athlete_id, school_id) values (t.a_ceg, t.univ) on conflict do nothing;
    end if;
    if p_role = 'anon' then
      perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
      perform set_config('role', 'anon', true);
    else
      perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
    end if;
    begin
      if p_quoi = 'lire' then
        v := pg_temp.lit(p_role, p_uid);
      elsif p_quoi = 'cibler l''université' then
        insert into public.athlete_targets (athlete_id, school_id)
        values (case when p_uid = t.u_ceg then t.a_ceg else t.a_sec end, t.univ);
        v := 'ciblée';
      elsif p_quoi = 'cibler un cégep' then
        insert into public.athlete_targets (athlete_id, school_id)
        values (case when p_uid = t.u_ceg then t.a_ceg else t.a_sec end, t.cegep) on conflict (athlete_id, school_id) do nothing;
        v := 'ciblé';
      elsif p_quoi = 'qui me ciblent' then
        select count(*) into n from public.athletes_targeting_my_cegep() x where x.athlete_id = t.a_ceg;
        v := n || ' cégépien';
      end if;
    exception when insufficient_privilege then v := 'refusé 42501';
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
    ('OFF', 'cégépien',                'authenticated', t.u_ceg,   'lire',                  '0/0/0'),
    ('OFF', 'cégépien',                'authenticated', t.u_ceg,   'cibler l''université',  'refusé 42501'),
    ('ON',  'cégépien',                'authenticated', t.u_ceg,   'lire',                  t.n_univ || '/' || t.n_eq || '/' || t.n_prog),
    ('ON',  'cégépien',                'authenticated', t.u_ceg,   'cibler l''université',  'ciblée'),
    ('ON',  'cégépien',                'authenticated', t.u_ceg,   'cibler un cégep',       'ciblé'),
    ('ON',  'athlète du secondaire',   'authenticated', t.u_sec,   'lire',                  '0/0/0'),
    ('ON',  'athlète du secondaire',   'authenticated', t.u_sec,   'cibler l''université',  'refusé 42501'),
    ('ON',  'athlète du secondaire',   'authenticated', t.u_sec,   'cibler un cégep',       'ciblé'),
    ('ON',  'coach',                   'authenticated', t.u_coach, 'lire',                  '0/0/0'),
    ('ON',  'recruteur collégial',     'authenticated', t.u_rec,   'lire',                  '0/0/0'),
    ('ON',  'partenaire',              'authenticated', t.u_part,  'lire',                  '0/0/0'),
    -- anon ne lit pas teams en prod (refusé) mais peut le lire en local : comparaison LIKE
    ('ON',  'anon',                    'anon',          null,      'lire',                  '0/%/refusé'),
    ('ON',  'recruteur universitaire', 'authenticated', t.neuf,    'qui me ciblent',        '1 cégépien'),
    ('OFF', 'recruteur universitaire', 'authenticated', t.neuf,    'qui me ciblent',        '0 cégépien'),
    ('OFF', 'admin',                   'authenticated', t.u_adm,   'lire',                  t.n_univ || '/' || t.n_eq || '/' || t.n_prog)
  ) x(interrupteur, appelant, role, uid, geste, attendu)) e;
select o, interrupteur, appelant, geste, attendu, obtenu, case when obtenu like attendu then 'ok' else 'ÉCART' end as "?"
  from _e order by o;

do $$
begin
  if exists (select 1 from _e where obtenu like 'ERREUR%') or exists (select 1 from _apres where lu like 'ERREUR%') then
    raise exception 'NEXUS: un essai a échoué';
  end if;
  if exists (select 1 from _e where obtenu not like attendu) then raise exception 'NEXUS: % essai(s) hors attendu', (select count(*) from _e where obtenu not like attendu); end if;
  if not (select on_initial from _t) and exists (select 1 from _avant a join _apres p using (o) where a.lu <> p.lu) then
    raise exception 'NEXUS: sous OFF, un compte lit autre chose qu''avant';
  end if;
  if public.lancement_universitaire_actif() is distinct from (select on_initial from _t) then
    raise exception 'NEXUS: l''interrupteur n''est pas revenu à son état initial';
  end if;
  if exists (select 1 from auth.users where id = (select neuf from _t)) then raise exception 'NEXUS: compte témoin resté'; end if;
  if exists (select 1 from public.athlete_targets t join public.schools s on s.id = t.school_id where s.type = 'UNIVERSITE') then
    raise exception 'NEXUS: une cible universitaire d''essai est restée';
  end if;
  raise notice 'NEXUS: VERDICT E1 — sous OFF rien ne change ; sous ON le cégépien seul lit et cible les universités, le recruteur universitaire voit qui le cible';
end $$;
select 'VERDICT' as verdict, 'conforme' as resultat;
-- [[REJEU

do $rb$ begin execute (select rollback from _e1); end $rb$;
do $$
begin
  if to_regprocedure('nexus_prive.cegepien_sous_on()') is not null
     or exists (select 1 from pg_policies where tablename = 'teams' and policyname = 'universites_lisibles_cegepiens')
     or exists (select 1 from pg_trigger where tgrelid = 'public.athlete_targets'::regclass and not tgisinternal) then
    raise exception 'NEXUS: après rollback, un objet du lot E1 reste';
  end if;
  raise notice 'NEXUS: rollback E1 vérifié (policies d''origine, déclencheur et fonctions retirés)';
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
select version, 'cegep_lot_e1_cibles_universitaires', array[contenu], 'bptds22@gmail.com' from _e1;
insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_CEGEP_LOT_E1',
       'Chantier cégep, lot E1 : le cégépien voit et cible les universités sous lancement_universitaire ON ; rien ne change sous OFF (GO BP)',
       jsonb_build_object('nom', 'cegep_lot_e1_cibles_universitaires', 'version', version,
         'fichier', 'supabase/migrations/' || version || '_cegep_lot_e1_cibles_universitaires.sql',
         'rollback', 'supabase/rollback/' || version || '_rollback_cegep_lot_e1_cibles_universitaires.sql',
         'md5_fichier', '@@MD5_MIGRATION@@', 'md5_rollback', '@@MD5_ROLLBACK@@', 'voie', 'psql (session pooler)'),
       (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0')
  from _e1;
do $$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '@@VERSION@@') then
    raise exception 'NEXUS: inscription schema_migrations absente';
  end if;
end $$;
select version as version_inscrite, clock_timestamp() as avant_commit from _e1;
commit;
\echo '== COMMIT fait : lot E1 cégep en prod (cibles universitaires sous ON, interrupteur OFF).'
-- APPLY]]
