-- ════════════════════════════════════════════════════════════════════════════
-- Lot D5a cégep (étape 1, faille d'écriture) — @@TITRE@@, version @@VERSION@@.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer.mjs <date> <rejeu-blanc|apply> d5a (migration et rollback
-- embarqués, LF, md5 gardés). Lancer SANS -1, en postgres.
--
-- UNE transaction : gardes → balayage AVANT (droits d'édition de chaque compte coach, recruteur et admin sur son
-- école et ses équipes) → migration → balayage APRÈS (comparé) → essais avec un recruteur universitaire témoin
-- (compte neuf), interrupteur OFF puis ON, chaque essai défait aussitôt → @@SUITE@@. Aucun nom affiché.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '300s';
set local search_path = public, extensions;
set local application_name = 'nexus-@@MODE@@-cegep-d5a';
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
  if exists (select 1 from public.admin_operations where operation in ('MIGRATION_CEGEP_LOT_D5A', 'ROLLBACK_CEGEP_LOT_D5A')) then
    raise exception 'NEXUS: le lot D5a a déjà laissé une trace dans admin_operations';
  end if;
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261028060000') then
    raise exception 'NEXUS: préalable D3d absent';
  end if;
end $$;
select max(version) as derniere_version, public.lancement_universitaire_actif() as interrupteur_on
  from supabase_migrations.schema_migrations;

-- ── Témoins (identifiants seulement) ─────────────────────────────────────────
create temp table _t on commit drop as
select (select s.id from public.schools s where s.type = 'UNIVERSITE' and exists (select 1 from public.teams t where t.school_id = s.id)
         order by s.name limit 1) as univ,
       (select s.id from public.schools s where s.type = 'UNIVERSITE' order by s.name desc limit 1) as univ_autre,
       (select u.id from public.users u join public.schools s on s.id = u.school_id and s.type = 'CEGEP'
         where u.role = 'RECRUTEUR'::public.user_role and u.context is distinct from 'universitaire'
           and exists (select 1 from public.teams t where t.school_id = s.id) order by u.id limit 1) as u_rec,
       (select tc.coach_id from public.team_coaches tc join public.users u on u.id = tc.coach_id
         where u.role = 'COACH'::public.user_role order by tc.coach_id, tc.team_id limit 1) as u_coach,
       (select u.id from public.users u where u.role = 'ADMIN'::public.user_role and u.is_platform_admin order by u.id limit 1) as u_adm,
       '00000000-0000-4000-8000-0000000d5a01'::uuid as neuf,
       public.lancement_universitaire_actif() as on_initial;
alter table _t add column c_rec uuid, add column t_univ uuid, add column t_cegep uuid, add column t_coach uuid, add column sport uuid;
update _t set c_rec = (select school_id from public.users where id = u_rec);
update _t set t_univ = (select t.id from public.teams t where t.school_id = univ order by t.id limit 1),
              t_cegep = (select t.id from public.teams t where t.school_id = c_rec order by t.id limit 1),
              t_coach = (select tc.team_id from public.team_coaches tc where tc.coach_id = u_coach order by tc.team_id limit 1);
update _t set sport = (select sport_id from public.teams where id = t_univ);
do $$
begin
  if exists (select 1 from _t where univ is null or univ_autre is null or univ = univ_autre or u_rec is null or u_coach is null
                or u_adm is null or c_rec is null or t_univ is null or t_cegep is null or t_coach is null) then
    raise exception 'NEXUS: un témoin manque';
  end if;
end $$;

-- ── Balayage des droits d'édition (comptes réels, avant / après) ─────────────
-- Pour chaque compte COACH, RECRUTEUR ou ADMIN : can_edit_school_page sur son école, can_edit_team_page sur chaque
-- équipe de son école et chaque équipe où il est coach. Jamais de nom, seulement des identifiants.
create function pg_temp.balayage() returns table (uid uuid, objet text, cible uuid, ok boolean) language plpgsql as $$
declare r record;
begin
  for r in select u.id, u.school_id from public.users u
            where u.role in ('COACH'::public.user_role, 'RECRUTEUR'::public.user_role, 'ADMIN'::public.user_role)
  loop
    perform set_config('request.jwt.claims', json_build_object('sub', r.id, 'role', 'authenticated')::text, true);
    if r.school_id is not null then
      uid := r.id; objet := 'école'; cible := r.school_id; ok := public.can_edit_school_page(r.school_id); return next;
    end if;
    return query
      select r.id, 'équipe'::text, x.id, public.can_edit_team_page(x.id)
        from (select t.id from public.teams t where t.school_id = r.school_id
              union select tc.team_id from public.team_coaches tc where tc.coach_id = r.id) x;
  end loop;
  perform set_config('request.jwt.claims', '', true);
end $$;
create temp table _avant on commit drop as select * from pg_temp.balayage();

