-- ════════════════════════════════════════════════════════════════════════════
-- Lot D5a cégep (étape 2, programmes universitaires) — REJEU À BLANC (finit par ROLLBACK), version 20261028090000.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer.mjs <date> <rejeu-blanc|apply> d5a2 (migration et rollback
-- embarqués, LF, md5 gardés). Lancer SANS -1, en postgres.
--
-- UNE transaction : gardes → migration → essais (recruteur universitaire témoin, compte neuf ; comptes réels pour
-- les autres rôles), interrupteur OFF puis ON, chaque essai défait aussitôt (NX000) → rollback D5A2 joué et vérifié → ROLLBACK. Aucun nom affiché.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-rejeu-blanc-cegep-d5a2';
select now() as debut, current_user, current_setting('server_version') as version;

do $$
declare v text;
begin
  if current_user <> 'postgres' then
    raise exception 'NEXUS: lancer en postgres, pas en %', current_user;
  end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '20261028090000') then
    raise exception 'NEXUS: version 20261028090000 déjà inscrite';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '20261028090000' then raise exception 'NEXUS: version 20261028090000 pas après la dernière (%) — régénérer', v; end if;
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
select '20261028090000'::text as version,
       $nexus_mig$-- Lot D5a cégep, étape 2 — programmes d'études universitaires (décisions BP 2026-10-28 : Q2 nom, cycle, faculté et
-- lien facultatifs ; pré-remplis depuis le site officiel de chaque université, premier cycle seulement ; ensuite
-- l'université ajoute, retire et modifie elle-même).
-- Table dédiée : school_programs reste le domaine des DEC (type préuniversitaire / technique, code MEQ, catalogue).
--   1. public.university_programs : école UNIVERSITÉ seulement (déclencheur), cycle baccalauréat ou certificat,
--      faculté et lien facultatifs (lien en https), source 'seed' (pré-remplissage, avec son URL) ou 'manuel'.
--   2. Lecture : l'admin, et le recruteur universitaire de SA université sous ON (nexus_prive.mon_universite()).
--      La page publique lira par la clé service (D5b). Rien pour anon.
--   3. Écriture : can_edit_school_page(school_id) (D5a étape 1 : admin, ou le recruteur universitaire de sa page
--      sous ON), par la RPC transactionnelle replace_university_programs, sur le modèle de replace_school_programs.
--      Une ligne pré-remplie que l'université modifie devient 'manuel'.

