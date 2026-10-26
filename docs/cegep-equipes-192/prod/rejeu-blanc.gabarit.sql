-- ════════════════════════════════════════════════════════════════════════════
-- Chantier cégep — les 192 équipes RSEQ de cégep : REJEU À BLANC (local ou prod).
-- NE LAISSE RIEN : UNE transaction qui finit par ROLLBACK ; toute erreur arrête psql avant
-- (ON_ERROR_STOP) et la session se ferme sans COMMIT.
--
-- Fichier GÉNÉRÉ par scripts/cegep-equipes-192/generer.sh à partir de ce gabarit : l'opération
-- (creer.sql) et son rollback (retirer.sql) y sont embarqués tels quels (LF), gardés par leur md5.
--
-- Déroulé : mesure AVANT → opération → mesure APRÈS → rollback → mesure APRÈS ROLLBACK → rapports
-- → ROLLBACK. Sondes de compte sous le rôle du compte (authenticated + request.jwt.claims), dans une
-- sous-transaction annulée. Le rapport n'affiche que compteurs, md5 et débuts d'identifiant.
--
-- Chaque cellule est une liste « clé=valeur;… ». Une clé qui commence par « effet » est un effet
-- ATTENDU de l'opération (nouvelles équipes, côtés reliés, suggestions, pages) : il est montré, pas
-- compté. Toute autre clé qui change est un écart INTERDIT (verdict ≠ 0 = ARRÊT).
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '900s';
set local search_path = public, extensions;
set local application_name = 'nexus-rejeu-blanc-cegep-192';
select now() as debut, current_user, current_setting('server_version') as version;

-- ── Les 192 (fixées AVANT) et les listes de sonde ───────────────────────────
create temp table _al as
select a.id, a.rseq_team_id
  from public.rseq_sync_alerts a,
       lateral public.rseq_proposition_equipe(a.rseq_team_id, a.rseq_institution_id, a.payload->>'team_name',
                                              a.rseq_league_id, a.payload->>'saison', 'Collégial') j
 where a.type = 'NOUVELLE_EQUIPE' and a.statut = 'OUVERTE' and j->>'decision' = 'a_creer';
do $$
begin
  if (select count(*) from _al) <> 192
     or (select md5(string_agg(id::text, ',' order by id)) from _al) <> 'd081e67cc269edf1921a88e5f7cecbd9'
     or (select md5(string_agg(rseq_team_id::text, ',' order by rseq_team_id)) from _al) <> '5834ba7981ca91638a8970541dc42117' then
    raise exception 'NEXUS: les 192 ont bougé (% alertes)', (select count(*) from _al);
  end if;
  if exists (select 1 from public.admin_operations where operation = 'CEGEP_EQUIPES_RSEQ_192') then
    raise exception 'NEXUS: les 192 ont déjà été créées';
  end if;
end $$;
-- Équipes présentes AVANT (les seules qui doivent rester identiques).
create temp table _t0 as select id from public.teams;
-- Matchs d'une des 192 (par rseq_team_id) et matchs d'une équipe de cégep.
create temp table _g192 as
select g.id from public.games g
 where g.home_rseq_team_id in (select rseq_team_id from _al) or g.visitor_rseq_team_id in (select rseq_team_id from _al);
create temp table _gc as
select g.id from public.games g
 where g.id in (select id from _g192)
    or exists (select 1 from public.teams t join public.schools s on s.id = t.school_id
                where s.type::text = 'CEGEP' and t.id in (g.home_team_id, g.visitor_team_id));
create temp table _tx as
select name as t from public.schools where type::text = 'CEGEP'
union select name from (select name from public.schools where type::text = 'SECONDAIRE' order by name limit 15) x
union select unnest(array['Collégial', 'Basketball', 'Volleyball', 'Soccer', 'Badminton', 'Rugby', 'Champlain', 'Juvénile']);

create temp table _lit (k text primary key, v text);
insert into _lit values
  ('{RIDS}',   (select 'array[' || string_agg(quote_literal(rseq_team_id::text), ',' order by rseq_team_id) || ']::uuid[]' from _al)),
  ('{G192}',   (select coalesce('array[' || string_agg(quote_literal(id::text), ',' order by id) || ']::uuid[]', 'array[]::uuid[]') from _g192)),
  ('{GCEGEP}', (select coalesce('array[' || string_agg(quote_literal(id::text), ',' order by id) || ']::uuid[]', 'array[]::uuid[]') from _gc)),
  ('{TEXTES}', (select 'array[' || string_agg(quote_literal(t), ',' order by t) || ']::text[]' from _tx)),
  ('{CODES}',  (select coalesce('array[' || string_agg(quote_literal(code), ',' order by code) || ']::text[]', 'array[]::text[]') from public.team_join_tokens));

