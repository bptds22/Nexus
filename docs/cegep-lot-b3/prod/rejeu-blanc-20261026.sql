-- ════════════════════════════════════════════════════════════════════════════
-- Lot B3 cégep — REJEU À BLANC (local ou prod) : « assure-toi que ça brise rien ».
-- NE LAISSE RIEN : UNE transaction qui finit par ROLLBACK ; toute erreur arrête psql avant
-- (ON_ERROR_STOP) et la session se ferme sans COMMIT.
--
-- Fichier GÉNÉRÉ par scripts/cegep-lot-b3/generer.sh à partir de ce gabarit : la migration et le
-- rollback y sont embarqués tels quels (fins de ligne LF), gardés par leur md5.
--
-- Déroulé : mesure AVANT → migration → mesure APRÈS → rollback → mesure APRÈS ROLLBACK → rapports
-- → ROLLBACK. Les sondes de compte tournent sous le rôle du compte (authenticated +
-- request.jwt.claims), jamais en superuser, dans une sous-transaction annulée. Le rapport n'affiche
-- que des compteurs, des md5 et des débuts d'identifiant, aucun nom de personne.
--
-- Chaque cellule est une liste « clé=valeur;… ». Une clé qui commence par « effet » est la SEULE
-- partie qui a le droit de changer (les colonnes ajoutées) ; toute autre clé qui change est un
-- écart INTERDIT (verdict ≠ 0 = ARRÊT). Les colonnes d'avant sont comparées telles qu'un binaire
-- mobile 1.4.5 les lit (ligne JSON moins les seules colonnes ajoutées).
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '900s';
set local search_path = public, extensions;
set local application_name = 'nexus-rejeu-blanc-lot-b3';
select now() as debut, current_user, current_setting('server_version') as version;

-- ── Garde : B3 pas encore en place ──────────────────────────────────────────
do $$
begin
  if exists (select 1 from supabase_migrations.schema_migrations where version = '20261028160000') then
    raise exception 'NEXUS: le lot B3 est déjà inscrit';
  end if;
  if pg_get_function_result(to_regprocedure('public.recruiter_athlete_cards(uuid[])')) like '%team_age_group%' then
    raise exception 'NEXUS: recruiter_athlete_cards rend déjà team_age_group';
  end if;
end $$;

-- ── Les listes de sonde ──────────────────────────────────────────────────────
create temp table _ath as
select a.id, public.athlete_est_cegepien(a.id) as cegepien from public.athletes a where a.status = 'ACTIF';
create temp table _lit (k text primary key, v text);
insert into _lit values
  ('{ATH}', (select coalesce('array[' || string_agg(quote_literal(id::text), ',' order by id) || ']::uuid[]', 'array[]::uuid[]') from _ath)),
  ('{CEG}', (select coalesce('array[' || string_agg(quote_literal(id::text), ',' order by id) || ']::uuid[]', 'array[]::uuid[]') from _ath where cegepien));

-- ── Les comptes ──────────────────────────────────────────────────────────────
-- Admin, tous les recruteurs (Pro ou non : le palier change l'identité visible), tous les partenaires
-- admis, un compte athlète, anon.
create temp table _c (cle text primary key, uid uuid, role text, cat text);
insert into _c
select 'ADMIN', coalesce((select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0' and role = 'ADMIN'::public.user_role),
                         (select id from public.users where role = 'ADMIN'::public.user_role order by id limit 1)),
       'authenticated', 'admin';
insert into _c
select 'R' || lpad(row_number() over (order by u.id)::text, 2, '0') || ' ' || left(u.id::text, 8), u.id, 'authenticated',
       'recruteur ' || coalesce((select sb.tier from public.subscriptions sb where sb.user_id = u.id and sb.status = 'active'
                                    order by sb.created_at desc limit 1), 'free') || ', école ' || coalesce(s.type::text, 'aucune')
       || case when public.unite_voit_cegepiens(u.school_id) then ' (voit les cégépiens)' else '' end
  from public.users u left join public.schools s on s.id = u.school_id
 where u.role = 'RECRUTEUR'::public.user_role;
insert into _c
select 'P' || lpad(row_number() over (order by u.id)::text, 2, '0') || ' ' || left(u.id::text, 8), u.id, 'authenticated', 'partenaire admis'
  from public.users u
 where u.role = 'PARTNER'::public.user_role
   and exists (select 1 from public.media_partners mp where mp.user_id = u.id and mp.status = 'APPROVED');
insert into _c
select 'T ' || left(u.id::text, 8), u.id, 'authenticated', 'athlète'
  from public.users u where u.role = 'ATHLETE'::public.user_role order by u.id limit 1;
insert into _c values ('ANON', null, 'anon', 'anon');
delete from _c where uid is null and role <> 'anon';
do $$
begin
  if not exists (select 1 from _c where cle like 'R%') then raise exception 'NEXUS: aucun recruteur pour sonder'; end if;
  if not exists (select 1 from _c where cle like 'P%') then raise exception 'NEXUS: aucun partenaire admis pour sonder'; end if;
end $$;
select cat, count(*) as comptes from _c group by cat order by cat;
select (select count(*) from _ath) as athletes_actifs, (select count(*) from _ath where cegepien) as cegepiens_actifs;

-- ── Les sondes ───────────────────────────────────────────────────────────────
-- portee : REC (recruteurs), PAR (partenaires), TOUS (tous les comptes, anon compris), SU (superuser, une fois).
-- « lignes » : les colonnes d'AVANT, ligne JSON moins les colonnes ajoutées (ce que lit le mobile 1.4.5).
-- « cegepiens » : cégépiens rendus (lot A : 0 pour un recruteur collégial, avant comme après).
-- « effet… » : distribution des colonnes ajoutées (NULL avant et après rollback).
create temp table _s (cle text primary key, portee text, q text);
insert into _s values
  ('a01 recruiter_search_athletes (défaut, tout)', 'REC',
   $$select 'n=' || count(*) || ';lignes=' || md5(coalesce(string_agg((z.j - 'team_age_group')::text, '|' order by z.j->>'id'), ''))
            || ';ordre=' || md5(coalesce(string_agg(z.j->>'id', ',' order by z.rn), ''))
            || ';cegepiens=' || count(*) filter (where (z.j->>'id')::uuid = any({CEG}))
            || ';effet_categories=' || coalesce(string_agg(distinct coalesce(z.j->>'school_type', '-') || '/' || coalesce(z.j->>'team_school_type', '-')
                                                   || '/' || coalesce(z.j->>'team_age_group', '-'), ','), '-')
       from (select to_jsonb(r) as j, row_number() over () as rn from public.recruiter_search_athletes() r) z$$),
  ('a02 recruiter_search_athletes (filtres serveur : promotion, texte, tri)', 'REC',
   $$select string_agg(x.k || '=' || (select count(*) || '/' || md5(coalesce(string_agg((to_jsonb(r) - 'team_age_group')::text, '|'), ''))
                                        from public.recruiter_search_athletes(p_search => x.s, p_promotion => x.p, p_sort_by => x.t) r), ';' order by x.k)
       from (values ('promo2027', null, 2027, 'rating_desc'), ('texte_cegep', 'cégep', null, 'rating_desc'),
                    ('texte_athle', 'athle', null, 'name_asc'), ('grad_asc', null, null, 'grad_asc')) x(k, s, p, t)$$),
  ('a03 recruiter_athlete_cards (tous les actifs)', 'REC',
   $$select 'n=' || count(*) || ';lignes=' || md5(coalesce(string_agg((to_jsonb(r) - 'team_school_type' - 'team_age_group')::text, '|' order by r.id), ''))
            || ';cegepiens=' || count(*) filter (where r.id = any({CEG}))
            || ';effet_categories=' || coalesce(string_agg(distinct coalesce(r.school_type, '-') || '/' || coalesce(to_jsonb(r)->>'team_school_type', '-')
                                                   || '/' || coalesce(to_jsonb(r)->>'team_age_group', '-'), ','), '-')
       from public.recruiter_athlete_cards({ATH}) r$$),
  ('a04 recruiter_athlete_profile (chaque actif)', 'REC',
   $$select 'n=' || count(*) || ';lignes=' || md5(coalesce(string_agg((to_jsonb(r) - 'team_school_type' - 'team_age_group')::text, '|' order by r.id), ''))
            || ';cegepiens=' || count(*) filter (where r.id = any({CEG}))
            || ';effet_categories=' || coalesce(string_agg(distinct coalesce(to_jsonb(r)->>'team_school_type', '-') || '/' || coalesce(to_jsonb(r)->>'team_age_group', '-'), ','), '-')
       from unnest({ATH}) x(id), lateral public.recruiter_athlete_profile(x.id) r$$),
  ('a05 top_athletes_view', 'TOUS',
   $$select 'n=' || count(*) || ';lignes=' || md5(coalesce(string_agg((to_jsonb(v) - 'school_type' - 'team_school_type' - 'team_age_group')::text, '|' order by v.id), ''))
            || ';ordre=' || md5(coalesce(string_agg(v.id::text, ','), ''))
            || ';cegepiens=' || count(*) filter (where v.id = any({CEG}))
            || ';effet_categories=' || coalesce(string_agg(distinct coalesce(to_jsonb(v)->>'school_type', '-') || '/' || coalesce(to_jsonb(v)->>'team_school_type', '-')
                                                   || '/' || coalesce(to_jsonb(v)->>'team_age_group', '-'), ','), '-')
       from public.top_athletes_view v$$),
  ('a06 top_athletes_view (filtres d''écran .eq + limit 25)', 'PAR',
   $$select string_agg(x.k || '=' || (select count(*) || '/' || md5(coalesce(string_agg((to_jsonb(v) - 'school_type' - 'team_school_type' - 'team_age_group')::text, '|'), ''))
                                        from (select * from public.top_athletes_view v0
                                               where (x.p is null or v0.annee_diplomation = x.p)
                                                 and (x.o is null or (x.o = 'scolaire' and v0.school_id is not null) or (x.o = 'civil' and v0.school_id is null))
                                               limit 25) v), ';' order by x.k)
       from (values ('tout', null::int, null::text), ('promo2027', 2027, null), ('scolaire', null, 'scolaire'), ('civil', null, 'civil')) x(k, p, o)$$),
  ('a07 trending_athletes_view', 'TOUS',
   $$select 'n=' || count(*) || ';lignes=' || md5(coalesce(string_agg((to_jsonb(v) - 'school_type' - 'team_school_type' - 'team_age_group')::text, '|' order by v.id), ''))
            || ';cegepiens=' || count(*) filter (where v.id = any({CEG}))
            || ';effet_categories=' || coalesce(string_agg(distinct coalesce(to_jsonb(v)->>'school_type', '-') || '/' || coalesce(to_jsonb(v)->>'team_school_type', '-')
                                                   || '/' || coalesce(to_jsonb(v)->>'team_age_group', '-'), ','), '-')
       from public.trending_athletes_view v$$),
  -- Dormance : aucune donnée ne bouge.
  ('t01 données (athlètes, équipes, rattachements, écoles)', 'SU',
   $$select 'athletes=' || (select md5(string_agg(to_jsonb(a)::text, '|' order by a.id)) from public.athletes a)
            || ';teams=' || (select md5(string_agg(to_jsonb(t)::text, '|' order by t.id)) from public.teams t)
            || ';team_athletes=' || (select md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by t.id), '')) from public.team_athletes t)
            || ';schools=' || (select md5(string_agg(to_jsonb(s)::text, '|' order by s.id)) from public.schools s)$$),
  -- Mobile 1.4.5 : signatures d'appel inchangées ; colonnes d'avant inchangées, dans le même ordre.
  ('t02 signatures et colonnes d''avant', 'SU',
   $$select string_agg(p.proname || '=' || md5(pg_get_function_identity_arguments(p.oid)) || '/'
                       || md5(regexp_replace(pg_get_function_result(p.oid), ', team_school_type text, team_age_group text\)$|, team_age_group text\)$', ')')), ';' order by p.proname)
            || ';effet_resultats=' || string_agg(left(md5(pg_get_function_result(p.oid)), 8), ',' order by p.proname)
            || ';vues=' || (select md5(string_agg(c.relname || ':' || a.attname || ':' || format_type(a.atttypid, a.atttypmod), ',' order by c.relname, a.attnum))
                              from pg_attribute a join pg_class c on c.oid = a.attrelid
                             where c.oid in ('public.top_athletes_view'::regclass, 'public.trending_athletes_view'::regclass)
                               and a.attnum > 0 and a.attname not in ('school_type', 'team_school_type', 'team_age_group'))
            || ';effet_vues=' || (select string_agg(c.relname || ':' || count_n, ',' order by c.relname)
                                    from (select a.attrelid, count(*) as count_n from pg_attribute a where a.attnum > 0
                                           and a.attrelid in ('public.top_athletes_view'::regclass, 'public.trending_athletes_view'::regclass) group by 1) z
                                    join pg_class c on c.oid = z.attrelid)
       from pg_proc p where p.pronamespace = 'public'::regnamespace
        and p.proname in ('recruiter_search_athletes', 'recruiter_athlete_cards', 'recruiter_athlete_profile')$$),
  -- Lot A : la règle et ses policies.
  ('t03 lot A : cégépiens et règle', 'SU',
   $$select 'cegepiens_actifs=' || (select count(*) from _ath where cegepien)
            || ';regle=' || (select md5(string_agg(md5(prosrc), ',' order by proname)) from pg_proc
                              where pronamespace = 'public'::regnamespace and proname in ('athlete_est_cegepien', 'peut_voir_cegepiens', 'unite_voit_cegepiens'))
            || ';policies=' || (select md5(string_agg(tablename || ':' || policyname || ':' || md5(coalesce(qual, '')), ',' order by tablename, policyname))
                                  from pg_policies where policyname = 'cegepiens_masques_recruteurs')$$);

