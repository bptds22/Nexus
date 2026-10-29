-- ════════════════════════════════════════════════════════════════════════════
-- Critères automatiques de Mon parcours (point 5, décision BP 2026-10-29) — REJEU À BLANC (finit par ROLLBACK), version 20261029180000.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer.mjs <date> <rejeu-blanc|apply> criteres (migration et rollback
-- embarqués, LF, md5 gardés). Lancer SANS -1, en postgres.
--
-- UNE transaction : gardes → photo des fiches (updated_at, complétion) → migration → rattrapage vérifié (vidéos
-- datées, rien d'autre ne bouge, aucune activité recruteur journalisée) → essais (chacun défait aussitôt, NX000) :
-- date non falsifiable, lien changé = date du jour, lien retiré = date vide, critères de la fonction = calcul
-- direct pour chaque athlète qui a une conversation recruteur ou une visite, anon refusé → rollback CRITERES joué et vérifié → ROLLBACK.
-- Aucun nom affiché.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-rejeu-blanc-criteres-parcours';
select now() as debut, current_user, current_setting('server_version') as version;

do $$
declare v text;
begin
  if current_user <> 'postgres' then raise exception 'NEXUS: lancer en postgres, pas en %', current_user; end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '20261029180000') then
    raise exception 'NEXUS: version 20261029180000 déjà inscrite';
  end if;
  select max(version) into v from supabase_migrations.schema_migrations;
  if v >= '20261029180000' then raise exception 'NEXUS: version 20261029180000 pas après la dernière (%) — régénérer', v; end if;
  if exists (select 1 from public.admin_operations where operation in ('MIGRATION_CRITERES_PARCOURS', 'ROLLBACK_CRITERES_PARCOURS')) then
    raise exception 'NEXUS: ce lot a déjà laissé une trace dans admin_operations';
  end if;
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261029160000') then
    raise exception 'NEXUS: préalable 20261029160000 (programme universitaire visé) absent';
  end if;
end $$;
select max(version) as derniere_version, public.lancement_universitaire_actif() as universitaire_on
  from supabase_migrations.schema_migrations;

-- ── Témoins et photo avant ───────────────────────────────────────────────────
create temp table _t on commit drop as
select (select a.id from public.athletes a where a.user_id is not null
          and nullif(btrim(a.video_faits_saillants_url), '') is not null order by a.id limit 1) as a_video,
       (select count(*) from public.athletes a where nullif(btrim(a.video_faits_saillants_url), '') is not null) as avec_video,
       (select count(*) from public.athletes) as fiches,
       (select count(*) from public.recruiter_activity_log) as activites_avant;
do $$ begin
  if (select a_video from _t) is null then raise exception 'NEXUS: aucun témoin avec vidéo'; end if;
end $$;
create temp table _avant on commit drop as
select a.id, a.updated_at, a.profile_completion, md5((to_jsonb(a))::text) as empreinte from public.athletes a;
select fiches, avec_video from _t;

-- ── La migration, texte gardé par son md5 ────────────────────────────────────
create temp table _m on commit drop as
select '20261029180000'::text as version,
       $nexus_mig$-- ════════════════════════════════════════════════════════════════════════════
