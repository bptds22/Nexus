-- ════════════════════════════════════════════════════════════════════════════
-- Lot C0 cégep — REJEU À BLANC de la migration @@VERSION@@. Fichier GÉNÉRÉ par
-- scripts/cegep-lot-c0/generer.sh <date> rejeu-blanc : migration et rollback embarqués (LF), md5 gardés.
--
-- UNE transaction qui finit par ROLLBACK : RIEN n'est appliqué.
--   A. Témoins (aucun nom affiché) : un recruteur collégial (Pro de préférence), un admin, un
--      partenaire, un coach ; un cégépien ; un athlète du secondaire ACTIF sans équipe ; un cégep et une
--      équipe de cégep.
--   B. Matrice AVANT : pour chaque acteur × athlète — favori, pipeline, fil recruteur ↔ coach, fil direct
--      (favori posé hors RLS, puis fil + premier message sous JWT), is_athlete_contactable — sous VRAI
--      JWT. Chaque essai est défait aussitôt ; il compte les avis qu'il aurait créés.
--   C. Empreinte du schéma public (fonctions md5 + ACL + réglages, policies, triggers).
--   D. La migration (md5 gardé).
--   E. Équivalence : pour CHAQUE compte, compte_voit_cegepiens(compte) = règle du lot A sous son JWT.
--   F. Matrice APRÈS : seul « recruteur collégial × cégépien » change, et tout y est refusé.
--   G. Verrou : OFF → nouvel ancrage cégep (UPDATE et INSERT) et rattachement à une équipe de cégep
--      refusés, cégépien déjà ancré intact ; ON → acceptés.
--   H. Le rollback (md5 gardé) : empreinte et matrice identiques à AVANT.
--   ROLLBACK, puis relecture hors transaction.
-- Lancer SANS -1, en postgres.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

create temp table _avis_noms (t text primary key);
insert into _avis_noms values ('public.athlete_notifications'), ('public.parent_notifications'),
  ('public.recruiter_contact_notifications'), ('public.parent_contact_avis'), ('public.recruiter_activity_log'),
  ('public.coach_activity_feed'), ('public.newsroom_events'), ('net.http_request_queue'),
  ('public.recruiter_favorites'), ('public.recruiter_pipeline'), ('public.conversations'), ('public.messages');
create temp table _hors (t text primary key, n bigint);
do $$
declare r record; n bigint;
begin
  for r in select t from _avis_noms loop
    if to_regclass(r.t) is not null then
      execute format('select count(*) from %s', r.t) into n;
      insert into _hors values (r.t, n);
    end if;
  end loop;
end $$;

begin;
set local lock_timeout = '3s';
set local statement_timeout = '300s';
set local search_path = public, extensions;
set local application_name = 'nexus-rejeu-blanc-cegep-c0';
select now() as debut, current_user, current_setting('server_version') as version;

-- ── 0. Gardes AVANT ──────────────────────────────────────────────────────────
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
end $$;

-- ── A. Témoins ───────────────────────────────────────────────────────────────
-- Sous JWT, en restant postgres pour lire : user_has_pro() du recruteur.
create function pg_temp.sous_jwt_bool(p_uid uuid, p_sql text) returns boolean language plpgsql as $$
declare v boolean;
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
  execute p_sql into v;
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
  return v;
end $$;

create temp table _t on commit drop as
with r as (
  select u.id from public.users u
   where u.role = 'RECRUTEUR'::public.user_role and not public.unite_voit_cegepiens(u.school_id)
   order by pg_temp.sous_jwt_bool(u.id, 'select public.user_has_pro()') desc, u.id limit 1),
x_cg as (
  select a.id from public.athletes a
   where a.status = 'ACTIF' and public.athlete_est_cegepien(a.id)
   order by public.is_messaging_blacked_out(a.id), a.id limit 1),
