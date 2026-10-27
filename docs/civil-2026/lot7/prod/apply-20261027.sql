-- ════════════════════════════════════════════════════════════════════════════
-- Lot 7 civil — APPLY RÉEL EN PROD, version 20261027150000 (interrupteur lancement_civil = false + verrou).
-- À lancer SEULEMENT sur GO BP, après le rejeu à blanc. Fichier GÉNÉRÉ par
-- scripts/civil-2026/lot7_prod.sh <date> apply : la migration y est embarquée telle quelle (LF), md5 gardé.
--
-- UNE transaction : gardes AVANT → inscription normale témoin AVANT (défaite aussitôt) → migration →
-- même inscription APRÈS (OFF), identique → inscription (schema_migrations + admin_operations
-- MIGRATION_CIVIL_LOT7_LANCEMENT) → COMMIT. Toute garde qui échoue arrête psql AVANT le COMMIT.
-- Lancer SANS -1, en postgres. Rollback : docs/civil-2026/lot7/prod/rollback-<date>.sql (sur GO).
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-apply-civil-lot7';
select now() as debut, current_user, current_setting('server_version') as version;

-- ── 0. Gardes AVANT ──────────────────────────────────────────────────────────
do $$
declare v text;
begin
  if current_user <> 'postgres' then
    raise exception 'NEXUS: lancer en postgres, pas en %', current_user;
  end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '20261027150000') then
    raise exception 'NEXUS: version 20261027150000 déjà inscrite';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '20261027150000' then raise exception 'NEXUS: version 20261027150000 pas après la dernière (%) — régénérer', v; end if;
  if exists (select 1 from public.admin_operations where operation in ('MIGRATION_CIVIL_LOT7_LANCEMENT', 'ROLLBACK_CIVIL_LOT7_LANCEMENT')) then
    raise exception 'NEXUS: le lot 7 civil a déjà laissé une trace dans admin_operations';
  end if;
end $$;

-- Témoins (aucun nom affiché) : mêmes règles que le rejeu à blanc.
create temp table _t on commit drop as
with a as (
  select a.id as athlete, t.id as equipe
    from public.athletes a
    join public.teams t on t.school_id = a.school_id and t.sport_id = a.sport_id and t.is_active
   where a.status = 'ACTIF'
     and not exists (select 1 from public.team_athletes ta where ta.athlete_id = a.id)
     and not exists (select 1 from public.equipes_sources e where e.team_id = t.id)
   order by a.id, t.id limit 1),
c as (
  -- Une équipe de SON école d'abord ; à défaut, une équipe active d'une école ouverte aux coachs.
  select u.id as coach, t.id as equipe
    from public.users u
    join public.teams t on t.is_active
    join public.schools s on s.id = t.school_id and s.type::text in ('SECONDAIRE', 'LIGUE_CIVILE')
   where u.role = 'COACH'::public.user_role and u.school_id is not null
     and not exists (select 1 from public.team_coaches tc where tc.coach_id = u.id and tc.team_id = t.id)
     and not exists (select 1 from public.equipes_sources e where e.team_id = t.id)
   order by (t.school_id = u.school_id) desc, u.id, t.id limit 1)
select (select athlete from a) as a_athlete, (select equipe from a) as a_equipe,
       (select coach from c) as c_coach, (select equipe from c) as c_equipe;

create function pg_temp.essai(p_sql text) returns text language plpgsql as $$
begin
  begin
    execute p_sql;
    raise exception using errcode = 'NX000', message = 'accepté';
  exception
    when sqlstate 'NX000' then return 'accepté';
    when others then return 'REFUSÉ ' || sqlstate || ' ' || left(sqlerrm, 140);
  end;
end $$;
create function pg_temp.deux() returns text language sql as $$
  select pg_temp.essai(format('insert into public.team_athletes (team_id, athlete_id) values (%L, %L)', a_equipe, a_athlete))
         || ' | ' ||
         pg_temp.essai(format('insert into public.team_coaches (team_id, coach_id, role) values (%L, %L, %L)', c_equipe, c_coach, 'assistant'))
    from _t;
$$;
create temp table _avant on commit drop as select pg_temp.deux() as resultat;
select 'AVANT' as phase, resultat from _avant;

