-- ════════════════════════════════════════════════════════════════════════════
-- Lot C1b cégep — REJEU À BLANC de la migration @@VERSION@@ (vérification automatique des
-- cégépiens). Préalable : C1a (valeur auto_cegep) EN PROD. Fichier GÉNÉRÉ par
-- scripts/cegep-lot-c1/generer.sh c1b <date> rejeu-blanc : migration et rollback embarqués (LF), md5
-- gardés.
--
-- UNE transaction qui finit par ROLLBACK : RIEN n'est appliqué. L'interrupteur lancement_collegial est
-- passé à ON DANS la transaction (sinon le verrou C0 refuse tout ancrage cégep), puis remis.
--   A. Témoins (aucun nom affiché) : un athlète du secondaire ACTIF, sans équipe, non vérifié, avec un
--      compte ; un athlète vérifié par un humain ; le cégépien déjà ancré ; une équipe de cégep (même
--      sport que le premier si possible) ; une autre école secondaire.
--   B. Essais AVANT (ON) : chacun défait aussitôt ; il dit l'état de vérification obtenu et compte les
--      avis et écritures qu'il aurait créés.
--   C. Empreinte du schéma public.
--   D. La migration (md5 gardé).
--   E. Essais APRÈS (ON) : mêmes avis ; seule la vérification change, là où elle doit.
--   F. Sous OFF : le rattachement à une équipe de cégep est refusé par le verrou C0, rien n'est vérifié.
--   G. Le rollback (md5 gardé) : empreinte et essais identiques à AVANT.
--   Fiche test (créée dans la transaction) : ancrage cégep → vérifiée auto_cegep ; sortie → grise.
--   Empreinte des FICHES athlètes (chaque ligne, dont verified et verification_method) : identique au
--   début, après la migration et ses essais, et après le rollback.
--   Avis « Ton coach a vérifié ton profil » et file pg_net : rien de plus pour la vérification automatique.
--   Gardes : postgres, interrupteur OFF, C1a = dernière version, C1b absente.
--   ROLLBACK, puis relecture hors transaction.
-- Lancer SANS -1, en postgres.
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

create temp table _avis_noms (t text primary key);
insert into _avis_noms values ('public.athlete_notifications'), ('public.parent_notifications'),
  ('public.activities'), ('public.recruiter_activity_log'), ('public.coach_activity_feed'),
  ('public.newsroom_events'), ('public.admin_notifications'), ('net.http_request_queue'),
  ('public.team_athletes');
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
create temp table _hors_verif as
select count(*) filter (where verified) as verifiees, count(*) filter (where verification_method::text = 'auto_cegep') as auto_cegep
  from public.athletes;

begin;
set local lock_timeout = '3s';
set local statement_timeout = '300s';
set local search_path = public, extensions;
set local application_name = 'nexus-rejeu-blanc-cegep-c1b';
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
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '@@VERSION_C1A@@') then
    raise exception 'NEXUS: C1a (@@VERSION_C1A@@) n''est pas inscrite — l''appliquer d''abord';
  end if;
  -- Gardes demandées par BP (2026-10-27) : C1a est la dernière version, C1b absente, interrupteur OFF.
  if v is distinct from '@@VERSION_C1A@@' then
    raise exception 'NEXUS: dernière version % au lieu de @@VERSION_C1A@@ (C1a)', v;
  end if;
  if to_regprocedure('public.verification_auto_cegep()') is not null
     or exists (select 1 from pg_trigger where tgname = 'trg_verification_auto_cegep') then
    raise exception 'NEXUS: C1b est déjà présente (fonction ou trigger)';
  end if;
  if to_regprocedure('public.lancement_collegial_actif()') is null or public.lancement_collegial_actif() then
    raise exception 'NEXUS: l''interrupteur lancement_collegial n''est pas OFF';
  end if;
end $$;

-- ── A. Témoins ───────────────────────────────────────────────────────────────
create temp table _t on commit drop as
with x_sec as (
  select a.id, a.sport_id from public.athletes a
    join public.schools s on s.id = a.school_id and s.type::text = 'SECONDAIRE'
   where a.status = 'ACTIF' and a.user_id is not null and not a.verified
     and not exists (select 1 from public.team_athletes ta where ta.athlete_id = a.id)
   order by (a.date_naissance <= current_date - interval '18 years') desc nulls last,
            coalesce(a.consentement_parental, false) desc, a.id
   limit 1),