-- ── Les comptes (même règle que B2) ──────────────────────────────────────────
create temp table _c (cle text primary key, uid uuid, role text, cat text, jeton text);
insert into _c
select 'ADMIN', coalesce((select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0' and role = 'ADMIN'::public.user_role),
                         (select id from public.users where role = 'ADMIN'::public.user_role order by id limit 1)),
       'authenticated', 'admin', null;
insert into _c
select 'R' || lpad(row_number() over (order by u.id)::text, 2, '0') || ' ' || left(u.id::text, 8), u.id, 'authenticated',
       'recruteur Pro, école ' || coalesce(s.type::text, 'aucune'), null
  from public.users u left join public.schools s on s.id = u.school_id
 where u.role = 'RECRUTEUR'::public.user_role
   and (select sb.tier from public.subscriptions sb where sb.user_id = u.id and sb.status = 'active'
         order by sb.created_at desc limit 1) in ('pro', 'all_star');
insert into _c
select 'P' || lpad(row_number() over (order by u.id)::text, 2, '0') || ' ' || left(u.id::text, 8), u.id, 'authenticated', 'partenaire admis', null
  from public.users u
 where u.role = 'PARTNER'::public.user_role
   and exists (select 1 from public.media_partners mp where mp.user_id = u.id and mp.status = 'APPROVED');
insert into _c
select 'I' || lpad(row_number() over (order by ti.id)::text, 2, '0') || ' ' || left(a.user_id::text, 8), a.user_id, 'authenticated',
       'destinataire d''invitation', ti.transfer_token
  from public.team_invitations ti join public.athletes a on a.id = ti.athlete_id
 where ti.status = 'PENDING' and (ti.expires_at is null or ti.expires_at > now())
   and ti.transfer_token is not null and a.user_id is not null;
delete from _c where uid is null;
do $$
begin
  if not exists (select 1 from _c where cle like 'R%') then raise exception 'NEXUS: aucun recruteur Pro pour sonder'; end if;
end $$;
select cat, count(*) as comptes from _c group by cat order by cat;
select (select count(*) from _al) as les_192, (select count(*) from _g192) as matchs_des_192,
       (select count(*) from _gc) as matchs_cegep_sondes, (select count(*) from _tx) as textes, (select count(*) from _t0) as equipes_avant;

-- ── Les sondes ───────────────────────────────────────────────────────────────
create temp table _s (cle text primary key, portee text, q text);
insert into _s values
  -- Carte des matchs : toute la saison par fenêtres de 31 jours. Les matchs des 192 = effet ; le reste identique.
  ('a01 matchs_recherche : saison, fenêtres de 31 j', 'R1',
   $$select string_agg('f' || to_char(w.d, 'YYYYMMDD') || '=' ||
              (select count(*) filter (where not (r.id = any({G192}))) || '/'
                      || md5(coalesce(string_agg(r::text, '|' order by r.id) filter (where not (r.id = any({G192}))), ''))
                 from public.matchs_recherche(w.d, w.d + 30, null, array['SECONDAIRE','COLLEGIAL','CIVIL'], null, null, null, false) r)
              || ';effet_f' || to_char(w.d, 'YYYYMMDD') || '=' ||
              (select count(*) filter (where r.id = any({G192})) || '/'
                      || md5(coalesce(string_agg(r::text, '|' order by r.id) filter (where r.id = any({G192})), ''))
                 from public.matchs_recherche(w.d, w.d + 30, null, array['SECONDAIRE','COLLEGIAL','CIVIL'], null, null, null, false) r),
              ';' order by w.d)
       from (select d0::date as d from generate_series('2026-07-01'::date, '2027-07-31'::date, interval '31 days') d0) w$$),
  -- Carte des matchs : filtres Type (7 combinaisons), 31 prochains jours.
  ('a02 matchs_recherche : filtres Type, 31 prochains jours', 'R1',
   $$select string_agg(array_to_string(ty.t, '+') || '=' ||
              (select count(*) || '/' || md5(coalesce(string_agg(
                        case when r.id = any({G192}) then (to_jsonb(r) - 'domicile' - 'visiteur' - 'nb_profils' - 'cible')::text
                             else to_jsonb(r)::text end, '|' order by r.id), ''))
                 from public.matchs_recherche(current_date, current_date + 30, null, ty.t, null, null, null, false) r)
              || ';effet_192_' || array_to_string(ty.t, '+') || '=' ||
              (select md5(coalesce(string_agg(r.id || '|' || coalesce(r.domicile, '') || '|' || coalesce(r.visiteur, '') || '|' || r.nb_profils || '|' || r.cible, '§' order by r.id)
                                     filter (where r.id = any({G192})), ''))
                 from public.matchs_recherche(current_date, current_date + 30, null, ty.t, null, null, null, false) r),
              ';' order by array_to_string(ty.t, '+'))
       from (values (array['SECONDAIRE']), (array['COLLEGIAL']), (array['CIVIL']), (array['SECONDAIRE','COLLEGIAL']),
                    (array['SECONDAIRE','CIVIL']), (array['COLLEGIAL','CIVIL']), (array['SECONDAIRE','COLLEGIAL','CIVIL'])) ty(t)$$),
  -- Suggestions : une équipe parmi les 192 et les terrains = effet ; les autres équipes identiques.
  ('a03 matchs_suggestions : cégeps, écoles, mots', 'R1',
   $$select 'effet_existantes_lignes=' || coalesce(string_agg(left(md5(x.tx || '|' || r::text), 10), ',' order by x.tx, r.cle)
                                       filter (where r.genre = 'EQUIPE' and not z.nouvelle), '-')
            || ';effet_equipes_192=' || count(*) filter (where r.genre = 'EQUIPE' and z.nouvelle)
            || ';effet_terrains=' || md5(coalesce(string_agg(x.tx || '|' || r::text, '§' order by x.tx, r.cle) filter (where r.genre <> 'EQUIPE'), ''))
       from unnest({TEXTES}) x(tx), lateral public.matchs_suggestions(x.tx) r,
            lateral (select exists (select 1 from public.teams t
                                     where t.id = (case when r.genre = 'EQUIPE' then r.cle::uuid end)
                                       and t.rseq_team_id = any({RIDS})) as nouvelle) z$$),
  -- Dépistage : chaque match d'une équipe de cégep et chaque match des 192 (équipes sœurs « Collégial »).
  ('a04 depistage_profils_match : matchs de cégep et des 192', 'R1',
   $$select 'matchs=' || count(*) || ';non_vides=' || count(*) filter (where z.n > 0)
            || ';contenu=' || coalesce(string_agg(g::text || ':' || z.n || ':' || z.h, ',' order by g) filter (where z.n > 0), '-')
       from unnest({GCEGEP}) g,
            lateral (select count(*) as n, md5(coalesce(string_agg(d::text, '|' order by d::text), '')) as h
                       from public.depistage_profils_match(g) d) z$$),
  ('a05 jetons d''équipe (apercu_code_equipe, resolve_team_join_token)', 'ADMIN',
   $$select 'jetons=' || count(*) || ';md5=' || md5(coalesce(string_agg(c || '|' || a::text || '|' || r::text, '§' order by c), ''))
       from unnest({CODES}) c left join lateral public.apercu_code_equipe(c) a on true
                              left join lateral public.resolve_team_join_token(c) r on true$$),
  ('a06 resolve_transfer_token (destinataire)', 'INV',
   $$select 'lignes=' || count(*) || ';md5=' || md5(coalesce(string_agg(r::text, '|'), '')) from public.resolve_transfer_token({JETON}) r$$),
  -- Données : ce qui doit rester identique, et les effets.
  ('t01 équipes présentes avant (ligne complète)', 'SU',
   $$select 'n=' || count(*) || ';md5=' || md5(string_agg(to_jsonb(t)::text, '|' order by t.id))
       from public.teams t where t.id in (select id from _t0)$$),
  ('t02 les 192 équipes créées', 'SU',
   $$select 'effet_n=' || count(*)
            || ';effet_categories=' || coalesce(string_agg(distinct coalesce(t.age_group, 'NULL'), ','), '-')
            || ';effet_saisons=' || coalesce(string_agg(distinct coalesce(t.season, 'NULL'), ','), '-')
            || ';effet_ecoles=' || count(distinct t.school_id)
            || ';hors_cegep=' || count(*) filter (where s.type::text <> 'CEGEP')
            || ';toutes_les_equipes=' || (select count(*) from public.teams) - count(*)
       from public.teams t join public.schools s on s.id = t.school_id where t.rseq_team_id = any({RIDS})$$),
  ('t03 matchs : contenu hors liaison, et liaisons', 'SU',
   $$select 'n=' || count(*)
            || ';sans_liaison_md5=' || md5(string_agg((to_jsonb(g) - 'home_team_id' - 'visitor_team_id')::text, '|' order by g.id))
            || ';hors192_md5=' || md5(string_agg(to_jsonb(g)::text, '|' order by g.id) filter (where not (g.id = any({G192}))))
            || ';effet_cotes_domicile=' || count(*) filter (where g.home_team_id in (select id from public.teams where rseq_team_id = any({RIDS})))
            || ';effet_cotes_visiteur=' || count(*) filter (where g.visitor_team_id in (select id from public.teams where rseq_team_id = any({RIDS})))
            || ';effet_matchs_192_a_venir=' || count(*) filter (where g.id = any({G192}) and g.game_date >= current_date)
       from public.games g$$),
  ('t04 classements rseq_standings', 'SU',
   $$select 'n=' || count(*) || ';md5=' || md5(string_agg(to_jsonb(s)::text, '|' order by s.id))
            || ';des192_sans_equipe=' || count(*) filter (where s.rseq_team_id = any({RIDS}) and s.team_id is null)
       from public.rseq_standings s$$),
  ('t05 alertes de la veille', 'SU',
   $$select 'hors192_md5=' || md5(string_agg(to_jsonb(a)::text, '|' order by a.id) filter (where a.id not in (select id from _al)))
            || ';refus_ouverts=' || count(*) filter (where a.type = 'NOUVELLE_EQUIPE' and a.statut = 'OUVERTE' and a.id not in (select id from _al))
            || ';effet_statut_192=' || coalesce(string_agg(distinct a.statut, ',') filter (where a.id in (select id from _al)), '-')
            || ';effet_md5_192=' || md5(coalesce(string_agg(to_jsonb(a)::text, '|' order by a.id) filter (where a.id in (select id from _al)), ''))
       from public.rseq_sync_alerts a$$),
  ('t06 athlètes et rattachements (lot A : rien touché)', 'SU',
   $$select 'athletes=' || (select md5(coalesce(string_agg(to_jsonb(a)::text, '|' order by a.id), '')) from public.athletes a)
            || ';team_athletes=' || (select md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.id), '')) from public.team_athletes x)
            || ';team_coaches=' || (select md5(coalesce(string_agg(to_jsonb(x)::text, '|' order by x.team_id, x.coach_id), '')) from public.team_coaches x)
            || ';users=' || (select md5(coalesce(string_agg(to_jsonb(u)::text, '|' order by u.id), '')) from public.users u)$$),
  ('t07 écoles', 'SU',
   $$select 'n=' || count(*) || ';md5=' || md5(string_agg(to_jsonb(s)::text, '|' order by s.id)) from public.schools s$$),
  ('t08 index teams_identity_unique', 'SU',
   $$select 'valide=' || (select bool_and(i.indisvalid and i.indisunique) from pg_index i where i.indexrelid = 'public.teams_identity_unique'::regclass)
            || ';groupes_en_double=' || (select count(*) from (select 1 from public.teams
                                          where school_id is not null and sport_id is not null and name is not null and age_group is not null
                                            and division is not null and gender is not null and season is not null and league is not null and zone is not null
                                          group by school_id, sport_id, name, age_group, division, gender, season, league, zone having count(*) > 1) d)$$),
  ('t09 dépendants des 192', 'SU',
   $$select 'n=' || ((select count(*) from public.team_athletes x join public.teams t on t.id = x.team_id where t.rseq_team_id = any({RIDS}))
                   + (select count(*) from public.team_coaches x join public.teams t on t.id = x.team_id where t.rseq_team_id = any({RIDS}))
                   + (select count(*) from public.cartes_prospect x join public.teams t on t.id = x.team_id where t.rseq_team_id = any({RIDS}))
                   + (select count(*) from public.team_join_tokens x join public.teams t on t.id = x.team_id where t.rseq_team_id = any({RIDS})))$$),
  -- Comme t13 de B2 : un athlète NON cégépien d'une équipe sœur « Collégial » apparaîtrait au dépistage.
  ('t10 athlètes sur une équipe sœur « Collégial » des 192', 'SU',
   $$select 'cegepiens=' || count(*) filter (where public.athlete_est_cegepien(a.id))
            || ';non_cegepiens=' || count(*) filter (where not public.athlete_est_cegepien(a.id))
       from public.team_athletes ta join public.teams t on t.id = ta.team_id join public.athletes a on a.id = ta.athlete_id
      where a.status = 'ACTIF' and t.age_group = 'Collégial'
        and exists (select 1 from _al x join public.rseq_sync_alerts al on al.id = x.id
                     join public.schools sc on sc.rseq_institution_id = al.rseq_institution_id and sc.type::text = 'CEGEP'
                    where sc.id = t.school_id)$$);

