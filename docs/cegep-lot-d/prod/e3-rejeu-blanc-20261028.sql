-- ════════════════════════════════════════════════════════════════════════════
-- Lot E3 cégep (cycle libre des programmes universitaires) — REJEU À BLANC (finit par ROLLBACK), version 20261028150000.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer.mjs <date> <rejeu-blanc|apply> e3 (migration et rollback
-- embarqués, LF, md5 gardés). Lancer SANS -1, en postgres.
--
-- UNE transaction : gardes → empreinte des programmes AVANT → migration → empreinte APRÈS (identique) → essais avec
-- un recruteur universitaire témoin (compte neuf, sous ON) et l'admin, chaque essai défait aussitôt (NX000)
-- → rollback E3 joué et vérifié → ROLLBACK. Aucun nom affiché.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '180s';
set local search_path = public, extensions;
set local application_name = 'nexus-rejeu-blanc-cegep-e3';
select now() as debut, current_user, current_setting('server_version') as version;

do $$
declare v text;
begin
  if current_user <> 'postgres' then raise exception 'NEXUS: lancer en postgres, pas en %', current_user; end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '20261028150000') then
    raise exception 'NEXUS: version 20261028150000 déjà inscrite';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '20261028150000' then raise exception 'NEXUS: version 20261028150000 pas après la dernière (%) — régénérer', v; end if;
  if exists (select 1 from public.admin_operations where operation in ('MIGRATION_CEGEP_LOT_E3', 'ROLLBACK_CEGEP_LOT_E3')) then
    raise exception 'NEXUS: le lot E3 a déjà laissé une trace dans admin_operations';
  end if;
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261028090000') then
    raise exception 'NEXUS: préalable D5a étape 2 absent';
  end if;
end $$;
select max(version) as derniere_version, public.lancement_universitaire_actif() as interrupteur_on
  from supabase_migrations.schema_migrations;

create temp table _t on commit drop as
select (select up.school_id from public.university_programs up where up.source = 'seed' group by up.school_id order by up.school_id limit 1) as univ,
       (select u.id from public.users u where u.role = 'ADMIN'::public.user_role and u.is_platform_admin order by u.id limit 1) as u_adm,
       '00000000-0000-4000-8000-0000000e3001'::uuid as neuf,
       public.lancement_universitaire_actif() as on_initial;
alter table _t add column v_seed uuid;
update _t set v_seed = (select up.id from public.university_programs up where up.school_id = univ and up.source = 'seed' order by up.id limit 1);
do $$ begin
  if exists (select 1 from _t where univ is null or u_adm is null or v_seed is null) then raise exception 'NEXUS: un témoin manque'; end if;
end $$;

create temp table _avant on commit drop as
select count(*) n, md5(string_agg(id::text || school_id || name || cycle || coalesce(faculte, '') || coalesce(lien, '') || source, ',' order by id)) empreinte
  from public.university_programs;

-- ── La migration, texte gardé par son md5 ────────────────────────────────────
create temp table _e3 on commit drop as
select '20261028150000'::text as version,
       $nexus_mig$-- Lot E3 cégep — cycle libre des programmes universitaires (retour du test de bout en bout de BP, 2026-10-28 : A3 ;
-- Q2 : liste fermée baccalauréat, certificat, maîtrise, doctorat, plus « autre » avec un texte libre).
--   1. university_programs.cycle : 'baccalaureat', 'certificat', 'maitrise', 'doctorat' ou 'autre' ; nouvelle colonne
--      cycle_libelle (1 à 60 caractères), OBLIGATOIRE pour 'autre' et INTERDITE sinon (contrainte).
--   2. replace_university_programs : accepte et contrôle les nouveaux cycles et cycle_libelle ; une ligne pré-remplie
--      dont le cycle ou le libellé change devient 'manuel', comme pour le nom.
-- Les lignes pré-remplies (baccalauréat, certificat) restent valides. Lecture et écriture : policies D5a / E1
-- inchangées. Corps de départ de la RPC gardé par md5.