x_hum as (
  select a.id from public.athletes a
    join public.schools s on s.id = a.school_id and s.type::text = 'SECONDAIRE'
   where a.verified and a.verification_method::text in ('manuel_coach', 'manuel_directeur', 'auto')
   order by a.id limit 1)
select (select id from x_sec) as x_sec,
       (select id from x_hum) as x_hum,
       (select a.id from public.athletes a join public.schools s on s.id = a.school_id and s.type::text = 'CEGEP'
         order by a.id limit 1) as x_cg,
       (select t.id from public.teams t join public.schools s on s.id = t.school_id and s.type::text = 'CEGEP'
         where t.is_active order by (t.sport_id is not distinct from (select sport_id from x_sec)) desc, t.id limit 1) as equipe_cegep,
       (select s.id from public.schools s where s.type::text = 'SECONDAIRE'
           and s.id <> (select a.school_id from public.athletes a where a.id = (select id from x_sec))
         order by s.id limit 1) as autre_sec;
create temp table _t2 on commit drop as
select t.*, (select school_id from public.teams where id = t.equipe_cegep) as ecole_cegep,
       (select u.id from public.athletes a join public.users u on u.id = a.user_id where a.id = t.x_sec) as x_sec_uid
  from _t t;
do $$
begin
  if exists (select 1 from _t2 where x_sec is null or x_hum is null or equipe_cegep is null or autre_sec is null or x_sec_uid is null) then
    raise exception 'NEXUS: un témoin manque';
  end if;
end $$;
select 'témoins trouvés (identifiants non affichés) ; secondaire majeur : '
       || coalesce((select (a.date_naissance <= current_date - interval '18 years')::text from public.athletes a where a.id = x_sec), '·')
       || ' ; même sport que l''équipe de cégep : '
       || ((select sport_id from public.athletes where id = x_sec) is not distinct from (select sport_id from public.teams where id = equipe_cegep))::text
       || ' ; cégépien déjà ancré : ' || (x_cg is not null)::text as temoins from _t2;

create function pg_temp.compte_avis() returns text language plpgsql as $$
declare r record; n bigint; s text := '';
begin
  for r in select t from _avis_noms order by t loop
    if to_regclass(r.t) is not null then
      execute format('select count(*) from %s', r.t) into n;
      s := s || r.t || '=' || n || ';';
    end if;
  end loop;
  -- Le seul avis qu'une vérification peut créer (notify_athlete_verified).
  s := s || 'avis_coach_verifie=' || (select count(*) from public.athlete_notifications
                                        where title = 'Ton coach a vérifié ton profil') || ';';
  return s;
end $$;
create function pg_temp.delta(p_avant text, p_apres text) returns text language sql as $$
  select coalesce(string_agg(split_part(b.kv, '=', 1) || ' +' || (split_part(a.kv, '=', 2)::bigint - split_part(b.kv, '=', 2)::bigint), ', '
                             order by b.kv), '')
    from unnest(string_to_array(trim(trailing ';' from p_avant), ';')) with ordinality b(kv, i)
    join unnest(string_to_array(trim(trailing ';' from p_apres), ';')) with ordinality a(kv, j) on i = j
   where split_part(a.kv, '=', 2) <> split_part(b.kv, '=', 2);
$$;
-- État de vérification d'une fiche, sans rien d'identifiant.
create function pg_temp.etat(p_id uuid) returns text language sql as $$
  select coalesce(s.type::text, 'sans école') || ' / ' || case when a.verified then 'vérifié' else 'non vérifié' end
         || ' / ' || coalesce(a.verification_method::text, '·')
         || case when a.verified then ' / par ' || case when a.verified_by is null then 'personne' else 'un compte' end else '' end
    from public.athletes a left join public.schools s on s.id = a.school_id where a.id = p_id;
$$;

