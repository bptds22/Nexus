-- ════════════════════════════════════════════════════════════════════════════
-- Lot D3a cégep — @@TITRE@@, version @@VERSION@@.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer.mjs <date> <rejeu-blanc|apply> d3a (migration et rollback
-- embarqués, LF, md5 gardés). Lancer SANS -1, en postgres.
--
-- UNE transaction : gardes → AVANT (ce que lit chaque lecteur, par ancrage de fiche ; banc des fonctions) →
-- migration → APRÈS → @@SUITE@@. Le recruteur universitaire est un compte témoin créé DANS chaque essai, avec
-- l'interrupteur posé pour l'essai, défait aussitôt. Aucun nom affiché : des nombres par ancrage.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '5s';
set local statement_timeout = '600s';
set local search_path = public, extensions;
set local application_name = 'nexus-@@MODE@@-cegep-d3a';
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
  if exists (select 1 from public.admin_operations where operation in ('MIGRATION_CEGEP_LOT_D3A', 'ROLLBACK_CEGEP_LOT_D3A')) then
    raise exception 'NEXUS: le lot D3a a déjà laissé une trace dans admin_operations';
  end if;
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261028030000') then
    raise exception 'NEXUS: préalable D2a absent';
  end if;
  if public.lancement_universitaire_actif() then
    raise exception 'NEXUS: lancement_universitaire est ON — D3a se pose interrupteur OFF';
  end if;
  if exists (select 1 from auth.users where id = '00000000-0000-4000-8000-0000000d3a01') then
    raise exception 'NEXUS: l''identifiant du compte témoin existe déjà';
  end if;
end $$;
select max(version) as derniere_version from supabase_migrations.schema_migrations;

-- ── Témoins (identifiants seulement) ─────────────────────────────────────────
create temp table _anc on commit drop as
select a.id, coalesce(s.type, 'AUCUNE') as anc from public.athletes a left join public.schools s on s.id = a.school_id;
grant select on _anc to authenticated;
create temp table _t on commit drop as
select (select s.id from public.schools s where s.type = 'UNIVERSITE' order by s.name limit 1) as univ,
       (select u.id from public.users u where u.role = 'RECRUTEUR'::public.user_role and u.onboarding_complete
          order by (select count(*) from public.recruiter_favorites f where f.recruiter_id = u.id) desc, u.id limit 1) as u_rec,
       (select u.id from public.users u where u.role = 'PARTNER'::public.user_role order by u.id limit 1) as u_part,
       (select u.id from public.users u where u.role = 'COACH'::public.user_role and u.school_id is not null order by u.id limit 1) as u_coach,
       (select u.id from public.users u join public.athletes a on a.user_id = u.id where u.role = 'ATHLETE'::public.user_role order by u.id limit 1) as u_ath,
       (select u.id from public.users u where u.role = 'ADMIN'::public.user_role order by u.id limit 1) as u_adm,
       (select x.id from _anc x where x.anc <> 'CEGEP' order by x.id limit 1) as a_autre,
       (select x.id from _anc x where x.anc = 'CEGEP' order by x.id limit 1) as a_cegep,
       '00000000-0000-4000-8000-0000000d3a01'::uuid as neuf;
do $$
begin
  if exists (select 1 from _t where univ is null or u_rec is null or u_part is null or u_coach is null or u_ath is null
                or u_adm is null or a_autre is null) then
    raise exception 'NEXUS: un témoin manque';
  end if;
end $$;
select (select count(*) from _anc where anc = 'CEGEP') as cegepiens,
       (select count(*) from _anc where anc <> 'CEGEP') as autres_fiches;