do $garde$
begin
  if md5(pg_get_functiondef('public.replace_university_programs(uuid,jsonb,boolean)'::regprocedure)) <> 'd358ffa4b42ff57b85f59b80f8a8c8cc' then
    raise exception 'NEXUS: E3 — replace_university_programs a changé depuis le relevé ; régénérer';
  end if;
  if pg_get_constraintdef((select oid from pg_constraint where conname = 'university_programs_cycle_check'))
       <> 'CHECK ((cycle = ANY (ARRAY[''baccalaureat''::text, ''certificat''::text])))' then
    raise exception 'NEXUS: E3 — la contrainte de cycle a changé ; relire';
  end if;
end $garde$;

alter table public.university_programs drop constraint university_programs_cycle_check;
alter table public.university_programs
  add constraint university_programs_cycle_check check (cycle in ('baccalaureat', 'certificat', 'maitrise', 'doctorat', 'autre')),
  add column cycle_libelle text,
  add constraint university_programs_cycle_libelle_check check (
    (cycle = 'autre') = (cycle_libelle is not null)
    and (cycle_libelle is null or length(btrim(cycle_libelle)) between 1 and 60));

create or replace function public.replace_university_programs(p_school_id uuid, p_rows jsonb, p_autoriser_vide boolean default false)
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
              where coalesce(btrim(r->>'name'), '') = ''
                 or coalesce(r->>'cycle', '') not in ('baccalaureat', 'certificat', 'maitrise', 'doctorat', 'autre')
                 or ((r->>'cycle') = 'autre') is distinct from (nullif(btrim(r->>'cycle_libelle'), '') is not null)
                 or length(btrim(coalesce(r->>'cycle_libelle', ''))) > 60
                 or (nullif(btrim(r->>'lien'), '') is not null and btrim(r->>'lien') !~ '^https://')) then
    raise exception 'NEXUS: Chaque programme a besoin d''un nom, d''un cycle (baccalauréat, certificat, maîtrise, doctorat, ou « autre » avec son libellé) et d''un lien en https:// s''il y en a un.';
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
         cycle_libelle = nullif(btrim(r->>'cycle_libelle'), ''),
         faculte = nullif(btrim(r->>'faculte'), ''),
         lien = nullif(btrim(r->>'lien'), ''),
         is_displayed = coalesce((r->>'is_displayed')::boolean, true),
         position = (i - 1)::int,
         source = case when (up.name, up.cycle, up.cycle_libelle, up.faculte, up.lien)
                            is distinct from (btrim(r->>'name'), r->>'cycle', nullif(btrim(r->>'cycle_libelle'), ''),
                                              nullif(btrim(r->>'faculte'), ''), nullif(btrim(r->>'lien'), ''))
                       then 'manuel' else up.source end
    from jsonb_array_elements(p_rows) with ordinality as t(r, i)
   where up.school_id = p_school_id and r->>'id' is not null and up.id = (r->>'id')::uuid;

  insert into public.university_programs (school_id, name, cycle, cycle_libelle, faculte, lien, is_displayed, position, source)
  select p_school_id, btrim(r->>'name'), r->>'cycle', nullif(btrim(r->>'cycle_libelle'), ''), nullif(btrim(r->>'faculte'), ''), nullif(btrim(r->>'lien'), ''),
         coalesce((r->>'is_displayed')::boolean, true), (i - 1)::int, 'manuel'
    from jsonb_array_elements(p_rows) with ordinality as t(r, i)
   where r->>'id' is null;

  select count(*) into v_n from public.university_programs where school_id = p_school_id;
  return v_n;
end $function$;
$nexus_mig$::text as contenu,
       $nexus_rb$-- Rollback du lot E3 cégep : remet la liste de cycles d'origine (baccalauréat, certificat), retire cycle_libelle et
-- remet replace_university_programs dans son corps du lot D5a étape 2 (vérifié par md5). Refusé si une ligne utilise
-- un cycle ajouté par E3.
do $$
begin
  if exists (select 1 from public.university_programs where cycle not in ('baccalaureat', 'certificat')) then
    raise exception 'NEXUS: rollback E3 refusé : % programme(s) utilisent maîtrise, doctorat ou autre',
      (select count(*) from public.university_programs where cycle not in ('baccalaureat', 'certificat'));
  end if;
end $$;
alter table public.university_programs drop constraint university_programs_cycle_libelle_check;
alter table public.university_programs drop column cycle_libelle;
alter table public.university_programs drop constraint university_programs_cycle_check;
alter table public.university_programs add constraint university_programs_cycle_check check (cycle in ('baccalaureat', 'certificat'));
create or replace function public.replace_university_programs(p_school_id uuid, p_rows jsonb, p_autoriser_vide boolean default false)
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

