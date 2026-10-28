-- ════════════════════════════════════════════════════════════════════════════
-- Lot E2 cégep (pages d'équipes universitaires) — APPLY RÉEL EN PROD (sur GO BP seulement, après le rejeu à blanc), version 20261028140000.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer.mjs <date> <rejeu-blanc|apply> e2 (migration et rollback
-- embarqués, LF, md5 gardés). Lancer SANS -1, en postgres.
--
-- UNE transaction : gardes → balayage AVANT (droit d'édition de chaque compte coach, recruteur et admin réel sur
-- les équipes de son école et celles où il est coach) → migration → balayage APRÈS (comparé) → essais OFF / ON avec
-- un recruteur universitaire témoin (compte neuf) → inscription (schema_migrations + admin_operations) → COMMIT. Chaque essai défait aussitôt (NX000). Aucun nom affiché.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '300s';
set local search_path = public, extensions;
set local application_name = 'nexus-apply-cegep-e2';
select now() as debut, current_user, current_setting('server_version') as version;

do $$
declare v text;
begin
  if current_user <> 'postgres' then raise exception 'NEXUS: lancer en postgres, pas en %', current_user; end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '20261028140000') then
    raise exception 'NEXUS: version 20261028140000 déjà inscrite';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '20261028140000' then raise exception 'NEXUS: version 20261028140000 pas après la dernière (%) — régénérer', v; end if;
  if exists (select 1 from public.admin_operations where operation in ('MIGRATION_CEGEP_LOT_E2', 'ROLLBACK_CEGEP_LOT_E2')) then
    raise exception 'NEXUS: le lot E2 a déjà laissé une trace dans admin_operations';
  end if;
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261028070000') then
    raise exception 'NEXUS: préalable D5a étape 1 absent';
  end if;
end $$;
select max(version) as derniere_version, public.lancement_universitaire_actif() as interrupteur_on
  from supabase_migrations.schema_migrations;

-- ── Témoins (identifiants seulement) ─────────────────────────────────────────
create temp table _t on commit drop as
select (select s.id from public.schools s where s.type = 'UNIVERSITE' and exists (select 1 from public.teams t where t.school_id = s.id)
         order by s.name limit 1) as univ,
       (select s.id from public.schools s where s.type = 'UNIVERSITE' and exists (select 1 from public.teams t where t.school_id = s.id)
         order by s.name desc limit 1) as univ_autre,
       (select u.id from public.users u join public.schools s on s.id = u.school_id and s.type = 'CEGEP'
         where u.role = 'RECRUTEUR'::public.user_role and u.context is distinct from 'universitaire'
           and exists (select 1 from public.teams t where t.school_id = s.id) order by u.id limit 1) as u_rec,
       (select tc.coach_id from public.team_coaches tc join public.users u on u.id = tc.coach_id
         where u.role = 'COACH'::public.user_role order by tc.coach_id, tc.team_id limit 1) as u_coach,
       (select u.id from public.users u where u.role = 'ADMIN'::public.user_role and u.is_platform_admin order by u.id limit 1) as u_adm,
       '00000000-0000-4000-8000-0000000e2001'::uuid as neuf,
       public.lancement_universitaire_actif() as on_initial;
alter table _t add column t_univ uuid, add column t_univ_autre uuid, add column t_cegep uuid, add column t_coach uuid;
update _t set t_univ = (select t.id from public.teams t where t.school_id = univ order by t.id limit 1),
              t_univ_autre = (select t.id from public.teams t where t.school_id = univ_autre order by t.id limit 1),
              t_cegep = (select t.id from public.teams t where t.school_id = (select school_id from public.users where id = u_rec) order by t.id limit 1),
              t_coach = (select tc.team_id from public.team_coaches tc where tc.coach_id = u_coach order by tc.team_id limit 1);
do $$
begin
  if exists (select 1 from _t where univ is null or univ_autre is null or univ = univ_autre or u_rec is null or u_coach is null
                or u_adm is null or t_univ is null or t_univ_autre is null or t_cegep is null or t_coach is null) then
    raise exception 'NEXUS: un témoin manque';
  end if;
end $$;

-- ── Balayage des droits d'édition d'équipe (comptes réels, avant / après) ────
create function pg_temp.balayage() returns table (uid uuid, cible uuid, ok boolean) language plpgsql as $$
declare r record;
begin
  for r in select u.id, u.school_id from public.users u
            where u.role in ('COACH'::public.user_role, 'RECRUTEUR'::public.user_role, 'ADMIN'::public.user_role)
  loop
    perform set_config('request.jwt.claims', json_build_object('sub', r.id, 'role', 'authenticated')::text, true);
    return query
      select r.id, x.id, public.can_edit_team_page(x.id)
        from (select t.id from public.teams t where t.school_id = r.school_id
              union select tc.team_id from public.team_coaches tc where tc.coach_id = r.id
              union select (select t_univ from _t)) x;
  end loop;
  perform set_config('request.jwt.claims', '', true);