create function pg_temp.sonde(p_uid uuid, p_role text, p_sql text)
returns text
language plpgsql
as $$
declare
  v text;
  v_sql text := p_sql;
  l record;
begin
  -- Résolu AVANT de changer de rôle : _lit est une table temporaire du superuser.
  for l in select * from _lit loop
    v_sql := replace(v_sql, l.k, l.v);
  end loop;
  begin
    if p_role is not null then
      perform set_config('request.jwt.claims',
        case when p_uid is null then json_build_object('role', p_role)::text
             else json_build_object('sub', p_uid, 'role', p_role)::text end, true);
      perform set_config('role', p_role, true);
    end if;
    execute v_sql into v;
    raise exception using errcode = 'NX000', message = coalesce(v, '·');   -- annule tout effet de bord
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'refus=' || sqlstate || ' ' || left(sqlerrm, 120);
  end;
end $$;

create temp table _m (phase text, compte text, surface text, v text, ms numeric);
create function pg_temp.mesurer(p_phase text)
returns void
language plpgsql
as $$
declare c record; s record; t0 timestamptz; v text;
begin
  for s in select * from _s order by cle loop
    for c in select * from _c
              where (s.portee = 'REC' and cle like 'R%')
                 or (s.portee = 'PAR' and cle like 'P%')
                 or s.portee = 'TOUS'
              order by cle loop
      t0 := clock_timestamp();
      v := pg_temp.sonde(c.uid, c.role, s.q);
      insert into _m values (p_phase, c.cle, s.cle, v, extract(epoch from clock_timestamp() - t0) * 1000);
    end loop;
    if s.portee = 'SU' then
      t0 := clock_timestamp();
      v := pg_temp.sonde(null, null, s.q);
      insert into _m values (p_phase, 'SU', s.cle, v, extract(epoch from clock_timestamp() - t0) * 1000);
    end if;
  end loop;
end $$;

-- Empreinte du schéma public : fonctions (md5 + ACL + réglages + commentaire), vues (définition, ACL,
-- options, commentaire), policies, déclencheurs.
create temp table _e (phase text, ligne text);
create function pg_temp.empreinte(p_phase text)
returns void
language sql
as $$
  insert into _e
  select p_phase, 'F|' || p.oid::regprocedure::text || '|' || md5(pg_get_functiondef(p.oid)) || '|'
                  || coalesce(p.proacl::text, '') || '|' || coalesce(p.proconfig::text, '') || '|' || coalesce(md5(obj_description(p.oid, 'pg_proc')), '')
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prokind = 'f'
  union all
  select p_phase, 'V|' || c.relname || '|' || md5(pg_get_viewdef(c.oid)) || '|' || coalesce(c.relacl::text, '') || '|'
                  || coalesce(c.reloptions::text, '') || '|' || coalesce(md5(obj_description(c.oid, 'pg_class')), '')
    from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind in ('v', 'm')
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
select clock_timestamp() as debut_mesure_avant;
select pg_temp.mesurer('1 avant');
select pg_temp.empreinte('1 avant');

-- ── 2. La migration, texte gardé par son md5 ────────────────────────────────
select clock_timestamp() as debut_migration;
do $rejeu$
declare t text := $nexus_mig$-- ════════════════════════════════════════════════════════════════════════════
-- Chantier cégep — LOT B3 « base des filtres » Type + Catégorie (GO BP 2026-10-26).
-- NON APPLIQUÉE EN PROD. Apply par la voie psql, sur GO BP seulement (au plus tôt mercredi 12 h).
--
-- Rend, en COLONNES AJOUTÉES EN FIN, le type de l'école d'ancrage, le type de l'école de l'équipe
-- et la catégorie de l'équipe (teams.age_group), pour que B4 (web) et B5 (mobile) filtrent sans
-- autre changement de base :
--   · recruiter_search_athletes : + team_age_group (school_type et team_school_type existent déjà) ;
--   · recruiter_athlete_profile, recruiter_athlete_cards : + team_school_type, team_age_group ;
--   · top_athletes_view, trending_athletes_view : + school_type, team_school_type, team_age_group.
-- L'équipe d'un athlète vient de team_athletes, UNIQUE (athlete_id) : au plus une ligne, aucune
-- ligne ajoutée ni retirée (gardé ci-dessous).
--
-- Rien d'autre ne change : corps d'origine (prod) repris À LA LETTRE, seules les colonnes de fin et
-- la jointure d'équipe s'ajoutent. Masquage du lot A intact (peut_voir_cegepiens /
-- athlete_est_cegepien dans les 3 fonctions) ; les 2 vues restent réservées aux partenaires admis,
-- qui voient les cégépiens par décision. Aucune règle Collégial dans la carte des matchs (BP 1).
--
-- Les 3 fonctions changent de type de retour : DROP + CREATE. ACL rétablies À L'IDENTIQUE (texte
-- exact, ordre compris), commentaires reposés. Aucun objet n'en dépend (relevé prod 2026-10-26).
-- Les 2 vues : CREATE OR REPLACE (colonnes ajoutées en fin) ; ACL et commentaires conservés ;
-- top_athletes_view sans reloptions, trending_athletes_view avec security_barrier (restatée).
--
-- Rollback : supabase/rollback/20261028160000_rollback_cegep_lot_b3_filtres.sql
-- ════════════════════════════════════════════════════════════════════════════

-- pg_get_viewdef dépend du search_path : les md5 des vues sont relevés sous celui-ci.
set local search_path = public, extensions;

