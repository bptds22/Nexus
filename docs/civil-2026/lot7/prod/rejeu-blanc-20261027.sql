-- ════════════════════════════════════════════════════════════════════════════
-- Lot 7 civil — REJEU À BLANC EN PROD de la migration 20261027150000 (interrupteur lancement_civil +
-- verrou). Fichier GÉNÉRÉ par scripts/civil-2026/lot7_prod.sh <date> rejeu-blanc : la migration et le
-- rollback y sont embarqués tels quels (fins de ligne LF), md5 gardés.
--
-- UNE transaction qui finit par ROLLBACK : RIEN n'est appliqué.
--   A. Témoins pris en prod (aucun nom affiché ; jamais une équipe importée) : un athlète sans équipe et une équipe active de son
--      école et de son sport ; un athlète déjà dans une équipe et une autre équipe active de son école et
--      de son sport (transfert) ; un coach et une équipe active de son école où il n'est pas.
--   B. Les trois inscriptions normales AVANT la migration (chacune défaite aussitôt).
--   C. La migration (md5 gardé ; elle vérifie elle-même ses gardes).
--   D. Les mêmes inscriptions APRÈS, interrupteur OFF : elles doivent donner exactement le même résultat.
--   E. Le verrou : les trois équipes marquées « importées » (lignes temporaires dans equipes_sources) →
--      refus NEXUS sous OFF ; acceptées sous ON.
--   G. Une cible sur un club civil n'apparaît chez aucun recruteur (athletes_targeting_my_cegep, vrai JWT).
--   F. Le rollback (md5 gardé), puis vérification qu'il ne reste rien.
--   ROLLBACK, puis relecture hors transaction : rien n'est resté, aucune notification ni appel réseau.
-- Les inscriptions passent en postgres, par DML direct : le verrou est un trigger, il se déclenche
-- quel que soit le chemin (RPC, PostgREST, coach). La RLS n'est pas touchée par la migration.
-- Lancer SANS -1 (le fichier ouvre et annule sa propre transaction), en postgres.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

-- Relevé hors transaction (comparé à la fin) : file pg_net et notifications.
create temp table _hors (cle text primary key, n bigint);
insert into _hors values
  ('net.http_request_queue', (select count(*) from net.http_request_queue)),
  ('athlete_notifications', (select count(*) from public.athlete_notifications)),
  ('team_athletes', (select count(*) from public.team_athletes)),
  ('team_coaches', (select count(*) from public.team_coaches)),
  ('athlete_targets', (select count(*) from public.athlete_targets));

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-rejeu-blanc-civil-lot7';
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
end $$;

-- ── A. Témoins ───────────────────────────────────────────────────────────────
create temp table _t on commit drop as
with a as (
  select a.id as athlete, t.id as equipe
    from public.athletes a
    join public.teams t on t.school_id = a.school_id and t.sport_id = a.sport_id and t.is_active
   where a.status = 'ACTIF'
     and not exists (select 1 from public.team_athletes ta where ta.athlete_id = a.id)
     and not exists (select 1 from public.equipes_sources e where e.team_id = t.id)
   order by a.id, t.id limit 1),
tr as (
  select ta.athlete_id as athlete, ta.team_id as de, t2.id as vers
    from public.team_athletes ta
    join public.athletes a on a.id = ta.athlete_id and a.status = 'ACTIF'
    join public.teams t1 on t1.id = ta.team_id
    join public.teams t2 on t2.school_id = t1.school_id and t2.sport_id = t1.sport_id and t2.is_active and t2.id <> t1.id
   where not exists (select 1 from public.equipes_sources e where e.team_id = t2.id)
   order by ta.athlete_id, t2.id limit 1),
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
       (select athlete from tr) as t_athlete, (select de from tr) as t_de, (select vers from tr) as t_vers,
       (select coach from c) as c_coach, (select equipe from c) as c_equipe;

do $$
begin
  if exists (select 1 from _t where a_athlete is null or t_athlete is null or c_coach is null) then
    raise exception 'NEXUS: un témoin manque (athlète sans équipe, transfert ou coach)';
  end if;
end $$;
select 'témoins trouvés : athlète sans équipe, transfert, coach (identifiants non affichés)' as temoins;

-- Un essai = l'écriture, puis on la DÉFAIT aussitôt (exception NX000) : rien ne reste, même accepté.
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

create function pg_temp.trois() returns table (cas text, resultat text) language sql as $$
  select 'athlète → équipe existante', pg_temp.essai(format(
    'insert into public.team_athletes (team_id, athlete_id) values (%L, %L)', a_equipe, a_athlete)) from _t
  union all
  select 'transfert vers une autre équipe', pg_temp.essai(format(
    'update public.team_athletes set team_id = %L where athlete_id = %L and team_id = %L', t_vers, t_athlete, t_de)) from _t
  union all
  select 'coach → équipe existante', pg_temp.essai(format(
    'insert into public.team_coaches (team_id, coach_id, role) values (%L, %L, %L)', c_equipe, c_coach, 'assistant')) from _t;