create function pg_temp.sonde(p_uid uuid, p_role text, p_sql text, p_jeton text)
returns text
language plpgsql
as $$
declare
  v text;
  v_sql text := p_sql;
  l record;
begin
  for l in select * from _lit loop
    v_sql := replace(v_sql, l.k, l.v);
  end loop;
  v_sql := replace(v_sql, '{JETON}', coalesce(quote_literal(p_jeton), 'null'));
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
              where (s.portee = 'R1' and cle = (select min(cle) from _c where cle like 'R%'))
                 or (s.portee = 'ADMIN' and cle = 'ADMIN')
                 or (s.portee = 'INV' and cle like 'I%')
              order by cle loop
      t0 := clock_timestamp();
      v := pg_temp.sonde(c.uid, c.role, s.q, c.jeton);
      insert into _m values (p_phase, c.cle, s.cle, v, extract(epoch from clock_timestamp() - t0) * 1000);
    end loop;
    if s.portee = 'SU' then
      t0 := clock_timestamp();
      v := pg_temp.sonde(null, null, s.q, null);
      insert into _m values (p_phase, 'SU', s.cle, v, extract(epoch from clock_timestamp() - t0) * 1000);
    end if;
  end loop;
end $$;

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
select clock_timestamp() as debut_mesure_avant;
select pg_temp.mesurer('1 avant');
select pg_temp.empreinte('1 avant');

