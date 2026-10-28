-- ════════════════════════════════════════════════════════════════════════════
-- Lot E1 cégep (le cégépien voit et cible les universités sous ON) — REJEU À BLANC (finit par ROLLBACK), version 20261028100000.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer.mjs <date> <rejeu-blanc|apply> e1 (migration et rollback
-- embarqués, LF, md5 gardés). Lancer SANS -1, en postgres.
--
-- UNE transaction : gardes → balayage AVANT (ce que lisent des comptes réels) → migration → balayage APRÈS sous OFF
-- (identique) → essais OFF / ON avec des comptes réels (cégépien, athlète du secondaire, coach, recruteur collégial,
-- partenaire, admin) et un recruteur universitaire témoin (compte neuf) ; chaque essai défait aussitôt (NX000)
-- → rollback E1 joué et vérifié → ROLLBACK. Aucun nom affiché.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '180s';
set local search_path = public, extensions;
set local application_name = 'nexus-rejeu-blanc-cegep-e1';
select now() as debut, current_user, current_setting('server_version') as version;

do $$
declare v text;
begin
  if current_user <> 'postgres' then raise exception 'NEXUS: lancer en postgres, pas en %', current_user; end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '20261028100000') then
    raise exception 'NEXUS: version 20261028100000 déjà inscrite';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '20261028100000' then raise exception 'NEXUS: version 20261028100000 pas après la dernière (%) — régénérer', v; end if;
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
select '20261028100000'::text as version,
       $nexus_mig$-- Lot E1 cégep — le cégépien voit et cible les universités, sous lancement_universitaire ON (retour du test de bout en
-- bout de BP, 2026-10-28 : A1, C1, C3 ; décision Q6 : tout sous l'interrupteur universitaire).
-- Sous OFF, rien ne change : les universités restent masquées à tous sauf l'admin (D1a), et personne ne peut les cibler.
--   1. nexus_prive.cegepien_sous_on() : interrupteur ON ET l'appelant est un compte ATHLETE dont la fiche est rattachée
--      à un CÉGEP (même règle que public.athlete_est_cegepien, lot A).
--   2. Lecture : les policies de masquage D1a (schools, teams) et la lecture des programmes universitaires (D5a)
--      s'ouvrent à ce seul lecteur ; une policy permissive lui rend les équipes universitaires (aucune policy
--      existante ne les montre à un athlète). Rien ne s'ouvre pour l'athlète du secondaire, le coach, le recruteur
--      collégial, le partenaire ni anon.
--   3. Écriture : athlete_targets refuse une université sauf pour le cégépien sous ON (ou l'admin) ; la table ne
--      contrôlait aucun type d'école jusqu'ici (0 cible universitaire en prod au 2026-10-28).
--   4. « Athlètes qui me ciblent » (A1) : athletes_targeting_my_cegep() rend déjà les cibles de l'école du recruteur,
--      universités comprises, et le recruteur universitaire voit les cégépiens sous ON (D3c) — rien à changer.
-- Policies de départ gardées par leur texte (relevé prod 2026-10-28) ; le rollback les remet à l'identique.

do $garde$
begin
  if (select regexp_replace(qual, '\s+', ' ', 'g') from pg_policies where schemaname = 'public' and tablename = 'schools' and policyname = 'universites_masquees')
       is distinct from '((type <> ''UNIVERSITE''::text) OR ( SELECT is_admin() AS is_admin) OR (id = ( SELECT nexus_prive.mon_universite() AS mon_universite)))'
     or (select regexp_replace(qual, '\s+', ' ', 'g') from pg_policies where schemaname = 'public' and tablename = 'teams' and policyname = 'universites_masquees')
       is distinct from '(( SELECT is_admin() AS is_admin) OR (NOT (school_id = ANY (( SELECT nexus_prive.ids_universites() AS ids_universites)::uuid[]))) OR (school_id = ( SELECT nexus_prive.mon_universite() AS mon_universite)))'
     or (select regexp_replace(qual, '\s+', ' ', 'g') from pg_policies where schemaname = 'public' and tablename = 'university_programs' and policyname = 'university_programs_read')
       is distinct from '(( SELECT is_admin() AS is_admin) OR (school_id = ( SELECT nexus_prive.mon_universite() AS mon_universite)))' then
    raise exception 'NEXUS: E1 — une policy de masquage a changé depuis le relevé ; régénérer';
  end if;
  if exists (select 1 from pg_trigger where tgrelid = 'public.athlete_targets'::regclass and not tgisinternal) then
    raise exception 'NEXUS: E1 — athlete_targets a déjà un déclencheur ; relire';
  end if;
end $garde$;

-- ── 1. Le lecteur cégépien sous ON ───────────────────────────────────────────
create function nexus_prive.cegepien_sous_on() returns boolean
  language sql stable security definer set search_path = public set row_security = off
as $function$
  select public.lancement_universitaire_actif()
     and exists (select 1 from public.users u
                   join public.athletes a on a.user_id = u.id
                   join public.schools s on s.id = a.school_id
                  where u.id = auth.uid() and u.role = 'ATHLETE'::public.user_role and s.type = 'CEGEP');
$function$;
revoke all on function nexus_prive.cegepien_sous_on() from public;
grant execute on function nexus_prive.cegepien_sous_on() to anon, authenticated, service_role;

-- ── 2. Lecture ───────────────────────────────────────────────────────────────
alter policy universites_masquees on public.schools
  using ((type <> 'UNIVERSITE'::text) or (select public.is_admin()) or (id = (select nexus_prive.mon_universite()))
         or (select nexus_prive.cegepien_sous_on()));
alter policy universites_masquees on public.teams
  using ((select public.is_admin()) or (not (school_id = any ((select nexus_prive.ids_universites())::uuid[])))
         or (school_id = (select nexus_prive.mon_universite())) or (select nexus_prive.cegepien_sous_on()));
create policy universites_lisibles_cegepiens on public.teams for select to authenticated
  using ((select nexus_prive.cegepien_sous_on()) and school_id = any ((select nexus_prive.ids_universites())::uuid[]));
alter policy university_programs_read on public.university_programs
  using ((select public.is_admin()) or (school_id = (select nexus_prive.mon_universite())) or (select nexus_prive.cegepien_sous_on()));

-- ── 3. Écriture des cibles ───────────────────────────────────────────────────
create function nexus_prive.cible_universite_permise() returns trigger
  language plpgsql security definer set search_path = public set row_security = off
as $function$
begin
  -- Écritures serveur (clé service, imports) : pas d'utilisateur, pas de règle de rôle.
  if auth.uid() is null then return new; end if;
  if not exists (select 1 from public.schools s where s.id = new.school_id and s.type = 'UNIVERSITE') then return new; end if;
  if public.is_admin() then return new; end if;
  if not public.lancement_universitaire_actif() then
    raise exception 'NEXUS: Les universités ne sont pas encore ouvertes sur Nexus. Ça arrive bientôt.' using errcode = '42501';
  end if;
  if not public.athlete_est_cegepien(new.athlete_id) then
    raise exception 'NEXUS: Seuls les athlètes collégiaux peuvent cibler une université.' using errcode = '42501';
  end if;
  return new;
end $function$;
revoke all on function nexus_prive.cible_universite_permise() from public, anon, authenticated;
create trigger athlete_targets_universite before insert or update of school_id, athlete_id on public.athlete_targets
  for each row execute function nexus_prive.cible_universite_permise();
$nexus_mig$::text as contenu,
       $nexus_rb$-- Rollback du lot E1 cégep : remet les policies de masquage D1a / D5a dans leur texte d'origine, retire la lecture
-- des équipes universitaires par le cégépien et le contrôle des cibles universitaires.
-- À jouer avant toute cible universitaire réelle (sinon les compter d'abord).
drop trigger athlete_targets_universite on public.athlete_targets;
drop function nexus_prive.cible_universite_permise();
drop policy universites_lisibles_cegepiens on public.teams;
alter policy universites_masquees on public.schools
  using ((type <> 'UNIVERSITE'::text) or (select public.is_admin()) or (id = (select nexus_prive.mon_universite())));
alter policy universites_masquees on public.teams
  using ((select public.is_admin()) or (not (school_id = any ((select nexus_prive.ids_universites())::uuid[])))
         or (school_id = (select nexus_prive.mon_universite())));
alter policy university_programs_read on public.university_programs
  using ((select public.is_admin()) or (school_id = (select nexus_prive.mon_universite())));
drop function nexus_prive.cegepien_sous_on();
$nexus_rb$::text as rollback;
do $apply$
begin
  if (select md5(contenu) from _e1) <> '38c5ef64e6324cdde8de03a131215509' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _e1);
  end if;
  if (select md5(rollback) from _e1) <> '338b155ec48603944139b651cc96c8dd' then
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