x_sec as (
  select a.id from public.athletes a join public.schools s on s.id = a.school_id and s.type::text = 'SECONDAIRE'
   where a.status = 'ACTIF'
     and not exists (select 1 from public.team_athletes ta where ta.athlete_id = a.id)
     and not exists (select 1 from public.recruiter_favorites f where f.athlete_id = a.id)
     and not exists (select 1 from public.recruiter_pipeline p where p.athlete_id = a.id)
     and not public.is_messaging_blacked_out(a.id)
   order by a.id limit 1)
select (select id from r) as r_col,
       (select u.id from public.users u where u.role = 'ADMIN'::public.user_role order by u.id limit 1) as admin,
       (select u.id from public.users u where u.role = 'PARTNER'::public.user_role order by u.id limit 1) as partenaire,
       (select u.id from public.users u where u.role = 'COACH'::public.user_role order by u.id limit 1) as coach,
       (select id from x_cg) as x_cg, (select id from x_sec) as x_sec,
       (select s.id from public.schools s where s.type::text = 'CEGEP' order by s.id limit 1) as ecole_cegep,
       (select t.id from public.teams t join public.schools s on s.id = t.school_id and s.type::text = 'CEGEP'
         where t.is_active order by t.id limit 1) as equipe_cegep;
do $$
begin
  if exists (select 1 from _t where r_col is null or admin is null or partenaire is null or coach is null
                                 or x_cg is null or x_sec is null or ecole_cegep is null or equipe_cegep is null) then
    raise exception 'NEXUS: un témoin manque';
  end if;
end $$;
select 'témoins trouvés (identifiants non affichés) ; recruteur collégial Pro : '
       || pg_temp.sous_jwt_bool(r_col, 'select public.user_has_pro()')
       || ' ; cégépien en période d''interdiction des messages : ' || public.is_messaging_blacked_out(x_cg) as temoins from _t;

-- Total des avis et des écritures suivies (lu en postgres).
create function pg_temp.compte_avis() returns text language plpgsql as $$
declare r record; n bigint; s text := '';
begin
  for r in select t from _avis_noms order by t loop
    if to_regclass(r.t) is not null then
      execute format('select count(*) from %s', r.t) into n;
      s := s || r.t || '=' || n || ';';
    end if;
  end loop;
  return s;
end $$;
create function pg_temp.delta(p_avant text, p_apres text) returns text language sql as $$
  select coalesce(string_agg(split_part(b.kv, '=', 1) || ' +' || (split_part(a.kv, '=', 2)::bigint - split_part(b.kv, '=', 2)::bigint), ', '
                             order by b.kv), '')
    from unnest(string_to_array(trim(trailing ';' from p_avant), ';')) with ordinality b(kv, i)
    join unnest(string_to_array(trim(trailing ';' from p_apres), ';')) with ordinality a(kv, j) on i = j
   where split_part(a.kv, '=', 2) <> split_part(b.kv, '=', 2);
$$;

-- Un essai : préparation hors RLS (p_prep, en postgres), puis l'écriture sous le JWT de p_uid, puis on
-- compte les avis créés, puis on DÉFAIT tout (NX000).
create function pg_temp.essai(p_uid uuid, p_prep text, p_sql text) returns text language plpgsql as $$
declare avant text; res text;
begin
  begin
    if p_prep is not null then execute p_prep; end if;
    avant := pg_temp.compte_avis();
    -- p_uid NULL : l'écriture passe en postgres (essais du verrou, qui est un trigger).
    if p_uid is not null then
      perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
    end if;
    execute p_sql;
    perform set_config('role', 'postgres', true);
    res := 'accepté' || coalesce(nullif(' (' || pg_temp.delta(avant, pg_temp.compte_avis()) || ')', ' ()'), '');
    raise exception using errcode = 'NX000', message = res;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'REFUSÉ ' || sqlstate || ' ' || left(sqlerrm, 110);
  end;
end $$;