-- Critères automatiques de « Quand le cégep cogne » / « Quand l'université cogne » (chantier cégep, point 5 —
-- liste validée par BP le 2026-10-29, AVEC la règle « vidéo de moins de 12 mois », cote R manuelle).
--
-- 1. athletes.video_faits_saillants_maj_le (timestamptz) — date de la dernière mise à jour de la vidéo de faits
--    saillants. Posée par la BASE seulement (trigger trg_athletes_video_faits_saillants_date, BEFORE) :
--      · lien posé ou changé → now() ; lien retiré → null ; sinon la date d'avant est gardée, quoi que le
--        client envoie (personne ne peut antidater ni rajeunir sa vidéo).
--    Rattrapage des vidéos existantes : on ne connaît pas leur vraie date (aucun historique). Elles reçoivent
--    la date de cette migration : elles comptent comme « récentes » pendant 12 mois, puis l'athlète devra
--    remettre son lien à jour. Le rattrapage n'écrit QUE cette colonne et garde updated_at (drapeau local
--    nexus.mirror_write, le même que le miroir des évaluations) : aucun athlète ne remonte dans les listes
--    « mis à jour récemment », aucune activité recruteur n'est journalisée (le lien ne change pas).
-- 2. public.mes_criteres_parcours() — jsonb, pour l'athlète CONNECTÉ seulement (auth.uid()) :
--      repondu_recruteur                  il a écrit au moins un message dans une conversation recruteur ↔ athlète ;
--      echange_recruteur_universitaire    idem, avec un recruteur rattaché à une université ;
--      visite                             une visite est enregistrée à son nom (visites_details, unité ou privée).
--    DEFINER : l'athlète ne lit ni la fiche du recruteur ni visites_details ; la fonction ne rend que trois
--    booléens sur ses propres données. Aucun interrupteur ici : la page n'affiche ces critères que sous
--    lancement_universitaire ON pour le cégépien (règle parcoursUniversitaireActif), et la liste du secondaire
--    ne dépend d'aucun interrupteur.
-- Mobile 1.4.5 : ne lit ni la colonne ni la fonction ; ses écritures de fiche passent par le même trigger.
--
-- Rollback : supabase/rollback/20261029180000_rollback_criteres_parcours_auto.sql
-- ════════════════════════════════════════════════════════════════════════════

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'athletes'
               and column_name = 'video_faits_saillants_maj_le') then
    raise exception 'NEXUS: 20261029180000 déjà appliquée';
  end if;
  if to_regprocedure('public.mes_criteres_parcours()') is not null
     or to_regprocedure('public.athletes_video_faits_saillants_date()') is not null then
    raise exception 'NEXUS: une fonction de 20261029180000 existe déjà';
  end if;
  if to_regclass('public.visites_details') is null then
    raise exception 'NEXUS: préalable visites_details absent';
  end if;
  if to_regprocedure('public.preserve_athlete_denorm_si_miroir()') is null then
    raise exception 'NEXUS: préalable preserve_athlete_denorm_si_miroir absent (garde de updated_at au rattrapage)';
  end if;
end $$;

alter table public.athletes add column video_faits_saillants_maj_le timestamptz;
comment on column public.athletes.video_faits_saillants_maj_le is
  'Date de la dernière mise à jour de video_faits_saillants_url, posée par la base (trigger). Vidéos d''avant le 2026-10-29 : date de la migration 20261029180000.';

-- Rattrapage : les vidéos déjà présentes, sans toucher updated_at.
select set_config('nexus.mirror_write', 'on', true);
update public.athletes set video_faits_saillants_maj_le = now()
 where nullif(btrim(video_faits_saillants_url), '') is not null;
select set_config('nexus.mirror_write', '', true);

create function public.athletes_video_faits_saillants_date()
returns trigger language plpgsql set search_path = public as $f$
begin
  if tg_op = 'INSERT' or new.video_faits_saillants_url is distinct from old.video_faits_saillants_url then
    new.video_faits_saillants_maj_le := case when nullif(btrim(new.video_faits_saillants_url), '') is null then null else now() end;
  else
    new.video_faits_saillants_maj_le := old.video_faits_saillants_maj_le;
  end if;
  return new;
end $f$;
create trigger trg_athletes_video_faits_saillants_date
  before insert or update on public.athletes
  for each row execute function public.athletes_video_faits_saillants_date();

create function public.mes_criteres_parcours()
returns jsonb language sql stable security definer set search_path = public set row_security = off as $f$
  with moi as (select a.id from public.athletes a where a.user_id = auth.uid() limit 1),
  repondu as (
    select c.recruiter_id from public.conversations c
      join public.messages m on m.conversation_id = c.id
     where c.athlete_id = (select id from moi) and c.conversation_type = 'RECRUTEUR_ATHLETE'
       and m.sender_id = auth.uid() and m.retracted_at is null
  )
  select case when (select id from moi) is null then null else jsonb_build_object(
    'repondu_recruteur', exists (select 1 from repondu),
    'echange_recruteur_universitaire', exists (
      select 1 from repondu r join public.users u on u.id = r.recruiter_id
        join public.schools s on s.id = u.school_id where s.type::text = 'UNIVERSITE'),
    'visite', exists (select 1 from public.visites_details v where v.athlete_id = (select id from moi))
  ) end
$f$;
revoke all on function public.mes_criteres_parcours() from public, anon;
grant execute on function public.mes_criteres_parcours() to authenticated, service_role;
comment on function public.mes_criteres_parcours() is
  'Critères automatiques de Mon parcours pour l''athlète connecté : a répondu à un recruteur, a échangé avec un recruteur universitaire, visite enregistrée.';
$nexus_mig$::text as contenu,
       $nexus_rb$-- Rollback de 20261029180000_criteres_parcours_auto : retire la fonction des critères, le trigger de date
