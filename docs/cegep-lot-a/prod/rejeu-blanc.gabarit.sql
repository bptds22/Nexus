-- ════════════════════════════════════════════════════════════════════════════
-- Lot A cégep — REJEU À BLANC EN PROD (journal compris, GO BP 2026-10-25).
-- NE LAISSE RIEN : tout tourne dans UNE transaction qui finit par ROLLBACK ; toute erreur
-- arrête psql avant (ON_ERROR_STOP) et la session se ferme sans COMMIT.
--
-- Fichier GÉNÉRÉ par scripts/cegep-lot-a-rejeu-blanc.sh à partir de ce gabarit : la migration
-- et le rollback y sont embarqués tels quels, gardés par leur md5.
--
-- Lancement (BP, pooler de session, SANS -1) :
--   $env:PGCLIENTENCODING="UTF8"
--   psql "host=aws-1-ca-central-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.<ref>" `
--        -v ON_ERROR_STOP=1 -f docs/cegep-lot-a/prod/rejeu-blanc-20261025.sql
--
-- Déroulé : mesure AVANT → migration (garde md5 du texte) → mesure APRÈS → rollback (garde md5
-- du texte) → mesure APRÈS ROLLBACK → rapports → ROLLBACK.
-- Chaque cellule tourne sous le rôle du compte (authenticated + request.jwt.claims, ou anon),
-- jamais en superuser, dans une sous-transaction annulée. Le rapport n'affiche que des
-- compteurs et des débuts d'identifiant, aucun nom.
--
-- Verrous : de la migration au ROLLBACK, athletes, team_athletes, athlete_badges, evaluations,
-- recruiter_athlete_views et recruiter_activity_log sont verrouillées (CREATE POLICY) — les
-- lectures de l'app attendent pendant ce temps (mesuré en local : voir le rapport).
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'
\if :{?temoin}
\else
  \set temoin ''
\endif

begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';
set local application_name = 'nexus-rejeu-blanc-lot-a';
select now() as debut, current_user, current_setting('server_version') as version;

-- ── Le témoin (admin_operations, ou -v temoin=<uuid> en local) ────────────────
create temp table _t as
select coalesce(nullif(:'temoin', '')::uuid,
                (select (details->>'athlete_id')::uuid from public.admin_operations
                  where operation = 'RATTACHEMENT_CEGEPIEN_TEST_LOT_A' order by le desc limit 1)) as id;
do $$
begin
  if (select id from _t) is null then raise exception 'NEXUS: témoin introuvable'; end if;
  if not exists (select 1 from public.athletes a join public.schools s on s.id = a.school_id
                  where a.id = (select id from _t) and s.type::text = 'CEGEP') then
    raise exception 'NEXUS: le témoin n''est plus ancré sur un cégep';
  end if;
  if to_regprocedure('public.athlete_est_cegepien(uuid)') is not null then
    raise exception 'NEXUS: le lot A est déjà en place — rejeu à blanc sans objet';
  end if;
end $$;

-- ── Les comptes ──────────────────────────────────────────────────────────────
-- Tous les recruteurs (collégiaux, admins de cégep, sans école, désactivés compris), un admin,
-- un partenaire, le coach du témoin et un autre coach, le témoin lui-même, son parent, anon.
create temp table _c (cle text primary key, uid uuid, role text, cat text);
insert into _c
select 'R' || lpad(row_number() over (order by u.id)::text, 2, '0') || ' ' || left(u.id::text, 8), u.id, 'authenticated',
       case when s.type::text = 'CEGEP' then 'collégial' || case when u.is_school_admin then ' admin du cégep' else '' end
            when u.school_id is null then 'sans école'
            else 'école ' || s.type::text end
       || case when u.status::text <> 'ACTIF' then ' (' || u.status::text || ')' else '' end
       || case when exists (select 1 from public.recruiter_activity_log l
                             where l.recruiter_id = u.id and l.athlete_id = (select id from _t))
               then ' [journal du témoin]' else '' end
  from public.users u left join public.schools s on s.id = u.school_id
 where u.role = 'RECRUTEUR'::public.user_role;
insert into _c select 'ADMIN', (select id from public.users where role = 'ADMIN'::public.user_role order by id limit 1), 'authenticated', 'admin';
insert into _c select 'PARTENAIRE', (select id from public.users where role = 'PARTNER'::public.user_role order by id limit 1), 'authenticated', 'partenaire';
insert into _c select 'COACH DU TÉMOIN', (select coach_id from public.athletes where id = (select id from _t)), 'authenticated', 'coach';
insert into _c select 'COACH', (select id from public.users where role = 'COACH'::public.user_role
                                   and id is distinct from (select coach_id from public.athletes where id = (select id from _t))
                                 order by id limit 1), 'authenticated', 'coach';
insert into _c select 'TÉMOIN', (select user_id from public.athletes where id = (select id from _t)), 'authenticated', 'athlète';
insert into _c select 'PARENT DU TÉMOIN', (select parent_user_id from public.parent_athletes where athlete_id = (select id from _t) order by id limit 1), 'authenticated', 'parent';
insert into _c values ('ANON', null, 'anon', 'anon');
delete from _c where uid is null and role <> 'anon';
select cat, count(*) as comptes from _c group by cat order by cat;

-- ── Les surfaces ({T} = le témoin) ───────────────────────────────────────────
create temp table _s (cle text primary key, q text);
insert into _s values
  ('s01 athletes : le témoin',                $$select count(*) from public.athletes where id = {T}$$),
  ('s02 athletes : total lisible',            $$select count(*) from public.athletes$$),
  ('s03 athletes : par ancrage',              $$select coalesce(string_agg(k || ':' || n, ',' order by k), '-')
                                                  from (select coalesce(s.type::text, 'aucun') k, count(*) n
                                                          from public.athletes a left join public.schools s on s.id = a.school_id group by 1) z$$),
  ('s04 recruiter_search_athletes()',         $$select 'tot:' || count(*) || ',temoin:' || count(*) filter (where id = {T}) from public.recruiter_search_athletes()$$),
  ('s05 recruiter_athlete_profile(témoin)',   $$select count(*) from public.recruiter_athlete_profile({T})$$),
  ('s06 recruiter_athlete_cards(témoin)',     $$select count(*) from public.recruiter_athlete_cards(array[{T}])$$),
  ('s07 team_athletes : le témoin',           $$select count(*) from public.team_athletes where athlete_id = {T}$$),
  ('s08 athlete_badges : le témoin',          $$select count(*) from public.athlete_badges where athlete_id = {T}$$),
  ('s09 evaluations : le témoin',             $$select count(*) from public.evaluations where athlete_id = {T}$$),
  ('s10 recruiter_athlete_views : le témoin', $$select count(*) from public.recruiter_athlete_views where athlete_id = {T}$$),
  ('s11 athletes_targeting_my_cegep',         $$select count(*) from public.athletes_targeting_my_cegep()$$),
  ('s12 matchs_recherche (30 j)',             $$select 'matchs:' || count(*) || ',profils:' || coalesce(sum(nb_profils), 0)
                                                  from public.matchs_recherche(current_date, current_date + 30)$$),
  ('s13 journal : lignes du témoin',          $$select count(*) from public.recruiter_activity_log where athlete_id = {T}$$),
  ('s14 journal : total lisible',             $$select count(*) from public.recruiter_activity_log$$),
  ('s15 journal du témoin, par recruteur',    $$select coalesce(string_agg(r || ':' || n, ',' order by r), '-')
                                                  from (select left(recruiter_id::text, 8) r, count(*) n from public.recruiter_activity_log
                                                         where athlete_id = {T} group by 1) z$$);

create function pg_temp.sonde(p_uid uuid, p_role text, p_sql text)
returns text
language plpgsql
as $$
declare
  v text;
  -- Résolu AVANT de changer de rôle : _t est une table temporaire du superuser.
  v_sql text := replace(p_sql, '{T}', quote_literal((select id from _t)) || '::uuid');
begin
  begin
    perform set_config('request.jwt.claims',
      case when p_uid is null then json_build_object('role', p_role)::text
           else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
    perform set_config('role', p_role, true);
    execute v_sql into v;
    raise exception using errcode = 'NX000', message = coalesce(v, '·');   -- annule tout effet de bord
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'refus ' || sqlstate;
  end;
end $$;

create temp table _m (phase text, compte text, surface text, v text, ms numeric);
create function pg_temp.mesurer(p_phase text)
returns void
language plpgsql
as $$
declare c record; s record; t0 timestamptz; v text;
begin
  for c in select * from _c loop
    for s in select * from _s loop
      t0 := clock_timestamp();
      v := pg_temp.sonde(c.uid, c.role, s.q);
      insert into _m values (p_phase, c.cle, s.cle, v, extract(epoch from clock_timestamp() - t0) * 1000);
    end loop;
  end loop;
end $$;

-- Empreinte du schéma public : fonctions (md5 + ACL + réglages), policies, déclencheurs.
create temp table _e (phase text, ligne text);
create function pg_temp.empreinte(p_phase text)
returns void
language sql
as $$
  insert into _e
  select p_phase, 'F|' || p.oid::regprocedure::text || '|' || md5(pg_get_functiondef(p.oid)) || '|'
                  || coalesce(p.proacl::text, '') || '|' || coalesce(p.proconfig::text, '')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f'
  union all
  select p_phase, 'P|' || tablename || '|' || policyname || '|' || cmd || '|' || permissive || '|' || roles::text
                  || '|' || md5(coalesce(qual, '')) || '|' || md5(coalesce(with_check, ''))
    from pg_policies where schemaname = 'public'
  union all
  select p_phase, 'T|' || c.relname || '|' || t.tgname || '|' || t.tgenabled::text || '|' || t.tgfoid::regprocedure::text
    from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and not t.tgisinternal
$$;

-- ── 1. AVANT ─────────────────────────────────────────────────────────────────
select pg_temp.mesurer('1 avant');
select pg_temp.empreinte('1 avant');

-- ── 2. La migration, texte gardé par son md5 ────────────────────────────────
select clock_timestamp() as debut_verrous;
do $rejeu$
declare t text := $nexus_mig$@@MIGRATION@@$nexus_mig$;
begin
  if md5(t) <> '@@MD5_MIGRATION@@' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', md5(t);
  end if;
  execute t;
end $rejeu$;

-- ── 3. APRÈS ─────────────────────────────────────────────────────────────────
select pg_temp.mesurer('2 après');
select pg_temp.empreinte('2 après');

-- ── 4. Le rollback, texte gardé par son md5 ─────────────────────────────────
do $rejeu$
declare t text := $nexus_rb$@@ROLLBACK@@$nexus_rb$;
begin
  if md5(t) <> '@@MD5_ROLLBACK@@' then
    raise exception 'NEXUS: texte du rollback altéré (md5 %)', md5(t);
  end if;
  execute t;
end $rejeu$;

-- ── 5. APRÈS ROLLBACK ────────────────────────────────────────────────────────
select pg_temp.mesurer('3 après rollback');
select pg_temp.empreinte('3 après rollback');
select clock_timestamp() as fin_mesures;

-- ── Rapports ─────────────────────────────────────────────────────────────────
\echo '== A. Écarts AVANT → APRÈS, regroupés (seules les cellules qui changent)'
select c.cat, a.surface, a.v as avant, b.v as apres, count(*) as comptes,
       string_agg(split_part(a.compte, ' ', 2), ' ' order by a.compte) as debuts_d_id
  from _m a join _m b on b.compte = a.compte and b.surface = a.surface and b.phase = '2 après'
  join _c c on c.cle = a.compte
 where a.phase = '1 avant' and a.v is distinct from b.v
 group by c.cat, a.surface, a.v, b.v
 order by c.cat, a.surface, a.v;

\echo '== B. Bilan par catégorie de compte'
select c.cat, count(distinct c.cle) as comptes, count(*) / 3 as cellules,
       count(*) filter (where a.phase = '1 avant' and a.v is distinct from b.v) as ecarts_avant_apres
  from _m a join _m b on b.compte = a.compte and b.surface = a.surface
  join _c c on c.cle = a.compte
 where b.phase = '2 après'
 group by c.cat order by c.cat;

\echo '== C. Journal du témoin (s13, s15) : comptes qui en lisaient une ligne, et l''admin'
select c.cat, a.compte, a.surface, a.v as avant, b.v as apres, r.v as apres_rollback
  from _m a
  join _m b on b.compte = a.compte and b.surface = a.surface and b.phase = '2 après'
  join _m r on r.compte = a.compte and r.surface = a.surface and r.phase = '3 après rollback'
  join _c c on c.cle = a.compte
 where a.phase = '1 avant' and a.surface in ('s13 journal : lignes du témoin', 's15 journal du témoin, par recruteur')
   and (a.v not in ('0', '-') or c.cat = 'admin')
 order by c.cat, a.compte, a.surface;

\echo '== D. Rollback à blanc : AVANT → APRÈS ROLLBACK (attendu : 0 et 0)'
select (select count(*) from _m a join _m r on r.compte = a.compte and r.surface = a.surface and r.phase = '3 après rollback'
         where a.phase = '1 avant' and a.v is distinct from r.v) as cellules_differentes,
       (select count(*) from ((select ligne from _e where phase = '1 avant' except all select ligne from _e where phase = '3 après rollback')
                               union all
                              (select ligne from _e where phase = '3 après rollback' except all select ligne from _e where phase = '1 avant')) d)
         as lignes_d_empreinte_differentes,
       (select count(*) from _e where phase = '1 avant') as lignes_d_empreinte;

\echo '== E. Ce que la migration change au schéma (empreinte AVANT → APRÈS)'
select left(ligne, 90) as objet, 'avant seulement' as cote from (select ligne from _e where phase = '1 avant' except select ligne from _e where phase = '2 après') x
union all
select left(ligne, 90), 'après seulement' from (select ligne from _e where phase = '2 après' except select ligne from _e where phase = '1 avant') y
order by 1, 2;

\echo '== F. Coût : recruiter_search_athletes, moyenne par recruteur (ms)'
select m.phase, round(avg(m.ms), 1) as ms_moyen, round(max(m.ms), 1) as ms_max, count(*) as appels
  from _m m join _c c on c.cle = m.compte
 where m.surface = 's04 recruiter_search_athletes()' and c.cle like 'R%'
 group by m.phase order by m.phase;

select clock_timestamp() as fin;
rollback;
\echo '== ROLLBACK fait : la prod est inchangée.'