-- Un essai : préparation (postgres), écriture (sous le JWT de p_uid, ou postgres si NULL), lecture de
-- l'état, avis créés, puis on DÉFAIT tout (NX000).
create function pg_temp.essai(p_uid uuid, p_prep text, p_sql text, p_cible text) returns text language plpgsql as $$
declare avant text; res text; v_id uuid;
begin
  begin
    if p_prep is not null then execute p_prep; end if;
    avant := pg_temp.compte_avis();
    if p_uid is not null then
      perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
    end if;
    execute p_sql;
    perform set_config('role', 'postgres', true);
    perform set_config('request.jwt.claims', '', true);
    execute p_cible into v_id;
    res := 'accepté → ' || coalesce(pg_temp.etat(v_id), '·')
           || coalesce(nullif(' (' || pg_temp.delta(avant, pg_temp.compte_avis()) || ')', ' ()'), '');
    raise exception using errcode = 'NX000', message = res;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'REFUSÉ ' || sqlstate || ' ' || left(sqlerrm, 110);
  end;
end $$;

create function pg_temp.essais() returns table (cas text, resultat text) language plpgsql as $$
declare t record;
begin
  select * into t from _t2;
  cas := '1 nouvel athlète inscrit, ancré à un cégep (INSERT)';
  resultat := pg_temp.essai(null, null,
    format('insert into public.athletes (first_name, last_name, school_id, status) values (%L, %L, %L, %L)', 'Rejeu', 'C1b', t.ecole_cegep, 'ACTIF'),
    $q$select id from public.athletes where first_name = 'Rejeu' and last_name = 'C1b' order by created_at desc limit 1$q$);
  return next;
  cas := '2 athlète du secondaire rejoint une équipe de cégep (apply_team_attachment, son JWT)';
  resultat := pg_temp.essai(t.x_sec_uid, null,
    format('select public.apply_team_attachment(%L, null, true)', t.equipe_cegep),
    format('select %L::uuid', t.x_sec));
  return next;
  cas := '3 athlète du secondaire change d''école secondaire';
  resultat := pg_temp.essai(null, null,
    format('update public.athletes set school_id = %L where id = %L', t.autre_sec, t.x_sec),
    format('select %L::uuid', t.x_sec));
  return next;
  cas := '4 athlète vérifié par un humain, ancré à un cégep';
  resultat := pg_temp.essai(null, null,
    format('update public.athletes set school_id = %L where id = %L', t.ecole_cegep, t.x_hum),
    format('select %L::uuid', t.x_hum));
  return next;
  cas := '5 athlète ancré au cégep puis revenu au secondaire';
  resultat := pg_temp.essai(null,
    format('update public.athletes set school_id = %L where id = %L', t.ecole_cegep, t.x_sec),
    format('update public.athletes set school_id = %L where id = %L', t.autre_sec, t.x_sec),
    format('select %L::uuid', t.x_sec));
  return next;
  cas := '6 cégépien déjà ancré : mise à jour sans changer d''école';
  resultat := case when t.x_cg is null then '· (aucun cégépien)' else pg_temp.essai(null, null,
    format('update public.athletes set school_id = school_id, updated_at = updated_at where id = %L', t.x_cg),
    format('select %L::uuid', t.x_cg)) end;
  return next;
  cas := '7 athlète du secondaire : sa propre mise à jour d''un champ libre (son JWT)';
  resultat := pg_temp.essai(t.x_sec_uid, null,
    format('update public.athletes set bio = coalesce(bio, %L) where id = %L', '', t.x_sec),
    format('select %L::uuid', t.x_sec));
  return next;
end $$;

-- Empreinte des FICHES athlètes : chaque ligne complète (verified, verification_method compris).
create function pg_temp.empreinte_fiches() returns text language sql as $$
  select count(*) || ' fiches ; ' || count(*) filter (where a.verified) || ' vérifiées ; '
         || count(*) filter (where a.verification_method::text = 'auto_cegep') || ' auto_cegep ; md5 '
         || md5(coalesce(string_agg(a::text, '|' order by a.id), ''))
    from public.athletes a;
$$;
create temp table _fiches on commit drop as select 'début' as moment, pg_temp.empreinte_fiches() as empreinte;
select * from _fiches;

