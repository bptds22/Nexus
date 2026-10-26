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
declare t text := $nexus_op$-- ════════════════════════════════════════════════════════════════════════════
-- Chantier cégep — les 192 équipes RSEQ de cégep proposées par la veille (GO BP 2026-10-26).
-- Opération de DONNÉES (aucun objet de schéma) : rseq_creer_equipes_proposees, fonction existante,
-- appelée sous l'identité de l'admin, avec EXACTEMENT les 192 alertes NOUVELLE_EQUIPE ouvertes dont la
-- proposition est « a_creer » (catégorie « Collégial » depuis B2). Les 12 refus (2 doublons, 10 écoles
-- introuvables) ne sont pas passés à la fonction : leurs alertes restent OUVERTE, intactes.
--
-- La fonction : recalcule la proposition, crée les équipes, relie les côtés de match NULL par
-- rseq_team_id, écrit admin_operations EQUIPES_RSEQ_CREEES, passe les alertes à TRAITEE ; nombres exacts
-- ou rien. Elle ne crée aucune école, ne touche ni athlètes, ni classements (la veille relie
-- rseq_standings.team_id à son passage suivant).
--
-- Gardes : 192 alertes exactes (empreinte d081e67c…) et 192 rseq_team_id exacts (5834ba79…), aucun
-- déjà en base, 1 462 côtés domicile + 1 454 visiteur à relier, puis les mêmes nombres en sortie.
-- Rollback : scripts/cegep-equipes-192/retirer.sql (par la liste des 192 rseq_team_id).
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_al uuid[]; v_rids uuid[]; v_teams uuid[]; r jsonb; n int; nh int; nv int;
begin
  with p as (
    select a.id, a.rseq_team_id,
           public.rseq_proposition_equipe(a.rseq_team_id, a.rseq_institution_id, a.payload->>'team_name',
                                          a.rseq_league_id, a.payload->>'saison', 'Collégial') as j
      from public.rseq_sync_alerts a
     where a.type = 'NOUVELLE_EQUIPE' and a.statut = 'OUVERTE')
  select array_agg(p.id order by p.id), array_agg(p.rseq_team_id order by p.rseq_team_id)
    into v_al, v_rids
    from p where p.j->>'decision' = 'a_creer' and p.j->>'age_group' = 'Collégial';

  if coalesce(cardinality(v_al), 0) <> 192
     or md5(array_to_string(v_al, ',')) <> 'd081e67cc269edf1921a88e5f7cecbd9'
     or md5(array_to_string(v_rids, ',')) <> '5834ba7981ca91638a8970541dc42117' then
    raise exception 'NEXUS: les 192 alertes ont bougé (% alerte(s), empreintes % / %)',
      coalesce(cardinality(v_al), 0), md5(array_to_string(v_al, ',')), md5(array_to_string(v_rids, ','));
  end if;
  if exists (select 1 from public.teams where rseq_team_id = any(v_rids)) then
    raise exception 'NEXUS: une des 192 équipes existe déjà';
  end if;
  select count(*) into nh from public.games where home_team_id is null and home_rseq_team_id = any(v_rids);
  select count(*) into nv from public.games where visitor_team_id is null and visitor_rseq_team_id = any(v_rids);
  if nh <> 1462 or nv <> 1454 then
    raise exception 'NEXUS: côtés à relier % / %, attendu 1462 / 1454 (la veille a bougé : régénérer)', nh, nv;
  end if;

  -- L'admin (is_admin() lit auth.uid()) : l'identité de BP, comme les lots RSEQ.
  perform set_config('request.jwt.claims',
    json_build_object('sub', 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0', 'role', 'authenticated')::text, true);
  r := public.rseq_creer_equipes_proposees(v_al);
  perform set_config('request.jwt.claims', '', true);

  if (r->>'equipes_creees')::int <> 192 or (r->>'cotes_domicile')::int <> 1462 or (r->>'cotes_visiteur')::int <> 1454
     or jsonb_array_length(r->'refusees') <> 0 then
    raise exception 'NEXUS: sortie inattendue de rseq_creer_equipes_proposees : %', r;
  end if;

  select array_agg(t.id order by t.id) into v_teams
    from public.teams t join public.schools s on s.id = t.school_id
   where t.rseq_team_id = any(v_rids) and s.type::text = 'CEGEP'
     and t.age_group = 'Collégial' and t.season = '2026-2027';
  if coalesce(cardinality(v_teams), 0) <> 192 then
    raise exception 'NEXUS: % équipe(s) créée(s) conforme(s), attendu 192', coalesce(cardinality(v_teams), 0);
  end if;
  select count(*) into n from public.rseq_sync_alerts where id = any(v_al) and statut = 'TRAITEE';
  if n <> 192 then raise exception 'NEXUS: % alerte(s) traitée(s), attendu 192', n; end if;
  select count(*) into n from public.games where home_team_id = any(v_teams);
  select count(*) into nh from public.games where visitor_team_id = any(v_teams);
  if n <> 1462 or nh <> 1454 then
    raise exception 'NEXUS: côtés reliés % / %, attendu 1462 / 1454', n, nh;
  end if;

  insert into public.admin_operations (operation, motif, details, par)
  values ('CEGEP_EQUIPES_RSEQ_192',
          'Chantier cégep : les 192 équipes RSEQ de cégep proposées par la veille, créées en « Collégial » (GO BP 2026-10-26)',
          jsonb_build_object('equipes', 192, 'cotes_domicile', 1462, 'cotes_visiteur', 1454,
                             'empreinte_alertes', 'd081e67cc269edf1921a88e5f7cecbd9',
                             'empreinte_rseq_team_ids', '5834ba7981ca91638a8970541dc42117',
                             'alertes', to_jsonb(v_al), 'team_ids', to_jsonb(v_teams)),
          'f51384b5-a2c2-4827-9137-8aa8d29a1fe0');
end $$;
$nexus_op$;
begin
  if md5(t) <> '7c2d244bdbbaf7e52eb0b853c6e6e8ec' then
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
declare t text := $nexus_rb$-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK des 192 équipes RSEQ de cégep (scripts/cegep-equipes-192/creer.sql), par la LISTE des 192
-- rseq_team_id (relevé prod 2026-10-26, empreinte 5834ba79…).
-- Refuse si une des 192 a reçu un dépendant (athlète, coach, page, fanion, événement, besoin de position,
-- jeton, invitation, carte prospect, prospect partenaire, revendication d'ambassadeur, équipe principale
-- d'un compte). Sinon : remet à NULL les côtés de match, rseq_standings.team_id et rseq_sync_alerts.team_id
-- qui pointent ces équipes (aucun match supprimé), supprime les 192 équipes, rouvre les 192 alertes dans
-- leur état d'avant (OUVERTE, sans note ni traitement), écrit admin_operations CEGEP_EQUIPES_RSEQ_192_RETIREES.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_rids uuid[] := array[
    '01d9f693-ef0a-44e2-a3d7-4e13d6b945e2',
    '04df76e4-56d7-4ccf-906d-360298ae7f4f',
    '0b4e3947-e020-4fa7-b77d-8ea191a7dfad',
    '0dee606d-0960-4763-adca-e09541bd4a07',
    '0e4d7a10-f890-4636-a874-f6c07f62d09e',
    '0f334a4e-c3e0-4f54-99cb-e58c2b2905a2',
    '0f79a19a-5f25-4c93-b92b-771c052d5299',
    '1203ef51-0888-4c63-9edd-8eda9e4583af',
    '14804db5-24a0-455d-a7d3-15b471884e4f',
    '14c02c76-a881-4f3b-ad84-20dd40bcff09',
    '163aa084-e90e-46fb-8a03-29a16fd0858f',
    '16742cae-1883-4c4d-93dd-df4735c4741c',
    '174f7b18-6cc1-4f95-bc65-b500b8f23828',
    '175bdf5a-e02d-45fe-80fb-00b64c2ce6e4',
    '182e0e5e-7d8a-4e71-a415-ff4bc692ae2a',
    '195d3cb2-487d-44ea-9281-2a59d4577376',
    '1ade5725-9bf4-4e63-bbae-bb8ff6f0ca6e',
    '1c5b3580-ffcf-48e5-8e22-813514e767ea',
    '1fdbedff-c2b6-4e3e-9fa1-c3a179bfe5a8',
    '2001cd84-dae9-4d5f-829a-cc290bfa97ba',
    '20ad934d-c313-43dd-9967-c5e8897fa8bb',
    '21fdf732-865e-419d-b640-664e1f9e22a4',
    '21ffe7f2-0a59-4785-bd5c-d660584d889e',
    '222f7996-13bd-4a80-9091-ceea8344c417',
    '23818296-1aaa-4e60-be74-6097c62481a4',
    '23a657c1-7232-4758-9ecf-c030f3a907fc',
    '24c9c6bd-69da-424a-b310-a9019f4fe011',
    '2554209a-f7fc-4540-b5f9-3ea108df893e',
    '28b5f6e2-d5ee-4d98-a6fd-8db2beadfadd',
    '28e6258b-f96c-4eb5-ad32-6fbf830060bf',
    '2a6230c8-3755-4ceb-bc19-61a79f07c7ac',
    '2aa07ff1-7d3d-4a84-ba1d-cc5a1dc608f8',
    '2c022f86-04be-4e29-906a-b58a742223c4',
    '2c30cbf4-5246-4a03-920b-a7248ab9bc9b',
    '2e1e1f27-8db3-484c-beee-790cf8a027d8',
    '2f14ba85-4803-4843-ba17-4d83f24e81f3',
    '2f2b6a0b-aacd-4d81-b6aa-7ab77f17fb0f',
    '2f69bb56-abb4-488c-a584-3c0ea9777293',
    '31273809-eb77-4373-83b3-6f7916bd2353',
    '32ac5fff-5a0e-4597-9165-5be3b4b817d0',
    '336628d2-df21-4399-8ca3-3e8f56cc4e64',
    '34cbb3c7-43b2-4020-9fc6-44b0c68d34cc',
    '35aacf87-b30c-4c41-9c8e-0241191c7dbf',
    '375c54c7-5e21-419e-9513-c9cd57eb1c26',
    '39a61fee-635e-4d50-b924-03b3291498ef',
    '39c4e62e-c5d5-44d5-afcc-3553aa07aaa3',
    '3a3bc42a-323b-4c83-968e-309541f46058',
    '3bfc3c88-442b-490c-ad4d-2f210d0e3418',
    '3c8467fd-93a3-4fa1-8028-f6d36b6e97bc',
    '3ca40f35-c42d-4f46-ae34-99f1842a073e',
    '3db6b273-09ae-4f73-a010-79afe1397cdb',
    '4055809d-7cea-4f87-9bb7-63350b1cb670',
    '40b4ae81-74a9-4330-b792-f86dcce4541c',
    '41d897b8-3126-4088-92b9-93d8a571e836',
    '44c4bb05-e7f8-4821-b410-055634d1ba59',
    '46427217-e1a3-418d-bda2-ea000a25e647',
    '48fc5d96-475d-40d1-ba81-9794be273517',
    '49982f3f-0175-4959-be05-8bbb04688404',
    '4b467cce-2989-4ffb-9ae4-f310598fdb2b',
    '4c8defb1-b745-4cce-b597-a1a60456b4f7',
    '4d1c22e9-6d1b-4ef7-a867-e579d18fb03b',
    '4f03810c-2e7d-4079-99e0-92979bbfff34',
    '4f406f20-9f10-427c-8bba-5d7df4eb6808',
    '4f4983e8-5e8b-48b0-a3ff-491bbda96b03',
    '507b9449-50fa-447a-83d3-daaea453823f',
    '5130a735-0804-40e9-be98-9ca5940f494c',
    '525fc1a1-e98c-47b0-a43f-73dc1846a4f7',
    '52ddf56a-ada6-4e95-8615-ec6325c9497a',
    '54e98b08-a6c2-42cc-b6b2-80a0b4c1f0dc',
    '5512ae57-9b60-4dc0-b549-ddc2ab2a264b',
    '55fbcd37-d4ef-43c7-b0ba-3d50a92b7640',
    '5689503a-d3bb-4e9e-bacb-18b5bf8ff184',
    '56aa48e3-4de2-4435-b3be-e300e92c5c01',
    '56c73753-8949-47ec-88a9-8c4c471299d8',
    '57e41db0-e4f2-4bb2-8cbf-84c6f6d9f9e8',
    '588dfa95-36af-47e4-8684-f4024875b431',
    '5a3b64c6-2639-4675-8868-572202ea2c90',
    '5aef2da3-96f7-4d33-bb2e-0ba6c722c069',
    '5d3d6acf-e986-473e-a4fc-e60816220f91',
    '5de5989a-3eb0-431e-9ba2-bc76c6bbcf56',
    '610832dd-eb86-4681-849f-8a67cec1971b',
    '628105a9-01b9-4be7-bab4-9b34f8bc3f35',
    '656a9dff-3510-45ce-a32e-5c80d1933548',
    '65cbfd38-2ba8-46ad-bdeb-e7f407562e6a',
    '65edf9cc-e1a6-4a0c-b020-8a0e44831166',
    '67652c52-66af-47e2-9f5f-d771db1ec0ea',
    '68f303d4-e2a0-40cb-ac14-d05ece7bf1db',
    '69767a19-b7d7-4693-92a3-e6c8765fd76e',
    '6ba50c57-09cc-4375-aef9-c36df6db1022',
    '6be2958a-4d63-40b0-a9b4-4066f084a19f',
    '6ced806d-c877-4f7d-b2af-65368bc85ee7',
    '725dcd50-001d-436b-baad-6a8573b8ddad',
    '733e3183-1d22-49e7-a7f3-245746ed77ed',
    '75dfcdbc-65bd-4c8a-8172-ac9c69774ecc',
    '76619078-d11c-4bb5-bf4b-d7bbd28d79cd',
    '77fc7e03-a5ec-4fc4-ab1f-b17cf79d05c8',
    '78714ac5-ace8-4fa5-a92f-70045489a58b',
    '79faf204-2cad-42d2-8425-0851dcfcc639',
    '7a335aea-b32b-4f69-b484-388ad888c6ad',
    '7aa13584-7f16-4501-ae58-e2ed1a8fc1a7',
    '7ad33e01-ef9b-4d01-9d35-ba387bb09e2e',
    '7b6aef49-441b-4b43-b75c-31bd79d34ab8',
    '7bdf8b29-6fbe-411f-a439-190689e42197',
    '7f634f47-f77b-4084-912c-8ac282960202',
    '80c76d27-c8dc-46d0-a1cf-2d96fc51f190',
    '86e9a25b-9e94-462b-b4c9-27064fa228ee',
    '893301a6-f8e0-4263-bc82-d0a026fd1b24',
    '8c00b4cc-c53b-490d-8b85-6a40462d1aec',
    '8c144d3e-5f3e-49aa-aa89-a6396431b50a',
    '8cc9d8a2-ba3f-49f6-a5b2-ae655d7d3302',
    '8ec38051-3a83-422b-8660-92441c1c51fa',
    '8f887d2a-9c16-4715-ae80-270a00769844',
    '910fc45a-571f-46e5-8c46-95e6ec71f0b0',
    '912c82da-1671-4f88-9ca5-8f4e1e5a3397',
    '92a8a2a2-f2e0-4ca2-97c6-3ba88af9e992',
    '92eaa0b1-0b55-4e38-abfb-5df0b21f72db',
    '9465d0c7-810a-455d-b6f9-454238866818',
    '94670618-7830-4756-a411-69801454df57',
    '95902150-8251-4e8e-817e-b3c5954ffb88',
    '965299e0-f613-49eb-a01b-3ba6824a3202',
    '974e5d04-571a-4996-a6e5-6f4d5faf005a',
    '99056790-8669-4efe-8565-7f3ef6c8a71b',
    '9a7dc9f2-d2cc-4b1d-86f2-81a292544ddb',
    '9b7c992f-e1ab-4c24-9cf7-06d085f49df0',
    '9cd62fc0-31bc-4a88-aea7-845c69758fd1',
    '9d370408-f809-4bfc-a659-d2cae8cba0fe',
    '9d7433d9-7950-421e-a2a4-9e9aa44f6dce',
    '9d861da0-ac92-4eae-af71-6343385fbd9d',
    '9dee648b-dc8f-417f-859e-6daf168e1064',
    '9f8d1a9d-ad3f-4121-bb64-fb8a85cffcce',
    'a027cd25-1059-4772-b4e0-1e6ccc0166f7',
    'a0f89416-0269-4a5b-a28f-4b438873dd2c',
    'a2067e2b-6606-4dba-b49e-d4a0773cb31b',
    'a97c8c83-f934-4549-9b89-9127ba9a4842',
    'a9cf4318-04af-44ff-bc7b-ccb715d7e50e',
    'ab2aa041-5c5c-4d6d-8c17-794c9f08fd22',
    'abbb8d0e-36b2-49fd-8a1d-9bb359e473b8',
    'ac231607-b0b8-48d2-a46b-b3a957c898ee',
    'ad986bf1-3ed5-43fa-8398-424e0254cfa2',
    'adaa126e-f3aa-4e44-96ae-054a2cb73c94',
    'b0b96fc8-04b3-4228-a642-33a87c953e03',
    'b177ba29-11aa-4458-a3b3-5e6a43f6ae75',
    'b49a8b8d-50f9-4bdf-a377-d512cfec0319',
    'b575bd03-5678-4112-8bfa-ea21516e4092',
    'b6ab0647-1f19-45c5-8e8b-71a214ee33de',
    'b6fc1bf3-48a1-4a77-abc3-00b18ad98457',
    'b73e9855-57d6-4e56-a83b-7194439907e5',
    'bc6ab59c-ebbc-4363-9f21-17779e03b94e',
    'bd55ed19-4682-4347-954a-5771a2b239f1',
    'bfe9daa9-6493-48bc-be79-38ad987eaeee',
    'bff44987-e6b2-4828-9b33-d71be3550ac0',
    'c0b974c8-3c62-4174-836d-79214509067c',
    'c178e8bb-7dbf-4e4d-bd21-ebc18dcd700a',
    'c54735b4-f2e5-4186-9184-31a5c695127f',
    'c73a02fc-b491-49f1-8982-e9cababed363',
    'c88074ce-bad0-4ad3-b384-d80368b7c422',
    'cb283ac0-1042-44aa-885f-8edaa57fe413',
    'cfc4b2fc-a29a-4c23-a58b-b6b51837c84b',
    'd00882ff-e70e-40a4-a4c1-3f55b4cb1d89',
    'd0daf331-b76d-4491-9668-cf9064a98f94',
    'd18db455-1c3b-4fb9-9a8e-c7ef65df490d',
    'd28da799-a7b3-4cac-8d79-f0bcaed4f8bf',
    'd4ade005-332e-46c0-85b2-b1f313c8d646',
    'd56b4e0a-d4a4-4c68-9423-2a4675378eb4',
    'd79a19c0-7670-4eda-9fa2-9e12c5691173',
    'd7c71683-d3c1-4e57-ab50-9eba999ff2d6',
    'db30e05a-454b-4070-8283-c9c442b96c48',
    'dcfc051a-014c-4f07-ad40-d551d4910313',
    'de1e886c-f35f-4a4a-8be3-9dbc97efbce6',
    'e0183435-6ddc-43a0-9311-7789bcd63fa0',
    'e065b589-421a-4ce7-833f-f6e0b9cb6acd',
    'e24a6336-f0ef-42f1-9d23-ac25c3be786d',
    'e2fbc9c8-663d-4f20-947e-f8e20df3e3c6',
    'e310b227-3aa5-46ed-873a-5d8901f8a9bb',
    'e40a772f-04fe-4286-874d-ff7e9a2cd49c',
    'e4184f05-2c9b-42d1-90e3-840d50fc03b9',
    'e502ca9f-73d9-4382-a0b3-4dfc7df4f74a',
    'e533ce93-b10f-4690-b1ff-a648a2b91538',
    'e540153a-2b6f-45fe-bda4-9922fa336f02',
    'e5de3d3a-86a1-43d4-b2c8-19e8c2d1d68e',
    'ea2f15af-c66e-4d9c-8df3-94f38cd1894d',
    'eb63ff68-5f89-4dc9-89dd-34d95c53d8ab',
    'ec32ba96-b1a9-4052-994a-e1816ca5fb96',
    'ec3a1b8d-0d64-428e-af60-337d8ec22b54',
    'ef075248-ffed-4ac4-b165-70621926912f',
    'f182dddb-5a8c-489d-a124-99f70415fae3',
    'f5b6d654-bdee-4194-a904-14b14c841af7',
    'f72018be-2052-4c2e-8778-bd3e4d8255bd',
    'f885eead-6861-4ba7-a2d6-9c3ec201d476',
    'fb665473-1f5a-4875-9b32-35c332ffa8d4',
    'fda2c13a-ae9f-40e4-bb6a-be5f793f37a5',
    'ffc9e367-b7e0-402b-b797-458e09550192'
  ]::uuid[];
  v_teams uuid[]; n int; nh int; nv int; ns int; na int;
begin
  if cardinality(v_rids) <> 192
     or md5(array_to_string(array(select x from unnest(v_rids) x order by x), ',')) <> '5834ba7981ca91638a8970541dc42117' then
    raise exception 'NEXUS: liste des 192 altérée';
  end if;
  select array_agg(id order by id) into v_teams from public.teams where rseq_team_id = any(v_rids);
  if coalesce(cardinality(v_teams), 0) <> 192 then
    raise exception 'NEXUS: % des 192 équipes en base, attendu 192 — rien écrit', coalesce(cardinality(v_teams), 0);
  end if;

  if exists (select 1 from public.team_athletes where team_id = any(v_teams))
     or exists (select 1 from public.team_coaches where team_id = any(v_teams))
     or exists (select 1 from public.team_events where team_id = any(v_teams))
     or exists (select 1 from public.team_invitations where team_id = any(v_teams))
     or exists (select 1 from public.team_join_tokens where team_id = any(v_teams))
     or exists (select 1 from public.team_page_content where team_id = any(v_teams))
     or exists (select 1 from public.team_pennants where team_id = any(v_teams))
     or exists (select 1 from public.team_position_needs where team_id = any(v_teams))
     or exists (select 1 from public.cartes_prospect where team_id = any(v_teams))
     or exists (select 1 from public.partenaire_prospects where team_id = any(v_teams))
     or exists (select 1 from public.ambassadeur_revendications where team_id = any(v_teams))
     or exists (select 1 from public.users where primary_team_id = any(v_teams)) then
    raise exception 'NEXUS: une des 192 équipes a reçu un dépendant — rollback refusé, rien écrit';
  end if;

  update public.games set home_team_id = null where home_team_id = any(v_teams);
  get diagnostics nh = row_count;
  update public.games set visitor_team_id = null where visitor_team_id = any(v_teams);
  get diagnostics nv = row_count;
  update public.rseq_standings set team_id = null where team_id = any(v_teams);
  get diagnostics ns = row_count;
  update public.rseq_sync_alerts set team_id = null where team_id = any(v_teams);

  delete from public.teams where id = any(v_teams);
  get diagnostics n = row_count;
  if n <> 192 then raise exception 'NEXUS: % équipe(s) supprimée(s), attendu 192 — rien écrit', n; end if;

  update public.rseq_sync_alerts
     set statut = 'OUVERTE', traite_le = null, traite_par = null, note = null
   where type = 'NOUVELLE_EQUIPE' and statut = 'TRAITEE' and rseq_team_id = any(v_rids);
  get diagnostics na = row_count;
  if na <> 192 then raise exception 'NEXUS: % alerte(s) rouverte(s), attendu 192 — rien écrit', na; end if;

  insert into public.admin_operations (operation, motif, details, par)
  values ('CEGEP_EQUIPES_RSEQ_192_RETIREES', 'Rollback des 192 équipes RSEQ de cégep',
          jsonb_build_object('equipes', n, 'cotes_domicile', nh, 'cotes_visiteur', nv, 'classements', ns,
                             'alertes_rouvertes', na, 'empreinte_rseq_team_ids', '5834ba7981ca91638a8970541dc42117'),
          'f51384b5-a2c2-4827-9137-8aa8d29a1fe0');
end $$;
$nexus_rb$;
begin
  if md5(t) <> 'a1b82e7e5a977624e7b758af34869613' then
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