-- ── 0. Gardes : les 5 objets sont ceux relevés en prod le 2026-10-26 ────────────
do $$
begin
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)'))
     is distinct from 'aba2e501dd8c62f323adfb857150b5a6' then
    raise exception 'NEXUS: recruiter_search_athletes n''est pas le corps prod relevé le 2026-10-26';
  end if;
  if (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)'))
     is distinct from '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}' then
    raise exception 'NEXUS: ACL de recruiter_search_athletes inattendue : %',
      (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)'));
  end if;
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.recruiter_athlete_profile(uuid)'))
     is distinct from '0fccf321625808a8561968231abe85ca' then
    raise exception 'NEXUS: recruiter_athlete_profile n''est pas le corps prod relevé le 2026-10-26';
  end if;
  if (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_athlete_profile(uuid)'))
     is distinct from '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' then
    raise exception 'NEXUS: ACL de recruiter_athlete_profile inattendue : %',
      (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_athlete_profile(uuid)'));
  end if;
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.recruiter_athlete_cards(uuid[])'))
     is distinct from 'ba26d8b8bb57246110388dd63e41ac6d' then
    raise exception 'NEXUS: recruiter_athlete_cards n''est pas le corps prod relevé le 2026-10-26';
  end if;
  if (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_athlete_cards(uuid[])'))
     is distinct from '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' then
    raise exception 'NEXUS: ACL de recruiter_athlete_cards inattendue : %',
      (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_athlete_cards(uuid[])'));
  end if;
  if md5(pg_get_viewdef('public.top_athletes_view'::regclass)) is distinct from 'b677336de698551f2d5b733bc7f70bab' then
    raise exception 'NEXUS: top_athletes_view n''est pas la définition prod relevée le 2026-10-26';
  end if;
  if (select relacl::text from pg_class where oid = 'public.top_athletes_view'::regclass) is distinct from '{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}' then
    raise exception 'NEXUS: ACL de top_athletes_view inattendue : %', (select relacl::text from pg_class where oid = 'public.top_athletes_view'::regclass);
  end if;
  if md5(obj_description('public.top_athletes_view'::regclass, 'pg_class')) is distinct from 'af7d280ebfb0efef9c6671ef88cab628' then
    raise exception 'NEXUS: commentaire de top_athletes_view inattendu';
  end if;
  if md5(pg_get_viewdef('public.trending_athletes_view'::regclass)) is distinct from 'b45eb0030c789288a79dddbdd020d060' then
    raise exception 'NEXUS: trending_athletes_view n''est pas la définition prod relevée le 2026-10-26';
  end if;
  if (select relacl::text from pg_class where oid = 'public.trending_athletes_view'::regclass) is distinct from '{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}' then
    raise exception 'NEXUS: ACL de trending_athletes_view inattendue : %', (select relacl::text from pg_class where oid = 'public.trending_athletes_view'::regclass);
  end if;
  if md5(obj_description('public.trending_athletes_view'::regclass, 'pg_class')) is distinct from '437c56a0178020eb9fed67cccb27c6c1' then
    raise exception 'NEXUS: commentaire de trending_athletes_view inattendu';
  end if;
  if (select reloptions from pg_class where oid = 'public.top_athletes_view'::regclass) is not null then
    raise exception 'NEXUS: top_athletes_view a des reloptions';
  end if;
  if (select reloptions::text from pg_class where oid = 'public.trending_athletes_view'::regclass)
     is distinct from '{security_barrier=true}' then
    raise exception 'NEXUS: trending_athletes_view sans security_barrier';
  end if;
  if md5(obj_description(to_regprocedure('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)'), 'pg_proc')) is distinct from 'e1c17f94928a14a388dc07e03ea4a2fc' then
    raise exception 'NEXUS: commentaire de recruiter_search_athletes inattendu';
  end if;
  if md5(obj_description(to_regprocedure('public.recruiter_athlete_profile(uuid)'), 'pg_proc')) is distinct from '4a6be07c0b1f51c8e7189d525b6e9507' then
    raise exception 'NEXUS: commentaire de recruiter_athlete_profile inattendu';
  end if;
  if md5(obj_description(to_regprocedure('public.recruiter_athlete_cards(uuid[])'), 'pg_proc')) is distinct from 'a2e22b53f4031df7aa0397bb997c51ba' then
    raise exception 'NEXUS: commentaire de recruiter_athlete_cards inattendu';
  end if;
  if exists (select 1 from pg_depend d join pg_rewrite r on r.oid = d.objid and d.classid = 'pg_rewrite'::regclass
              where d.refobjid in ('public.top_athletes_view'::regclass, 'public.trending_athletes_view'::regclass)
                and r.ev_class not in ('public.top_athletes_view'::regclass, 'public.trending_athletes_view'::regclass)) then
    raise exception 'NEXUS: un objet dépend d''une des 2 vues';
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.team_athletes'::regclass and contype = 'u'
                    and pg_get_constraintdef(oid) = 'UNIQUE (athlete_id)') then
    raise exception 'NEXUS: team_athletes n''est plus UNIQUE (athlete_id) : la jointure d''équipe multiplierait des lignes';
  end if;
end $$;

create temp table _b3_com (sig text primary key, texte text);
insert into _b3_com
select 'public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)', obj_description(to_regprocedure('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)'), 'pg_proc')
union all
select 'public.recruiter_athlete_profile(uuid)', obj_description(to_regprocedure('public.recruiter_athlete_profile(uuid)'), 'pg_proc')
union all
select 'public.recruiter_athlete_cards(uuid[])', obj_description(to_regprocedure('public.recruiter_athlete_cards(uuid[])'), 'pg_proc');

-- ── recruiter_search_athletes ──
drop function public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean);
CREATE FUNCTION public.recruiter_search_athletes(p_search text DEFAULT NULL::text, p_sport_id uuid DEFAULT NULL::uuid, p_promotion integer DEFAULT NULL::integer, p_verified_only boolean DEFAULT false, p_with_video_only boolean DEFAULT false, p_min_gpa numeric DEFAULT NULL::numeric, p_min_rating numeric DEFAULT NULL::numeric, p_ouvert_demenager boolean DEFAULT false, p_ouvert_prive boolean DEFAULT false, p_ouvert_anglophone boolean DEFAULT false, p_new_only boolean DEFAULT false, p_sort_by text DEFAULT 'rating_desc'::text, p_limit integer DEFAULT NULL::integer, p_programme_ids uuid[] DEFAULT NULL::uuid[], p_offert_par_mon_cegep boolean DEFAULT false, p_inclure_partenaires boolean DEFAULT false)
 RETURNS TABLE(id uuid, identity_visible boolean, first_name text, last_name text, photo_url text, numero_jersey text, age integer, annee_diplomation integer, verified boolean, last_profile_validation timestamp with time zone, cote_globale numeric, profile_completion integer, taille_pieds integer, taille_pouces integer, poids_lbs numeric, moyenne_generale numeric, mentions_academiques jsonb, recruitment_status text, statut_recrutement_override text, open_to_offers boolean, a_une_video boolean, context text, created_at timestamp with time zone, sport_nom text, position_nom text, position_abbr text, school_id uuid, school_name text, school_region text, school_type text, committed_school_name text, evaluations jsonb, team_gender text, programmes jsonb, team_division text, team_league text, team_is_rseq boolean, team_school_type text, cote_partenaire numeric, cote_partenaire_organisation text, team_age_group text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
DECLARE
  v_tier_ok boolean;
  v_mots    text[];
  v_sort    text;
  v_school  uuid;
BEGIN
  IF NOT public.is_recruiter() THEN
    RAISE EXCEPTION 'acces reserve aux recruteurs' USING ERRCODE = '42501';
  END IF;

  v_tier_ok := public.get_user_tier() IN ('pro', 'all_star');

  -- RECHERCHE TEXTE — ouverte a TOUS les paliers depuis le 2026-09-17, mais la
  -- branche NOM du predicat reste Pro (et identite visible) : voir l'en-tete
  -- de la migration 20260917120000. Mots sans accent, jokers LIKE echappes.
  -- NULL si la saisie est vide.
  SELECT array_agg(replace(replace(replace(
           extensions.unaccent('extensions.unaccent'::regdictionary, m),
           '\', '\\'), '%', '\%'), '_', '\_'))
    INTO v_mots
    FROM regexp_split_to_table(btrim(COALESCE(p_search, '')), '\s+') AS m
   WHERE m <> '';

  -- Oracle ferme pour les Free : le tri alphabetique est rabattu sur la cote —
  -- sinon l'ORDRE trahirait le nom qu'on vient de masquer.
  --
  -- VITRINE : volontairement NON assoupli. La vitrine sort de toute facon en
  -- tete du tri par cote.
  v_sort := CASE WHEN p_sort_by = 'name_asc' AND NOT v_tier_ok
                 THEN 'rating_desc' ELSE p_sort_by END;

  -- Une liste a zero doit toujours pouvoir dire POURQUOI elle est a zero.
  IF p_offert_par_mon_cegep THEN
    SELECT u.school_id INTO v_school FROM public.users u WHERE u.id = auth.uid();
    IF v_school IS NULL THEN
      RAISE EXCEPTION 'NEXUS: aucun cegep rattache a ce compte — le filtre « offert par mon cegep » est indisponible'
        USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.school_programs sp WHERE sp.school_id = v_school) THEN
      RAISE EXCEPTION 'NEXUS: aucun programme au catalogue de ce cegep — le filtre « offert par mon cegep » ne peut rien rendre'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    (public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase)),
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.first_name END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.last_name END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.photo_url END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.numero_jersey END,
    CASE WHEN a.date_naissance IS NOT NULL
         THEN EXTRACT(YEAR FROM age(a.date_naissance))::integer END,
    a.annee_diplomation, a.verified, a.last_profile_validation,
    a.cote_globale_entraineur, a.profile_completion,
    a.taille_pieds, a.taille_pouces, a.poids_lbs,
    a.moyenne_generale, a.mentions_academiques,
    a.recruitment_status::text, a.statut_recrutement_override, a.open_to_offers,
    -- « A une vidéo » : l'un des CINQ liens vidéo, non vide (2026-10-03).
    (COALESCE(NULLIF(btrim(a.video_faits_saillants_url), ''), NULLIF(btrim(a.hudl_url), ''),
              NULLIF(btrim(a.youtube_url), ''), NULLIF(btrim(a.video_match_complet_url), ''),
              NULLIF(btrim(a.video_entrainement_url), '')) IS NOT NULL),
    a.context, a.created_at,
    sp.nom, po.nom, po.abreviation,
    a.school_id, sc.name, sc.region, sc.type,
    cs.name,
    -- Badges SANS évaluation (2026-10-03) : l'agrégat ne passait que par
    -- evaluations — un athlète badgé mais jamais évalué perdait ses badges sur
    -- la carte ET dans « Avec distinction » (1 cas en prod). Repli : une ligne
    -- qui ne porte QUE les badges, sans cote (le client n'en lit que les
    -- distinctions).
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'cote_globale', ev.cote_globale,
              'distinctions', (select coalesce(jsonb_agg(jsonb_build_object('badge', b2.code, 'detail', ab.contexte, 'libelle', b2.libelle) order by b2.ordre), '[]'::jsonb) from public.athlete_badges ab join public.badges b2 on b2.id = ab.badge_id where ab.athlete_id = ev.athlete_id and ab.retire_le is null),
              'updated_at',   ev.updated_at))
       FROM public.evaluations ev
      WHERE ev.athlete_id = a.id),
     (SELECT jsonb_build_array(jsonb_build_object(
               'cote_globale', NULL,
               'distinctions', jsonb_agg(jsonb_build_object('badge', b2.code, 'detail', ab.contexte, 'libelle', b2.libelle) ORDER BY b2.ordre),
               'updated_at',   NULL))
        FROM public.athlete_badges ab JOIN public.badges b2 ON b2.id = ab.badge_id
       WHERE ab.athlete_id = a.id AND ab.retire_le IS NULL
      HAVING count(*) > 0)),
    tm.gender,
    -- Projection : sans elle le filtre est aveugle. Le LIBELLE choisi par
    -- l'athlete, pas le nom ministeriel.
    (SELECT jsonb_agg(jsonb_build_object(
              'id', l.id, 'label', l.label, 'code', p.code, 'program_id', p.id)
              ORDER BY idx.ord)
       FROM unnest(a.programmes_vises) WITH ORDINALITY AS idx(lid, ord)
       JOIN public.cegep_program_labels l ON l.id = idx.lid
       JOIN public.cegep_programs       p ON p.id = l.program_id),
    -- LOT 3 — meme jointure qu'au-dessus, quatre colonnes de plus.
    tm.division,
    tm.league,
    (tm.rseq_team_id IS NOT NULL),
    tsc.type,
    -- W2 — l'évaluation PARTENAIRE, à part : jamais fusionnée dans cote_globale
    -- (qui reste la note du coach, lue telle quelle par les binaires mobiles).
    pe.cote_globale,
    pe.organisation,
    -- Lot B3 cégep (filtre Catégorie) : catégorie de l'équipe. Le type de l'école d'ancrage
    -- (school_type) et celui de l'école de l'équipe (team_school_type) sont déjà rendus.
    tm.age_group
  FROM public.athletes a
  LEFT JOIN public.sports        sp ON sp.id = a.sport_id
  LEFT JOIN public.positions     po ON po.id = a.position_id
  LEFT JOIN public.schools       sc ON sc.id = a.school_id
  LEFT JOIN public.schools       cs ON cs.id = a.committed_school_id
  LEFT JOIN public.team_athletes ta ON ta.athlete_id = a.id
  LEFT JOIN public.teams         tm ON tm.id = ta.team_id
  -- L'ecole de L'EQUIPE, pas celle de l'athlete : les deux divergent deja en
  -- prod (2 athletes au 2026-09-07). `teams.school_id` est NOT NULL, donc
  -- `team_school_type` non nul <=> l'athlete a une equipe.
  LEFT JOIN public.schools       tsc ON tsc.id = tm.school_id
  -- W2 — la plus récente évaluation d'un partenaire APPROUVÉ. Une seule ligne
  -- (LIMIT 1) : le join ne multiplie rien.
  LEFT JOIN LATERAL (
    SELECT pev.cote_globale, mp.organization_name AS organisation
      FROM public.partner_evaluations pev
      JOIN public.media_partners mp ON mp.id = pev.partner_id AND mp.status = 'APPROVED'
     WHERE pev.athlete_id = a.id
       AND COALESCE(public.is_partner_eligible_athlete(a.id), false)  -- Loi 25 (2026-10-16) : sans opt-in actif, rien — sauf pour l'admin.
     ORDER BY pev.updated_at DESC, pev.id DESC
     LIMIT 1) pe ON true
  WHERE a.status = 'ACTIF'::public.account_status
    -- Lot A cégep (2026-10-20) : un cégépien n'est rendu qu'à qui peut_voir_cegepiens().
    AND ((SELECT public.peut_voir_cegepiens()) OR NOT public.athlete_est_cegepien(a.id))
    -- D1b (2026-10-15) : une fiche sans prénom, sans nom, ou au nom recopié de Google et pas encore
    -- confirmé par l'athlète, n'apparaît pas dans la recherche.
    AND COALESCE(btrim(a.first_name), '') <> '' AND COALESCE(btrim(a.last_name), '') <> ''
    AND NOT a.nom_a_confirmer
    -- RECHERCHE PAR MOTS (2026-09-17). Lu : « aucun mot saisi n'est introuvable ».
    -- Un mot est trouve s'il figure dans :
    --   · le prenom ou le nom — PRO SEULEMENT et IDENTITE VISIBLE (oracle ferme) ;
    --   · l'ecole de l'athlete, l'ecole de son equipe, ou son equipe — tous paliers.
    AND (v_mots IS NULL OR NOT EXISTS (
          SELECT 1
            FROM unnest(v_mots) AS mot
           WHERE NOT COALESCE(
                   (    v_tier_ok
                    AND public.athlete_identity_ok(a.date_naissance, a.consentement_parental)
                    AND (   extensions.unaccent('extensions.unaccent'::regdictionary, a.first_name) ILIKE '%' || mot || '%'
                         OR extensions.unaccent('extensions.unaccent'::regdictionary, a.last_name)  ILIKE '%' || mot || '%'))
                   OR extensions.unaccent('extensions.unaccent'::regdictionary, sc.name)  ILIKE '%' || mot || '%'
                   OR extensions.unaccent('extensions.unaccent'::regdictionary, tsc.name) ILIKE '%' || mot || '%'
                   OR extensions.unaccent('extensions.unaccent'::regdictionary, tm.name)  ILIKE '%' || mot || '%',
                 false)))
    AND (p_sport_id  IS NULL OR a.sport_id = p_sport_id)
    AND (p_promotion IS NULL OR a.annee_diplomation = p_promotion)
    AND (NOT p_verified_only    OR a.verified = true)
    AND (NOT p_with_video_only  OR (COALESCE(NULLIF(btrim(a.video_faits_saillants_url), ''), NULLIF(btrim(a.hudl_url), ''),
              NULLIF(btrim(a.youtube_url), ''), NULLIF(btrim(a.video_match_complet_url), ''),
              NULLIF(btrim(a.video_entrainement_url), '')) IS NOT NULL))
    AND (p_min_gpa    IS NULL OR a.moyenne_generale >= p_min_gpa)
    -- W2 — cote du coach si elle existe, sinon celle du partenaire (décision BP),
    -- seulement si l'appelant le demande (web). Sinon : cote du coach seule,
    -- comme avant W2 (binaires mobiles publiés).
    AND (p_min_rating IS NULL OR
         CASE WHEN p_inclure_partenaires THEN COALESCE(a.cote_globale_entraineur, pe.cote_globale)
              ELSE a.cote_globale_entraineur END >= p_min_rating)
    AND (NOT p_ouvert_demenager  OR a.pret_changer_region = true)
    AND (NOT p_ouvert_prive      OR a.ouvert_cegep_prive = true)
    AND (NOT p_ouvert_anglophone OR a.ouvert_cegep_anglophone = true)
    AND (NOT p_new_only OR a.created_at >= now() - INTERVAL '10 days')
    -- Comparaison au niveau du PROGRAMME, pas du libelle.
    AND (p_programme_ids IS NULL OR EXISTS (
          SELECT 1 FROM public.cegep_program_labels l
           WHERE l.id = ANY(a.programmes_vises)
             AND l.program_id = ANY(p_programme_ids)))
    AND (NOT p_offert_par_mon_cegep OR EXISTS (
          SELECT 1
            FROM public.cegep_program_labels l
            JOIN public.school_programs spx ON spx.program_id = l.program_id
           WHERE l.id = ANY(a.programmes_vises)
             AND spx.school_id = v_school
             AND spx.is_displayed))
  ORDER BY
    CASE WHEN v_sort = 'rating_desc' THEN
      CASE WHEN p_inclure_partenaires THEN COALESCE(a.cote_globale_entraineur, pe.cote_globale)
           ELSE a.cote_globale_entraineur END END DESC NULLS LAST,
    CASE WHEN v_sort = 'rating_asc'  THEN
      CASE WHEN p_inclure_partenaires THEN COALESCE(a.cote_globale_entraineur, pe.cote_globale)
           ELSE a.cote_globale_entraineur END END ASC  NULLS LAST,
    CASE WHEN v_sort = 'grad_asc'    THEN a.annee_diplomation END ASC,
    CASE WHEN v_sort = 'grad_desc'   THEN a.annee_diplomation END DESC,
    CASE WHEN v_sort = 'name_asc'    THEN a.last_name END ASC,
    a.id
  LIMIT CASE WHEN p_limit IS NULL OR p_limit < 0 THEN NULL ELSE p_limit END;
END;
$function$;
revoke all on function public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean) from public, anon, authenticated, service_role;
grant execute on function public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean) to service_role;
grant execute on function public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean) to authenticated;