-- Fiche test créée dans la transaction : secondaire → cégep → secondaire, puis tout est défait (NX000).
create function pg_temp.fiche_test() returns text language plpgsql as $$
declare t record; v_id uuid; avant text; e1 text; e2 text;
begin
  select * into t from _t2;
  begin
    avant := pg_temp.compte_avis();
    insert into public.athletes (first_name, last_name, school_id, status)
    values ('Rejeu', 'C1b-fiche', t.autre_sec, 'ACTIF') returning id into v_id;
    update public.athletes set school_id = t.ecole_cegep where id = v_id;
    e1 := pg_temp.etat(v_id);
    update public.athletes set school_id = t.autre_sec where id = v_id;
    e2 := pg_temp.etat(v_id);
    raise exception using errcode = 'NX000', message = 'ancrage cégep → ' || e1 || ' ; sortie du cégep → ' || e2
      || coalesce(nullif(' (' || pg_temp.delta(avant, pg_temp.compte_avis()) || ')', ' ()'), '');
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'REFUSÉ ' || sqlstate || ' ' || left(sqlerrm, 110);
  end;
end $$;

-- ── B. Essais AVANT (interrupteur ON dans la transaction) ────────────────────
update public.app_settings set value = 'true' where key = 'lancement_collegial';
create temp table _avant on commit drop as select * from pg_temp.essais();
select 'AVANT' as phase, * from _avant order by cas;
create temp table _ft_avant on commit drop as select pg_temp.fiche_test() as resultat;
select 'AVANT' as phase, '8 fiche test (créée dans la transaction)' as cas, resultat from _ft_avant;

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
   where not t.tgisinternal and c.relnamespace = 'public'::regnamespace;
$$;
create temp table _emp_avant on commit drop as select * from pg_temp.empreinte();
select count(*) as lignes_empreinte from _emp_avant;

-- ── D. La migration ──────────────────────────────────────────────────────────
create temp table _c1b on commit drop as
select $nexus_mig$@@MIGRATION@@$nexus_mig$::text as migration,
       $nexus_rb$@@ROLLBACK@@$nexus_rb$::text as rollback;
select clock_timestamp() as debut_migration;
do $m$
begin
  if (select md5(migration) from _c1b) <> '@@MD5_MIGRATION@@' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', (select md5(migration) from _c1b);
  end if;
  execute (select migration from _c1b);
end $m$;
select clock_timestamp() as fin_migration;
set local search_path = public, extensions;

-- ── E. Essais APRÈS ──────────────────────────────────────────────────────────
create temp table _apres on commit drop as select * from pg_temp.essais();
select 'APRÈS' as phase, p.*, case when p.resultat = b.resultat then '=' else 'CHANGE' end as vs_avant
  from _apres p join _avant b using (cas) order by cas;
create temp table _ft_apres on commit drop as select pg_temp.fiche_test() as resultat;
select 'APRÈS' as phase, '8 fiche test (créée dans la transaction)' as cas, resultat from _ft_apres;
insert into _fiches select 'après la migration et ses essais', pg_temp.empreinte_fiches();
do $$
begin
  if (select resultat from _ft_apres) not like 'ancrage cégep → CEGEP / vérifié / auto_cegep / par personne ; sortie du cégep → SECONDAIRE / non vérifié / ·%' then
    raise exception 'NEXUS: fiche test — ancrage ou sortie du cégep inattendu : %', (select resultat from _ft_apres);
  end if;
  if (select resultat from _ft_apres) ~ '(athlete_notifications|http_request_queue|avis_coach_verifie)' then
    raise exception 'NEXUS: fiche test — un avis ou un envoi pg_net a été mis en file';
  end if;
  if exists (select 1 from _apres where resultat like '%avis_coach_verifie%') then
    raise exception 'NEXUS: un avis « Ton coach a vérifié ton profil » a été créé';
  end if;
  if (select count(distinct empreinte) from _fiches) <> 1 then
    raise exception 'NEXUS: une fiche athlète existante a changé';
  end if;
end $$;
-- Ce qui doit changer, et seulement ça : 1 et 2 vérifiés 'auto_cegep' par personne, sans un avis de plus.
create function pg_temp.sans_etat(r text) returns text language sql as $$
  select regexp_replace(r, '→ [^(]*', '→ ');
