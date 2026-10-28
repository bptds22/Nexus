-- ════════════════════════════════════════════════════════════════════════════
-- Lot D5a cégep (étape 1, faille d'écriture) — REJEU À BLANC (finit par ROLLBACK), version 20261028070000.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer.mjs <date> <rejeu-blanc|apply> d5a (migration et rollback
-- embarqués, LF, md5 gardés). Lancer SANS -1, en postgres.
--
-- UNE transaction : gardes → balayage AVANT (droits d'édition de chaque compte coach, recruteur et admin sur son
-- école et ses équipes) → migration → balayage APRÈS (comparé) → essais avec un recruteur universitaire témoin
-- (compte neuf), interrupteur OFF puis ON, chaque essai défait aussitôt → rollback D5A joué et vérifié → ROLLBACK. Aucun nom affiché.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '300s';
set local search_path = public, extensions;
set local application_name = 'nexus-rejeu-blanc-cegep-d5a';
select now() as debut, current_user, current_setting('server_version') as version;

do $$
declare v text;
begin
  if current_user <> 'postgres' then
    raise exception 'NEXUS: lancer en postgres, pas en %', current_user;
  end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '20261028070000') then
    raise exception 'NEXUS: version 20261028070000 déjà inscrite';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '20261028070000' then raise exception 'NEXUS: version 20261028070000 pas après la dernière (%) — régénérer', v; end if;
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
select '20261028070000'::text as version,
       $nexus_mig$-- Lot D5a cégep, étape 1 — fermer la faille d'écriture du recruteur rattaché à une université (décision BP
-- 2026-10-28 : « Ferme d'abord la faille d'écriture », avant la « Ma page » universitaire).
-- Aujourd'hui, can_edit_school_page / can_edit_team_page ne regardent ni le type d'école ni le contexte du compte,
-- et les policies d'écriture de teams ne regardent que school_id = current_user_school_id(). Un compte rattaché à
-- une université pourrait donc écrire la page de son université, ses pages d'équipes et ses équipes elles-mêmes.
-- Ce compte ne peut pas exister sous OFF (verrous D0, D2a) : la faille est latente, on la ferme avant d'ouvrir.
--   1. can_edit_school_page : pour une UNIVERSITÉ, l'admin plateforme, ou le recruteur universitaire de CETTE
--      université sous ON (nexus_prive.mon_universite(), D2a). Pour les autres écoles, rien ne change, sauf qu'un
--      compte au contexte universitaire n'y écrit jamais.
--   2. can_edit_team_page : une équipe universitaire n'est modifiable que par l'admin (Q5 : pages d'équipes
--      universitaires plus tard). Rien ne change pour les autres équipes.
--   3. teams : policies RESTRICTIVES d'écriture — insérer, modifier ou supprimer une équipe universitaire (ou
--      déplacer une équipe vers une université) est réservé à l'admin. Les équipes universitaires viennent des lots
--      D1 / D1b.
-- Les 11 policies (8 tables de page, 3 sur storage.objects) et les 5 RPC replace_* passent par ces deux fonctions :
-- elles suivent sans être touchées. Corps de départ gardés par leur md5 (prod = local, relevés le 2026-10-28).

do $garde$
begin
  if md5(pg_get_functiondef('public.can_edit_school_page(uuid)'::regprocedure)) <> '1443bedc4d195ffe5c136040456973c7'
     or md5(pg_get_functiondef('public.can_edit_team_page(uuid)'::regprocedure)) <> '4d2ec9960dc8ef39d8a6a71775dbf31a' then
    raise exception 'NEXUS: D5a — can_edit_school_page ou can_edit_team_page a changé depuis le relevé ; régénérer';
  end if;
  if to_regprocedure('nexus_prive.mon_universite()') is null or to_regprocedure('nexus_prive.ids_universites()') is null then
    raise exception 'NEXUS: D5a — préalables nexus_prive (D1a2, D2a) absents';
  end if;
end $garde$;