-- ── La migration, texte gardé par son md5 ────────────────────────────────────
create temp table _d5a on commit drop as
select '@@VERSION@@'::text as version,
       $nexus_mig$@@MIGRATION@@$nexus_mig$::text as contenu,
       $nexus_rb$@@ROLLBACK@@$nexus_rb$::text as rollback;
do $apply$
begin
  if (select md5(contenu) from _d5a) <> '@@MD5_MIGRATION@@' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _d5a);
  end if;
  if (select md5(rollback) from _d5a) <> '@@MD5_ROLLBACK@@' then
    raise exception 'NEXUS: texte du rollback altéré (md5 %)', (select md5(rollback) from _d5a);
  end if;
  execute (select contenu from _d5a);
end $apply$;
set local search_path = public, extensions;

create temp table _apres on commit drop as select * from pg_temp.balayage();
select (select count(*) from _avant) as droits_releves,
       (select count(*) from _avant where ok) as droits_vrais_avant,
       (select count(*) from _apres where ok) as droits_vrais_apres,
       (select count(*) from _avant a join _apres p using (uid, objet, cible) where a.ok is distinct from p.ok) as droits_changes,
       (select count(*) from _avant a join _apres p using (uid, objet, cible)
         where a.ok is distinct from p.ok
           and not (a.cible = any (nexus_prive.ids_universites())
                    or a.cible in (select t.id from public.teams t where t.school_id = any (nexus_prive.ids_universites())))) as changes_hors_universites;

-- ── Essais ───────────────────────────────────────────────────────────────────
-- Recruteur universitaire témoin (compte neuf rattaché à « univ »). Chaque essai : interrupteur posé, appelant,
-- geste, résultat, puis tout est défait (NX000).
create function pg_temp.essai(p_on boolean, p_uid uuid, p_quoi text, p_id uuid) returns text language plpgsql as $$
declare v text; n int;
begin
  begin
    update public.app_settings set value = case when p_on then 'true' else 'false' end where key = 'lancement_universitaire';
    insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
    select '00000000-0000-0000-0000-000000000000', neuf, 'authenticated', 'authenticated', 'd5a-temoin@nexus.invalid',
           '{}', '{}', now(), now() from _t;
    update public.users u set role = 'RECRUTEUR'::public.user_role, context = 'universitaire', school_id = t.univ,
           primary_team_id = null, onboarding_complete = true, role_claimed_at = now()
      from _t t where u.id = t.neuf;
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    begin
      if p_quoi = 'page école' then
        v := case when public.can_edit_school_page(p_id) then 'oui' else 'non' end;
      elsif p_quoi = 'page équipe' then
        v := case when public.can_edit_team_page(p_id) then 'oui' else 'non' end;
      elsif p_quoi = 'écrire school_page_content' then
        insert into public.school_page_content (school_id) values (p_id)
          on conflict (school_id) do update set school_id = excluded.school_id;
        v := 'écrit';
      elsif p_quoi = 'créer une équipe' then
        insert into public.teams (school_id, sport_id, name) select p_id, sport, 'D5a essai' from _t;
        v := 'créée';
      elsif p_quoi = 'modifier une équipe' then
        update public.teams set name = name where id = p_id;
        get diagnostics n = row_count; v := n || ' modifiée(s)';
      elsif p_quoi = 'supprimer une équipe' then
        delete from public.teams where id = p_id;
        get diagnostics n = row_count; v := n || ' supprimée(s)';
      elsif p_quoi = 'déplacer son équipe vers l''université' then
        update public.teams set school_id = (select univ from _t) where id = p_id;
        get diagnostics n = row_count; v := n || ' déplacée(s)';
      end if;
    exception when insufficient_privilege or check_violation or with_check_option_violation then
      v := 'refusé ' || sqlstate;
    end;
    raise exception using errcode = 'NX000', message = v;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 70);
  end;