end $$;
create temp table _avant on commit drop as select * from pg_temp.balayage();

-- ── La migration, texte gardé par son md5 ────────────────────────────────────
create temp table _e2 on commit drop as
select '20261028140000'::text as version,
       $nexus_mig$-- Lot E2 cégep — pages d'équipes universitaires (retour du test de bout en bout de BP, 2026-10-28 : A2 ; Q3 : le
-- recruteur universitaire de l'université + l'admin). Même modèle que les cégeps : en-tête et présentation
-- (team_page_content), fanions (team_pennants), calendrier et camps (team_events), besoins par poste
-- (team_position_needs) — tous écrits sous can_edit_team_page, par policy ou par les RPC replace_team_*.
-- D5a étape 1 réservait l'équipe universitaire à l'admin. Ici, une seule branche s'ajoute : un compte RECRUTEUR dont
-- nexus_prive.mon_universite() (contexte universitaire, interrupteur ON, D2a) est l'école de l'équipe.
-- Sous OFF, mon_universite() est nulle pour tout le monde : rien ne change. Aucune autre branche ne bouge (coachs,
-- directeurs et recruteurs collégiaux de leur école ; jamais une équipe universitaire). Corps de départ gardé par md5.

do $garde$
begin
  if md5(pg_get_functiondef('public.can_edit_team_page(uuid)'::regprocedure)) <> 'db8b25c92c4cc274b3ec1a8d18c1ac48' then
    raise exception 'NEXUS: E2 — can_edit_team_page a changé depuis le relevé (D5a) ; régénérer';
  end if;
end $garde$;

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
        -- équipe universitaire : le recruteur universitaire de CETTE université, sous ON (lot E2, Q3)
        or (
          u.role = 'RECRUTEUR'
          and t.school_id = nexus_prive.mon_universite()
        )
        or (
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
$nexus_mig$::text as contenu,
       $nexus_rb$-- Rollback du lot E2 cégep : remet can_edit_team_page dans son corps du lot D5a étape 1 (équipe universitaire :
-- admin seulement), vérifié par md5.
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

do $verif$
begin
  if md5(pg_get_functiondef('public.can_edit_team_page(uuid)'::regprocedure)) <> 'db8b25c92c4cc274b3ec1a8d18c1ac48' then
    raise exception 'NEXUS: rollback E2 — le corps remis ne retrouve pas son md5 (D5a)';
  end if;
end $verif$;
$nexus_rb$::text as rollback;
do $apply$
begin
  if (select md5(contenu) from _e2) <> 'd429c032f3f8d03e4d0ff90e9df5c54a' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _e2);
  end if;
  if (select md5(rollback) from _e2) <> '318547ae26166ded40a6af139443fc36' then
    raise exception 'NEXUS: texte du rollback altéré (md5 %)', (select md5(rollback) from _e2);
  end if;
  execute (select contenu from _e2);
end $apply$;
set local search_path = public, extensions;

create temp table _apres on commit drop as select * from pg_temp.balayage();
select (select count(*) from _avant) as droits_releves, (select count(*) from _avant where ok) as vrais_avant,
       (select count(*) from _apres where ok) as vrais_apres,
       (select count(*) from _avant a join _apres p using (uid, cible) where a.ok is distinct from p.ok) as droits_changes;