create function pg_temp.matrice() returns table (acteur text, cible text, ecriture text, resultat text)
language plpgsql as $$
declare t record; a record; x record;
begin
  select * into t from _t;
  for a in select * from (values ('recruteur collégial', t.r_col), ('admin', t.admin), ('partenaire', t.partenaire)) v(nom, uid) loop
    for x in select * from (values ('cégépien', t.x_cg), ('secondaire', t.x_sec)) w(nom, id) loop
      acteur := a.nom; cible := x.nom;
      ecriture := '1 favori';
      resultat := pg_temp.essai(a.uid, null, format(
        'insert into public.recruiter_favorites (recruiter_id, athlete_id) values (%L, %L)', a.uid, x.id));
      return next;
      ecriture := '2 pipeline';
      resultat := pg_temp.essai(a.uid, null, format(
        'insert into public.recruiter_pipeline (recruiter_id, athlete_id) values (%L, %L)', a.uid, x.id));
      return next;
      ecriture := '3 fil recruteur ↔ coach';
      resultat := pg_temp.essai(a.uid, null, format(
        'insert into public.conversations (recruiter_id, coach_id, athlete_id, conversation_type) values (%L, %L, %L, %L)',
        a.uid, t.coach, x.id, 'RECRUTEUR_COACH'));
      return next;
      ecriture := '4 fil direct + message (favori posé hors RLS)';
      resultat := pg_temp.essai(a.uid,
        format('insert into public.recruiter_favorites (recruiter_id, athlete_id) select %L, %L where exists (select 1 from public.users where id = %L and role = %L) on conflict do nothing',
               a.uid, x.id, a.uid, 'RECRUTEUR'),
        -- Deux instructions : la policy de messages ne voit pas un fil inséré par la MÊME instruction.
        format('insert into public.conversations (recruiter_id, athlete_id, conversation_type) values (%L, %L, %L); '
               'insert into public.messages (conversation_id, sender_id, content) '
               'select c.id, %L, %L from public.conversations c where c.recruiter_id = %L and c.athlete_id = %L '
               'and c.conversation_type = %L order by c.created_at desc limit 1',
               a.uid, x.id, 'RECRUTEUR_ATHLETE', a.uid, 'rejeu à blanc C0', a.uid, x.id, 'RECRUTEUR_ATHLETE'));
      return next;
      ecriture := '5 is_athlete_contactable';
      resultat := case pg_temp.sous_jwt_bool(a.uid, format('select public.is_athlete_contactable(%L)', x.id))
                    when true then 'vrai' when false then 'faux' else '·' end;
      return next;
    end loop;
  end loop;
end $$;

-- ── B. Matrice AVANT ─────────────────────────────────────────────────────────
create temp table _avant on commit drop as select * from pg_temp.matrice();
select 'AVANT' as phase, * from _avant order by acteur, cible, ecriture;

-- ── C. Empreinte du schéma public ────────────────────────────────────────────
create function pg_temp.empreinte() returns table (ligne text) language sql as $$
  select 'F ' || p.oid::regprocedure::text || ' ' || md5(p.prosrc) || ' ' || coalesce(p.proacl::text, '·')
         || ' ' || coalesce(p.proconfig::text, '·') || ' ' || p.prosecdef::text || ' ' || p.provolatile::text
    from pg_proc p where p.pronamespace = 'public'::regnamespace
  union all
  select 'P ' || tablename || ' ' || policyname || ' ' || cmd || ' ' || permissive || ' ' || roles::text
         || ' ' || md5(coalesce(qual, '')) || ' ' || md5(coalesce(with_check, ''))
    from pg_policies where schemaname = 'public'
  union all
  select 'T ' || c.relname || ' ' || t.tgname || ' ' || md5(pg_get_triggerdef(t.oid)) || ' ' || t.tgenabled::text
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where not t.tgisinternal and c.relnamespace = 'public'::regnamespace
  union all
  select 'S ' || key || ' ' || md5(value) from public.app_settings;