-- ── 2. L'opération, texte gardé par son md5 ─────────────────────────────────
select clock_timestamp() as debut_operation;
do $rejeu$
declare t text := $nexus_op$@@OPERATION@@$nexus_op$;
begin
  if md5(t) <> '@@MD5_OPERATION@@' then
    raise exception 'NEXUS: texte de l''opération altéré (md5 %)', md5(t);
  end if;
  execute t;
end $rejeu$;
select clock_timestamp() as fin_operation;

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
create temp view _kv as
select m.phase, m.compte, m.surface, split_part(x.kv, '=', 1) as k, substr(x.kv, length(split_part(x.kv, '=', 1)) + 2) as v
  from _m m, lateral regexp_split_to_table(m.v, ';') x(kv);

\echo '== 0. Valeurs AVANT (md5 abrégés)'
select m.surface, min(m.compte) as compte, left(regexp_replace(min(m.v), '([0-9a-f]{8})[0-9a-f]{24}', '\1…', 'g'), 200) as valeur
  from _m m where m.phase = '1 avant' group by m.surface, m.v order by m.surface;

\echo '== A. Écarts INTERDITS AVANT → APRÈS (attendu : aucune ligne)'
select a.surface, a.k as cle, left(regexp_replace(a.v, '([0-9a-f]{8})[0-9a-f]{24}', '\1…', 'g'), 70) as avant,
       left(regexp_replace(b.v, '([0-9a-f]{8})[0-9a-f]{24}', '\1…', 'g'), 70) as apres
  from _kv a join _kv b on b.compte = a.compte and b.surface = a.surface and b.k = a.k and b.phase = '2 après'
 where a.phase = '1 avant' and a.v is distinct from b.v and a.k not like 'effet%'
 order by 1, 2;