$$;
do $$
begin
  if exists (select 1 from _apres p join _avant b using (cas)
              where pg_temp.sans_etat(p.resultat) is distinct from pg_temp.sans_etat(b.resultat)) then
    raise exception 'NEXUS: un essai change d''avis, d''écritures ou d''acceptation (au-delà de la vérification)';
  end if;
  if exists (select 1 from _apres where left(cas, 1) in ('1', '2')
                and resultat not like 'accepté → CEGEP / vérifié / auto_cegep / par personne%') then
    raise exception 'NEXUS: un nouvel ancrage cégep n''est pas vérifié auto_cegep';
  end if;
  if exists (select 1 from _apres p join _avant b using (cas)
              where left(p.cas, 1) in ('3', '4', '6', '7') and p.resultat is distinct from b.resultat) then
    raise exception 'NEXUS: la vérification change hors d''un nouvel ancrage cégep';
  end if;
  if exists (select 1 from _apres where left(cas, 1) = '5' and resultat not like 'accepté → SECONDAIRE / non vérifié / ·%') then
    raise exception 'NEXUS: un athlète auto_cegep revenu au secondaire garde son crochet';
  end if;
end $$;

-- ── F. Sous OFF ──────────────────────────────────────────────────────────────
update public.app_settings set value = 'false' where key = 'lancement_collegial';
create temp table _off on commit drop as
select pg_temp.essai(t.x_sec_uid, null, format('select public.apply_team_attachment(%L, null, true)', t.equipe_cegep),
                     format('select %L::uuid', t.x_sec)) as resultat from _t2 t;
select 'OFF' as phase, '2 athlète du secondaire rejoint une équipe de cégep' as cas, resultat from _off;
do $$
begin
  if (select resultat from _off) not like 'REFUSÉ % NEXUS: Les cégeps ne sont pas encore ouverts%'
     and (select resultat from _off) not like 'REFUSÉ %cégeps ne sont pas encore ouverts%' then
    raise exception 'NEXUS: sous OFF, le rattachement à une équipe de cégep n''est pas refusé par le verrou';
  end if;
end $$;
update public.app_settings set value = 'true' where key = 'lancement_collegial';

-- ── G. Le rollback ───────────────────────────────────────────────────────────
do $r$
begin
  if (select md5(rollback) from _c1b) <> '@@MD5_ROLLBACK@@' then
    raise exception 'NEXUS: texte du rollback altéré (md5 %)', (select md5(rollback) from _c1b);
  end if;
  execute (select rollback from _c1b);
end $r$;
set local search_path = public, extensions;
create temp table _emp_apres on commit drop as select * from pg_temp.empreinte();
create temp table _apres_rb on commit drop as select * from pg_temp.essais();
select 'empreinte avant / après rollback' as sonde,
       (select count(*) from (select * from _emp_avant except select * from _emp_apres) x) as disparues,
       (select count(*) from (select * from _emp_apres except select * from _emp_avant) x) as apparues,
       (select count(*) from _apres_rb r join _avant b using (cas) where r.resultat is distinct from b.resultat) as essais_ecarts;
do $$
begin
  if exists (select * from _emp_avant except select * from _emp_apres)
     or exists (select * from _emp_apres except select * from _emp_avant) then
    raise exception 'NEXUS: l''empreinte du schéma diffère après rollback';
  end if;
  if exists (select 1 from _apres_rb r join _avant b using (cas) where r.resultat is distinct from b.resultat) then
    raise exception 'NEXUS: les essais diffèrent après rollback';
  end if;
end $$;
update public.app_settings set value = 'false' where key = 'lancement_collegial';
insert into _fiches select 'après le rollback', pg_temp.empreinte_fiches();
select * from _fiches;
do $$
begin
  if (select count(distinct empreinte) from _fiches) <> 1 then
    raise exception 'NEXUS: l''empreinte des fiches athlètes diffère';
  end if;
end $$;
select 'VERDICT : aucune fiche existante ne change ; fiche test : ancrage cégep → vérifiée auto_cegep par personne, sortie → grise ; nouvel ancrage cégep → vérifié auto_cegep, sans avis « coach a vérifié » ni envoi pg_net de plus ; rien d''autre ne change ; sous OFF le verrou refuse ; rollback à l''identique' as verdict,
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
select v.verifiees as verifiees_avant,
       (select count(*) filter (where verified) from public.athletes) as verifiees_apres,
       (select count(*) filter (where verification_method::text = 'auto_cegep') from public.athletes) as auto_cegep_apres,
       (select value from public.app_settings where key = 'lancement_collegial') as interrupteur,
       (select count(*) from pg_trigger where tgname = 'trg_verification_auto_cegep') as trigger_reste,
       (select max(version) from supabase_migrations.schema_migrations) as derniere_version
  from _hors_verif v;
\echo '== ROLLBACK fait : rien n''est appliqué.'