create table public.university_programs (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools (id) on delete cascade,
  name         text not null check (length(btrim(name)) between 1 and 200),
  cycle        text not null check (cycle in ('baccalaureat', 'certificat')),
  faculte      text check (faculte is null or length(btrim(faculte)) between 1 and 150),
  lien         text check (lien is null or (lien ~ '^https://' and length(lien) <= 500)),
  is_displayed boolean not null default true,
  position     integer not null default 0,
  source       text not null default 'manuel' check (source in ('seed', 'manuel')),
  source_url   text check (source_url is null or length(source_url) <= 500),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index university_programs_unique on public.university_programs (school_id, lower(btrim(name)), cycle);
create index university_programs_school on public.university_programs (school_id, position);

create function nexus_prive.university_programs_ecole_universite() returns trigger
  language plpgsql security definer set search_path = public set row_security = off
as $function$
begin
  if not exists (select 1 from public.schools s where s.id = new.school_id and s.type = 'UNIVERSITE') then
    raise exception 'NEXUS: un programme universitaire doit appartenir à une université' using errcode = '23514';
  end if;
  new.updated_at := now();
  return new;
end $function$;
revoke all on function nexus_prive.university_programs_ecole_universite() from public, anon, authenticated;
create trigger university_programs_ecole_universite before insert or update on public.university_programs
  for each row execute function nexus_prive.university_programs_ecole_universite();

alter table public.university_programs enable row level security;
revoke all on public.university_programs from anon, authenticated;
grant select, insert, update, delete on public.university_programs to authenticated;
grant all on public.university_programs to service_role;

create policy university_programs_read on public.university_programs for select to authenticated
  using ((select public.is_admin()) or school_id = (select nexus_prive.mon_universite()));
create policy university_programs_write on public.university_programs for all to authenticated
  using (public.can_edit_school_page(school_id))
  with check (public.can_edit_school_page(school_id));

-- Remplacement atomique de la liste d'une université. p_rows : [{id?, name, cycle, faculte?, lien?, is_displayed?}]
-- dans l'ordre d'affichage. Ligne avec id = conservée (modifiée si son contenu change) ; sans id = ajout manuel ;
-- absente = retirée.
create function public.replace_university_programs(p_school_id uuid, p_rows jsonb, p_autoriser_vide boolean default false)
  returns integer
  language plpgsql
  set search_path = public
as $function$
declare
  v_garde uuid[];
  v_n     integer;
begin
  if p_school_id is null then
    raise exception 'NEXUS: Aucune université ciblée — rien n''a été modifié.';
  end if;
  if jsonb_typeof(p_rows) is distinct from 'array' then
    raise exception 'NEXUS: Liste de programmes illisible — rien n''a été modifié.';
  end if;
  if not public.can_edit_school_page(p_school_id) then
    raise exception 'NEXUS: Tu n''as pas les droits d''édition sur cette université.' using errcode = '42501';
  end if;
  if jsonb_array_length(p_rows) > 800 then
    raise exception 'NEXUS: Trop de programmes (800 au plus) — rien n''a été modifié.';
  end if;
  if exists (select 1 from jsonb_array_elements(p_rows) r
              where coalesce(btrim(r->>'name'), '') = '' or coalesce(r->>'cycle', '') not in ('baccalaureat', 'certificat')
                 or (nullif(btrim(r->>'lien'), '') is not null and btrim(r->>'lien') !~ '^https://')) then
    raise exception 'NEXUS: Chaque programme a besoin d''un nom, d''un cycle (baccalauréat ou certificat) et d''un lien en https:// s''il y en a un.';
  end if;
  if jsonb_array_length(p_rows) = 0 and not p_autoriser_vide
     and exists (select 1 from public.university_programs where school_id = p_school_id) then
    raise exception 'NEXUS: Aucun programme reçu — la liste n''a pas été effacée.';
  end if;

  select coalesce(array_agg((r->>'id')::uuid), '{}') into v_garde
    from jsonb_array_elements(p_rows) r where r->>'id' is not null;

  delete from public.university_programs where school_id = p_school_id and id <> all (v_garde);

  update public.university_programs up
     set name = btrim(r->>'name'),
         cycle = r->>'cycle',
         faculte = nullif(btrim(r->>'faculte'), ''),
         lien = nullif(btrim(r->>'lien'), ''),
         is_displayed = coalesce((r->>'is_displayed')::boolean, true),
         position = (i - 1)::int,
         source = case when (up.name, up.cycle, up.faculte, up.lien)
                            is distinct from (btrim(r->>'name'), r->>'cycle', nullif(btrim(r->>'faculte'), ''), nullif(btrim(r->>'lien'), ''))
                       then 'manuel' else up.source end
    from jsonb_array_elements(p_rows) with ordinality as t(r, i)
   where up.school_id = p_school_id and r->>'id' is not null and up.id = (r->>'id')::uuid;

  insert into public.university_programs (school_id, name, cycle, faculte, lien, is_displayed, position, source)
  select p_school_id, btrim(r->>'name'), r->>'cycle', nullif(btrim(r->>'faculte'), ''), nullif(btrim(r->>'lien'), ''),
         coalesce((r->>'is_displayed')::boolean, true), (i - 1)::int, 'manuel'
    from jsonb_array_elements(p_rows) with ordinality as t(r, i)
   where r->>'id' is null;

  select count(*) into v_n from public.university_programs where school_id = p_school_id;
  return v_n;
end $function$;
revoke all on function public.replace_university_programs(uuid, jsonb, boolean) from public, anon;
grant execute on function public.replace_university_programs(uuid, jsonb, boolean) to authenticated, service_role;
$nexus_mig$::text as contenu,
       $nexus_rb$-- Rollback du lot D5a cégep, étape 2 : retire les programmes universitaires (table, RPC, déclencheur).
-- La table part avec ses lignes : à jouer avant tout pré-remplissage, ou après l'avoir retiré.
drop function public.replace_university_programs(uuid, jsonb, boolean);
drop table public.university_programs;
drop function nexus_prive.university_programs_ecole_universite();
$nexus_rb$::text as rollback;
do $apply$
begin
  if (select md5(contenu) from _d5a2) <> '4aec916703417b5d178ba98aa6b5c208' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _d5a2);
  end if;
  if (select md5(rollback) from _d5a2) <> '7b266bc04e4d89d045c533915ba67c6c' then
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