$$;

-- ── B. AVANT la migration ────────────────────────────────────────────────────
create temp table _avant on commit drop as select * from pg_temp.trois();
select 'AVANT' as phase, * from _avant;

-- ── C. La migration, texte gardé par son md5 ─────────────────────────────────
create temp table _lot7 on commit drop as
select $nexus_mig$-- 20261027150000_civil_lot7_lancement
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
$nexus_mig$::text as migration,
       $nexus_rb$-- Rollback de 20261027150000_civil_lot7_lancement : retire le verrou et l'interrupteur.
-- Sans le verrou, une équipe importée redevient joignable par tous les chemins : à ne jouer
-- que si les lots 3 à 5 ne sont PAS en prod, ou après les avoir annulés.
do $garde$
begin
  if to_regprocedure('public.verrou_lancement_civil()') is null then
    raise exception 'NEXUS: 20261027150000 absente, rien à annuler';
  end if;
end $garde$;

drop trigger trg_verrou_lancement_civil on public.team_athletes;
drop trigger trg_verrou_lancement_civil on public.team_coaches;
drop function public.verrou_lancement_civil();
drop function public.lancement_civil_actif();
delete from public.app_settings where key = 'lancement_civil';

do $garde$
begin
  if exists (select 1 from pg_trigger where tgname = 'trg_verrou_lancement_civil')
     or to_regprocedure('public.lancement_civil_actif()') is not null
     or exists (select 1 from public.app_settings where key = 'lancement_civil') then
    raise exception 'NEXUS: rollback incomplet';
  end if;
  raise notice 'NEXUS: lot 7 civil annulé (verrou et interrupteur retirés)';
end $garde$;
$nexus_rb$::text as rollback;

select clock_timestamp() as debut_migration;
do $m$
begin
  if (select md5(migration) from _lot7) <> '114f1359354a921686dcddb29e194bb1' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(migration) from _lot7);
  end if;
  execute (select migration from _lot7);
end $m$;
select clock_timestamp() as fin_migration;
set local search_path = public, extensions;

-- ── D. APRÈS, interrupteur OFF : mêmes résultats ─────────────────────────────
create temp table _apres on commit drop as select * from pg_temp.trois();
select 'APRÈS (OFF)' as phase, * from _apres;
do $$
declare n int;
begin
  select count(*) into n from _avant b join _apres a using (cas) where a.resultat is distinct from b.resultat;
  if n <> 0 or (select count(*) from _apres) <> 3 then
    raise exception 'NEXUS: % inscription(s) normale(s) changent de résultat après la migration', n;
  end if;
end $$;

-- ── E. Le verrou : les trois équipes cibles marquées « importées » ───────────
do $$
begin
  if exists (select 1 from _avant where resultat <> 'accepté') then
    raise exception 'NEXUS: un témoin est refusé dès AVANT (%) — choisir un autre témoin', (select string_agg(cas || ' : ' || resultat, ' ; ') from _avant where resultat <> 'accepté');
  end if;
end $$;
insert into public.equipes_sources (source_nom, source_cle, team_id)
select 'SPORDLE', 'rejeu-blanc-lot7|' || x, x
  from _t, lateral (values (a_equipe), (t_vers), (c_equipe)) v(x)
 group by x;
create temp table _off on commit drop as select * from pg_temp.trois();
select 'VERROU, équipes importées, OFF' as phase, * from _off;
update public.app_settings set value = 'true' where key = 'lancement_civil';
create temp table _on on commit drop as select * from pg_temp.trois();
select 'VERROU, équipes importées, ON' as phase, * from _on;
do $$
begin
  if exists (select 1 from _off where resultat not like 'REFUSÉ 42501 NEXUS: Cette équipe sera ouverte%') then
    raise exception 'NEXUS: le verrou laisse passer une inscription sous OFF';
  end if;
  if exists (select 1 from _on o join _avant b using (cas) where o.resultat is distinct from b.resultat) then
    raise exception 'NEXUS: sous ON, une inscription ne retrouve pas son résultat d''avant';
  end if;
end $$;
update public.app_settings set value = 'false' where key = 'lancement_civil';
delete from public.equipes_sources where source_cle like 'rejeu-blanc-lot7|%';

-- ── G. Cœur sur un club civil (décision BP 2026-10-27) : aucun recruteur ne le voit ─
-- Un athlète du SECONDAIRE sans aucune cible. Témoin : il cible un club civil ; chaque recruteur, sous
-- son vrai JWT, appelle athletes_targeting_my_cegep() : l'athlète ne doit apparaître chez personne.
-- Contrôle : la même sonde, avec une cible vers un cégep qui a un recruteur, doit le voir au moins une fois
-- (sinon la sonde serait aveugle).
create temp table _g on commit drop as
select (select a.id from public.athletes a join public.schools s on s.id = a.school_id and s.type::text = 'SECONDAIRE'
         where a.status = 'ACTIF' and not exists (select 1 from public.athlete_targets t where t.athlete_id = a.id)
         order by a.id limit 1) as athlete,
       (select s.id from public.schools s where s.type::text = 'LIGUE_CIVILE' order by s.id limit 1) as club,
       (select s.id from public.schools s
         where s.type::text = 'CEGEP'
           and exists (select 1 from public.users u where u.school_id = s.id and u.role = 'RECRUTEUR'::public.user_role)
         order by s.id limit 1) as cegep;