do $verif$
begin
  if md5(pg_get_functiondef('public.replace_university_programs(uuid,jsonb,boolean)'::regprocedure)) <> 'd358ffa4b42ff57b85f59b80f8a8c8cc' then
    raise exception 'NEXUS: rollback E3 — la RPC remise ne retrouve pas son md5 (D5a)';
  end if;
end $verif$;
$nexus_rb$::text as rollback;
do $apply$
begin
  if (select md5(contenu) from _e3) <> '646026e149c9b6d5d2b6bb7b0fcaf645' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _e3);
  end if;
  if (select md5(rollback) from _e3) <> '0d4f8d71979172cd41ea06c55bdb19fb' then
    raise exception 'NEXUS: texte du rollback altéré (md5 %)', (select md5(rollback) from _e3);
  end if;
  execute (select contenu from _e3);
end $apply$;
set local search_path = public, extensions;

create temp table _apres on commit drop as
select count(*) n, md5(string_agg(id::text || school_id || name || cycle || coalesce(faculte, '') || coalesce(lien, '') || source, ',' order by id)) empreinte,
       count(*) filter (where cycle_libelle is not null) avec_libelle
  from public.university_programs;
select a.n as programmes_avant, p.n as programmes_apres, a.empreinte = p.empreinte as identiques, p.avec_libelle
  from _avant a, _apres p;

-- ── Essais ───────────────────────────────────────────────────────────────────
create function pg_temp.essai(p_on boolean, p_uid uuid, p_quoi text) returns text language plpgsql as $$
declare t record; v text; n int;
begin
  select * into t from _t;
  begin
    update public.app_settings set value = case when p_on then 'true' else 'false' end where key = 'lancement_universitaire';
    insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
    values ('00000000-0000-0000-0000-000000000000', t.neuf, 'authenticated', 'authenticated', 'e3-temoin@nexus.invalid', '{}', '{}', now(), now());
    update public.users set role = 'RECRUTEUR'::public.user_role, context = 'universitaire', school_id = t.univ,
           primary_team_id = null, onboarding_complete = true, role_claimed_at = now() where id = t.neuf;
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    begin
      if p_quoi = 'maîtrise, doctorat et « autre » libellé' then
        n := public.replace_university_programs(t.univ, jsonb_build_array(
               jsonb_build_object('id', t.v_seed, 'name', (select name from public.university_programs where id = t.v_seed),
                                  'cycle', (select cycle from public.university_programs where id = t.v_seed),
                                  'faculte', (select faculte from public.university_programs where id = t.v_seed),
                                  'lien', (select lien from public.university_programs where id = t.v_seed)),
               jsonb_build_object('name', 'Maîtrise essai', 'cycle', 'maitrise'),
               jsonb_build_object('name', 'Doctorat essai', 'cycle', 'doctorat'),
               jsonb_build_object('name', 'Programme essai', 'cycle', 'autre', 'cycle_libelle', 'Microprogramme')));
        v := n || ' ; libellés ' || (select count(*) from public.university_programs where school_id = t.univ and cycle_libelle is not null)
             || ' ; seed gardé ' || (select source from public.university_programs where id = t.v_seed);
      elsif p_quoi = 'ligne pré-remplie passée en maîtrise' then
        n := public.replace_university_programs(t.univ, jsonb_build_array(
               jsonb_build_object('id', t.v_seed, 'name', (select name from public.university_programs where id = t.v_seed), 'cycle', 'maitrise')));
        v := n || ' ; devient ' || (select source from public.university_programs where id = t.v_seed);
      elsif p_quoi = '« autre » sans libellé' then
        n := public.replace_university_programs(t.univ, jsonb_build_array(jsonb_build_object('name', 'X', 'cycle', 'autre')));
        v := n::text;
      elsif p_quoi = 'libellé sur un baccalauréat' then
        n := public.replace_university_programs(t.univ, jsonb_build_array(jsonb_build_object('name', 'X', 'cycle', 'baccalaureat', 'cycle_libelle', 'Y')));
        v := n::text;
      elsif p_quoi = 'libellé de 61 caractères' then
        n := public.replace_university_programs(t.univ, jsonb_build_array(jsonb_build_object('name', 'X', 'cycle', 'autre', 'cycle_libelle', repeat('a', 61))));
        v := n::text;
      elsif p_quoi = 'cycle inconnu' then
        n := public.replace_university_programs(t.univ, jsonb_build_array(jsonb_build_object('name', 'X', 'cycle', 'postdoc')));
        v := n::text;
      elsif p_quoi = 'écriture directe « autre » sans libellé' then
        insert into public.university_programs (school_id, name, cycle) values (t.univ, 'Direct', 'autre');
        v := 'écrit';
      elsif p_quoi = 'écriture directe « autre » libellé' then
        insert into public.university_programs (school_id, name, cycle, cycle_libelle) values (t.univ, 'Direct', 'autre', 'Diplôme');
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
select o, interrupteur, appelant, geste, attendu, pg_temp.essai(interrupteur = 'ON', uid, geste) as obtenu
  from (select x.*, row_number() over () as o from _t t, lateral (values
    ('ON',  'recruteur universitaire', t.neuf,  'maîtrise, doctorat et « autre » libellé', '4 ; libellés 1 ; seed gardé seed'),
    ('ON',  'recruteur universitaire', t.neuf,  'ligne pré-remplie passée en maîtrise',     '1 ; devient manuel'),
    ('ON',  'recruteur universitaire', t.neuf,  '« autre » sans libellé',                   'refusé P0001'),
    ('ON',  'recruteur universitaire', t.neuf,  'libellé sur un baccalauréat',              'refusé P0001'),
    ('ON',  'recruteur universitaire', t.neuf,  'libellé de 61 caractères',                 'refusé P0001'),
    ('ON',  'recruteur universitaire', t.neuf,  'cycle inconnu',                            'refusé P0001'),
    ('ON',  'recruteur universitaire', t.neuf,  'écriture directe « autre » sans libellé',  'refusé 23514'),
    ('ON',  'recruteur universitaire', t.neuf,  'écriture directe « autre » libellé',       'écrit'),
    ('OFF', 'recruteur universitaire', t.neuf,  'maîtrise, doctorat et « autre » libellé', 'refusé 42501'),
    ('OFF', 'admin',                   t.u_adm, 'écriture directe « autre » libellé',       'écrit'),
    ('OFF', 'admin',                   t.u_adm, 'écriture directe « autre » sans libellé',  'refusé 23514')
  ) x(interrupteur, appelant, uid, geste, attendu)) e;