-- ── 1. La migration, texte gardé par son md5 ─────────────────────────────────
create temp table _lot7 on commit drop as
select '20261027150000'::text as version, $nexus_mig$-- 20261027150000_civil_lot7_lancement
--
-- NON APPLIQUÉE EN PROD. Import civil soccer / futsal / basket 2026-27, LOT 7 : l'interrupteur
-- de lancement et le verrou en base (décisions BP 2026-10-27, points 1 et 3).
-- Rollback : supabase/rollback/20261027150000_rollback_civil_lot7_lancement.sql
-- Plan des lots : docs/civil-2026/LISEZMOI.md
--
-- ── POURQUOI ─────────────────────────────────────────────────────────────────
-- Les lots 3 à 5 (équipes et matchs importés) partent en prod le jour du lancement, juste
-- avant de passer l'interrupteur à ON (décision 4, pas de masque RLS). Entre les deux, et à
-- tout moment où l'interrupteur serait remis à OFF, personne ne doit pouvoir rejoindre une
-- équipe importée, quel que soit le chemin (onboarding web ou mobile, code d'adhésion,
-- invitation, ajout par un coach, transfert, PATCH direct).
--
-- ── CE QUE FAIT LE LOT ───────────────────────────────────────────────────────
--   1. app_settings « lancement_civil » = 'false' (BOOLEAN). Lu par le web via
--      lib/config/lancementCivil.ts (OFF si absent ou en erreur), éditable dans /admin/settings.
--   2. lancement_civil_actif() : vrai seulement si la valeur vaut 'true' (casse et espaces
--      ignorés). Absente, vide ou illisible → faux.
--   3. verrou_lancement_civil() : trigger BEFORE sur team_athletes et team_coaches
--      (INSERT, UPDATE OF team_id). Refuse d'y FAIRE ENTRER une équipe importée (une ligne dans
--      equipes_sources) tant que l'interrupteur est OFF. Une ligne existante qui ne change pas
--      d'équipe passe telle quelle ; une équipe créée dans l'appli n'est jamais concernée.
--
-- Aucune policy, aucune table, aucune colonne ne change.

-- ── GARDES D'AVANT ───────────────────────────────────────────────────────────
do $garde$
begin
  if exists (select 1 from public.app_settings where key = 'lancement_civil') then
    raise exception 'NEXUS: app_settings lancement_civil existe déjà';
  end if;
  if to_regprocedure('public.lancement_civil_actif()') is not null
     or to_regprocedure('public.verrou_lancement_civil()') is not null then
    raise exception 'NEXUS: 20261027150000 déjà appliquée';
  end if;
  if to_regclass('public.equipes_sources') is null then
    raise exception 'NEXUS: préalable lot 1 (equipes_sources) absent';
  end if;
  if exists (select 1 from pg_trigger where tgname = 'trg_verrou_lancement_civil') then
    raise exception 'NEXUS: trigger trg_verrou_lancement_civil déjà présent';
  end if;
end $garde$;

-- ── 1. L'interrupteur ────────────────────────────────────────────────────────
insert into public.app_settings (key, value, type, description) values
  ('lancement_civil', 'false', 'BOOLEAN',
   'Lancement civil soccer / futsal / basket. false = équipes civiles importées impossibles à rejoindre (verrou en base) et destinations 18+ masquées dans Trouve ton cégep. Passer à true le jour du lancement, APRÈS les lots 3 à 5.');

-- ── 2. La lecture de l'interrupteur ──────────────────────────────────────────
create function public.lancement_civil_actif()
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select coalesce((select lower(btrim(value)) = 'true' from public.app_settings where key = 'lancement_civil'), false);
$function$;

comment on function public.lancement_civil_actif() is
  'Lot 7 civil : vrai seulement si app_settings.lancement_civil vaut true. Absente ou illisible → faux.';

-- ── 3. Le verrou ─────────────────────────────────────────────────────────────
create function public.verrou_lancement_civil()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  -- Seule l'écriture qui FAIT ENTRER dans une équipe est regardée.
  if tg_op = 'UPDATE' and old.team_id is not distinct from new.team_id then
    return new;
  end if;
  if new.team_id is not null
     and exists (select 1 from public.equipes_sources e where e.team_id = new.team_id)
     and not public.lancement_civil_actif() then
    raise exception 'NEXUS: Cette équipe sera ouverte au lancement des ligues civiles sur Nexus. Réessaie bientôt.'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

comment on function public.verrou_lancement_civil() is
  'Lot 7 civil : refuse de rejoindre une équipe importée (equipes_sources) tant que lancement_civil est OFF. Trigger BEFORE sur team_athletes et team_coaches.';

create trigger trg_verrou_lancement_civil
  before insert or update of team_id on public.team_athletes
  for each row execute function public.verrou_lancement_civil();
create trigger trg_verrou_lancement_civil
  before insert or update of team_id on public.team_coaches
  for each row execute function public.verrou_lancement_civil();