-- et la colonne video_faits_saillants_maj_le (les dates posées depuis sont perdues ; les liens restent).
drop function if exists public.mes_criteres_parcours();
drop trigger if exists trg_athletes_video_faits_saillants_date on public.athletes;
drop function if exists public.athletes_video_faits_saillants_date();
alter table public.athletes drop column if exists video_faits_saillants_maj_le;
$nexus_rb$::text as rollback;
do $apply$
begin
  if (select md5(contenu) from _m) <> '796a2f033f94ba3bc36b2acf02158b91' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _m);
  end if;
  if (select md5(rollback) from _m) <> 'ae2baecee3e8b56f3133689a7aa3b60d' then
    raise exception 'NEXUS: texte du rollback altéré (md5 %)', (select md5(rollback) from _m);
  end if;
  execute (select contenu from _m);
end $apply$;
set local search_path = public, extensions;

-- ── Rattrapage vérifié ───────────────────────────────────────────────────────
create temp table _r on commit drop as
select (select count(*) from public.athletes a where nullif(btrim(a.video_faits_saillants_url), '') is not null
          and a.video_faits_saillants_maj_le = now()) as videos_datees,
       (select count(*) from public.athletes a where nullif(btrim(a.video_faits_saillants_url), '') is null
          and a.video_faits_saillants_maj_le is not null) as dates_sans_video,
       (select count(*) from public.athletes a join _avant b on b.id = a.id
          where a.updated_at is distinct from b.updated_at or a.profile_completion is distinct from b.profile_completion
             or md5((to_jsonb(a) - 'video_faits_saillants_maj_le')::text) <> b.empreinte) as fiches_changees,
       (select count(*) from public.recruiter_activity_log) - (select activites_avant from _t) as activites_ecrites;
select r.videos_datees, t.avec_video as attendu, r.dates_sans_video, r.fiches_changees, r.activites_ecrites from _r r, _t t;