select o, interrupteur, appelant, geste, attendu, obtenu, case when obtenu = attendu then 'ok' else 'ÉCART' end as "?"
  from _e order by o;

do $$
begin
  if exists (select 1 from _e where obtenu like 'ERREUR%') then raise exception 'NEXUS: un essai a échoué'; end if;
  if exists (select 1 from _e where obtenu <> attendu) then raise exception 'NEXUS: % essai(s) hors attendu', (select count(*) from _e where obtenu <> attendu); end if;
  if (select empreinte from _avant) is distinct from (select empreinte from _apres) or (select avec_libelle from _apres) <> 0 then
    raise exception 'NEXUS: les programmes existants ont bougé';
  end if;
  if public.lancement_universitaire_actif() is distinct from (select on_initial from _t) then
    raise exception 'NEXUS: l''interrupteur n''est pas revenu à son état initial';
  end if;
  if exists (select 1 from auth.users where id = (select neuf from _t)) then raise exception 'NEXUS: compte témoin resté'; end if;
  raise notice 'NEXUS: VERDICT E3 — cycles baccalauréat, certificat, maîtrise, doctorat, autre (avec libellé) ; programmes existants intacts';
end $$;
select 'VERDICT' as verdict, 'conforme' as resultat;

do $rb$ begin execute (select rollback from _e3); end $rb$;
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'university_programs' and column_name = 'cycle_libelle') then
    raise exception 'NEXUS: après rollback, cycle_libelle existe encore';
  end if;
  raise notice 'NEXUS: rollback E3 vérifié (colonne retirée, contrainte et RPC d''origine par md5)';
end $$;

rollback;
\echo '== ROLLBACK fait : rien n''est appliqué.'
