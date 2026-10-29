-- ════════════════════════════════════════════════════════════════════════════
-- Black-out par portée (point 8, plan validé BP 2026-10-29) — @@TITRE@@, version @@VERSION@@.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer.mjs <date> <rejeu-blanc|apply> blackout (migration et rollback
-- embarqués, LF, md5 gardés). Lancer SANS -1, en postgres.
--
-- UNE transaction : gardes → témoins → relevé AVANT (get_active_blackout de chaque athlète) → migration →
-- portées posées → relevé APRÈS (seuls les cégépiens peuvent changer) → essais par paire (chaque essai crée sa
-- période d'essai et la défait aussitôt, NX000) → @@SUITE@@. Aucun nom affiché.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-@@MODE@@-blackout-portee';
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
  if exists (select 1 from public.admin_operations where operation in ('MIGRATION_BLACKOUT_PORTEE', 'ROLLBACK_BLACKOUT_PORTEE')) then
    raise exception 'NEXUS: ce lot a déjà laissé une trace dans admin_operations';
  end if;
  if not exists (select 1 from public.blackout_periods where id = '2d32b641-fcc3-496e-8396-d75458c18cf6') then
    raise exception 'NEXUS: la période « Silence RSEQ - Football » attendue est absente';
  end if;
end $$;
select max(version) as derniere_version, public.lancement_universitaire_actif() as universitaire_on
  from supabase_migrations.schema_migrations;

-- ── Témoins (athlètes sans conversation, pour que l'essai du trigger ne heurte rien) ─
create temp table _t on commit drop as
select (select a.id from public.athletes a left join public.schools s on s.id = a.school_id
         where coalesce(s.type::text, '') <> 'CEGEP' and not coalesce(a.is_showcase, false)
           and not exists (select 1 from public.conversations c where c.athlete_id = a.id)
         order by a.id limit 1) as sec,
       (select a.id from public.athletes a join public.schools s on s.id = a.school_id
         where s.type::text = 'CEGEP' and not coalesce(a.is_showcase, false)
           and not exists (select 1 from public.conversations c where c.athlete_id = a.id)
         order by a.id limit 1) as ceg,
       (select u.id from public.users u join public.schools s on s.id = u.school_id
         where u.role = 'RECRUTEUR'::public.user_role and s.type::text = 'CEGEP' order by u.id limit 1) as r_col,
       (select u.id from public.users u join public.schools s on s.id = u.school_id
         where u.role = 'RECRUTEUR'::public.user_role and s.type::text = 'UNIVERSITE' order by u.id limit 1) as r_uni_reel,
       (select u.id from public.users u where u.role = 'COACH'::public.user_role order by u.id limit 1) as coach,
       (select count(*) from public.blackout_periods) as periodes_avant;
alter table _t add column r_uni uuid;
-- Sans recruteur universitaire en prod, l'essai prend le recruteur collégial : la règle ne regarde que le rôle.
update _t set r_uni = coalesce(r_uni_reel, r_col);
do $$ begin
  if exists (select 1 from _t where sec is null or ceg is null or r_col is null or coach is null) then
    raise exception 'NEXUS: un témoin manque';
  end if;
end $$;
select r_uni_reel is not null as recruteur_universitaire_reel, periodes_avant from _t;

create temp table _avant on commit drop as
select a.id, exists (select 1 from public.schools s where s.id = a.school_id and s.type::text = 'CEGEP') as cegepien,
       (select g.id from public.get_active_blackout(a.id) g) as periode
  from public.athletes a;

-- ── La migration, texte gardé par son md5 ────────────────────────────────────
create temp table _m on commit drop as
select '@@VERSION@@'::text as version,
       $nexus_mig$@@MIGRATION@@$nexus_mig$::text as contenu,
       $nexus_rb$@@ROLLBACK@@$nexus_rb$::text as rollback;
do $apply$
begin
  if (select md5(contenu) from _m) <> '@@MD5_MIGRATION@@' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _m);
  end if;
  if (select md5(rollback) from _m) <> '@@MD5_ROLLBACK@@' then
    raise exception 'NEXUS: texte du rollback altéré (md5 %)', (select md5(rollback) from _m);
  end if;
  execute (select contenu from _m);
end $apply$;
set local search_path = public, extensions;

select libelle, portee, actif, date_debut, date_fin from public.blackout_periods order by date_debut;

-- Relevé APRÈS : un athlète qui n'est pas cégépien garde exactement la même période qu'avant.
select count(*) filter (where not v.cegepien) as athletes_secondaire,
       count(*) filter (where not v.cegepien and v.periode is distinct from (select g.id from public.get_active_blackout(v.id) g)) as secondaire_changes,
       count(*) filter (where v.cegepien) as cegepiens,
       count(*) filter (where v.cegepien and v.periode is distinct from (select g.id from public.get_active_blackout(v.id) g)) as cegepiens_changes
  from _avant v;

-- ── Essais (chacun crée sa période d'essai, puis tout est défait) ────────────
create function pg_temp.essai(p_portee text, p_quoi text) returns text language plpgsql as $$
declare t record; v text; p uuid := '00000000-0000-4000-8000-0000000b1a01';
begin
  select * into t from _t;
  begin
    insert into public.blackout_periods (id, libelle, sport_id, date_debut, date_fin, portee)
    values (p, 'Essai portée', null, (now() at time zone 'America/Montreal')::date, date '2099-12-31', p_portee);
    if p_quoi = 'secondaire + recruteur collégial' then
      v := 'visé ' || exists (select 1 from public.get_active_blackout(t.sec, t.r_col) g where g.id = p);
    elsif p_quoi = 'secondaire + recruteur universitaire' then
      v := 'visé ' || exists (select 1 from public.get_active_blackout(t.sec, t.r_uni) g where g.id = p);
    elsif p_quoi = 'cégépien + recruteur universitaire' then
      v := 'visé ' || exists (select 1 from public.get_active_blackout(t.ceg, t.r_uni) g where g.id = p);
    elsif p_quoi = 'secondaire + coach' then
      v := 'visé ' || exists (select 1 from public.get_active_blackout(t.sec, t.coach) g where g.id = p);
    elsif p_quoi = 'secondaire, 1 argument (1.4.5)' then
      v := 'visé ' || exists (select 1 from public.get_active_blackout(t.sec) g where g.id = p);
    elsif p_quoi = 'cégépien, 1 argument (1.4.5)' then
      v := 'visé ' || exists (select 1 from public.get_active_blackout(t.ceg) g where g.id = p);
    elsif p_quoi = 'sans athlète (bannière)' then
      v := 'visé ' || exists (select 1 from public.get_active_blackout() g where g.id = p);
    elsif p_quoi = 'carte cégep' then
      v := 'visé ' || exists (select 1 from public.non_contact_carte(null, null, 'cegep') g where g.date_fin = '2099-12-31');
    elsif p_quoi = 'carte secondaire' then
      v := 'visé ' || exists (select 1 from public.non_contact_carte(null, null, 'secondaire') g where g.date_fin = '2099-12-31');
    elsif p_quoi = 'conversation recruteur ↔ secondaire' then
      insert into public.conversations (recruiter_id, athlete_id, conversation_type) values (t.r_col, t.sec, 'RECRUTEUR_ATHLETE');
      v := 'acceptée';
    elsif p_quoi = 'conversation recruteur ↔ cégépien' then
      insert into public.conversations (recruiter_id, athlete_id, conversation_type) values (t.r_uni, t.ceg, 'RECRUTEUR_ATHLETE');
      v := 'acceptée';
    elsif p_quoi = 'conversation recruteur ↔ coach' then
      insert into public.conversations (recruiter_id, coach_id, athlete_id, conversation_type) values (t.r_col, t.coach, t.sec, 'RECRUTEUR_COACH');
      v := 'acceptée';
    end if;
    raise exception using errcode = 'NX000', message = v;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when check_violation then return 'refusée ' || sqlstate;
    when others then return 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 90);
  end;
end $$;

create temp table _e (o int, portee text, geste text, attendu text, obtenu text) on commit drop;
insert into _e (o, portee, geste, attendu) values
  ( 1, 'secondaire', 'secondaire + recruteur collégial',      'visé true'),
  ( 2, 'secondaire', 'secondaire + recruteur universitaire',  'visé true'),
  ( 3, 'secondaire', 'cégépien + recruteur universitaire',    'visé false'),
  ( 4, 'secondaire', 'secondaire + coach',                    'visé false'),
  ( 5, 'secondaire', 'secondaire, 1 argument (1.4.5)',        'visé true'),
  ( 6, 'secondaire', 'cégépien, 1 argument (1.4.5)',          'visé false'),
  ( 7, 'secondaire', 'sans athlète (bannière)',               'visé true'),
  ( 8, 'cegep',      'cégépien + recruteur universitaire',    'visé true'),
  ( 9, 'cegep',      'secondaire + recruteur collégial',      'visé false'),
  (10, 'cegep',      'secondaire + recruteur universitaire',  'visé false'),
  (11, 'tous',       'secondaire + recruteur collégial',      'visé true'),
  (12, 'tous',       'cégépien + recruteur universitaire',    'visé true'),
  (13, 'tous',       'secondaire + coach',                    'visé false'),
  (14, 'cegep',      'carte cégep',                           'visé true'),
  (15, 'cegep',      'carte secondaire',                      'visé false'),
  (16, 'secondaire', 'conversation recruteur ↔ secondaire',   'refusée 23514'),
  (17, 'secondaire', 'conversation recruteur ↔ cégépien',     'acceptée'),
  (18, 'tous',       'conversation recruteur ↔ cégépien',     'refusée 23514'),
  (19, 'tous',       'conversation recruteur ↔ coach',        'acceptée');
update _e set obtenu = pg_temp.essai(portee, geste);
select o, portee, geste, attendu, obtenu, case when obtenu = attendu then 'ok' else 'ÉCART' end as "?" from _e order by o;

do $$
begin
  if exists (select 1 from _e where obtenu like 'ERREUR%') then raise exception 'NEXUS: un essai a échoué'; end if;
  if exists (select 1 from _e where obtenu <> attendu) then raise exception 'NEXUS: % essai(s) hors attendu', (select count(*) from _e where obtenu <> attendu); end if;
  if exists (select 1 from _avant v where not v.cegepien
               and v.periode is distinct from (select g.id from public.get_active_blackout(v.id) g)) then
    raise exception 'NEXUS: un athlète du secondaire a changé de période';
  end if;
  if (select portee from public.blackout_periods where id = '2d32b641-fcc3-496e-8396-d75458c18cf6') <> 'secondaire' then
    raise exception 'NEXUS: Silence RSEQ - Football n''est pas en portée secondaire';
  end if;
  if exists (select 1 from public.blackout_periods where id <> '2d32b641-fcc3-496e-8396-d75458c18cf6' and portee <> 'tous') then
    raise exception 'NEXUS: une autre période a changé de portée';
  end if;
  if (select count(*) from public.blackout_periods) <> (select periodes_avant from _t) then
    raise exception 'NEXUS: une période d''essai est restée';
  end if;
  raise notice 'NEXUS: VERDICT black-out par portée — paires conformes, secondaire inchangé, coach jamais visé';
end $$;
select 'VERDICT' as verdict, 'conforme' as resultat;
-- [[REJEU

do $rb$ begin execute (select rollback from _m); end $rb$;
do $$
begin
  if (select md5(prosrc) from pg_proc where oid = 'public.get_active_blackout(uuid)'::regprocedure) <> 'f93e81bed72c2c180b83da6c6cd01c94'
     or (select md5(prosrc) from pg_proc where oid = 'public.enforce_messaging_blackout()'::regprocedure) <> 'b6b069f4e7c43b96cbc0a5805cb80f7b' then
    raise exception 'NEXUS: après rollback, un corps n''est pas celui d''avant';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'blackout_periods' and column_name = 'portee')
     or to_regprocedure('public.get_active_blackout(uuid, uuid)') is not null
     or to_regprocedure('public.non_contact_carte(uuid, integer, text)') is not null then
    raise exception 'NEXUS: après rollback, un objet du lot reste';
  end if;
  raise notice 'NEXUS: rollback vérifié (corps d''avant par md5, colonne et variantes retirées)';
end $$;

rollback;
\echo '== ROLLBACK fait : rien n''est appliqué.'
-- REJEU]]
-- [[APPLY

insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'blackout_portee', array[contenu], 'bptds22@gmail.com' from _m;
insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_BLACKOUT_PORTEE',
       'Black-out par portée : la période suit le niveau de l''athlète ; Silence RSEQ - Football → secondaire, les autres → tous (GO BP)',
       jsonb_build_object('nom', 'blackout_portee', 'version', m.version,
         'fichier', 'supabase/migrations/' || m.version || '_blackout_portee.sql',
         'rollback', 'supabase/rollback/' || m.version || '_rollback_blackout_portee.sql',
         'md5_fichier', '@@MD5_MIGRATION@@', 'md5_rollback', '@@MD5_ROLLBACK@@', 'voie', 'psql (session pooler)'),
       (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0')
  from _m m;
do $$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '@@VERSION@@') then
    raise exception 'NEXUS: inscription schema_migrations absente';
  end if;
end $$;
select version as version_inscrite, clock_timestamp() as avant_commit from _m;
commit;
\echo '== COMMIT fait : black-out par portée en prod.'
-- APPLY]]