-- ── recruiter_athlete_profile ──
drop function public.recruiter_athlete_profile(uuid);
CREATE FUNCTION public.recruiter_athlete_profile(p_athlete_id uuid)
 RETURNS TABLE(id uuid, identity_visible boolean, first_name text, last_name text, photo_url text, numero_jersey text, age integer, genre text, annee_diplomation integer, verified boolean, profile_completion integer, last_profile_validation timestamp with time zone, cote_globale numeric, taille_pieds integer, taille_pouces integer, poids_lbs numeric, moyenne_generale numeric, mentions_academiques jsonb, matieres_fortes jsonb, programme_cegep_vise jsonb, regions_cegep_preferees jsonb, ouvert_cegep_prive boolean, ouvert_cegep_anglophone boolean, pret_changer_region boolean, bio text, recruitment_status text, statut_recrutement_override text, open_to_offers boolean, video_faits_saillants_url text, hudl_url text, youtube_url text, context text, sport_nom text, position_nom text, position_abbr text, school_id uuid, school_name text, school_region text, school_city text, school_type text, committed_school_name text, evaluations jsonb, team_school_type text, team_age_group text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
DECLARE
  v_tier_ok boolean;
BEGIN
  IF NOT public.is_recruiter() THEN
    RAISE EXCEPTION 'acces reserve aux recruteurs' USING ERRCODE = '42501';
  END IF;

  v_tier_ok := public.get_user_tier() IN ('pro', 'all_star');

  RETURN QUERY
  SELECT
    a.id,
    (public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase)),
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.first_name END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.last_name END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.photo_url END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.numero_jersey END,
    CASE WHEN a.date_naissance IS NOT NULL
         THEN EXTRACT(YEAR FROM age(a.date_naissance))::integer END,
    a.genre,
    a.annee_diplomation, a.verified, a.profile_completion, a.last_profile_validation,
    a.cote_globale_entraineur,
    a.taille_pieds, a.taille_pouces, a.poids_lbs,
    a.moyenne_generale, a.mentions_academiques, a.matieres_fortes,
    a.programme_cegep_vise, a.regions_cegep_preferees,
    a.ouvert_cegep_prive, a.ouvert_cegep_anglophone, a.pret_changer_region,
    a.bio,
    a.recruitment_status::text, a.statut_recrutement_override, a.open_to_offers,
    a.video_faits_saillants_url, a.hudl_url, a.youtube_url,
    a.context,
    sp.nom, po.nom, po.abreviation,
    a.school_id, sc.name, sc.region, sc.city, sc.type,
    cs.name,
    (SELECT jsonb_agg(jsonb_build_object(
              'cote_globale',        ev.cote_globale,
              'distinctions', (select coalesce(jsonb_agg(jsonb_build_object('badge', b2.code, 'detail', ab.contexte, 'libelle', b2.libelle) order by b2.ordre), '[]'::jsonb) from public.athlete_badges ab join public.badges b2 on b2.id = ab.badge_id where ab.athlete_id = ev.athlete_id and ab.retire_le is null),
              'rapport_entraineur',  ev.rapport_entraineur,
              'updated_at',          ev.updated_at,
              'leadership',          ev.leadership,
              'discipline',          ev.discipline,
              'coachabilite',        ev.coachabilite,
              'intelligence_jeu',    ev.intelligence_jeu,
              'competitivite',       ev.competitivite,
              'esprit_equipe',       ev.esprit_equipe,
              'resilience',          ev.resilience,
              'attitude_mentalite',  ev.attitude_mentalite,
              'vitesse_explosivite', ev.vitesse_explosivite,
              'force_puissance',     ev.force_puissance,
              'endurance_cardio',    ev.endurance_cardio,
              'agilite_coordination',ev.agilite_coordination,
              'vision_du_jeu',       ev.vision_du_jeu,
              'sens_tactique',       ev.sens_tactique))
       FROM public.evaluations ev
      WHERE ev.athlete_id = a.id),
    -- Lot B3 cégep (filtres Type et Catégorie) : type de l'école de l'équipe et catégorie de
    -- l'équipe. Le type de l'école d'ancrage est school_type, plus haut.
    tsc.type,
    tm.age_group
  FROM public.athletes a
  LEFT JOIN public.sports    sp ON sp.id = a.sport_id
  LEFT JOIN public.positions po ON po.id = a.position_id
  LEFT JOIN public.schools   sc ON sc.id = a.school_id
  LEFT JOIN public.schools   cs ON cs.id = a.committed_school_id
  -- Lot B3 cégep : l'équipe de l'athlète. team_athletes est UNIQUE (athlete_id) : au plus une
  -- ligne, le jeu de lignes ne change pas.
  LEFT JOIN public.team_athletes ta ON ta.athlete_id = a.id
  LEFT JOIN public.teams         tm ON tm.id = ta.team_id
  LEFT JOIN public.schools       tsc ON tsc.id = tm.school_id
  WHERE a.id = p_athlete_id
    AND a.status = 'ACTIF'::public.account_status
    -- Lot A cégep (2026-10-20)
    AND ((SELECT public.peut_voir_cegepiens()) OR NOT public.athlete_est_cegepien(a.id));
END;
$function$;
revoke all on function public.recruiter_athlete_profile(uuid) from public, anon, authenticated, service_role;
grant execute on function public.recruiter_athlete_profile(uuid) to authenticated;
grant execute on function public.recruiter_athlete_profile(uuid) to service_role;

-- ── recruiter_athlete_cards ──
drop function public.recruiter_athlete_cards(uuid[]);
CREATE FUNCTION public.recruiter_athlete_cards(p_athlete_ids uuid[])
 RETURNS TABLE(id uuid, identity_visible boolean, first_name text, last_name text, photo_url text, numero_jersey text, age integer, annee_diplomation integer, verified boolean, last_profile_validation timestamp with time zone, cote_globale numeric, profile_completion integer, taille_pieds integer, taille_pouces integer, poids_lbs numeric, moyenne_generale numeric, mentions_academiques jsonb, recruitment_status text, statut_recrutement_override text, open_to_offers boolean, a_une_video boolean, context text, sport_nom text, position_nom text, position_abbr text, school_id uuid, school_name text, school_region text, school_type text, committed_school_name text, evaluations jsonb, team_school_type text, team_age_group text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
DECLARE
  v_tier_ok boolean;
BEGIN
  IF NOT public.is_recruiter() THEN
    RAISE EXCEPTION 'acces reserve aux recruteurs' USING ERRCODE = '42501';
  END IF;

  v_tier_ok := public.get_user_tier() IN ('pro', 'all_star');

  RETURN QUERY
  SELECT
    a.id,
    (public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase)),
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.first_name END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.last_name END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.photo_url END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.numero_jersey END,
    CASE WHEN a.date_naissance IS NOT NULL
         THEN EXTRACT(YEAR FROM age(a.date_naissance))::integer END,
    a.annee_diplomation,
    a.verified,
    a.last_profile_validation,
    a.cote_globale_entraineur,
    a.profile_completion,
    a.taille_pieds, a.taille_pouces, a.poids_lbs,
    a.moyenne_generale, a.mentions_academiques,
    a.recruitment_status::text,
    a.statut_recrutement_override,
    a.open_to_offers,
    -- « A une vidéo » : même définition que recruiter_search_athletes (2026-10-03).
    (COALESCE(NULLIF(btrim(a.video_faits_saillants_url), ''), NULLIF(btrim(a.hudl_url), ''),
              NULLIF(btrim(a.youtube_url), ''), NULLIF(btrim(a.video_match_complet_url), ''),
              NULLIF(btrim(a.video_entrainement_url), '')) IS NOT NULL),
    a.context,
    sp.nom, po.nom, po.abreviation,
    a.school_id, sc.name, sc.region, sc.type,
    cs.name,
    (SELECT jsonb_agg(jsonb_build_object(
              'cote_globale', ev.cote_globale,
              'distinctions', (select coalesce(jsonb_agg(jsonb_build_object('badge', b2.code, 'detail', ab.contexte, 'libelle', b2.libelle) order by b2.ordre), '[]'::jsonb) from public.athlete_badges ab join public.badges b2 on b2.id = ab.badge_id where ab.athlete_id = ev.athlete_id and ab.retire_le is null),
              'updated_at',   ev.updated_at))
       FROM public.evaluations ev
      WHERE ev.athlete_id = a.id),
    -- Lot B3 cégep (filtres Type et Catégorie) : type de l'école de l'équipe et catégorie de
    -- l'équipe. Le type de l'école d'ancrage est school_type, plus haut.
    tsc.type,
    tm.age_group
  FROM public.athletes a
  LEFT JOIN public.sports    sp ON sp.id = a.sport_id
  LEFT JOIN public.positions po ON po.id = a.position_id
  LEFT JOIN public.schools   sc ON sc.id = a.school_id
  LEFT JOIN public.schools   cs ON cs.id = a.committed_school_id
  -- Lot B3 cégep : l'équipe de l'athlète. team_athletes est UNIQUE (athlete_id) : au plus une
  -- ligne, le jeu de lignes ne change pas.
  LEFT JOIN public.team_athletes ta ON ta.athlete_id = a.id
  LEFT JOIN public.teams         tm ON tm.id = ta.team_id
  LEFT JOIN public.schools       tsc ON tsc.id = tm.school_id
  WHERE a.id = ANY(p_athlete_ids)
    AND a.status = 'ACTIF'::public.account_status
    -- Lot A cégep (2026-10-20)
    AND ((SELECT public.peut_voir_cegepiens()) OR NOT public.athlete_est_cegepien(a.id));