$$;
create temp table _emp_avant on commit drop as select * from pg_temp.empreinte();
select count(*) as lignes_empreinte from _emp_avant;

-- ── D. La migration ──────────────────────────────────────────────────────────
create temp table _c0 on commit drop as
select $nexus_mig$@@MIGRATION@@$nexus_mig$::text as migration,
       $nexus_rb$@@ROLLBACK@@$nexus_rb$::text as rollback;
select clock_timestamp() as debut_migration;
do $m$
begin
  if (select md5(migration) from _c0) <> '@@MD5_MIGRATION@@' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(migration) from _c0);
  end if;
  execute (select migration from _c0);
end $m$;
select clock_timestamp() as fin_migration;
set local search_path = public, extensions;

-- ── E. Équivalence de la règle, compte par compte ────────────────────────────
create temp table _eq on commit drop as
select u.id, u.role::text as role, public.compte_voit_cegepiens(u.id) as c0,
       pg_temp.sous_jwt_bool(u.id, 'select not public.is_recruiter() or public.peut_voir_cegepiens()') as lot_a
  from public.users u;
select 'équivalence règle C0 / règle lot A' as sonde, count(*) as comptes,
       count(*) filter (where c0 is distinct from lot_a) as ecarts,
       count(*) filter (where not c0) as recruteurs_masques from _eq;
do $$
begin
  if exists (select 1 from _eq where c0 is distinct from lot_a) then
    raise exception 'NEXUS: compte_voit_cegepiens diffère de la règle du lot A pour % compte(s)',
      (select count(*) from _eq where c0 is distinct from lot_a);
  end if;
end $$;

-- ── F. Matrice APRÈS ─────────────────────────────────────────────────────────
create temp table _apres on commit drop as select * from pg_temp.matrice();
select 'APRÈS' as phase, p.*, case when p.resultat = b.resultat then '=' else 'CHANGE' end as vs_avant
  from _apres p join _avant b using (acteur, cible, ecriture) order by acteur, cible, ecriture;
do $$
begin
  if exists (select 1 from _apres p join _avant b using (acteur, cible, ecriture)
              where p.resultat is distinct from b.resultat
                and not (p.acteur = 'recruteur collégial' and p.cible = 'cégépien')) then
    raise exception 'NEXUS: une écriture change hors « recruteur collégial × cégépien »';
  end if;
  if exists (select 1 from _apres where acteur = 'recruteur collégial' and cible = 'cégépien'
                and ((ecriture like '5 %' and resultat <> 'faux') or (ecriture not like '5 %' and resultat not like 'REFUSÉ%'))) then
    raise exception 'NEXUS: le recruteur collégial écrit encore vers le cégépien';
  end if;
end $$;

-- ── G. Verrou ────────────────────────────────────────────────────────────────
create function pg_temp.verrou() returns table (cas text, resultat text) language plpgsql as $$
declare t record;
begin
  select * into t from _t;
  cas := 'nouvel ancrage cégep (UPDATE)';
  resultat := pg_temp.essai(null, null, format('update public.athletes set school_id = %L where id = %L', t.ecole_cegep, t.x_sec));
  return next;
  cas := 'nouvel athlète ancré cégep (INSERT)';
  resultat := pg_temp.essai(null, null, format('insert into public.athletes (first_name, last_name, school_id) values (%L, %L, %L)', 'Rejeu', 'C0', t.ecole_cegep));
  return next;
  cas := 'rattachement à une équipe de cégep';
  resultat := pg_temp.essai(null, null, format('insert into public.team_athletes (team_id, athlete_id) values (%L, %L)', t.equipe_cegep, t.x_sec));
  return next;
  cas := 'cégépien déjà ancré : mise à jour sans changer d''école';
  resultat := pg_temp.essai(null, null, format('update public.athletes set school_id = school_id, updated_at = updated_at where id = %L', t.x_cg));
  return next;