end $$;
create temp table _e on commit drop as
select o, interrupteur, appelant, geste, attendu, pg_temp.essai(interrupteur = 'ON', uid, geste, cible) as obtenu
  from (select x.*, row_number() over () as o from _t t, lateral (values
    ('OFF', 'recruteur universitaire', t.neuf,   'page école',                 t.univ,       'non'),
    ('OFF', 'recruteur universitaire', t.neuf,   'écrire school_page_content', t.univ,       'refusé 42501'),
    ('ON',  'recruteur universitaire', t.neuf,   'page école',                 t.univ,       'oui'),
    ('ON',  'recruteur universitaire', t.neuf,   'écrire school_page_content', t.univ,       'écrit'),
    ('ON',  'recruteur universitaire', t.neuf,   'page école',                 t.univ_autre, 'non'),
    ('ON',  'recruteur universitaire', t.neuf,   'page école',                 t.c_rec,      'non'),
    ('ON',  'recruteur universitaire', t.neuf,   'page équipe',                t.t_univ,     'non'),
    ('ON',  'recruteur universitaire', t.neuf,   'créer une équipe',           t.univ,       'refusé 42501'),
    ('ON',  'recruteur universitaire', t.neuf,   'modifier une équipe',        t.t_univ,     '0 modifiée(s)'),
    ('ON',  'recruteur universitaire', t.neuf,   'supprimer une équipe',       t.t_univ,     '0 supprimée(s)'),
    ('ON',  'recruteur collégial',     t.u_rec,  'page école',                 t.c_rec,      'oui'),
    ('OFF', 'recruteur collégial',     t.u_rec,  'page école',                 t.c_rec,      'oui'),
    ('ON',  'recruteur collégial',     t.u_rec,  'page équipe',                t.t_cegep,    'oui'),
    ('ON',  'recruteur collégial',     t.u_rec,  'page école',                 t.univ,       'non'),
    ('ON',  'recruteur collégial',     t.u_rec,  'écrire school_page_content', t.univ,       'refusé 42501'),
    ('ON',  'recruteur collégial',     t.u_rec,  'page équipe',                t.t_univ,     'non'),
    ('ON',  'recruteur collégial',     t.u_rec,  'déplacer son équipe vers l''université', t.t_cegep, 'refusé 42501'),
    ('ON',  'coach',                   t.u_coach,'page équipe',                t.t_coach,    'oui'),
    ('ON',  'coach',                   t.u_coach,'page équipe',                t.t_univ,     'non'),
    ('ON',  'admin',                   t.u_adm,  'page école',                 t.univ,       'oui'),
    ('ON',  'admin',                   t.u_adm,  'page équipe',                t.t_univ,     'oui'),
    ('OFF', 'admin',                   t.u_adm,  'écrire school_page_content', t.univ,       'écrit')
  ) x(interrupteur, appelant, uid, geste, cible, attendu)) e;
select o, interrupteur, appelant, geste, attendu, obtenu, case when obtenu = attendu then 'ok' else 'ÉCART' end as "?"
  from _e order by o;

do $$
begin
  if exists (select 1 from _e where obtenu like 'ERREUR%') then raise exception 'NEXUS: un essai a échoué'; end if;
  if exists (select 1 from _e where obtenu <> attendu) then raise exception 'NEXUS: % essai(s) hors attendu', (select count(*) from _e where obtenu <> attendu); end if;
  if exists (select 1 from _avant a join _apres p using (uid, objet, cible)
              where a.ok is distinct from p.ok
                and not (a.cible = any (nexus_prive.ids_universites())
                         or a.cible in (select t.id from public.teams t where t.school_id = any (nexus_prive.ids_universites())))) then
    raise exception 'NEXUS: un droit d''édition a changé hors universités';
  end if;
  if (select count(*) from _avant) <> (select count(*) from _apres) then raise exception 'NEXUS: balayage avant/après de tailles différentes'; end if;
  if public.lancement_universitaire_actif() is distinct from (select on_initial from _t) then
    raise exception 'NEXUS: l''interrupteur n''est pas revenu à son état initial';
  end if;
  if exists (select 1 from auth.users where id = (select neuf from _t)) then raise exception 'NEXUS: compte témoin resté'; end if;
  raise notice 'NEXUS: VERDICT D5a — page et équipes universitaires : admin, ou le recruteur universitaire de SA page sous ON ; rien ne change ailleurs';
end $$;
select 'VERDICT' as verdict, 'conforme' as resultat;
-- [[REJEU

do $rb$ begin execute (select rollback from _d5a); end $rb$;
do $$
begin
  if exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'teams' and policyname like 'universites_ecriture_admin_%') then
    raise exception 'NEXUS: après rollback, une policy D5a reste sur teams';
  end if;
  raise notice 'NEXUS: rollback D5a vérifié (corps d''origine par md5, policies retirées)';
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
select version, 'cegep_lot_d5a_ecriture_universites', array[contenu], 'bptds22@gmail.com' from _d5a;

insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_CEGEP_LOT_D5A',
       'Chantier cégep, lot D5a étape 1 : écriture des pages et équipes universitaires fermée (admin, ou le recruteur universitaire de sa page sous ON) (GO BP)',
       jsonb_build_object('nom', 'cegep_lot_d5a_ecriture_universites', 'version', version,
         'fichier', 'supabase/migrations/' || version || '_cegep_lot_d5a_ecriture_universites.sql',
         'rollback', 'supabase/rollback/' || version || '_rollback_cegep_lot_d5a_ecriture_universites.sql',
         'md5_fichier', '@@MD5_MIGRATION@@', 'md5_rollback', '@@MD5_ROLLBACK@@', 'voie', 'psql (session pooler)'),
       (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0')
  from _d5a;
do $$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '@@VERSION@@') then
    raise exception 'NEXUS: inscription schema_migrations absente';
  end if;
end $$;
select version as version_inscrite, clock_timestamp() as avant_commit from _d5a;
commit;
\echo '== COMMIT fait : lot D5a (étape 1) cégep en prod (écriture universitaire fermée, interrupteur OFF).'
-- APPLY]]