\echo '== B. EFFETS de l''opération (AVANT → APRÈS)'
select a.surface, a.k as cle, left(regexp_replace(a.v, '([0-9a-f]{8})[0-9a-f]{24}', '\1…', 'g'), 50) as avant,
       left(regexp_replace(b.v, '([0-9a-f]{8})[0-9a-f]{24}', '\1…', 'g'), 50) as apres
  from _kv a join _kv b on b.compte = a.compte and b.surface = a.surface and b.k = a.k and b.phase = '2 après'
 where a.phase = '1 avant' and a.v is distinct from b.v and a.k like 'effet%'
 order by 1, 2;

\echo '== B2. Suggestions (8 équipes au plus par recherche) : lignes d''équipes existantes retirées par les nouvelles (effet) ou apparues / modifiées (INTERDIT)'
with av as (select unnest(string_to_array(v, ',')) e from _kv where phase = '1 avant' and k = 'effet_existantes_lignes' and v <> '-'),
     ap as (select unnest(string_to_array(v, ',')) e from _kv where phase = '2 après' and k = 'effet_existantes_lignes' and v <> '-')
select (select count(*) from av) as lignes_avant, (select count(*) from ap) as lignes_apres,
       (select count(*) from (select e from av except all select e from ap) d) as retirees_effet,
       (select count(*) from (select e from ap except all select e from av) d) as apparues_ou_modifiees_interdit;

