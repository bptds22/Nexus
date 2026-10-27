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
  if exists (select 1 from supabase_migrations.schema_migrations where version = '@@VERSION@@') then
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
declare t text := $nexus_mig$@@MIGRATION@@$nexus_mig$;
begin
  if md5(t) <> '@@MD5_MIGRATION@@' then
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
declare t text := $nexus_rb$@@ROLLBACK@@$nexus_rb$;
begin
  if md5(t) <> '@@MD5_ROLLBACK@@' then
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