-- ── Essais ───────────────────────────────────────────────────────────────────
create function pg_temp.essai(p_on boolean, p_uid uuid, p_quoi text, p_id uuid) returns text language plpgsql as $$
declare v text;
begin
  begin
    update public.app_settings set value = case when p_on then 'true' else 'false' end where key = 'lancement_universitaire';
    insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
    select '00000000-0000-0000-0000-000000000000', neuf, 'authenticated', 'authenticated', 'e2-temoin@nexus.invalid',
           '{}', '{}', now(), now() from _t;
    update public.users u set role = 'RECRUTEUR'::public.user_role, context = 'universitaire', school_id = t.univ,
           primary_team_id = null, onboarding_complete = true, role_claimed_at = now()
      from _t t where u.id = t.neuf;
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    begin
      if p_quoi = 'page équipe' then
        v := case when public.can_edit_team_page(p_id) then 'oui' else 'non' end;
      elsif p_quoi = 'écrire team_page_content' then
        insert into public.team_page_content (team_id) values (p_id) on conflict (team_id) do update set team_id = excluded.team_id;
        v := 'écrit';
      elsif p_quoi = 'page école' then
        v := case when public.can_edit_school_page(p_id) then 'oui' else 'non' end;
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
    ('OFF', 'recruteur universitaire', t.neuf,    'page équipe',              t.t_univ,       'non'),
    ('OFF', 'recruteur universitaire', t.neuf,    'écrire team_page_content', t.t_univ,       'refusé 42501'),
    ('ON',  'recruteur universitaire', t.neuf,    'page équipe',              t.t_univ,       'oui'),
    ('ON',  'recruteur universitaire', t.neuf,    'écrire team_page_content', t.t_univ,       'écrit'),
    ('ON',  'recruteur universitaire', t.neuf,    'page équipe',              t.t_univ_autre, 'non'),
    ('ON',  'recruteur universitaire', t.neuf,    'écrire team_page_content', t.t_univ_autre, 'refusé 42501'),
    ('ON',  'recruteur universitaire', t.neuf,    'page équipe',              t.t_cegep,      'non'),
    ('ON',  'recruteur universitaire', t.neuf,    'page école',               t.univ,         'oui'),
    ('ON',  'recruteur collégial',     t.u_rec,   'page équipe',              t.t_univ,       'non'),
    ('ON',  'recruteur collégial',     t.u_rec,   'écrire team_page_content', t.t_univ,       'refusé 42501'),
    ('ON',  'recruteur collégial',     t.u_rec,   'page équipe',              t.t_cegep,      'oui'),
    ('ON',  'coach',                   t.u_coach, 'page équipe',              t.t_coach,      'oui'),
    ('ON',  'coach',                   t.u_coach, 'page équipe',              t.t_univ,       'non'),
    ('OFF', 'admin',                   t.u_adm,   'page équipe',              t.t_univ,       'oui'),
    ('OFF', 'admin',                   t.u_adm,   'écrire team_page_content', t.t_univ,       'écrit')
  ) x(interrupteur, appelant, uid, geste, cible, attendu)) e;
select o, interrupteur, appelant, geste, attendu, obtenu, case when obtenu = attendu then 'ok' else 'ÉCART' end as "?"
  from _e order by o;

do $$
begin
  if exists (select 1 from _e where obtenu like 'ERREUR%') then raise exception 'NEXUS: un essai a échoué'; end if;
  if exists (select 1 from _e where obtenu <> attendu) then raise exception 'NEXUS: % essai(s) hors attendu', (select count(*) from _e where obtenu <> attendu); end if;
  if (select count(*) from _avant) <> (select count(*) from _apres) then raise exception 'NEXUS: balayage avant/après de tailles différentes'; end if;
  if not (select on_initial from _t) and exists (select 1 from _avant a join _apres p using (uid, cible) where a.ok is distinct from p.ok) then
    raise exception 'NEXUS: sous OFF, un droit d''édition d''équipe a changé';
  end if;
  if public.lancement_universitaire_actif() is distinct from (select on_initial from _t) then
    raise exception 'NEXUS: l''interrupteur n''est pas revenu à son état initial';
  end if;
  if exists (select 1 from auth.users where id = (select neuf from _t)) then raise exception 'NEXUS: compte témoin resté'; end if;
  raise notice 'NEXUS: VERDICT E2 — équipe universitaire : admin, ou le recruteur universitaire de SON université sous ON ; rien ne change ailleurs';
end $$;
select 'VERDICT' as verdict, 'conforme' as resultat;

do $$
begin
  if public.lancement_universitaire_actif() then raise exception 'NEXUS: l''interrupteur doit rester OFF'; end if;
end $$;
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'cegep_lot_e2_pages_equipes_universitaires', array[contenu], 'bptds22@gmail.com' from _e2;
insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_CEGEP_LOT_E2',
       'Chantier cégep, lot E2 : pages d''équipes universitaires éditables par le recruteur universitaire de l''université sous ON, et l''admin (GO BP)',
       jsonb_build_object('nom', 'cegep_lot_e2_pages_equipes_universitaires', 'version', version,
         'fichier', 'supabase/migrations/' || version || '_cegep_lot_e2_pages_equipes_universitaires.sql',
         'rollback', 'supabase/rollback/' || version || '_rollback_cegep_lot_e2_pages_equipes_universitaires.sql',
         'md5_fichier', 'd429c032f3f8d03e4d0ff90e9df5c54a', 'md5_rollback', '318547ae26166ded40a6af139443fc36', 'voie', 'psql (session pooler)'),
       (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0')
  from _e2;
do $$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261028140000') then
    raise exception 'NEXUS: inscription schema_migrations absente';
  end if;
end $$;
select version as version_inscrite, clock_timestamp() as avant_commit from _e2;
commit;
\echo '== COMMIT fait : lot E2 cégep en prod (pages d''équipes universitaires sous ON, interrupteur OFF).'