do $$
begin
  if exists (select 1 from _g where athlete is null or club is null or cegep is null) then
    raise exception 'NEXUS: témoin de cible manquant (athlète, club ou cégep avec recruteur)';
  end if;
end $$;
insert into public.athlete_targets (athlete_id, school_id) select athlete, club from _g;
create function pg_temp.voit_cible_club(p_uid uuid) returns text language plpgsql as $$
declare n int; cible uuid := (select athlete from _g);
begin
  begin
    perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
    perform set_config('role', 'authenticated', true);
    select count(*) into n from public.athletes_targeting_my_cegep() r where r.athlete_id = cible;
    raise exception using errcode = 'NX000', message = n::text;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'refus=' || sqlstate;
  end;
end $$;
create temp table _gr on commit drop as
select u.id, pg_temp.voit_cible_club(u.id) as vu from public.users u where u.role = 'RECRUTEUR'::public.user_role;
select 'cible sur un club, vue par les recruteurs' as sonde, count(*) as recruteurs,
       count(*) filter (where vu = '0') as ne_la_voient_pas, count(*) filter (where vu <> '0') as autres
  from _gr;
do $$
begin
  if exists (select 1 from _gr where vu <> '0') then
    raise exception 'NEXUS: une cible sur un club apparaît chez un recruteur (%)', (select string_agg(distinct vu, ',') from _gr where vu <> '0');
  end if;
end $$;
delete from public.athlete_targets t using _g where t.athlete_id = _g.athlete and t.school_id = _g.club;
insert into public.athlete_targets (athlete_id, school_id) select athlete, cegep from _g;
create temp table _gc on commit drop as
select u.id, pg_temp.voit_cible_club(u.id) as vu from public.users u where u.role = 'RECRUTEUR'::public.user_role;
select 'contrôle : cible sur un cégep, vue par les recruteurs' as sonde, count(*) filter (where vu = '1') as la_voient
  from _gc;
do $$
begin
  if not exists (select 1 from _gc where vu = '1') then
    raise exception 'NEXUS: contrôle raté — la sonde ne voit pas non plus une cible sur un cégep';
  end if;
end $$;
delete from public.athlete_targets t using _g where t.athlete_id = _g.athlete and t.school_id = _g.cegep;

-- ── F. Le rollback, texte gardé par son md5 ──────────────────────────────────
do $r$
begin
  if (select md5(rollback) from _lot7) <> '341ac6212860cc824e374204f4308e51' then
    raise exception 'NEXUS: texte du rollback altéré (md5 %)', (select md5(rollback) from _lot7);
  end if;
  execute (select rollback from _lot7);
end $r$;
set local search_path = public, extensions;
create temp table _apres_rb on commit drop as select * from pg_temp.trois();
do $$
begin
  if exists (select 1 from pg_trigger where tgname = 'trg_verrou_lancement_civil')
     or to_regprocedure('public.lancement_civil_actif()') is not null
     or exists (select 1 from public.app_settings where key = 'lancement_civil') then
    raise exception 'NEXUS: le rollback laisse un objet du lot 7';
  end if;
  if exists (select 1 from _apres_rb r join _avant b using (cas) where r.resultat is distinct from b.resultat) then
    raise exception 'NEXUS: après rollback, une inscription ne retrouve pas son résultat d''avant';
  end if;
end $$;
select 'VERDICT : inscriptions normales identiques avant / après / après rollback ; verrou refuse sous OFF, accepte sous ON ; cible sur un club vue par aucun recruteur ; rollback complet' as verdict,
       clock_timestamp() as avant_rollback;
rollback;

-- ── Relecture hors transaction ───────────────────────────────────────────────
select h.cle, h.n as avant,
       case h.cle
         when 'net.http_request_queue' then (select count(*) from net.http_request_queue)
         when 'athlete_notifications' then (select count(*) from public.athlete_notifications)
         when 'team_athletes' then (select count(*) from public.team_athletes)
         when 'team_coaches' then (select count(*) from public.team_coaches)
         when 'athlete_targets' then (select count(*) from public.athlete_targets)
       end as apres
  from _hors h order by h.cle;
select exists (select 1 from public.app_settings where key = 'lancement_civil') as interrupteur_reste,
       (select count(*) from pg_trigger where tgname = 'trg_verrou_lancement_civil') as triggers_restent,
       (select count(*) from public.equipes_sources) as equipes_sources,
       (select max(version) from supabase_migrations.schema_migrations) as derniere_version;
\echo '== ROLLBACK fait : rien n''est appliqué.'