revoke all on function public.lancement_civil_actif() from public, anon;
grant execute on function public.lancement_civil_actif() to authenticated, service_role;
revoke all on function public.verrou_lancement_civil() from public, anon, authenticated;
grant execute on function public.verrou_lancement_civil() to service_role;

-- ── GARDES D'APRÈS ───────────────────────────────────────────────────────────
do $garde$
declare
  r    record;
  vus  text[];
begin
  if (select value || '|' || type from public.app_settings where key = 'lancement_civil') is distinct from 'false|BOOLEAN' then
    raise exception 'NEXUS: lancement_civil inattendu';
  end if;
  if public.lancement_civil_actif() then
    raise exception 'NEXUS: l''interrupteur lit ON après l''insertion';
  end if;
  -- ACL : liste COMPLÈTE triée des bénéficiaires, jamais par inclusion
  for r in select * from (values
      ('public.lancement_civil_actif()',  array['authenticated', 'postgres', 'service_role']),
      ('public.verrou_lancement_civil()', array['postgres', 'service_role'])) as t(sig, acl) loop
    select array_agg(distinct g order by g) into vus
      from pg_proc pr,
           lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                      from unnest(pr.proacl::text[]) as x) a
     where pr.oid = r.sig::regprocedure;
    if vus is distinct from r.acl then
      raise exception 'NEXUS: ACL de % = %, attendu %', r.sig, vus, r.acl;
    end if;
  end loop;
  if (select count(*) from pg_trigger where tgname = 'trg_verrou_lancement_civil' and tgenabled = 'O'
         and tgrelid in ('public.team_athletes'::regclass, 'public.team_coaches'::regclass)) <> 2 then
    raise exception 'NEXUS: les deux triggers du verrou ne sont pas en place';
  end if;
  raise notice 'NEXUS: lot 7 civil — interrupteur OFF, verrou en place (% équipes importées verrouillées)',
    (select count(distinct team_id) from public.equipes_sources);
end $garde$;
$nexus_mig$::text as contenu;

select clock_timestamp() as debut_migration;
do $apply$
begin
  if (select md5(contenu) from _lot7) <> '114f1359354a921686dcddb29e194bb1' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _lot7);
  end if;
  execute (select contenu from _lot7);
end $apply$;
select clock_timestamp() as fin_migration;
set local search_path = public, extensions;

-- ── 2. Gardes APRÈS : interrupteur OFF, inscriptions normales identiques ─────
do $$
begin
  if public.lancement_civil_actif() then
    raise exception 'NEXUS: l''interrupteur lit ON';
  end if;
  if (select pg_temp.deux()) is distinct from (select resultat from _avant) then
    raise exception 'NEXUS: une inscription normale change de résultat après la migration : % → %',
      (select resultat from _avant), (select pg_temp.deux());
  end if;
end $$;
select 'APRÈS (OFF)' as phase, pg_temp.deux() as resultat;

-- ── 3. Inscription ───────────────────────────────────────────────────────────
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'civil_lot7_lancement', array[contenu], 'bptds22@gmail.com' from _lot7;

insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_CIVIL_LOT7_LANCEMENT',
       'Import civil 2026-27, lot 7 : interrupteur app_settings lancement_civil (false) et verrou en base (rejoindre une équipe importée refusé tant qu''il est OFF) (GO BP 2026-10-27)',
       jsonb_build_object(
         'nom', 'civil_lot7_lancement',
         'version', version,
         'fichier', 'supabase/migrations/' || version || '_civil_lot7_lancement.sql',
         'rollback', 'supabase/rollback/' || version || '_rollback_civil_lot7_lancement.sql',
         'md5_fichier', '114f1359354a921686dcddb29e194bb1',
         'md5_rollback', '341ac6212860cc824e374204f4308e51',
         'equipes_importees_verrouillees', (select count(distinct team_id) from public.equipes_sources),
         'voie', 'psql (session pooler)'),
       (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0')  -- BP ; NULL hors prod
  from _lot7;

do $$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations
                  where version = '20261027150000' and name = 'civil_lot7_lancement') then
    raise exception 'NEXUS: inscription schema_migrations absente';
  end if;
  if (select count(*) from public.admin_operations where operation = 'MIGRATION_CIVIL_LOT7_LANCEMENT') <> 1 then
    raise exception 'NEXUS: ligne admin_operations MIGRATION_CIVIL_LOT7_LANCEMENT absente ou en double';
  end if;
end $$;

select version as version_inscrite,
       (select value from public.app_settings where key = 'lancement_civil') as interrupteur,
       clock_timestamp() as avant_commit
  from _lot7;
commit;
\echo '== COMMIT fait : lot 7 civil en prod (interrupteur OFF).'