end $$;
-- Les essais du verrou tournent en postgres (le verrou est un trigger : le chemin ne compte pas).
create temp table _v_off on commit drop as select * from pg_temp.verrou();
select 'VERROU OFF' as phase, * from _v_off;
update public.app_settings set value = ' True ' where key = 'lancement_collegial';
create temp table _v_on on commit drop as select * from pg_temp.verrou();
select 'VERROU ON' as phase, * from _v_on;
update public.app_settings set value = 'false' where key = 'lancement_collegial';
do $$
begin
  if exists (select 1 from _v_off where cas not like 'cégépien%' and resultat not like 'REFUSÉ 42501 NEXUS: Les cégeps ne sont pas encore ouverts%') then
    raise exception 'NEXUS: le verrou laisse passer un nouvel ancrage ou rattachement sous OFF';
  end if;
  if exists (select 1 from _v_off where cas like 'cégépien%' and resultat not like 'accepté%') then
    raise exception 'NEXUS: le verrou bloque le cégépien déjà ancré';
  end if;
  if exists (select 1 from _v_on where resultat like 'REFUSÉ 42501 NEXUS: Les cégeps%') then
    raise exception 'NEXUS: le verrou refuse encore sous ON';
  end if;
end $$;

-- ── H. Le rollback ───────────────────────────────────────────────────────────
do $r$
begin
  if (select md5(rollback) from _c0) <> '@@MD5_ROLLBACK@@' then
    raise exception 'NEXUS: texte du rollback altéré (md5 %)', (select md5(rollback) from _c0);
  end if;
  execute (select rollback from _c0);
end $r$;
set local search_path = public, extensions;
create temp table _emp_apres on commit drop as select * from pg_temp.empreinte();
create temp table _apres_rb on commit drop as select * from pg_temp.matrice();
select 'empreinte avant / après rollback' as sonde,
       (select count(*) from (select * from _emp_avant except select * from _emp_apres) x) as disparues,
       (select count(*) from (select * from _emp_apres except select * from _emp_avant) x) as apparues,
       (select count(*) from _apres_rb r join _avant b using (acteur, cible, ecriture) where r.resultat is distinct from b.resultat) as matrice_ecarts;
do $$
begin
  if exists (select * from _emp_avant except select * from _emp_apres)
     or exists (select * from _emp_apres except select * from _emp_avant) then
    raise exception 'NEXUS: l''empreinte du schéma diffère après rollback';
  end if;
  if exists (select 1 from _apres_rb r join _avant b using (acteur, cible, ecriture) where r.resultat is distinct from b.resultat) then
    raise exception 'NEXUS: la matrice diffère après rollback';
  end if;
end $$;
select 'VERDICT : seul « recruteur collégial × cégépien » change (tout refusé, aucun avis) ; règle identique au lot A pour tous les comptes ; verrou refuse sous OFF, accepte sous ON, cégépien déjà ancré intact ; rollback à l''identique' as verdict,
       clock_timestamp() as avant_rollback;
rollback;

-- ── Relecture hors transaction ───────────────────────────────────────────────
create temp table _hors_apres (t text primary key, n bigint);
do $$
declare r record; n bigint;
begin
  for r in select t from _hors loop
    execute format('select count(*) from %s', r.t) into n;
    insert into _hors_apres values (r.t, n);
  end loop;
end $$;
select h.t as table_suivie, h.n as avant, a.n as apres from _hors h join _hors_apres a using (t) order by h.t;
select exists (select 1 from public.app_settings where key = 'lancement_collegial') as interrupteur_reste,
       (select count(*) from pg_policies where policyname = 'cegepiens_ecriture_recruteurs') as policies_restent,
       (select md5(prosrc) from pg_proc where oid = 'public.is_athlete_contactable(uuid)'::regprocedure) as contactable_md5,
       (select max(version) from supabase_migrations.schema_migrations) as derniere_version;
\echo '== ROLLBACK fait : rien n''est appliqué.'