\echo '== C. Ce que l''opération écrit dans admin_operations (dans la transaction)'
select operation, details->>'equipes' as equipes, details->>'cotes_domicile' as domicile, details->>'cotes_visiteur' as visiteur
  from public.admin_operations where le = now() order by operation;

\echo '== D. Rollback : AVANT → APRÈS ROLLBACK (attendu : 0, 0)'
select (select count(*) from _m a join _m r on r.compte = a.compte and r.surface = a.surface and r.phase = '3 après rollback'
         where a.phase = '1 avant' and a.v is distinct from r.v) as cellules_differentes,
       (select count(*) from ((select ligne from _e where phase = '1 avant' except all select ligne from _e where phase = '3 après rollback')
                               union all
                              (select ligne from _e where phase = '3 après rollback' except all select ligne from _e where phase = '1 avant')) d)
         as lignes_d_empreinte_differentes,
       (select count(*) from _e where phase = '1 avant') as lignes_d_empreinte;
select a.surface, a.k as cle from _kv a join _kv r on r.compte = a.compte and r.surface = a.surface and r.k = a.k and r.phase = '3 après rollback'
 where a.phase = '1 avant' and a.v is distinct from r.v order by 1, 2;

\echo '== E. Schéma (attendu : aucune ligne — opération de données)'
select left(ligne, 90) as objet, 'avant seulement' as cote from (select ligne from _e where phase = '1 avant' except select ligne from _e where phase = '2 après') x
union all
select left(ligne, 90), 'après seulement' from (select ligne from _e where phase = '2 après' except select ligne from _e where phase = '1 avant') y
order by 1, 2;

\echo '== F. Durées (ms)'
select surface, phase, count(*) as appels, round(avg(ms), 1) as ms_moyen, round(max(ms), 1) as ms_max
  from _m group by surface, phase order by surface, phase;

\echo '== VERDICT (attendu : tout à 0)'
select (select count(*) from _kv a join _kv b on b.compte = a.compte and b.surface = a.surface and b.k = a.k and b.phase = '2 après'
         where a.phase = '1 avant' and a.v is distinct from b.v and a.k not like 'effet%') as ecarts_interdits,
       (select count(*) from _m a join _m r on r.compte = a.compte and r.surface = a.surface and r.phase = '3 après rollback'
         where a.phase = '1 avant' and a.v is distinct from r.v) as ecarts_apres_rollback,
       (select count(*) from ((select ligne from _e where phase = '1 avant' except all select ligne from _e where phase = '3 après rollback')
                               union all
                              (select ligne from _e where phase = '3 après rollback' except all select ligne from _e where phase = '1 avant')) d)
         as empreinte_apres_rollback,
       (select count(*) from (select unnest(string_to_array(v, ',')) from _kv where phase = '2 après' and k = 'effet_existantes_lignes' and v <> '-'
                              except all
                              select unnest(string_to_array(v, ',')) from _kv where phase = '1 avant' and k = 'effet_existantes_lignes' and v <> '-') d)
         as suggestions_modifiees,
       (select count(*) from _m where v like 'refus=%') as refus;
select m.surface, m.compte, m.phase, m.v from _m m where m.v like 'refus=%' order by 1, 2, 3 limit 20;

select clock_timestamp() as fin;
rollback;
\echo '== ROLLBACK fait : rien n''est resté.'