-- ── 1. Page d'école ──────────────────────────────────────────────────────────
create or replace function public.can_edit_school_page(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $function$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and (
        u.is_platform_admin
        or (
          u.school_id = p_school_id
          and u.role = 'RECRUTEUR'
          and (
            -- université : son recruteur universitaire, sous ON seulement
            p_school_id = nexus_prive.mon_universite()
            or (
              not (p_school_id = any (nexus_prive.ids_universites()))
              and u.context is distinct from 'universitaire'
            )
          )
        )
      )
  );
$function$;

-- ── 2. Page d'équipe ─────────────────────────────────────────────────────────
create or replace function public.can_edit_team_page(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $function$
  select exists (
    select 1
    from public.teams t
    join public.users u on u.id = auth.uid()
    where t.id = p_team_id
      and (
        u.is_platform_admin
        or (
          -- équipe universitaire : admin seulement (Q5, plus tard)
          not (t.school_id = any (nexus_prive.ids_universites()))
          and (
            (
              u.role = 'COACH'
              and exists (
                select 1 from public.team_coaches tc
                where tc.team_id = t.id and tc.coach_id = u.id
              )
            )
            or (
              u.school_id = t.school_id
              and (
                (u.role = 'COACH' and u.is_school_admin)
                or u.role = 'RECRUTEUR'
              )
            )
          )
        )
      )
  );
$function$;

-- ── 3. Équipes universitaires : écriture admin seulement ─────────────────────
create policy universites_ecriture_admin_insert on public.teams as restrictive for insert to public
  with check ((select public.is_admin()) or not (school_id = any ((select nexus_prive.ids_universites())::uuid[])));
create policy universites_ecriture_admin_update on public.teams as restrictive for update to public
  using ((select public.is_admin()) or not (school_id = any ((select nexus_prive.ids_universites())::uuid[])))
  with check ((select public.is_admin()) or not (school_id = any ((select nexus_prive.ids_universites())::uuid[])));
create policy universites_ecriture_admin_delete on public.teams as restrictive for delete to public
  using ((select public.is_admin()) or not (school_id = any ((select nexus_prive.ids_universites())::uuid[])));
$nexus_mig$::text as contenu,
       $nexus_rb$-- Rollback du lot D5a cégep, étape 1 : remet can_edit_school_page / can_edit_team_page dans leur corps du
-- 20260817030000 (sans palier) et retire les trois policies restrictives d'écriture de teams.
drop policy universites_ecriture_admin_insert on public.teams;
drop policy universites_ecriture_admin_update on public.teams;
drop policy universites_ecriture_admin_delete on public.teams;

CREATE OR REPLACE FUNCTION public.can_edit_school_page(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and (
        u.is_platform_admin
        or (
          u.school_id = p_school_id
          and u.role = 'RECRUTEUR'
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_edit_team_page(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
  select exists (
    select 1
    from public.teams t
    join public.users u on u.id = auth.uid()
    where t.id = p_team_id
      and (
        u.is_platform_admin
        or (
          u.role = 'COACH'
          and exists (
            select 1 from public.team_coaches tc
            where tc.team_id = t.id and tc.coach_id = u.id
          )
        )
        or (
          u.school_id = t.school_id
          and (
            (u.role = 'COACH' and u.is_school_admin)
            or u.role = 'RECRUTEUR'
          )
        )
      )
  );
$function$;

do $verif$
begin
  if md5(pg_get_functiondef('public.can_edit_school_page(uuid)'::regprocedure)) <> '1443bedc4d195ffe5c136040456973c7'
     or md5(pg_get_functiondef('public.can_edit_team_page(uuid)'::regprocedure)) <> '4d2ec9960dc8ef39d8a6a71775dbf31a' then
    raise exception 'NEXUS: rollback D5a — les corps remis ne retrouvent pas leur md5 d''origine';
  end if;
end $verif$;
$nexus_rb$::text as rollback;
do $apply$
begin
  if (select md5(contenu) from _d5a) <> '9cfa1f02122c643cb0eb87fe5a0904e8' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _d5a);
  end if;
  if (select md5(rollback) from _d5a) <> 'c8e432cc5e05bf204d9e8b91dfa5fbe0' then
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