-- Recruteur universitaire témoin (dans l'essai seulement) : compte neuf, rattaché à une université.
create function pg_temp.prep_univ(p_on boolean) returns void language plpgsql as $$
begin
  update public.app_settings set value = case when p_on then 'true' else 'false' end where key = 'lancement_universitaire';
  insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
  select '00000000-0000-0000-0000-000000000000', neuf, 'authenticated', 'authenticated', 'd3a-temoin@nexus.invalid',
         '{}', '{}', now(), now() from _t;
  update public.users u set role = 'RECRUTEUR'::public.user_role, context = 'universitaire', school_id = t.univ,
         onboarding_complete = true, role_claimed_at = now()
    from _t t where u.id = t.neuf;
end $$;
create function pg_temp.jwt(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;

-- Ce que LIT un lecteur dans les 6 tables, par ancrage : « cégépiens / autres » pour chaque table.
create function pg_temp.lit(p_uid uuid, p_univ boolean, p_on boolean) returns text language plpgsql as $$
declare v text; q text;
begin
  begin
    if p_univ then perform pg_temp.prep_univ(p_on); end if;
    perform pg_temp.jwt(p_uid);
    q := 'select coalesce(sum((x.anc = ''CEGEP'')::int), 0) || ''/'' || coalesce(sum((x.anc <> ''CEGEP'')::int), 0) from %s t join _anc x on x.id = t.%s';
    execute 'select ' ||
      '(' || format(q, 'public.athletes', 'id') || ') || '' '' || ' ||
      '(' || format(q, 'public.team_athletes', 'athlete_id') || ') || '' '' || ' ||
      '(' || format(q, 'public.athlete_badges', 'athlete_id') || ') || '' '' || ' ||
      '(' || format(q, 'public.evaluations', 'athlete_id') || ') || '' '' || ' ||
      '(' || format(q, 'public.recruiter_athlete_views', 'athlete_id') || ') || '' '' || ' ||
      '(' || format(q, 'public.recruiter_activity_log', 'athlete_id') || ')' into v;
    raise exception using errcode = 'NX000', message = v;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 60);
  end;
end $$;
create function pg_temp.lecteurs() returns table (o int, lecteur text, lu text) language sql as $$
  select 1, 'recruteur universitaire (ON)', pg_temp.lit(neuf, true, true) from _t
  union all select 2, 'recruteur universitaire (OFF)', pg_temp.lit(neuf, true, false) from _t
  union all select 3, 'recruteur collégial', pg_temp.lit(u_rec, false, false) from _t
  union all select 4, 'recruteur collégial (ON)', pg_temp.lit(u_rec, true, true) from _t
  union all select 5, 'partenaire', pg_temp.lit(u_part, false, false) from _t
  union all select 6, 'coach', pg_temp.lit(u_coach, false, false) from _t
  union all select 7, 'athlète', pg_temp.lit(u_ath, false, false) from _t
  union all select 8, 'admin', pg_temp.lit(u_adm, false, false) from _t;
$$;

-- Banc des fonctions : identifiants de fiches dans la réponse, « cégépiens / autres ».
create temp table _appels (n int primary key, objet text, appel text) on commit drop;
insert into _appels values
  (1,  'recruiter_search_athletes()',        'select jsonb_agg(x)::text from public.recruiter_search_athletes() x'),
  (2,  'recruiter_athlete_cards(toutes)',     'select jsonb_agg(x)::text from public.recruiter_athlete_cards({ALL}) x'),
  (3,  'recruiter_athlete_profile(autre)',    'select jsonb_agg(x)::text from public.recruiter_athlete_profile({A}) x'),
  (4,  'athletes_nom_proche(autre)',          'select jsonb_agg(x)::text from public.athletes_nom_proche({PRENOM}, {NOM}, null) x'),
  (5,  'athlete_nexus_par_courriel(autre)',   'select jsonb_agg(x)::text from public.athlete_nexus_par_courriel({COURRIEL}) x'),
  (6,  'athletes_targeting_my_cegep()',       'select jsonb_agg(x)::text from public.athletes_targeting_my_cegep() x'),
  (7,  'matchs_profils_nexus(500 matchs)',    'select jsonb_agg(x)::text from public.matchs_profils_nexus({GAMES}) x'),
  (8,  'matchs_recherche(31 jours)',          'select jsonb_agg(x)::text from public.matchs_recherche(current_date, current_date + 30) x'),
  (9,  'rapprochements_unite()',              'select jsonb_agg(x)::text from public.rapprochements_unite() x'),
  (10, 'is_athlete_contactable(autre)',       'select case when public.is_athlete_contactable({A}) then {A}::text else '''' end');
create function pg_temp.ctx() returns jsonb language sql as $$
  select jsonb_build_object(
    'ALL', quote_literal((select array_agg(id)::text from _anc)) || '::uuid[]',
    'A', quote_literal((select a_autre from _t)::text) || '::uuid',
    'PRENOM', quote_literal(coalesce((select first_name from public.athletes where id = (select a_autre from _t)), '')),
    'NOM', quote_literal(coalesce((select last_name from public.athletes where id = (select a_autre from _t)), '')),
    'COURRIEL', quote_literal(coalesce((select u.email from public.athletes a join public.users u on u.id = a.user_id
                                         where a.id = (select a_autre from _t)), '')),
    'GAMES', quote_literal(coalesce((select array_agg(id)::text from (select g.id from public.games g
                                       where g.game_date >= current_date - 60 order by g.game_date, g.id limit 500) z), '{}')) || '::uuid[]');
$$;
create function pg_temp.appel(p_uid uuid, p_univ boolean, p_on boolean, p_sql text, p_ceg text[], p_autres text[]) returns text
language plpgsql as $$
declare v text; nc int; na int;
begin
  begin
    if p_univ then perform pg_temp.prep_univ(p_on); end if;
    perform pg_temp.jwt(p_uid);
    execute p_sql into v;
    v := coalesce(v, '');
    select count(*) into nc from unnest(p_ceg) m where strpos(v, m) > 0;
    select count(*) into na from unnest(p_autres) m where strpos(v, m) > 0;
    raise exception using errcode = 'NX000', message = 'ok ' || nc || '/' || na;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when insufficient_privilege then return 'refusé';
    when others then
      if sqlerrm like 'NEXUS%' then return 'refusé'; end if;
      return 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 60);
  end;
end $$;
create temp table _banc (moment text, o int, n int, resultat text) on commit drop;
create function pg_temp.banc(p_moment text) returns void language plpgsql as $$
declare c jsonb := pg_temp.ctx(); a record; r record; s text; k text;
        v_ceg text[] := (select coalesce(array_agg(id::text), '{}') from _anc where anc = 'CEGEP');
        v_aut text[] := (select coalesce(array_agg(id::text), '{}') from _anc where anc <> 'CEGEP');
begin
  for r in select * from (values (1, true, true), (3, false, false), (5, false, false)) x(o, univ, on_) loop
    for a in select * from _appels order by n loop
      s := a.appel;
      foreach k in array array['ALL', 'A', 'PRENOM', 'NOM', 'COURRIEL', 'GAMES'] loop
        s := replace(s, '{' || k || '}', c ->> k);
      end loop;
      insert into _banc values (p_moment, r.o, a.n,
        pg_temp.appel(case r.o when 1 then (select neuf from _t) when 3 then (select u_rec from _t) else (select u_part from _t) end,
                      r.univ, r.on_, s, v_ceg, v_aut));
    end loop;
  end loop;
end $$;

-- Écritures du recruteur universitaire (ON) vers une fiche non cégépienne, et vers un cégépien (contrôle).
create function pg_temp.ecrit(p_sql text) returns text language plpgsql as $$
declare n bigint;
begin
  begin
    perform pg_temp.prep_univ(true);
    perform pg_temp.jwt((select neuf from _t));
    execute p_sql;
    get diagnostics n = row_count;
    raise exception using errcode = 'NX000', message = 'accepté ' || n;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'refusé ' || sqlstate || ' ' || left(sqlerrm, 50);
  end;
end $$;
create function pg_temp.ecritures() returns table (o int, essai text, resultat text) language sql as $$
  select 1, 'favori → fiche non cégépienne', pg_temp.ecrit(format('insert into public.recruiter_favorites (recruiter_id, athlete_id) values (auth.uid(), %L)', a_autre)) from _t
  union all select 2, 'processus → fiche non cégépienne', pg_temp.ecrit(format('insert into public.recruiter_pipeline (recruiter_id, athlete_id) values (auth.uid(), %L)', a_autre)) from _t
  union all select 3, 'conversation → fiche non cégépienne', pg_temp.ecrit(format('insert into public.conversations (recruiter_id, athlete_id, conversation_type) values (auth.uid(), %L, ''RECRUTEUR_ATHLETE'')', a_autre)) from _t
  union all select 4, 'favori → cégépien (contrôle)', case when a_cegep is null then 'pas de cégépien en base'
         else pg_temp.ecrit(format('insert into public.recruiter_favorites (recruiter_id, athlete_id) values (auth.uid(), %L)', a_cegep)) end from _t;
$$;

-- Coût : la recherche et la lecture des fiches par le recruteur collégial, médiane de 5.
create function pg_temp.duree(p_sql text) returns numeric language plpgsql as $$
declare t0 timestamptz; d numeric[] := '{}'; i int; x text;
begin
  for i in 1..5 loop
    begin
      perform pg_temp.jwt((select u_rec from _t));
      t0 := clock_timestamp();
      execute p_sql into x;
      d := d || (extract(epoch from clock_timestamp() - t0) * 1000)::numeric;
      raise exception using errcode = 'NX000';
    exception when sqlstate 'NX000' then null;
    end;
  end loop;
  return round((select percentile_cont(0.5) within group (order by y) from unnest(d) y)::numeric, 1);
end $$;

-- ── AVANT ────────────────────────────────────────────────────────────────────
create temp table _avant on commit drop as select * from pg_temp.lecteurs();
select 'AVANT' as phase, lecteur, lu as "fiches équipes badges éval. vues journal" from _avant order by o;
select pg_temp.banc('avant');
create temp table _temps_avant on commit drop as
select pg_temp.duree('select count(*)::text from public.recruiter_search_athletes()') as recherche_ms,
       pg_temp.duree('select count(*)::text from public.athletes') as fiches_ms;

-- ── La migration, texte gardé par son md5 ────────────────────────────────────
create temp table _d3a on commit drop as
select '@@VERSION@@'::text as version,
       $nexus_mig$@@MIGRATION@@$nexus_mig$::text as contenu,
       $nexus_rb$@@ROLLBACK@@$nexus_rb$::text as rollback;
do $apply$
begin
  if (select md5(contenu) from _d3a) <> '@@MD5_MIGRATION@@' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(contenu) from _d3a);
  end if;
  if (select md5(rollback) from _d3a) <> '@@MD5_ROLLBACK@@' then
    raise exception 'NEXUS: texte du rollback altéré (md5 %)', (select md5(rollback) from _d3a);
  end if;
  execute (select contenu from _d3a);
end $apply$;
set local search_path = public, extensions;

-- ── APRÈS ────────────────────────────────────────────────────────────────────
create temp table _apres on commit drop as select * from pg_temp.lecteurs();
select 'APRÈS' as phase, a.lecteur, a.lu as "fiches équipes badges éval. vues journal",
       case when a.lu = b.lu then '=' else 'CHANGE' end as vs_avant
  from _apres a join _avant b using (o) order by o;
select pg_temp.banc('apres');
select a.n, a.objet,
       max(case when b.o = 1 and b.moment = 'avant' then b.resultat end) as univ_avant,
       max(case when b.o = 1 and b.moment = 'apres' then b.resultat end) as univ_apres,
       max(case when b.o = 3 and b.moment = 'avant' then b.resultat end) as collegial_avant,
       max(case when b.o = 3 and b.moment = 'apres' then b.resultat end) as collegial_apres,
       max(case when b.o = 5 and b.moment = 'avant' then b.resultat end) as partenaire_avant,
       max(case when b.o = 5 and b.moment = 'apres' then b.resultat end) as partenaire_apres
  from _appels a join _banc b using (n) group by a.n, a.objet order by a.n;
create temp table _ecr on commit drop as select * from pg_temp.ecritures();
select essai, resultat from _ecr order by o;
select t.recherche_ms as recherche_ms_avant,
       pg_temp.duree('select count(*)::text from public.recruiter_search_athletes()') as recherche_ms_apres,
       t.fiches_ms as fiches_ms_avant,
       pg_temp.duree('select count(*)::text from public.athletes') as fiches_ms_apres
  from _temps_avant t;
create temp table _corps on commit drop as
select p.proname,
       (p.prosrc like '%lecteur_universitaire%' or p.prosrc like '%compte_universitaire%' or p.prosrc like '%unite_universitaire%') as filtre
  from pg_proc p where p.pronamespace = 'public'::regnamespace
   and p.proname in ('agenda_flux', 'athlete_nexus_par_courriel', 'athletes_nom_proche', 'athletes_targeting_my_cegep',
     'depistage_profils_match', 'fusionner_carte', 'is_athlete_contactable', 'log_athlete_update', 'log_coach_reply',
     'log_new_athlete', 'match_notes_lier', 'matchs_profils_nexus', 'matchs_recherche', 'rapprochement_candidats',
     'rapprochements_refuses_unite', 'rapprochements_unite', 'recruiter_athlete_cards', 'recruiter_athlete_profile',
     'recruiter_search_athletes');
select count(*) filter (where filtre) as fonctions_avec_filtre, count(*) as fonctions from _corps;

do $$
declare u text;
begin
  if exists (select 1 from _avant where lu like 'ERREUR%') or exists (select 1 from _apres where lu like 'ERREUR%') then
    raise exception 'NEXUS: un essai de lecture a échoué';
  end if;
  if exists (select 1 from _banc where resultat like 'ERREUR%') then
    raise exception 'NEXUS: un appel du banc a échoué sans être un refus';
  end if;
  -- Le recruteur universitaire (ON) ne lit plus AUCUNE fiche non cégépienne, nulle part.
  u := (select lu from _apres where o = 1);
  if exists (select 1 from unnest(string_to_array(u, ' ')) p where split_part(p, '/', 2) <> '0') then
    raise exception 'NEXUS: le recruteur universitaire lit encore une fiche non cégépienne : %', u;
  end if;
  -- Sous OFF, il ne lit RIEN (ni cégépien, ni autre).
  if (select lu from _apres where o = 2) <> '0/0 0/0 0/0 0/0 0/0 0/0' then
    raise exception 'NEXUS: sous OFF, le recruteur universitaire lit des fiches : %', (select lu from _apres where o = 2);
  end if;
  if exists (select 1 from _banc where moment = 'apres' and o = 1 and resultat like 'ok %' and split_part(resultat, '/', 2) <> '0') then
    raise exception 'NEXUS: une fonction rend une fiche non cégépienne au recruteur universitaire';
  end if;
  -- Tous les autres lecteurs : exactement la même chose qu'avant (OFF comme ON pour le collégial).
  if exists (select 1 from _apres a join _avant b using (o) where a.o not in (1, 2) and a.lu <> b.lu) then
    raise exception 'NEXUS: un lecteur autre que le recruteur universitaire voit autre chose qu''avant';
  end if;
  if exists (select 1 from _banc a join _banc b using (o, n) where a.moment = 'avant' and b.moment = 'apres' and a.o in (3, 5)
               and a.resultat <> b.resultat) then
    raise exception 'NEXUS: une fonction rend autre chose qu''avant au recruteur collégial ou au partenaire';
  end if;
  if exists (select 1 from _ecr where o in (1, 2, 3) and resultat like 'accepté%' and resultat <> 'accepté 0') then
    raise exception 'NEXUS: le recruteur universitaire écrit vers une fiche non cégépienne';
  end if;
  if exists (select 1 from _corps where not filtre) or (select count(*) from _corps) <> 19 then
    raise exception 'NEXUS: une des 19 fonctions n''a pas le filtre';
  end if;
  raise notice 'NEXUS: VERDICT D3a — recruteur universitaire : cégépiens seulement ; tout autre lecteur inchangé';
end $$;
select 'VERDICT' as verdict, 'conforme' as resultat;
-- [[REJEU

do $rb$ begin execute (select rollback from _d3a); end $rb$;
set local search_path = public, extensions;
create temp table _apres_rb on commit drop as select * from pg_temp.lecteurs();
do $$
begin
  if exists (select 1 from _apres_rb r join _avant a using (o) where r.lu <> a.lu)
     or exists (select 1 from pg_policies where policyname in ('non_cegepiens_masques_universitaires', 'non_cegepiens_ecriture_universitaires'))
     or to_regprocedure('nexus_prive.lecteur_universitaire()') is not null
     or exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and prosrc like '%lecteur_universitaire%') then
    raise exception 'NEXUS: après rollback, l''état d''avant n''est pas retrouvé';
  end if;
  raise notice 'NEXUS: rollback D3a vérifié (lectures identiques à AVANT, policies, règles et filtres retirés)';
end $$;

rollback;
\echo '== ROLLBACK fait : rien n''est appliqué.'
-- REJEU]]
-- [[APPLY

do $$
begin
  if public.lancement_universitaire_actif() then raise exception 'NEXUS: l''interrupteur doit rester OFF'; end if;
  if exists (select 1 from auth.users where id = (select neuf from _t)) then raise exception 'NEXUS: compte témoin resté'; end if;
end $$;
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select version, 'cegep_lot_d3a_universitaire_cegepiens_seulement', array[contenu], 'bptds22@gmail.com' from _d3a;

insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_CEGEP_LOT_D3A',
       'Chantier cégep, lot D3a : le recruteur universitaire ne voit que les cégépiens (secondaire, civil, sans école masqués en base), interrupteur OFF (GO BP)',
       jsonb_build_object('nom', 'cegep_lot_d3a_universitaire_cegepiens_seulement', 'version', version,
         'fichier', 'supabase/migrations/' || version || '_cegep_lot_d3a_universitaire_cegepiens_seulement.sql',
         'rollback', 'supabase/rollback/' || version || '_rollback_cegep_lot_d3a_universitaire_cegepiens_seulement.sql',
         'md5_fichier', '@@MD5_MIGRATION@@', 'md5_rollback', '@@MD5_ROLLBACK@@', 'voie', 'psql (session pooler)'),
       (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0')
  from _d3a;
do $$
begin
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '@@VERSION@@') then
    raise exception 'NEXUS: inscription schema_migrations absente';
  end if;
end $$;
select version as version_inscrite, clock_timestamp() as avant_commit from _d3a;
commit;
\echo '== COMMIT fait : lot D3a cégep en prod (recruteur universitaire : cégépiens seulement, interrupteur OFF).'
-- APPLY]]