-- ── Essais (chacun défait aussitôt) ──────────────────────────────────────────
create function pg_temp.essai(p_quoi text, p_athlete uuid default null) returns text language plpgsql as $$
declare t record; a record; v text; d timestamptz; d0 timestamptz; att jsonb; obt jsonb;
begin
  select * into t from _t;
  begin
    if p_quoi in ('date forcée par l''athlète', 'lien changé', 'lien retiré') then
      select * into a from public.athletes where id = t.a_video;
      d0 := a.video_faits_saillants_maj_le;
      if p_quoi = 'lien changé' then
        alter table public.athletes disable trigger trg_athletes_video_faits_saillants_date;
        update public.athletes set video_faits_saillants_maj_le = '2024-01-01' where id = a.id;
        alter table public.athletes enable trigger trg_athletes_video_faits_saillants_date;
      end if;
      perform set_config('request.jwt.claims', json_build_object('sub', a.user_id, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      if p_quoi = 'date forcée par l''athlète' then
        update public.athletes set video_faits_saillants_maj_le = '2020-01-01' where id = a.id;
      elsif p_quoi = 'lien changé' then
        update public.athletes set video_faits_saillants_url = 'https://youtu.be/nexus-temoin-criteres' where id = a.id;
      else
        update public.athletes set video_faits_saillants_url = null where id = a.id;
      end if;
      perform set_config('role', 'postgres', true);
      select video_faits_saillants_maj_le into d from public.athletes where id = a.id;
      v := case when p_quoi = 'date forcée par l''athlète' then (case when d is not distinct from d0 then 'date gardée' else 'date changée' end)
                when d is null then 'vide' when d = now() then 'date du jour' else 'autre date' end;
    elsif p_quoi = 'critères = calcul direct' then
      select * into a from public.athletes where id = p_athlete;
      att := jsonb_build_object(
        'repondu_recruteur', exists (select 1 from public.conversations c join public.messages m on m.conversation_id = c.id
            where c.athlete_id = a.id and c.conversation_type = 'RECRUTEUR_ATHLETE' and m.sender_id = a.user_id and m.retracted_at is null),
        'echange_recruteur_universitaire', exists (select 1 from public.conversations c join public.messages m on m.conversation_id = c.id
            join public.users u on u.id = c.recruiter_id join public.schools s on s.id = u.school_id
            where c.athlete_id = a.id and c.conversation_type = 'RECRUTEUR_ATHLETE' and m.sender_id = a.user_id
              and m.retracted_at is null and s.type::text = 'UNIVERSITE'),
        'visite', exists (select 1 from public.visites_details vd where vd.athlete_id = a.id));
      perform set_config('request.jwt.claims', json_build_object('sub', a.user_id, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      obt := public.mes_criteres_parcours();
      v := case when obt = att then 'identique' else 'ÉCART ' || coalesce(obt::text, 'null') || ' ≠ ' || att::text end;
    elsif p_quoi = 'compte sans fiche athlète' then
      perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-4000-8000-0000000c1001', 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
      v := coalesce(public.mes_criteres_parcours()::text, 'null');
    elsif p_quoi = 'anon' then
      v := 'exécute ' || has_function_privilege('anon', 'public.mes_criteres_parcours()', 'execute')::text;
    end if;
    raise exception using errcode = 'NX000', message = v;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 90);
  end;
end $$;

create temp table _e on commit drop as
select 1 as o, 'date forcée par l''athlète'::text as geste, 'date gardée'::text as attendu,
       pg_temp.essai('date forcée par l''athlète') as obtenu
union all select 2, 'lien changé', 'date du jour', pg_temp.essai('lien changé')
union all select 3, 'lien retiré', 'vide', pg_temp.essai('lien retiré')
union all select 4, 'compte sans fiche athlète', 'null', pg_temp.essai('compte sans fiche athlète')
union all select 5, 'anon', 'exécute false', pg_temp.essai('anon');
insert into _e
select 10 + row_number() over (order by a.id), 'critères = calcul direct', 'identique', pg_temp.essai('critères = calcul direct', a.id)
  from public.athletes a
 where a.user_id is not null
   and (exists (select 1 from public.conversations c where c.athlete_id = a.id and c.conversation_type = 'RECRUTEUR_ATHLETE')
        or exists (select 1 from public.visites_details vd where vd.athlete_id = a.id));
select o, geste, attendu, obtenu, case when obtenu = attendu then 'ok' else 'ÉCART' end as "?" from _e order by o limit 40;
select count(*) filter (where o > 10) as athletes_compares, count(*) filter (where obtenu <> attendu) as ecarts from _e;

do $$
begin
  if exists (select 1 from _e where obtenu like 'ERREUR%') then raise exception 'NEXUS: un essai a échoué'; end if;
  if exists (select 1 from _e where obtenu <> attendu) then raise exception 'NEXUS: % essai(s) hors attendu', (select count(*) from _e where obtenu <> attendu); end if;
  if (select videos_datees from _r) <> (select avec_video from _t) then raise exception 'NEXUS: rattrapage incomplet'; end if;
  if (select dates_sans_video from _r) <> 0 then raise exception 'NEXUS: une date posée sans vidéo'; end if;
  if (select fiches_changees from _r) <> 0 then raise exception 'NEXUS: % fiche(s) changée(s) ailleurs que la date de vidéo', (select fiches_changees from _r); end if;
  if (select activites_ecrites from _r) <> 0 then raise exception 'NEXUS: une activité recruteur a été journalisée'; end if;
  if (select count(*) from public.athletes) <> (select fiches from _t) then raise exception 'NEXUS: le nombre de fiches a bougé'; end if;
  if (select count(*) from public.recruiter_activity_log) <> (select activites_avant from _t) then raise exception 'NEXUS: activité restée après les essais'; end if;
  if coalesce(current_setting('nexus.mirror_write', true), '') <> '' then raise exception 'NEXUS: drapeau mirror_write resté posé'; end if;
  raise notice 'NEXUS: VERDICT critères — vidéos datées sans autre changement, date tenue par la base, fonction = calcul direct';
end $$;
select 'VERDICT' as verdict, 'conforme' as resultat;

do $rb$ begin execute (select rollback from _m); end $rb$;
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'athletes'
               and column_name = 'video_faits_saillants_maj_le')
     or to_regprocedure('public.mes_criteres_parcours()') is not null
     or to_regprocedure('public.athletes_video_faits_saillants_date()') is not null then
    raise exception 'NEXUS: après rollback, un objet reste';
  end if;
  if exists (select 1 from public.athletes a join _avant b on b.id = a.id where md5((to_jsonb(a))::text) <> b.empreinte) then
    raise exception 'NEXUS: après rollback, une fiche diffère de la photo d''avant';
  end if;
  raise notice 'NEXUS: rollback vérifié (objets retirés, fiches identiques à la photo d''avant)';
end $$;

rollback;
\echo '== ROLLBACK fait : rien n''est appliqué.'