END;
$function$;
revoke all on function public.recruiter_athlete_cards(uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.recruiter_athlete_cards(uuid[]) to authenticated;
grant execute on function public.recruiter_athlete_cards(uuid[]) to service_role;

do $$
declare c record;
begin
  for c in select * from _b3_com where texte is not null loop
    execute format('comment on function %s is %L', c.sig, c.texte);
  end loop;
end $$;
drop table _b3_com;

-- ── Les 2 vues partenaire ──
CREATE OR REPLACE VIEW public.top_athletes_view AS
 SELECT a.id,
    a.first_name,
    a.last_name,
    a.cote_globale_entraineur,
    a.annee_diplomation,
    sch.region,
    a.sport_id,
    a.position_id,
    a.school_id,
    a.photo_url,
    s.nom AS sport_name,
    p.nom AS position_name,
    sch.name AS school_name,
    e.distinctions,
    CASE WHEN public.is_partner_media_athlete(a.id) THEN a.video_faits_saillants_url END AS video_faits_saillants_url,
    CASE WHEN public.is_partner_media_athlete(a.id) THEN a.video_match_complet_url END AS video_match_complet_url,
    CASE WHEN public.is_partner_media_athlete(a.id) THEN a.video_entrainement_url END AS video_entrainement_url,
    a.genre,
    ( SELECT COALESCE(jsonb_agg(jsonb_build_object('code', x.code, 'libelle', x.libelle, 'famille', x.famille, 'contexte', x.contexte, 'attribue_le', x.attribue_le) ORDER BY x.rang, x.ordre, x.attribue_le), '[]'::jsonb) AS "coalesce"
           FROM ( SELECT b2.code,
                    b2.libelle,
                    b2.famille,
                    ab.contexte,
                    ab.created_at AS attribue_le,
                    b2.ordre,
                        CASE b2.famille
                            WHEN 'honneur'::text THEN 0
                            WHEN 'universel'::text THEN 1
                            ELSE 2
                        END AS rang
                   FROM public.athlete_badges ab
                     JOIN public.badges b2 ON b2.id = ab.badge_id
                  WHERE ab.athlete_id = a.id AND ab.retire_le IS NULL) x) AS badges,
    -- Lot B3 cégep (filtres Type et Catégorie) : type de l'école d'ancrage, type de l'école de
    -- l'équipe, catégorie de l'équipe.
    sch.type AS school_type,
    tsc.type AS team_school_type,
    tm.age_group AS team_age_group
   FROM public.athletes a
     LEFT JOIN public.sports s ON s.id = a.sport_id
     LEFT JOIN public.positions p ON p.id = a.position_id
     LEFT JOIN public.schools sch ON sch.id = a.school_id
     -- Lot B3 : team_athletes est UNIQUE (athlete_id), au plus une ligne.
     LEFT JOIN public.team_athletes ta ON ta.athlete_id = a.id
     LEFT JOIN public.teams tm ON tm.id = ta.team_id
     LEFT JOIN public.schools tsc ON tsc.id = tm.school_id
     LEFT JOIN LATERAL ( SELECT evaluations.distinctions
           FROM public.evaluations
          WHERE evaluations.athlete_id = a.id
          ORDER BY evaluations.created_at DESC
         LIMIT 1) e ON true
  WHERE a.status = 'ACTIF'::public.account_status
    AND public.is_partner_eligible_athlete(a.id) AND public.is_approved_partner(auth.uid())
  ORDER BY a.cote_globale_entraineur DESC;

CREATE OR REPLACE VIEW public.trending_athletes_view
  WITH (security_barrier = true) AS
 WITH recent_views AS (
         SELECT recruiter_athlete_views.athlete_id,
            count(*) AS views_last_7d
           FROM public.recruiter_athlete_views
          WHERE recruiter_athlete_views.viewed_at >= (now() - '7 days'::interval)
          GROUP BY recruiter_athlete_views.athlete_id
        ), prior_views AS (
         SELECT recruiter_athlete_views.athlete_id,
            count(*) AS views_prior_7d
           FROM public.recruiter_athlete_views
          WHERE recruiter_athlete_views.viewed_at >= (now() - '14 days'::interval) AND recruiter_athlete_views.viewed_at < (now() - '7 days'::interval)
          GROUP BY recruiter_athlete_views.athlete_id
        ), recent_favs AS (
         SELECT recruiter_favorites.athlete_id,
            count(*) AS favs_last_7d
           FROM public.recruiter_favorites
          WHERE recruiter_favorites.created_at >= (now() - '7 days'::interval)
          GROUP BY recruiter_favorites.athlete_id
        ), prior_favs AS (
         SELECT recruiter_favorites.athlete_id,
            count(*) AS favs_prior_7d
           FROM public.recruiter_favorites
          WHERE recruiter_favorites.created_at >= (now() - '14 days'::interval) AND recruiter_favorites.created_at < (now() - '7 days'::interval)
          GROUP BY recruiter_favorites.athlete_id
        )
 SELECT a.id,
    a.first_name,
    a.last_name,
    a.photo_url,
    a.cote_globale_entraineur,
    sch.region,
    sch.name AS school_name,
    a.annee_diplomation,
    s.nom AS sport_name,
    COALESCE(rv.views_last_7d, 0::bigint) AS views_7d,
    COALESCE(pv.views_prior_7d, 0::bigint) AS views_prior_7d,
    COALESCE(rv.views_last_7d, 0::bigint) - COALESCE(pv.views_prior_7d, 0::bigint) AS views_delta,
    COALESCE(rfv.favs_last_7d, 0::bigint) AS favs_7d,
    COALESCE(pf.favs_prior_7d, 0::bigint) AS favs_prior_7d,
    COALESCE(rfv.favs_last_7d, 0::bigint) - COALESCE(pf.favs_prior_7d, 0::bigint) AS favs_delta,
    a.sport_id,
    a.position_id,
    a.genre,
    -- Lot B3 cégep (filtres Type et Catégorie) : type de l'école d'ancrage, type de l'école de
    -- l'équipe, catégorie de l'équipe.
    sch.type AS school_type,
    tsc.type AS team_school_type,
    tm.age_group AS team_age_group
   FROM public.athletes a
     LEFT JOIN public.sports s ON s.id = a.sport_id
     LEFT JOIN public.schools sch ON sch.id = a.school_id
     -- Lot B3 : team_athletes est UNIQUE (athlete_id), au plus une ligne.
     LEFT JOIN public.team_athletes ta ON ta.athlete_id = a.id
     LEFT JOIN public.teams tm ON tm.id = ta.team_id
     LEFT JOIN public.schools tsc ON tsc.id = tm.school_id
     LEFT JOIN recent_views rv ON rv.athlete_id = a.id
     LEFT JOIN prior_views pv ON pv.athlete_id = a.id
     LEFT JOIN recent_favs rfv ON rfv.athlete_id = a.id
     LEFT JOIN prior_favs pf ON pf.athlete_id = a.id
  WHERE a.status = 'ACTIF'::public.account_status
    AND public.is_partner_eligible_athlete(a.id) AND public.is_approved_partner(auth.uid());

-- ── Gardes APRÈS ─────────────────────────────────────────────────────────────
do $$
begin
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)'))
     is distinct from '8ff1f67effeb583d2ef100b7f76560f9' then
    raise exception 'NEXUS: recruiter_search_athletes n''est pas la version B3';
  end if;
  if (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)'))
     is distinct from '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}' then
    raise exception 'NEXUS: ACL de recruiter_search_athletes inattendue : %',
      (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)'));
  end if;
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.recruiter_athlete_profile(uuid)'))
     is distinct from '4ce325480f3d9d85fbf728e963049d57' then
    raise exception 'NEXUS: recruiter_athlete_profile n''est pas la version B3';
  end if;
  if (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_athlete_profile(uuid)'))
     is distinct from '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' then
    raise exception 'NEXUS: ACL de recruiter_athlete_profile inattendue : %',
      (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_athlete_profile(uuid)'));
  end if;
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.recruiter_athlete_cards(uuid[])'))
     is distinct from '230f7047875868d7e3d81dd9b3fcb508' then
    raise exception 'NEXUS: recruiter_athlete_cards n''est pas la version B3';
  end if;
  if (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_athlete_cards(uuid[])'))
     is distinct from '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' then
    raise exception 'NEXUS: ACL de recruiter_athlete_cards inattendue : %',
      (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_athlete_cards(uuid[])'));
  end if;
  if (select relacl::text from pg_class where oid = 'public.top_athletes_view'::regclass) is distinct from '{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}' then
    raise exception 'NEXUS: ACL de top_athletes_view inattendue : %', (select relacl::text from pg_class where oid = 'public.top_athletes_view'::regclass);
  end if;
  if md5(obj_description('public.top_athletes_view'::regclass, 'pg_class')) is distinct from 'af7d280ebfb0efef9c6671ef88cab628' then
    raise exception 'NEXUS: commentaire de top_athletes_view inattendu';
  end if;
  if (select relacl::text from pg_class where oid = 'public.trending_athletes_view'::regclass) is distinct from '{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}' then
    raise exception 'NEXUS: ACL de trending_athletes_view inattendue : %', (select relacl::text from pg_class where oid = 'public.trending_athletes_view'::regclass);
  end if;
  if md5(obj_description('public.trending_athletes_view'::regclass, 'pg_class')) is distinct from '437c56a0178020eb9fed67cccb27c6c1' then
    raise exception 'NEXUS: commentaire de trending_athletes_view inattendu';
  end if;
  if (select reloptions from pg_class where oid = 'public.top_athletes_view'::regclass) is not null then
    raise exception 'NEXUS: top_athletes_view a des reloptions';
  end if;
  if (select reloptions::text from pg_class where oid = 'public.trending_athletes_view'::regclass)
     is distinct from '{security_barrier=true}' then
    raise exception 'NEXUS: trending_athletes_view sans security_barrier';
  end if;
  if md5(obj_description(to_regprocedure('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)'), 'pg_proc')) is distinct from 'e1c17f94928a14a388dc07e03ea4a2fc' then
    raise exception 'NEXUS: commentaire de recruiter_search_athletes inattendu';
  end if;
  if md5(obj_description(to_regprocedure('public.recruiter_athlete_profile(uuid)'), 'pg_proc')) is distinct from '4a6be07c0b1f51c8e7189d525b6e9507' then
    raise exception 'NEXUS: commentaire de recruiter_athlete_profile inattendu';
  end if;
  if md5(obj_description(to_regprocedure('public.recruiter_athlete_cards(uuid[])'), 'pg_proc')) is distinct from 'a2e22b53f4031df7aa0397bb997c51ba' then
    raise exception 'NEXUS: commentaire de recruiter_athlete_cards inattendu';
  end if;
  if pg_get_function_result(to_regprocedure('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)')) not like '%, cote_partenaire_organisation text, team_age_group text)' then
    raise exception 'NEXUS: colonnes de fin de recruiter_search_athletes inattendues';
  end if;
  if pg_get_function_result(to_regprocedure('public.recruiter_athlete_profile(uuid)')) not like '%, evaluations jsonb, team_school_type text, team_age_group text)' then
    raise exception 'NEXUS: colonnes de fin de recruiter_athlete_profile inattendues';
  end if;
  if pg_get_function_result(to_regprocedure('public.recruiter_athlete_cards(uuid[])')) not like '%, evaluations jsonb, team_school_type text, team_age_group text)' then
    raise exception 'NEXUS: colonnes de fin de recruiter_athlete_cards inattendues';
  end if;
  if (select string_agg(attname, ',' order by attnum) from (select attname, attnum from pg_attribute
        where attrelid = 'public.top_athletes_view'::regclass and attnum > 0 order by attnum desc limit 3) x)
     is distinct from 'school_type,team_school_type,team_age_group' then
    raise exception 'NEXUS: colonnes de fin de top_athletes_view inattendues';
  end if;
  if (select string_agg(attname, ',' order by attnum) from (select attname, attnum from pg_attribute
        where attrelid = 'public.trending_athletes_view'::regclass and attnum > 0 order by attnum desc limit 3) x)
     is distinct from 'school_type,team_school_type,team_age_group' then
    raise exception 'NEXUS: colonnes de fin de trending_athletes_view inattendues';
  end if;
end $$;

notify pgrst, 'reload schema';
$nexus_mig$;
begin
  if md5(t) <> '8be0e1f1e60b7f86f11f4e1018997880' then
    raise exception 'NEXUS: texte de la migration altéré (md5 %)', md5(t);
  end if;
  execute t;
end $rejeu$;
select clock_timestamp() as fin_migration;
-- La migration pose search_path en « set local » : on le reprend tel quel.
set local search_path = public, extensions;

-- ── 3. APRÈS ─────────────────────────────────────────────────────────────────
select pg_temp.mesurer('2 après');
select pg_temp.empreinte('2 après');

-- ── 4. Le rollback, texte gardé par son md5 ─────────────────────────────────
do $rejeu$
declare t text := $nexus_rb$-- ════════════════════════════════════════════════════════════════════════════
-- Rollback du lot B3 cégep (20261028160000_cegep_lot_b3_filtres). Sur GO BP seulement.
-- Remet les 3 fonctions recruteur et les 2 vues partenaire dans leur état prod du 2026-10-26 :
-- corps d'origine à la lettre, ACL au texte exact, commentaires reposés, reloptions identiques.
-- Les vues perdent des colonnes : DROP + CREATE (aucun objet n'en dépend, gardé ci-dessous).
-- ════════════════════════════════════════════════════════════════════════════

set local search_path = public, extensions;

do $$
begin
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)'))
     is distinct from '8ff1f67effeb583d2ef100b7f76560f9' then
    raise exception 'NEXUS: recruiter_search_athletes n''est pas la version B3 — ne pas écraser une version inconnue';
  end if;
  if (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)'))
     is distinct from '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}' then
    raise exception 'NEXUS: ACL de recruiter_search_athletes inattendue : %',
      (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)'));
  end if;
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.recruiter_athlete_profile(uuid)'))
     is distinct from '4ce325480f3d9d85fbf728e963049d57' then
    raise exception 'NEXUS: recruiter_athlete_profile n''est pas la version B3 — ne pas écraser une version inconnue';
  end if;
  if (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_athlete_profile(uuid)'))
     is distinct from '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' then
    raise exception 'NEXUS: ACL de recruiter_athlete_profile inattendue : %',
      (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_athlete_profile(uuid)'));
  end if;
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.recruiter_athlete_cards(uuid[])'))
     is distinct from '230f7047875868d7e3d81dd9b3fcb508' then
    raise exception 'NEXUS: recruiter_athlete_cards n''est pas la version B3 — ne pas écraser une version inconnue';
  end if;
  if (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_athlete_cards(uuid[])'))
     is distinct from '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' then
    raise exception 'NEXUS: ACL de recruiter_athlete_cards inattendue : %',
      (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_athlete_cards(uuid[])'));
  end if;
  if (select relacl::text from pg_class where oid = 'public.top_athletes_view'::regclass) is distinct from '{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}' then
    raise exception 'NEXUS: ACL de top_athletes_view inattendue : %', (select relacl::text from pg_class where oid = 'public.top_athletes_view'::regclass);
  end if;
  if md5(obj_description('public.top_athletes_view'::regclass, 'pg_class')) is distinct from 'af7d280ebfb0efef9c6671ef88cab628' then
    raise exception 'NEXUS: commentaire de top_athletes_view inattendu';
  end if;
  if (select relacl::text from pg_class where oid = 'public.trending_athletes_view'::regclass) is distinct from '{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}' then
    raise exception 'NEXUS: ACL de trending_athletes_view inattendue : %', (select relacl::text from pg_class where oid = 'public.trending_athletes_view'::regclass);
  end if;
  if md5(obj_description('public.trending_athletes_view'::regclass, 'pg_class')) is distinct from '437c56a0178020eb9fed67cccb27c6c1' then
    raise exception 'NEXUS: commentaire de trending_athletes_view inattendu';
  end if;
  if (select reloptions from pg_class where oid = 'public.top_athletes_view'::regclass) is not null then
    raise exception 'NEXUS: top_athletes_view a des reloptions';
  end if;
  if (select reloptions::text from pg_class where oid = 'public.trending_athletes_view'::regclass)
     is distinct from '{security_barrier=true}' then
    raise exception 'NEXUS: trending_athletes_view sans security_barrier';
  end if;
  if exists (select 1 from pg_depend d join pg_rewrite r on r.oid = d.objid and d.classid = 'pg_rewrite'::regclass
              where d.refobjid in ('public.top_athletes_view'::regclass, 'public.trending_athletes_view'::regclass)
                and r.ev_class not in ('public.top_athletes_view'::regclass, 'public.trending_athletes_view'::regclass)) then
    raise exception 'NEXUS: un objet dépend d''une des 2 vues';
  end if;
end $$;

create temp table _b3_com (sig text primary key, texte text);
insert into _b3_com
select 'public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)', obj_description(to_regprocedure('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)'), 'pg_proc')
union all
select 'public.recruiter_athlete_profile(uuid)', obj_description(to_regprocedure('public.recruiter_athlete_profile(uuid)'), 'pg_proc')
union all
select 'public.recruiter_athlete_cards(uuid[])', obj_description(to_regprocedure('public.recruiter_athlete_cards(uuid[])'), 'pg_proc');
create temp table _b3_com_vues (vue text primary key, texte text);
insert into _b3_com_vues
select 'public.top_athletes_view', obj_description('public.top_athletes_view'::regclass, 'pg_class')
union all
select 'public.trending_athletes_view', obj_description('public.trending_athletes_view'::regclass, 'pg_class');

-- ── recruiter_search_athletes ──
drop function public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean);
CREATE FUNCTION public.recruiter_search_athletes(p_search text DEFAULT NULL::text, p_sport_id uuid DEFAULT NULL::uuid, p_promotion integer DEFAULT NULL::integer, p_verified_only boolean DEFAULT false, p_with_video_only boolean DEFAULT false, p_min_gpa numeric DEFAULT NULL::numeric, p_min_rating numeric DEFAULT NULL::numeric, p_ouvert_demenager boolean DEFAULT false, p_ouvert_prive boolean DEFAULT false, p_ouvert_anglophone boolean DEFAULT false, p_new_only boolean DEFAULT false, p_sort_by text DEFAULT 'rating_desc'::text, p_limit integer DEFAULT NULL::integer, p_programme_ids uuid[] DEFAULT NULL::uuid[], p_offert_par_mon_cegep boolean DEFAULT false, p_inclure_partenaires boolean DEFAULT false)
 RETURNS TABLE(id uuid, identity_visible boolean, first_name text, last_name text, photo_url text, numero_jersey text, age integer, annee_diplomation integer, verified boolean, last_profile_validation timestamp with time zone, cote_globale numeric, profile_completion integer, taille_pieds integer, taille_pouces integer, poids_lbs numeric, moyenne_generale numeric, mentions_academiques jsonb, recruitment_status text, statut_recrutement_override text, open_to_offers boolean, a_une_video boolean, context text, created_at timestamp with time zone, sport_nom text, position_nom text, position_abbr text, school_id uuid, school_name text, school_region text, school_type text, committed_school_name text, evaluations jsonb, team_gender text, programmes jsonb, team_division text, team_league text, team_is_rseq boolean, team_school_type text, cote_partenaire numeric, cote_partenaire_organisation text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
DECLARE
  v_tier_ok boolean;
  v_mots    text[];
  v_sort    text;
  v_school  uuid;
BEGIN
  IF NOT public.is_recruiter() THEN
    RAISE EXCEPTION 'acces reserve aux recruteurs' USING ERRCODE = '42501';
  END IF;

  v_tier_ok := public.get_user_tier() IN ('pro', 'all_star');

  -- RECHERCHE TEXTE — ouverte a TOUS les paliers depuis le 2026-09-17, mais la
  -- branche NOM du predicat reste Pro (et identite visible) : voir l'en-tete
  -- de la migration 20260917120000. Mots sans accent, jokers LIKE echappes.
  -- NULL si la saisie est vide.
  SELECT array_agg(replace(replace(replace(
           extensions.unaccent('extensions.unaccent'::regdictionary, m),
           '\', '\\'), '%', '\%'), '_', '\_'))
    INTO v_mots
    FROM regexp_split_to_table(btrim(COALESCE(p_search, '')), '\s+') AS m
   WHERE m <> '';

  -- Oracle ferme pour les Free : le tri alphabetique est rabattu sur la cote —
  -- sinon l'ORDRE trahirait le nom qu'on vient de masquer.
  --
  -- VITRINE : volontairement NON assoupli. La vitrine sort de toute facon en
  -- tete du tri par cote.
  v_sort := CASE WHEN p_sort_by = 'name_asc' AND NOT v_tier_ok
                 THEN 'rating_desc' ELSE p_sort_by END;

  -- Une liste a zero doit toujours pouvoir dire POURQUOI elle est a zero.
  IF p_offert_par_mon_cegep THEN
    SELECT u.school_id INTO v_school FROM public.users u WHERE u.id = auth.uid();
    IF v_school IS NULL THEN
      RAISE EXCEPTION 'NEXUS: aucun cegep rattache a ce compte — le filtre « offert par mon cegep » est indisponible'
        USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.school_programs sp WHERE sp.school_id = v_school) THEN
      RAISE EXCEPTION 'NEXUS: aucun programme au catalogue de ce cegep — le filtre « offert par mon cegep » ne peut rien rendre'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    (public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase)),
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.first_name END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.last_name END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.photo_url END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.numero_jersey END,
    CASE WHEN a.date_naissance IS NOT NULL
         THEN EXTRACT(YEAR FROM age(a.date_naissance))::integer END,
    a.annee_diplomation, a.verified, a.last_profile_validation,
    a.cote_globale_entraineur, a.profile_completion,
    a.taille_pieds, a.taille_pouces, a.poids_lbs,
    a.moyenne_generale, a.mentions_academiques,
    a.recruitment_status::text, a.statut_recrutement_override, a.open_to_offers,
    -- « A une vidéo » : l'un des CINQ liens vidéo, non vide (2026-10-03).
    (COALESCE(NULLIF(btrim(a.video_faits_saillants_url), ''), NULLIF(btrim(a.hudl_url), ''),
              NULLIF(btrim(a.youtube_url), ''), NULLIF(btrim(a.video_match_complet_url), ''),
              NULLIF(btrim(a.video_entrainement_url), '')) IS NOT NULL),
    a.context, a.created_at,
    sp.nom, po.nom, po.abreviation,
    a.school_id, sc.name, sc.region, sc.type,
    cs.name,
    -- Badges SANS évaluation (2026-10-03) : l'agrégat ne passait que par
    -- evaluations — un athlète badgé mais jamais évalué perdait ses badges sur
    -- la carte ET dans « Avec distinction » (1 cas en prod). Repli : une ligne
    -- qui ne porte QUE les badges, sans cote (le client n'en lit que les
    -- distinctions).
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'cote_globale', ev.cote_globale,
              'distinctions', (select coalesce(jsonb_agg(jsonb_build_object('badge', b2.code, 'detail', ab.contexte, 'libelle', b2.libelle) order by b2.ordre), '[]'::jsonb) from public.athlete_badges ab join public.badges b2 on b2.id = ab.badge_id where ab.athlete_id = ev.athlete_id and ab.retire_le is null),
              'updated_at',   ev.updated_at))
       FROM public.evaluations ev
      WHERE ev.athlete_id = a.id),
     (SELECT jsonb_build_array(jsonb_build_object(
               'cote_globale', NULL,
               'distinctions', jsonb_agg(jsonb_build_object('badge', b2.code, 'detail', ab.contexte, 'libelle', b2.libelle) ORDER BY b2.ordre),
               'updated_at',   NULL))
        FROM public.athlete_badges ab JOIN public.badges b2 ON b2.id = ab.badge_id
       WHERE ab.athlete_id = a.id AND ab.retire_le IS NULL
      HAVING count(*) > 0)),
    tm.gender,
    -- Projection : sans elle le filtre est aveugle. Le LIBELLE choisi par
    -- l'athlete, pas le nom ministeriel.
    (SELECT jsonb_agg(jsonb_build_object(
              'id', l.id, 'label', l.label, 'code', p.code, 'program_id', p.id)
              ORDER BY idx.ord)
       FROM unnest(a.programmes_vises) WITH ORDINALITY AS idx(lid, ord)
       JOIN public.cegep_program_labels l ON l.id = idx.lid
       JOIN public.cegep_programs       p ON p.id = l.program_id),
    -- LOT 3 — meme jointure qu'au-dessus, quatre colonnes de plus.
    tm.division,
    tm.league,
    (tm.rseq_team_id IS NOT NULL),
    tsc.type,
    -- W2 — l'évaluation PARTENAIRE, à part : jamais fusionnée dans cote_globale
    -- (qui reste la note du coach, lue telle quelle par les binaires mobiles).
    pe.cote_globale,
    pe.organisation
  FROM public.athletes a
  LEFT JOIN public.sports        sp ON sp.id = a.sport_id
  LEFT JOIN public.positions     po ON po.id = a.position_id
  LEFT JOIN public.schools       sc ON sc.id = a.school_id
  LEFT JOIN public.schools       cs ON cs.id = a.committed_school_id
  LEFT JOIN public.team_athletes ta ON ta.athlete_id = a.id
  LEFT JOIN public.teams         tm ON tm.id = ta.team_id
  -- L'ecole de L'EQUIPE, pas celle de l'athlete : les deux divergent deja en
  -- prod (2 athletes au 2026-09-07). `teams.school_id` est NOT NULL, donc
  -- `team_school_type` non nul <=> l'athlete a une equipe.
  LEFT JOIN public.schools       tsc ON tsc.id = tm.school_id
  -- W2 — la plus récente évaluation d'un partenaire APPROUVÉ. Une seule ligne
  -- (LIMIT 1) : le join ne multiplie rien.
  LEFT JOIN LATERAL (
    SELECT pev.cote_globale, mp.organization_name AS organisation
      FROM public.partner_evaluations pev
      JOIN public.media_partners mp ON mp.id = pev.partner_id AND mp.status = 'APPROVED'
     WHERE pev.athlete_id = a.id
       AND COALESCE(public.is_partner_eligible_athlete(a.id), false)  -- Loi 25 (2026-10-16) : sans opt-in actif, rien — sauf pour l'admin.
     ORDER BY pev.updated_at DESC, pev.id DESC
     LIMIT 1) pe ON true
  WHERE a.status = 'ACTIF'::public.account_status
    -- Lot A cégep (2026-10-20) : un cégépien n'est rendu qu'à qui peut_voir_cegepiens().
    AND ((SELECT public.peut_voir_cegepiens()) OR NOT public.athlete_est_cegepien(a.id))
    -- D1b (2026-10-15) : une fiche sans prénom, sans nom, ou au nom recopié de Google et pas encore
    -- confirmé par l'athlète, n'apparaît pas dans la recherche.
    AND COALESCE(btrim(a.first_name), '') <> '' AND COALESCE(btrim(a.last_name), '') <> ''
    AND NOT a.nom_a_confirmer
    -- RECHERCHE PAR MOTS (2026-09-17). Lu : « aucun mot saisi n'est introuvable ».
    -- Un mot est trouve s'il figure dans :
    --   · le prenom ou le nom — PRO SEULEMENT et IDENTITE VISIBLE (oracle ferme) ;
    --   · l'ecole de l'athlete, l'ecole de son equipe, ou son equipe — tous paliers.
    AND (v_mots IS NULL OR NOT EXISTS (
          SELECT 1
            FROM unnest(v_mots) AS mot
           WHERE NOT COALESCE(
                   (    v_tier_ok
                    AND public.athlete_identity_ok(a.date_naissance, a.consentement_parental)
                    AND (   extensions.unaccent('extensions.unaccent'::regdictionary, a.first_name) ILIKE '%' || mot || '%'
                         OR extensions.unaccent('extensions.unaccent'::regdictionary, a.last_name)  ILIKE '%' || mot || '%'))
                   OR extensions.unaccent('extensions.unaccent'::regdictionary, sc.name)  ILIKE '%' || mot || '%'
                   OR extensions.unaccent('extensions.unaccent'::regdictionary, tsc.name) ILIKE '%' || mot || '%'
                   OR extensions.unaccent('extensions.unaccent'::regdictionary, tm.name)  ILIKE '%' || mot || '%',
                 false)))
    AND (p_sport_id  IS NULL OR a.sport_id = p_sport_id)
    AND (p_promotion IS NULL OR a.annee_diplomation = p_promotion)
    AND (NOT p_verified_only    OR a.verified = true)
    AND (NOT p_with_video_only  OR (COALESCE(NULLIF(btrim(a.video_faits_saillants_url), ''), NULLIF(btrim(a.hudl_url), ''),
              NULLIF(btrim(a.youtube_url), ''), NULLIF(btrim(a.video_match_complet_url), ''),
              NULLIF(btrim(a.video_entrainement_url), '')) IS NOT NULL))
    AND (p_min_gpa    IS NULL OR a.moyenne_generale >= p_min_gpa)
    -- W2 — cote du coach si elle existe, sinon celle du partenaire (décision BP),
    -- seulement si l'appelant le demande (web). Sinon : cote du coach seule,
    -- comme avant W2 (binaires mobiles publiés).
    AND (p_min_rating IS NULL OR
         CASE WHEN p_inclure_partenaires THEN COALESCE(a.cote_globale_entraineur, pe.cote_globale)
              ELSE a.cote_globale_entraineur END >= p_min_rating)
    AND (NOT p_ouvert_demenager  OR a.pret_changer_region = true)
    AND (NOT p_ouvert_prive      OR a.ouvert_cegep_prive = true)
    AND (NOT p_ouvert_anglophone OR a.ouvert_cegep_anglophone = true)
    AND (NOT p_new_only OR a.created_at >= now() - INTERVAL '10 days')
    -- Comparaison au niveau du PROGRAMME, pas du libelle.
    AND (p_programme_ids IS NULL OR EXISTS (
          SELECT 1 FROM public.cegep_program_labels l
           WHERE l.id = ANY(a.programmes_vises)
             AND l.program_id = ANY(p_programme_ids)))
    AND (NOT p_offert_par_mon_cegep OR EXISTS (
          SELECT 1
            FROM public.cegep_program_labels l
            JOIN public.school_programs spx ON spx.program_id = l.program_id
           WHERE l.id = ANY(a.programmes_vises)
             AND spx.school_id = v_school
             AND spx.is_displayed))
  ORDER BY
    CASE WHEN v_sort = 'rating_desc' THEN
      CASE WHEN p_inclure_partenaires THEN COALESCE(a.cote_globale_entraineur, pe.cote_globale)
           ELSE a.cote_globale_entraineur END END DESC NULLS LAST,
    CASE WHEN v_sort = 'rating_asc'  THEN
      CASE WHEN p_inclure_partenaires THEN COALESCE(a.cote_globale_entraineur, pe.cote_globale)
           ELSE a.cote_globale_entraineur END END ASC  NULLS LAST,
    CASE WHEN v_sort = 'grad_asc'    THEN a.annee_diplomation END ASC,
    CASE WHEN v_sort = 'grad_desc'   THEN a.annee_diplomation END DESC,
    CASE WHEN v_sort = 'name_asc'    THEN a.last_name END ASC,
    a.id
  LIMIT CASE WHEN p_limit IS NULL OR p_limit < 0 THEN NULL ELSE p_limit END;
END;
$function$;
revoke all on function public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean) from public, anon, authenticated, service_role;
grant execute on function public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean) to service_role;
grant execute on function public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean) to authenticated;

-- ── recruiter_athlete_profile ──
drop function public.recruiter_athlete_profile(uuid);
CREATE FUNCTION public.recruiter_athlete_profile(p_athlete_id uuid)
 RETURNS TABLE(id uuid, identity_visible boolean, first_name text, last_name text, photo_url text, numero_jersey text, age integer, genre text, annee_diplomation integer, verified boolean, profile_completion integer, last_profile_validation timestamp with time zone, cote_globale numeric, taille_pieds integer, taille_pouces integer, poids_lbs numeric, moyenne_generale numeric, mentions_academiques jsonb, matieres_fortes jsonb, programme_cegep_vise jsonb, regions_cegep_preferees jsonb, ouvert_cegep_prive boolean, ouvert_cegep_anglophone boolean, pret_changer_region boolean, bio text, recruitment_status text, statut_recrutement_override text, open_to_offers boolean, video_faits_saillants_url text, hudl_url text, youtube_url text, context text, sport_nom text, position_nom text, position_abbr text, school_id uuid, school_name text, school_region text, school_city text, school_type text, committed_school_name text, evaluations jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
DECLARE
  v_tier_ok boolean;
BEGIN
  IF NOT public.is_recruiter() THEN
    RAISE EXCEPTION 'acces reserve aux recruteurs' USING ERRCODE = '42501';
  END IF;

  v_tier_ok := public.get_user_tier() IN ('pro', 'all_star');

  RETURN QUERY
  SELECT
    a.id,
    (public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase)),
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.first_name END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.last_name END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.photo_url END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.numero_jersey END,
    CASE WHEN a.date_naissance IS NOT NULL
         THEN EXTRACT(YEAR FROM age(a.date_naissance))::integer END,
    a.genre,
    a.annee_diplomation, a.verified, a.profile_completion, a.last_profile_validation,
    a.cote_globale_entraineur,
    a.taille_pieds, a.taille_pouces, a.poids_lbs,
    a.moyenne_generale, a.mentions_academiques, a.matieres_fortes,
    a.programme_cegep_vise, a.regions_cegep_preferees,
    a.ouvert_cegep_prive, a.ouvert_cegep_anglophone, a.pret_changer_region,
    a.bio,
    a.recruitment_status::text, a.statut_recrutement_override, a.open_to_offers,
    a.video_faits_saillants_url, a.hudl_url, a.youtube_url,
    a.context,
    sp.nom, po.nom, po.abreviation,
    a.school_id, sc.name, sc.region, sc.city, sc.type,
    cs.name,
    (SELECT jsonb_agg(jsonb_build_object(
              'cote_globale',        ev.cote_globale,
              'distinctions', (select coalesce(jsonb_agg(jsonb_build_object('badge', b2.code, 'detail', ab.contexte, 'libelle', b2.libelle) order by b2.ordre), '[]'::jsonb) from public.athlete_badges ab join public.badges b2 on b2.id = ab.badge_id where ab.athlete_id = ev.athlete_id and ab.retire_le is null),
              'rapport_entraineur',  ev.rapport_entraineur,
              'updated_at',          ev.updated_at,
              'leadership',          ev.leadership,
              'discipline',          ev.discipline,
              'coachabilite',        ev.coachabilite,
              'intelligence_jeu',    ev.intelligence_jeu,
              'competitivite',       ev.competitivite,
              'esprit_equipe',       ev.esprit_equipe,
              'resilience',          ev.resilience,
              'attitude_mentalite',  ev.attitude_mentalite,
              'vitesse_explosivite', ev.vitesse_explosivite,
              'force_puissance',     ev.force_puissance,
              'endurance_cardio',    ev.endurance_cardio,
              'agilite_coordination',ev.agilite_coordination,
              'vision_du_jeu',       ev.vision_du_jeu,
              'sens_tactique',       ev.sens_tactique))
       FROM public.evaluations ev
      WHERE ev.athlete_id = a.id)
  FROM public.athletes a
  LEFT JOIN public.sports    sp ON sp.id = a.sport_id
  LEFT JOIN public.positions po ON po.id = a.position_id
  LEFT JOIN public.schools   sc ON sc.id = a.school_id
  LEFT JOIN public.schools   cs ON cs.id = a.committed_school_id
  WHERE a.id = p_athlete_id
    AND a.status = 'ACTIF'::public.account_status
    -- Lot A cégep (2026-10-20)
    AND ((SELECT public.peut_voir_cegepiens()) OR NOT public.athlete_est_cegepien(a.id));
END;
$function$;
revoke all on function public.recruiter_athlete_profile(uuid) from public, anon, authenticated, service_role;
grant execute on function public.recruiter_athlete_profile(uuid) to authenticated;
grant execute on function public.recruiter_athlete_profile(uuid) to service_role;

-- ── recruiter_athlete_cards ──
drop function public.recruiter_athlete_cards(uuid[]);
CREATE FUNCTION public.recruiter_athlete_cards(p_athlete_ids uuid[])
 RETURNS TABLE(id uuid, identity_visible boolean, first_name text, last_name text, photo_url text, numero_jersey text, age integer, annee_diplomation integer, verified boolean, last_profile_validation timestamp with time zone, cote_globale numeric, profile_completion integer, taille_pieds integer, taille_pouces integer, poids_lbs numeric, moyenne_generale numeric, mentions_academiques jsonb, recruitment_status text, statut_recrutement_override text, open_to_offers boolean, a_une_video boolean, context text, sport_nom text, position_nom text, position_abbr text, school_id uuid, school_name text, school_region text, school_type text, committed_school_name text, evaluations jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
DECLARE
  v_tier_ok boolean;
BEGIN
  IF NOT public.is_recruiter() THEN
    RAISE EXCEPTION 'acces reserve aux recruteurs' USING ERRCODE = '42501';
  END IF;

  v_tier_ok := public.get_user_tier() IN ('pro', 'all_star');

  RETURN QUERY
  SELECT
    a.id,
    (public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase)),
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.first_name END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.last_name END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.photo_url END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.numero_jersey END,
    CASE WHEN a.date_naissance IS NOT NULL
         THEN EXTRACT(YEAR FROM age(a.date_naissance))::integer END,
    a.annee_diplomation,
    a.verified,
    a.last_profile_validation,
    a.cote_globale_entraineur,
    a.profile_completion,
    a.taille_pieds, a.taille_pouces, a.poids_lbs,
    a.moyenne_generale, a.mentions_academiques,
    a.recruitment_status::text,
    a.statut_recrutement_override,
    a.open_to_offers,
    -- « A une vidéo » : même définition que recruiter_search_athletes (2026-10-03).
    (COALESCE(NULLIF(btrim(a.video_faits_saillants_url), ''), NULLIF(btrim(a.hudl_url), ''),
              NULLIF(btrim(a.youtube_url), ''), NULLIF(btrim(a.video_match_complet_url), ''),
              NULLIF(btrim(a.video_entrainement_url), '')) IS NOT NULL),
    a.context,
    sp.nom, po.nom, po.abreviation,
    a.school_id, sc.name, sc.region, sc.type,
    cs.name,
    (SELECT jsonb_agg(jsonb_build_object(
              'cote_globale', ev.cote_globale,
              'distinctions', (select coalesce(jsonb_agg(jsonb_build_object('badge', b2.code, 'detail', ab.contexte, 'libelle', b2.libelle) order by b2.ordre), '[]'::jsonb) from public.athlete_badges ab join public.badges b2 on b2.id = ab.badge_id where ab.athlete_id = ev.athlete_id and ab.retire_le is null),
              'updated_at',   ev.updated_at))
       FROM public.evaluations ev
      WHERE ev.athlete_id = a.id)
  FROM public.athletes a
  LEFT JOIN public.sports    sp ON sp.id = a.sport_id
  LEFT JOIN public.positions po ON po.id = a.position_id
  LEFT JOIN public.schools   sc ON sc.id = a.school_id
  LEFT JOIN public.schools   cs ON cs.id = a.committed_school_id
  WHERE a.id = ANY(p_athlete_ids)
    AND a.status = 'ACTIF'::public.account_status
    -- Lot A cégep (2026-10-20)
    AND ((SELECT public.peut_voir_cegepiens()) OR NOT public.athlete_est_cegepien(a.id));
END;
$function$;
revoke all on function public.recruiter_athlete_cards(uuid[]) from public, anon, authenticated, service_role;
grant execute on function public.recruiter_athlete_cards(uuid[]) to authenticated;
grant execute on function public.recruiter_athlete_cards(uuid[]) to service_role;

do $$
declare c record;
begin
  for c in select * from _b3_com where texte is not null loop
    execute format('comment on function %s is %L', c.sig, c.texte);
  end loop;
end $$;
drop table _b3_com;

-- ── Les 2 vues ──
drop view public.top_athletes_view;
drop view public.trending_athletes_view;
CREATE VIEW public.top_athletes_view AS
 SELECT a.id,
    a.first_name,
    a.last_name,
    a.cote_globale_entraineur,
    a.annee_diplomation,
    sch.region,
    a.sport_id,
    a.position_id,
    a.school_id,
    a.photo_url,
    s.nom AS sport_name,
    p.nom AS position_name,
    sch.name AS school_name,
    e.distinctions,
    CASE WHEN public.is_partner_media_athlete(a.id) THEN a.video_faits_saillants_url END AS video_faits_saillants_url,
    CASE WHEN public.is_partner_media_athlete(a.id) THEN a.video_match_complet_url END AS video_match_complet_url,
    CASE WHEN public.is_partner_media_athlete(a.id) THEN a.video_entrainement_url END AS video_entrainement_url,
    a.genre,
    ( SELECT COALESCE(jsonb_agg(jsonb_build_object('code', x.code, 'libelle', x.libelle, 'famille', x.famille, 'contexte', x.contexte, 'attribue_le', x.attribue_le) ORDER BY x.rang, x.ordre, x.attribue_le), '[]'::jsonb) AS "coalesce"
           FROM ( SELECT b2.code,
                    b2.libelle,
                    b2.famille,
                    ab.contexte,
                    ab.created_at AS attribue_le,
                    b2.ordre,
                        CASE b2.famille
                            WHEN 'honneur'::text THEN 0
                            WHEN 'universel'::text THEN 1
                            ELSE 2
                        END AS rang
                   FROM public.athlete_badges ab
                     JOIN public.badges b2 ON b2.id = ab.badge_id
                  WHERE ab.athlete_id = a.id AND ab.retire_le IS NULL) x) AS badges
   FROM public.athletes a
     LEFT JOIN public.sports s ON s.id = a.sport_id
     LEFT JOIN public.positions p ON p.id = a.position_id
     LEFT JOIN public.schools sch ON sch.id = a.school_id
     LEFT JOIN LATERAL ( SELECT evaluations.distinctions
           FROM public.evaluations
          WHERE evaluations.athlete_id = a.id
          ORDER BY evaluations.created_at DESC
         LIMIT 1) e ON true
  WHERE a.status = 'ACTIF'::public.account_status
    AND public.is_partner_eligible_athlete(a.id) AND public.is_approved_partner(auth.uid())
  ORDER BY a.cote_globale_entraineur DESC;

CREATE VIEW public.trending_athletes_view
  WITH (security_barrier = true) AS
 WITH recent_views AS (
         SELECT recruiter_athlete_views.athlete_id,
            count(*) AS views_last_7d
           FROM public.recruiter_athlete_views
          WHERE recruiter_athlete_views.viewed_at >= (now() - '7 days'::interval)
          GROUP BY recruiter_athlete_views.athlete_id
        ), prior_views AS (
         SELECT recruiter_athlete_views.athlete_id,
            count(*) AS views_prior_7d
           FROM public.recruiter_athlete_views
          WHERE recruiter_athlete_views.viewed_at >= (now() - '14 days'::interval) AND recruiter_athlete_views.viewed_at < (now() - '7 days'::interval)
          GROUP BY recruiter_athlete_views.athlete_id
        ), recent_favs AS (
         SELECT recruiter_favorites.athlete_id,
            count(*) AS favs_last_7d
           FROM public.recruiter_favorites
          WHERE recruiter_favorites.created_at >= (now() - '7 days'::interval)
          GROUP BY recruiter_favorites.athlete_id
        ), prior_favs AS (
         SELECT recruiter_favorites.athlete_id,
            count(*) AS favs_prior_7d
           FROM public.recruiter_favorites
          WHERE recruiter_favorites.created_at >= (now() - '14 days'::interval) AND recruiter_favorites.created_at < (now() - '7 days'::interval)
          GROUP BY recruiter_favorites.athlete_id
        )
 SELECT a.id,
    a.first_name,
    a.last_name,
    a.photo_url,
    a.cote_globale_entraineur,
    sch.region,
    sch.name AS school_name,
    a.annee_diplomation,
    s.nom AS sport_name,
    COALESCE(rv.views_last_7d, 0::bigint) AS views_7d,
    COALESCE(pv.views_prior_7d, 0::bigint) AS views_prior_7d,
    COALESCE(rv.views_last_7d, 0::bigint) - COALESCE(pv.views_prior_7d, 0::bigint) AS views_delta,
    COALESCE(rfv.favs_last_7d, 0::bigint) AS favs_7d,
    COALESCE(pf.favs_prior_7d, 0::bigint) AS favs_prior_7d,
    COALESCE(rfv.favs_last_7d, 0::bigint) - COALESCE(pf.favs_prior_7d, 0::bigint) AS favs_delta,
    a.sport_id,
    a.position_id,
    a.genre
   FROM public.athletes a
     LEFT JOIN public.sports s ON s.id = a.sport_id
     LEFT JOIN public.schools sch ON sch.id = a.school_id
     LEFT JOIN recent_views rv ON rv.athlete_id = a.id
     LEFT JOIN prior_views pv ON pv.athlete_id = a.id
     LEFT JOIN recent_favs rfv ON rfv.athlete_id = a.id
     LEFT JOIN prior_favs pf ON pf.athlete_id = a.id
  WHERE a.status = 'ACTIF'::public.account_status
    AND public.is_partner_eligible_athlete(a.id) AND public.is_approved_partner(auth.uid());

revoke all on table public.top_athletes_view, public.trending_athletes_view from public, anon, authenticated, service_role;
grant all on table public.top_athletes_view, public.trending_athletes_view to authenticated;
grant all on table public.top_athletes_view, public.trending_athletes_view to service_role;
do $$
declare c record;
begin
  for c in select * from _b3_com_vues where texte is not null loop
    execute format('comment on view %s is %L', c.vue, c.texte);
  end loop;
end $$;
drop table _b3_com_vues;

-- ── Gardes APRÈS : état prod du 2026-10-26 ──
do $$
begin
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)'))
     is distinct from 'aba2e501dd8c62f323adfb857150b5a6' then
    raise exception 'NEXUS: recruiter_search_athletes n''est pas revenue au corps prod du 2026-10-26';
  end if;
  if (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)'))
     is distinct from '{postgres=X/postgres,service_role=X/postgres,authenticated=X/postgres}' then
    raise exception 'NEXUS: ACL de recruiter_search_athletes inattendue : %',
      (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)'));
  end if;
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.recruiter_athlete_profile(uuid)'))
     is distinct from '0fccf321625808a8561968231abe85ca' then
    raise exception 'NEXUS: recruiter_athlete_profile n''est pas revenue au corps prod du 2026-10-26';
  end if;
  if (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_athlete_profile(uuid)'))
     is distinct from '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' then
    raise exception 'NEXUS: ACL de recruiter_athlete_profile inattendue : %',
      (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_athlete_profile(uuid)'));
  end if;
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.recruiter_athlete_cards(uuid[])'))
     is distinct from 'ba26d8b8bb57246110388dd63e41ac6d' then
    raise exception 'NEXUS: recruiter_athlete_cards n''est pas revenue au corps prod du 2026-10-26';
  end if;
  if (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_athlete_cards(uuid[])'))
     is distinct from '{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}' then
    raise exception 'NEXUS: ACL de recruiter_athlete_cards inattendue : %',
      (select proacl::text from pg_proc where oid = to_regprocedure('public.recruiter_athlete_cards(uuid[])'));
  end if;
  if md5(pg_get_viewdef('public.top_athletes_view'::regclass)) is distinct from 'b677336de698551f2d5b733bc7f70bab' then
    raise exception 'NEXUS: top_athletes_view n''est pas revenue à la définition prod du 2026-10-26';
  end if;
  if (select relacl::text from pg_class where oid = 'public.top_athletes_view'::regclass) is distinct from '{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}' then
    raise exception 'NEXUS: ACL de top_athletes_view inattendue : %', (select relacl::text from pg_class where oid = 'public.top_athletes_view'::regclass);
  end if;
  if md5(obj_description('public.top_athletes_view'::regclass, 'pg_class')) is distinct from 'af7d280ebfb0efef9c6671ef88cab628' then
    raise exception 'NEXUS: commentaire de top_athletes_view inattendu';
  end if;
  if md5(pg_get_viewdef('public.trending_athletes_view'::regclass)) is distinct from 'b45eb0030c789288a79dddbdd020d060' then
    raise exception 'NEXUS: trending_athletes_view n''est pas revenue à la définition prod du 2026-10-26';
  end if;
  if (select relacl::text from pg_class where oid = 'public.trending_athletes_view'::regclass) is distinct from '{postgres=arwdDxtm/postgres,authenticated=arwdDxtm/postgres,service_role=arwdDxtm/postgres}' then
    raise exception 'NEXUS: ACL de trending_athletes_view inattendue : %', (select relacl::text from pg_class where oid = 'public.trending_athletes_view'::regclass);
  end if;
  if md5(obj_description('public.trending_athletes_view'::regclass, 'pg_class')) is distinct from '437c56a0178020eb9fed67cccb27c6c1' then
    raise exception 'NEXUS: commentaire de trending_athletes_view inattendu';
  end if;
  if (select reloptions from pg_class where oid = 'public.top_athletes_view'::regclass) is not null then
    raise exception 'NEXUS: top_athletes_view a des reloptions';
  end if;
  if (select reloptions::text from pg_class where oid = 'public.trending_athletes_view'::regclass)
     is distinct from '{security_barrier=true}' then
    raise exception 'NEXUS: trending_athletes_view sans security_barrier';
  end if;
  if md5(obj_description(to_regprocedure('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)'), 'pg_proc')) is distinct from 'e1c17f94928a14a388dc07e03ea4a2fc' then
    raise exception 'NEXUS: commentaire de recruiter_search_athletes inattendu';
  end if;
  if md5(obj_description(to_regprocedure('public.recruiter_athlete_profile(uuid)'), 'pg_proc')) is distinct from '4a6be07c0b1f51c8e7189d525b6e9507' then
    raise exception 'NEXUS: commentaire de recruiter_athlete_profile inattendu';
  end if;
  if md5(obj_description(to_regprocedure('public.recruiter_athlete_cards(uuid[])'), 'pg_proc')) is distinct from 'a2e22b53f4031df7aa0397bb997c51ba' then
    raise exception 'NEXUS: commentaire de recruiter_athlete_cards inattendu';
  end if;
end $$;

notify pgrst, 'reload schema';
$nexus_rb$;
begin
  if md5(t) <> 'c4009d73f3a38ba334545724b60df502' then
    raise exception 'NEXUS: texte du rollback altéré (md5 %)', md5(t);
  end if;
  execute t;
end $rejeu$;
set local search_path = public, extensions;

-- ── 5. APRÈS ROLLBACK ────────────────────────────────────────────────────────
select pg_temp.mesurer('3 après rollback');
select pg_temp.empreinte('3 après rollback');
select clock_timestamp() as fin_mesures;

-- ── Rapports ─────────────────────────────────────────────────────────────────
create temp view _kv as
select m.phase, m.compte, m.surface, split_part(x.kv, '=', 1) as k, substr(x.kv, length(split_part(x.kv, '=', 1)) + 2) as v
  from _m m, lateral regexp_split_to_table(m.v, ';') x(kv);

\echo '== 0. Valeurs AVANT (une ligne par valeur distincte ; md5 abrégés)'
select m.surface, min(m.compte) as compte, count(*) as comptes,
       left(regexp_replace(min(m.v), '([0-9a-f]{8})[0-9a-f]{24}', '\1…', 'g'), 160) as valeur
  from _m m where m.phase = '1 avant'
 group by m.surface, m.v order by m.surface, 2;

\echo '== A. Écarts AVANT → APRÈS, clé par clé (seules les clés « effet… » ont le droit de changer)'
select a.surface, a.k as cle, case when a.k like 'effet%' then 'permis' else 'INTERDIT' end as nature,
       count(*) as comptes, left(regexp_replace(a.v, '([0-9a-f]{8})[0-9a-f]{24}', '\1…', 'g'), 60) as avant,
       left(regexp_replace(b.v, '([0-9a-f]{8})[0-9a-f]{24}', '\1…', 'g'), 120) as apres
  from _kv a join _kv b on b.compte = a.compte and b.surface = a.surface and b.k = a.k and b.phase = '2 après'
 where a.phase = '1 avant' and a.v is distinct from b.v
 group by a.surface, a.k, a.v, b.v order by a.surface, a.k;

\echo '== B. Lot A : cégépiens rendus, par compte et par surface, APRÈS (attendu : 0 pour tout recruteur collégial)'
select k.compte, (select cat from _c where cle = k.compte) as categorie, k.surface, k.v as cegepiens
  from _kv k where k.phase = '2 après' and k.k = 'cegepiens' and (k.compte like 'R%' or k.v <> '0')
 order by 1, 3;

\echo '== D. Rollback : AVANT → APRÈS ROLLBACK (attendu : 0, 0)'
select (select count(*) from _m a join _m r on r.compte = a.compte and r.surface = a.surface and r.phase = '3 après rollback'
         where a.phase = '1 avant' and a.v is distinct from r.v) as cellules_differentes,
       (select count(*) from ((select ligne from _e where phase = '1 avant' except all select ligne from _e where phase = '3 après rollback')
                               union all
                              (select ligne from _e where phase = '3 après rollback' except all select ligne from _e where phase = '1 avant')) d)
         as lignes_d_empreinte_differentes,
       (select count(*) from _e where phase = '1 avant') as lignes_d_empreinte;

\echo '== E. Ce que la migration change au schéma (attendu : les 3 fonctions recruteur et les 2 vues partenaire, rien d''autre)'
select left(ligne, 100) as objet, 'avant seulement' as cote from (select ligne from _e where phase = '1 avant' except select ligne from _e where phase = '2 après') x
union all
select left(ligne, 100), 'après seulement' from (select ligne from _e where phase = '2 après' except select ligne from _e where phase = '1 avant') y
order by 1, 2;

\echo '== F. Durées (ms) par sonde et par phase'
select surface, phase, count(*) as appels, round(avg(ms), 1) as ms_moyen, round(max(ms), 1) as ms_max
  from _m group by surface, phase order by surface, phase;

\echo '== VERDICT (attendu : tout à 0)'
select (select count(*) from _kv a join _kv b on b.compte = a.compte and b.surface = a.surface and b.k = a.k and b.phase = '2 après'
         where a.phase = '1 avant' and a.v is distinct from b.v and a.k not like 'effet%') as ecarts_interdits,
       (select count(*) from _kv where phase = '2 après' and k = 'cegepiens' and compte like 'R%' and v <> '0'
           and (select cat from _c where cle = compte) not like '%voit les cégépiens%') as cegepiens_rendus_aux_recruteurs,
       (select count(*) from _m a join _m r on r.compte = a.compte and r.surface = a.surface and r.phase = '3 après rollback'
         where a.phase = '1 avant' and a.v is distinct from r.v) as ecarts_apres_rollback,
       (select count(*) from ((select ligne from _e where phase = '1 avant' except all select ligne from _e where phase = '3 après rollback')
                               union all
                              (select ligne from _e where phase = '3 après rollback' except all select ligne from _e where phase = '1 avant')) d)
         as empreinte_apres_rollback,
       (select count(*) from ((select split_part(ligne, '|', 2) from _e where phase = '1 avant' except select split_part(ligne, '|', 2) from _e where phase = '2 après')
                               union
                              (select split_part(ligne, '|', 2) from _e where phase = '2 après' except select split_part(ligne, '|', 2) from _e where phase = '1 avant')) d
         where d.split_part not in ('top_athletes_view', 'trending_athletes_view',
                                    'recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)',
                                    'recruiter_athlete_cards(uuid[])', 'recruiter_athlete_profile(uuid)'))
         as autres_objets_changes,
       (select count(*) from (select ligne from _e where phase = '1 avant' except select ligne from _e where phase = '2 après') x
         where split_part(ligne, '|', 1) not in ('F', 'V')
            or split_part(ligne, '|', 2) not in ('top_athletes_view', 'trending_athletes_view',
                                    'recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)',
                                    'recruiter_athlete_cards(uuid[])', 'recruiter_athlete_profile(uuid)'))
         as autres_lignes_changees;
\echo '== Refus (identiques avant et après : comptes qui n''ont pas accès à une surface, attendu)'
select m.surface, count(*) filter (where m.phase = '1 avant') as avant, count(*) filter (where m.phase = '2 après') as apres,
       min(left(m.v, 60)) as exemple
  from _m m where m.v like 'refus=%' group by m.surface order by 1;

select clock_timestamp() as fin;
rollback;
\echo '== ROLLBACK fait : rien n''est resté.'
