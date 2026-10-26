-- ════════════════════════════════════════════════════════════════════════════
-- Chantier cégep — les 12 équipes RSEQ de cégep refusées par la proposition : REJEU À BLANC (local ou prod).
-- NE LAISSE RIEN : UNE transaction qui finit par ROLLBACK ; toute erreur arrête psql avant
-- (ON_ERROR_STOP) et la session se ferme sans COMMIT.
--
-- Fichier GÉNÉRÉ par scripts/cegep-equipes-12/generer.sh à partir de ce gabarit : l'opération
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
set local application_name = 'nexus-rejeu-blanc-cegep-12';
select now() as debut, current_user, current_setting('server_version') as version;

-- ── Les 12 (fixées AVANT) et les listes de sonde ────────────────────────────
-- Les 12 refus de la proposition : doublon ou école introuvable.
create temp table _al as
select a.id, a.rseq_team_id
  from public.rseq_sync_alerts a,
       lateral public.rseq_proposition_equipe(a.rseq_team_id, a.rseq_institution_id, a.payload->>'team_name',
                                              a.rseq_league_id, a.payload->>'saison', 'Collégial') j
 where a.type = 'NOUVELLE_EQUIPE' and a.statut = 'OUVERTE' and j->>'decision' in ('doublon', 'ecole_introuvable');
do $$
begin
  if (select count(*) from _al) <> 12
     or (select md5(string_agg(id::text, ',' order by id)) from _al) <> '43e3182df9a741428ef01798b33d2707'
     or (select md5(string_agg(rseq_team_id::text, ',' order by rseq_team_id)) from _al) <> '8836addda230b40f74d227d2af3f0f3b' then
    raise exception 'NEXUS: les 12 ont bougé (% alertes)', (select count(*) from _al);
  end if;
  if exists (select 1 from public.admin_operations where operation = 'CEGEP_EQUIPES_RSEQ_12') then
    raise exception 'NEXUS: les 12 ont déjà été créées';
  end if;
end $$;
-- Les écoles du plan (figées par id, comme dans creer.sql), pour la sonde des équipes sœurs.
create temp table _ec (id uuid primary key);
insert into _ec values
  ('c8cb3c98-2744-47fa-957b-a00245dbc54d'), ('f7fafd77-a20b-4f96-8db5-afb999e7e4d9'), ('85419c0f-03e8-4e4e-accb-8a30cc4b52c0'),
  ('dfad9036-0d54-4304-906f-91f19542a882'), ('7adaa8e9-015b-4d5b-869e-3646d072935a'), ('613aaadc-0947-43fa-8f89-84f73fdaf8b0'),
  ('8a330cf7-76fa-4761-8cbd-df223e6c4cbd'), ('55f424c0-d740-43e5-99f6-38a8fb73e03b'), ('61ed3f9a-f089-4983-87e9-85bab65e1693');
-- Équipes présentes AVANT (les seules qui doivent rester identiques).
create temp table _t0 as select id from public.teams;
-- Matchs d'une des 12 (par rseq_team_id) et matchs d'une équipe de cégep.
create temp table _g12 as
select g.id from public.games g
 where g.home_rseq_team_id in (select rseq_team_id from _al) or g.visitor_rseq_team_id in (select rseq_team_id from _al);
create temp table _gc as
select g.id from public.games g
 where g.id in (select id from _g12)
    or exists (select 1 from public.teams t join public.schools s on s.id = t.school_id
                where s.type::text = 'CEGEP' and t.id in (g.home_team_id, g.visitor_team_id));
create temp table _tx as
select name as t from public.schools where type::text = 'CEGEP'
union select name from (select name from public.schools where type::text = 'SECONDAIRE' order by name limit 15) x
union select unnest(array['Collégial', 'Basketball', 'Volleyball', 'Soccer', 'Badminton', 'Rugby', 'Champlain', 'Juvénile',
                           'Joliette', 'Lionel-Groulx', 'Sherbrooke', 'Ch.-Lennoxville', 'Sud-Ouest', 'Flag']);

create temp table _lit (k text primary key, v text);
insert into _lit values
  ('{RIDS}',   (select 'array[' || string_agg(quote_literal(rseq_team_id::text), ',' order by rseq_team_id) || ']::uuid[]' from _al)),
  ('{G12}',   (select coalesce('array[' || string_agg(quote_literal(id::text), ',' order by id) || ']::uuid[]', 'array[]::uuid[]') from _g12)),
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
select (select count(*) from _al) as les_12, (select count(*) from _g12) as matchs_des_12,
       (select count(*) from _gc) as matchs_cegep_sondes, (select count(*) from _tx) as textes, (select count(*) from _t0) as equipes_avant;

-- ── Les sondes ───────────────────────────────────────────────────────────────
create temp table _s (cle text primary key, portee text, q text);
insert into _s values
  -- Carte des matchs : toute la saison par fenêtres de 31 jours. Les matchs des 12 = effet ; le reste identique.
  ('a01 matchs_recherche : saison, fenêtres de 31 j', 'R1',
   $$select string_agg('f' || to_char(w.d, 'YYYYMMDD') || '=' ||
              (select count(*) filter (where not (r.id = any({G12}))) || '/'
                      || md5(coalesce(string_agg(r::text, '|' order by r.id) filter (where not (r.id = any({G12}))), ''))
                 from public.matchs_recherche(w.d, w.d + 30, null, array['SECONDAIRE','COLLEGIAL','CIVIL'], null, null, null, false) r)
              || ';effet_f' || to_char(w.d, 'YYYYMMDD') || '=' ||
              (select count(*) filter (where r.id = any({G12})) || '/'
                      || md5(coalesce(string_agg(r::text, '|' order by r.id) filter (where r.id = any({G12})), ''))
                 from public.matchs_recherche(w.d, w.d + 30, null, array['SECONDAIRE','COLLEGIAL','CIVIL'], null, null, null, false) r),
              ';' order by w.d)
       from (select d0::date as d from generate_series('2026-07-01'::date, '2027-07-31'::date, interval '31 days') d0) w$$),
  -- Carte des matchs : filtres Type (7 combinaisons), 31 prochains jours.
  ('a02 matchs_recherche : filtres Type, 31 prochains jours', 'R1',
   $$select string_agg(array_to_string(ty.t, '+') || '=' ||
              (select count(*) || '/' || md5(coalesce(string_agg(
                        case when r.id = any({G12}) then (to_jsonb(r) - 'domicile' - 'visiteur' - 'nb_profils' - 'cible')::text
                             else to_jsonb(r)::text end, '|' order by r.id), ''))
                 from public.matchs_recherche(current_date, current_date + 30, null, ty.t, null, null, null, false) r)
              || ';effet_12_' || array_to_string(ty.t, '+') || '=' ||
              (select md5(coalesce(string_agg(r.id || '|' || coalesce(r.domicile, '') || '|' || coalesce(r.visiteur, '') || '|' || r.nb_profils || '|' || r.cible, '§' order by r.id)
                                     filter (where r.id = any({G12})), ''))
                 from public.matchs_recherche(current_date, current_date + 30, null, ty.t, null, null, null, false) r),
              ';' order by array_to_string(ty.t, '+'))
       from (values (array['SECONDAIRE']), (array['COLLEGIAL']), (array['CIVIL']), (array['SECONDAIRE','COLLEGIAL']),
                    (array['SECONDAIRE','CIVIL']), (array['COLLEGIAL','CIVIL']), (array['SECONDAIRE','COLLEGIAL','CIVIL'])) ty(t)$$),
  -- Suggestions : une équipe parmi les 12 et les terrains = effet ; les autres équipes identiques.
  ('a03 matchs_suggestions : cégeps, écoles, mots', 'R1',
   $$select 'effet_existantes_lignes=' || coalesce(string_agg(left(md5(x.tx || '|' || r::text), 10), ',' order by x.tx, r.cle)
                                       filter (where r.genre = 'EQUIPE' and not z.nouvelle), '-')
            || ';effet_equipes_12=' || count(*) filter (where r.genre = 'EQUIPE' and z.nouvelle)
            || ';effet_terrains=' || md5(coalesce(string_agg(x.tx || '|' || r::text, '§' order by x.tx, r.cle) filter (where r.genre <> 'EQUIPE'), ''))
       from unnest({TEXTES}) x(tx), lateral public.matchs_suggestions(x.tx) r,
            lateral (select exists (select 1 from public.teams t
                                     where t.id = (case when r.genre = 'EQUIPE' then r.cle::uuid end)
                                       and t.rseq_team_id = any({RIDS})) as nouvelle) z$$),
  -- Dépistage : chaque match d'une équipe de cégep et chaque match des 12 (équipes sœurs « Collégial »).
  ('a04 depistage_profils_match : matchs de cégep et des 12', 'R1',
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
  ('t02 les 12 équipes créées', 'SU',
   $$select 'effet_n=' || count(*)
            || ';effet_noms=' || coalesce(string_agg(t.name || '/' || left(t.gender, 1) || '/' || t.division, ',' order by t.name, t.gender), '-')
            || ';effet_categories=' || coalesce(string_agg(distinct coalesce(t.age_group, 'NULL'), ','), '-')
            || ';effet_saisons=' || coalesce(string_agg(distinct coalesce(t.season, 'NULL'), ','), '-')
            || ';effet_ecoles=' || count(distinct t.school_id)
            || ';hors_cegep=' || count(*) filter (where s.type::text <> 'CEGEP')
            || ';toutes_les_equipes=' || (select count(*) from public.teams) - count(*)
       from public.teams t join public.schools s on s.id = t.school_id where t.rseq_team_id = any({RIDS})$$),
  ('t03 matchs : contenu hors liaison, et liaisons', 'SU',
   $$select 'n=' || count(*)
            || ';sans_liaison_md5=' || md5(string_agg((to_jsonb(g) - 'home_team_id' - 'visitor_team_id')::text, '|' order by g.id))
            || ';hors12_md5=' || md5(string_agg(to_jsonb(g)::text, '|' order by g.id) filter (where not (g.id = any({G12}))))
            || ';effet_cotes_domicile=' || count(*) filter (where g.home_team_id in (select id from public.teams where rseq_team_id = any({RIDS})))
            || ';effet_cotes_visiteur=' || count(*) filter (where g.visitor_team_id in (select id from public.teams where rseq_team_id = any({RIDS})))
            || ';effet_matchs_12_a_venir=' || count(*) filter (where g.id = any({G12}) and g.game_date >= current_date)
       from public.games g$$),
  ('t04 classements rseq_standings', 'SU',
   $$select 'n=' || count(*) || ';md5=' || md5(string_agg(to_jsonb(s)::text, '|' order by s.id))
            || ';des12_sans_equipe=' || count(*) filter (where s.rseq_team_id = any({RIDS}) and s.team_id is null)
       from public.rseq_standings s$$),
  ('t05 alertes de la veille', 'SU',
   $$select 'hors12_md5=' || md5(string_agg(to_jsonb(a)::text, '|' order by a.id) filter (where a.id not in (select id from _al)))
            || ';autres_ouvertes=' || count(*) filter (where a.type = 'NOUVELLE_EQUIPE' and a.statut = 'OUVERTE' and a.id not in (select id from _al))
            || ';effet_statut_12=' || coalesce(string_agg(distinct a.statut, ',') filter (where a.id in (select id from _al)), '-')
            || ';effet_md5_12=' || md5(coalesce(string_agg(to_jsonb(a)::text, '|' order by a.id) filter (where a.id in (select id from _al)), ''))
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
  ('t09 dépendants des 12', 'SU',
   $$select 'n=' || ((select count(*) from public.team_athletes x join public.teams t on t.id = x.team_id where t.rseq_team_id = any({RIDS}))
                   + (select count(*) from public.team_coaches x join public.teams t on t.id = x.team_id where t.rseq_team_id = any({RIDS}))
                   + (select count(*) from public.cartes_prospect x join public.teams t on t.id = x.team_id where t.rseq_team_id = any({RIDS}))
                   + (select count(*) from public.team_join_tokens x join public.teams t on t.id = x.team_id where t.rseq_team_id = any({RIDS})))$$),
  -- Comme t13 de B2 : un athlète NON cégépien d'une équipe sœur « Collégial » apparaîtrait au dépistage.
  ('t10 athlètes sur une équipe sœur « Collégial » des 12', 'SU',
   $$select 'cegepiens=' || count(*) filter (where public.athlete_est_cegepien(a.id))
            || ';non_cegepiens=' || count(*) filter (where not public.athlete_est_cegepien(a.id))
       from public.team_athletes ta join public.teams t on t.id = ta.team_id join public.athletes a on a.id = ta.athlete_id
      where a.status = 'ACTIF' and t.age_group = 'Collégial'
        and t.school_id in (select id from _ec)$$),
  -- La 1re équipe des deux cégeps à doublon (Sud-Ouest A) : intacte, ses matchs aussi (déjà couverte par t01).
  ('t11 1res équipes flag F D3 (Sud-Ouest A)', 'SU',
   $$select 'n=' || count(*) || ';md5=' || md5(string_agg(to_jsonb(t)::text, '|' order by t.id))
            || ';matchs=' || (select count(*) from public.games g
                               where g.home_team_id in ('d469c1ce-6262-4fec-9c49-548d1b7844ae', '38e387b3-a1a9-45a8-82dc-6524765e42ae')
                                  or g.visitor_team_id in ('d469c1ce-6262-4fec-9c49-548d1b7844ae', '38e387b3-a1a9-45a8-82dc-6524765e42ae'))
       from public.teams t where t.id in ('d469c1ce-6262-4fec-9c49-548d1b7844ae', '38e387b3-a1a9-45a8-82dc-6524765e42ae')$$);

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
-- Chantier cégep — les 12 équipes RSEQ de cégep refusées par la proposition de la veille (GO BP 2026-10-26).
-- Opération de DONNÉES (aucun objet de schéma). rseq_creer_equipes_proposees les refuse (doublon, école
-- introuvable) : on les crée donc ici, à la main, sur décision de BP, avec un plan LITTÉRAL (aucun filtre
-- par nom ; chaque équipe est désignée par son alerte et son rseq_team_id, chaque école par son id).
--
-- 1. Deux « doublons » flag football féminin D3 : 2es équipes distinctes du même cégep, dans une autre
--    poule (Sud-Ouest C et B ; la 1re joue en Sud-Ouest A). Exception au dédoublonnage, comme Triolet le
--    8 oct. Nom distinct : « Joliette (Sud-Ouest C) », « Lionel-Groulx (Sud-Ouest B) ». La clé
--    teams_identity_unique (école, sport, nom, catégorie, division, sexe, saison, ligue, zone) n'est pas en
--    cause (ligue et nom diffèrent déjà) ; la veille relie les matchs par rseq_team_id, jamais par nom.
-- 2. Dix équipes de Basketball D2 Nord-Est CQ B, sans InstitutionId publié (ligue sans Teams[]) :
--    école établie par la correspondance de nom validée par BP, figée ici en id. Aucune école créée ni
--    modifiée. Nom = nom RSEQ.
--
-- Toutes en « Collégial » 2026-2027, division / sexe / ligue = ceux de la proposition (vérifiés égaux au
-- plan). Les côtés de match NULL sont reliés par rseq_team_id ; les 12 alertes passent à TRAITEE ;
-- admin_operations CEGEP_EQUIPES_RSEQ_12.
--
-- Gardes : 12 alertes exactes (empreinte 43e3182d…) et 12 rseq_team_id exacts (8836addd…), OUVERTE, aucun
-- déjà en base ; proposition recalculée = plan (décision, sport, division, sexe, ligue, doublon attendu) ;
-- écoles de type CEGEP ; dédoublonnage (règle 2) : basketball = aucune équipe, flag = la seule 1re équipe
-- connue ; côtés à relier équipe par équipe (total 72 domicile, 76 visiteur), puis les mêmes en sortie.
-- Rollback : scripts/cegep-equipes-12/retirer.sql (par la liste des 12 rseq_team_id).
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_plan jsonb := $plan$[
    {"alerte": "ea152938-1f4e-4913-b3be-872f57cc7f36", "rid": "b7c0e77d-76f5-401e-a3ea-beacbf8d27a8", "ecole": "c8cb3c98-2744-47fa-957b-a00245dbc54d",
     "nom": "Joliette (Sud-Ouest C)", "decision": "doublon", "doublon": "d469c1ce-6262-4fec-9c49-548d1b7844ae",
     "sport": "f1c283ba-7ef2-44a5-acff-d16017562d67", "division": "D3", "gender": "Féminin",
     "league": "Flag football C F D3 Sud-Ouest C (2026-2027)", "h": 5, "v": 4},
    {"alerte": "e5bffe47-78f3-4697-bc31-97b112eb4003", "rid": "b96f844d-43a5-4854-8bb8-f08ebb6fd830", "ecole": "f7fafd77-a20b-4f96-8db5-afb999e7e4d9",
     "nom": "Lionel-Groulx (Sud-Ouest B)", "decision": "doublon", "doublon": "38e387b3-a1a9-45a8-82dc-6524765e42ae",
     "sport": "f1c283ba-7ef2-44a5-acff-d16017562d67", "division": "D3", "gender": "Féminin",
     "league": "Flag football C F D3 Sud-Ouest B (2026-2027)", "h": 5, "v": 4},
    {"alerte": "23779985-2bcd-43ca-aa2b-8f133b4da57d", "rid": "73e3a35a-e00a-41d9-828a-ac7ef5ac7214", "ecole": "85419c0f-03e8-4e4e-accb-8a30cc4b52c0",
     "nom": "Ch.-Lennoxville", "decision": "ecole_introuvable", "doublon": null,
     "sport": "5dd6a7c8-2aa4-4b0e-a150-4ac77255f492", "division": "D2", "gender": "Masculin",
     "league": "Basketball C M D2 Nord-Est CQ B (2026-2027)", "h": 6, "v": 7},
    {"alerte": "12440459-9dcd-4b27-9e70-782b0fd3565d", "rid": "ca0983e7-85d6-4d8b-9684-89eef3418a9a", "ecole": "dfad9036-0d54-4304-906f-91f19542a882",
     "nom": "Saint-Hyacinthe", "decision": "ecole_introuvable", "doublon": null,
     "sport": "5dd6a7c8-2aa4-4b0e-a150-4ac77255f492", "division": "D2", "gender": "Féminin",
     "league": "Basketball C F D2 Nord-Est CQ B (2026-2027)", "h": 6, "v": 7},
    {"alerte": "8d21c2df-4c97-4e74-9214-e41ef4fb808a", "rid": "8d15b218-9005-4513-b2d8-17a5ed4fbd71", "ecole": "dfad9036-0d54-4304-906f-91f19542a882",
     "nom": "Saint-Hyacinthe", "decision": "ecole_introuvable", "doublon": null,
     "sport": "5dd6a7c8-2aa4-4b0e-a150-4ac77255f492", "division": "D2", "gender": "Masculin",
     "league": "Basketball C M D2 Nord-Est CQ B (2026-2027)", "h": 6, "v": 7},
    {"alerte": "6751645b-4986-4792-a490-74e65d11e516", "rid": "028950e6-34ca-4f08-b8b5-7337529be45c", "ecole": "7adaa8e9-015b-4d5b-869e-3646d072935a",
     "nom": "Séminaire de Sherbrooke", "decision": "ecole_introuvable", "doublon": null,
     "sport": "5dd6a7c8-2aa4-4b0e-a150-4ac77255f492", "division": "D2", "gender": "Masculin",
     "league": "Basketball C M D2 Nord-Est CQ B (2026-2027)", "h": 6, "v": 7},
    {"alerte": "c4e46a28-323f-44d3-91aa-281649b74a07", "rid": "931b39c9-12d8-4df9-8072-01ace9ee1ce5", "ecole": "613aaadc-0947-43fa-8f89-84f73fdaf8b0",
     "nom": "Shawinigan", "decision": "ecole_introuvable", "doublon": null,
     "sport": "5dd6a7c8-2aa4-4b0e-a150-4ac77255f492", "division": "D2", "gender": "Féminin",
     "league": "Basketball C F D2 Nord-Est CQ B (2026-2027)", "h": 6, "v": 7},
    {"alerte": "58a59a19-a51f-4d3c-aa68-39defdd541a9", "rid": "68599a7b-b6d7-4b1b-bce7-caa55600af22", "ecole": "8a330cf7-76fa-4761-8cbd-df223e6c4cbd",
     "nom": "Sherbrooke", "decision": "ecole_introuvable", "doublon": null,
     "sport": "5dd6a7c8-2aa4-4b0e-a150-4ac77255f492", "division": "D2", "gender": "Féminin",
     "league": "Basketball C F D2 Nord-Est CQ B (2026-2027)", "h": 7, "v": 6},
    {"alerte": "67487976-8c40-45c2-b39a-9725f2dfd066", "rid": "9f7f1bf2-11a8-4a56-ab47-6561f199989d", "ecole": "8a330cf7-76fa-4761-8cbd-df223e6c4cbd",
     "nom": "Sherbrooke", "decision": "ecole_introuvable", "doublon": null,
     "sport": "5dd6a7c8-2aa4-4b0e-a150-4ac77255f492", "division": "D2", "gender": "Masculin",
     "league": "Basketball C M D2 Nord-Est CQ B (2026-2027)", "h": 7, "v": 6},
    {"alerte": "5e7b1333-0ae2-4a59-be39-aa2028657fa7", "rid": "8c0749c7-13a0-4d3a-928a-cba989ca65ec", "ecole": "55f424c0-d740-43e5-99f6-38a8fb73e03b",
     "nom": "Sorel-Tracy", "decision": "ecole_introuvable", "doublon": null,
     "sport": "5dd6a7c8-2aa4-4b0e-a150-4ac77255f492", "division": "D2", "gender": "Féminin",
     "league": "Basketball C F D2 Nord-Est CQ B (2026-2027)", "h": 6, "v": 7},
    {"alerte": "9bb986ee-9923-4047-865f-1cf9195bf55a", "rid": "2a991ddd-1782-4bbb-993e-d16c67db5e84", "ecole": "61ed3f9a-f089-4983-87e9-85bab65e1693",
     "nom": "Trois-Rivières", "decision": "ecole_introuvable", "doublon": null,
     "sport": "5dd6a7c8-2aa4-4b0e-a150-4ac77255f492", "division": "D2", "gender": "Masculin",
     "league": "Basketball C M D2 Nord-Est CQ B (2026-2027)", "h": 6, "v": 7},
    {"alerte": "26589406-a168-40fd-9b00-324a6f0824c9", "rid": "f4c5f91f-2ae4-4b71-a90d-52f160af3ef4", "ecole": "61ed3f9a-f089-4983-87e9-85bab65e1693",
     "nom": "Trois-Rivières", "decision": "ecole_introuvable", "doublon": null,
     "sport": "5dd6a7c8-2aa4-4b0e-a150-4ac77255f492", "division": "D2", "gender": "Féminin",
     "league": "Basketball C F D2 Nord-Est CQ B (2026-2027)", "h": 6, "v": 7}
  ]$plan$;
  v_admin constant uuid := 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0';
  v_al uuid[]; v_rids uuid[]; v_teams uuid[]; e text; n int; nh int; nv int;
begin
  -- Le plan lui-même.
  select array_agg(p.alerte order by p.alerte), array_agg(p.rid order by p.rid) into v_al, v_rids
    from jsonb_to_recordset(v_plan) p(alerte uuid, rid uuid);
  if cardinality(v_al) <> 12
     or md5(array_to_string(v_al, ',')) <> '43e3182df9a741428ef01798b33d2707'
     or md5(array_to_string(v_rids, ',')) <> '8836addda230b40f74d227d2af3f0f3b' then
    raise exception 'NEXUS: plan des 12 altéré (empreintes % / %)', md5(array_to_string(v_al, ',')), md5(array_to_string(v_rids, ','));
  end if;

  -- Alertes : les 12, ouvertes, chacune avec son rseq_team_id, proposition recalculée = plan.
  select string_agg(p.nom || ' : ' || coalesce(
           case when a.id is null then 'alerte absente ou déjà traitée'
                when j->>'decision' is distinct from p.decision then 'décision ' || coalesce(j->>'decision', '?')
                when (j->>'sport_id')::uuid is distinct from p.sport then 'sport'
                when j->>'age_group' is distinct from 'Collégial' then 'catégorie'
                when j->>'saison' is distinct from '2026-2027' then 'saison'
                when j->>'division' is distinct from p.division then 'division'
                when j->>'gender' is distinct from p.gender then 'sexe'
                when j->>'league' is distinct from p.league then 'ligue'
                when (j->>'doublon_team_id')::uuid is distinct from p.doublon then 'doublon'
                when p.decision = 'doublon' and (j->>'school_id')::uuid is distinct from p.ecole then 'école prouvée'
           end, ''), ', ') into e
    from jsonb_to_recordset(v_plan) p(alerte uuid, rid uuid, ecole uuid, nom text, decision text, doublon uuid,
                                      sport uuid, division text, gender text, league text)
    left join public.rseq_sync_alerts a
           on a.id = p.alerte and a.rseq_team_id = p.rid and a.type = 'NOUVELLE_EQUIPE' and a.statut = 'OUVERTE'
    left join lateral (select public.rseq_proposition_equipe(a.rseq_team_id, a.rseq_institution_id, a.payload->>'team_name',
                                                             a.rseq_league_id, a.payload->>'saison', 'Collégial') as j) x on true
   where a.id is null
      or j->>'decision' is distinct from p.decision or (j->>'sport_id')::uuid is distinct from p.sport
      or j->>'age_group' is distinct from 'Collégial' or j->>'saison' is distinct from '2026-2027'
      or j->>'division' is distinct from p.division or j->>'gender' is distinct from p.gender
      or j->>'league' is distinct from p.league or (j->>'doublon_team_id')::uuid is distinct from p.doublon
      or (p.decision = 'doublon' and (j->>'school_id')::uuid is distinct from p.ecole);
  if e is not null then raise exception 'NEXUS: alerte ou proposition hors plan — %', e; end if;

  if exists (select 1 from public.teams where rseq_team_id = any(v_rids)) then
    raise exception 'NEXUS: une des 12 équipes existe déjà';
  end if;

  -- Écoles : existent, type CEGEP. Dédoublonnage (règle 2 de la proposition) avec l'école du plan.
  select string_agg(p.nom || ' : ' ||
           case when s.id is null then 'école absente'
                when s.type::text <> 'CEGEP' then 'école ' || s.type::text
                else 'équipes existantes ' || coalesce(d.ids, '-') end, ', ') into e
    from jsonb_to_recordset(v_plan) p(ecole uuid, nom text, doublon uuid, sport uuid, division text, gender text)
    left join public.schools s on s.id = p.ecole
    left join lateral (select string_agg(t.id::text, ',' order by t.id) as ids
                         from public.teams t
                        where t.school_id = p.ecole and t.sport_id = p.sport and t.season = '2026-2027'
                          and coalesce(t.age_group, '') = 'Collégial'
                          and regexp_replace(lower(coalesce(t.division, '')), '^division\s*', 'd') = lower(p.division)
                          and coalesce(t.gender, '') = p.gender) d on true
   where s.id is null or s.type::text <> 'CEGEP' or d.ids is distinct from p.doublon::text;
  if e is not null then raise exception 'NEXUS: école ou dédoublonnage hors plan — %', e; end if;

  -- Côtés de match à relier, équipe par équipe.
  select string_agg(p.nom || ' ' || p.gender || ' ' || x.h || '/' || x.v || ' attendu ' || p.h || '/' || p.v, ', ') into e
    from jsonb_to_recordset(v_plan) p(rid uuid, nom text, gender text, h int, v int),
         lateral (select (select count(*) from public.games where home_team_id is null and home_rseq_team_id = p.rid) as h,
                         (select count(*) from public.games where visitor_team_id is null and visitor_rseq_team_id = p.rid) as v) x
   where x.h <> p.h or x.v <> p.v;
  if e is not null then raise exception 'NEXUS: côtés à relier hors plan (la veille a bougé : régénérer) — %', e; end if;

  -- Les 12 équipes.
  insert into public.teams (school_id, sport_id, name, age_group, division, gender, season, league, rseq_team_id)
  select p.ecole, p.sport, p.nom, 'Collégial', p.division, p.gender, '2026-2027', p.league, p.rid
    from jsonb_to_recordset(v_plan) p(rid uuid, ecole uuid, nom text, sport uuid, division text, gender text, league text);
  get diagnostics n = row_count;
  if n <> 12 then raise exception 'NEXUS: % équipe(s) créée(s), attendu 12', n; end if;
  select array_agg(id order by id) into v_teams from public.teams where rseq_team_id = any(v_rids);

  update public.games g set home_team_id = t.id
    from public.teams t
   where t.id = any(v_teams) and g.home_rseq_team_id = t.rseq_team_id and g.home_team_id is null;
  get diagnostics nh = row_count;
  update public.games g set visitor_team_id = t.id
    from public.teams t
   where t.id = any(v_teams) and g.visitor_rseq_team_id = t.rseq_team_id and g.visitor_team_id is null;
  get diagnostics nv = row_count;
  if nh <> 72 or nv <> 76 then raise exception 'NEXUS: côtés reliés % / %, attendu 72 / 76', nh, nv; end if;

  update public.rseq_sync_alerts a
     set statut = 'TRAITEE', traite_le = now(), traite_par = v_admin,
         note = case p.decision
                  when 'doublon' then 'Équipe créée à la main : 2e équipe distincte, exception au dédoublonnage (GO BP 2026-10-26)'
                  else 'Équipe créée à la main : école établie par correspondance validée par BP (GO BP 2026-10-26)' end
    from jsonb_to_recordset(v_plan) p(alerte uuid, decision text)
   where a.id = p.alerte and a.statut = 'OUVERTE';
  get diagnostics n = row_count;
  if n <> 12 then raise exception 'NEXUS: % alerte(s) traitée(s), attendu 12', n; end if;

  insert into public.admin_operations (operation, motif, details, par)
  values ('CEGEP_EQUIPES_RSEQ_12',
          'Chantier cégep : les 12 équipes RSEQ de cégep refusées par la proposition, créées à la main en « Collégial » '
          || '(2 doublons flag F D3 = 2es équipes distinctes ; 10 Basketball D2 Nord-Est CQ B, école par correspondance validée) — GO BP 2026-10-26',
          jsonb_build_object('equipes', 12, 'cotes_domicile', nh, 'cotes_visiteur', nv,
                             'empreinte_alertes', '43e3182df9a741428ef01798b33d2707',
                             'empreinte_rseq_team_ids', '8836addda230b40f74d227d2af3f0f3b',
                             'alertes', to_jsonb(v_al), 'team_ids', to_jsonb(v_teams),
                             'plan', (select jsonb_agg(jsonb_build_object('rseq_team_id', p->'rid', 'school_id', p->'ecole', 'nom', p->'nom',
                                                                          'decision', p->'decision', 'doublon_de', p->'doublon'))
                                        from jsonb_array_elements(v_plan) p)),
          v_admin);
end $$;
$nexus_op$;
begin
  if md5(t) <> '16c6678ea2614a1226c377e243bec5da' then
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
-- ROLLBACK des 12 équipes RSEQ de cégep (scripts/cegep-equipes-12/creer.sql), par la LISTE des 12
-- rseq_team_id (relevé prod 2026-10-26, empreinte 8836addd…).
-- Refuse si une des 12 a reçu un dépendant (athlète, coach, page, fanion, événement, besoin de position,
-- jeton, invitation, carte prospect, prospect partenaire, revendication d'ambassadeur, équipe principale
-- d'un compte). Sinon : remet à NULL les côtés de match, rseq_standings.team_id et rseq_sync_alerts.team_id
-- qui pointent ces équipes (aucun match supprimé), supprime les 12 équipes, rouvre les 12 alertes dans
-- leur état d'avant (OUVERTE, sans note ni traitement), écrit admin_operations CEGEP_EQUIPES_RSEQ_12_RETIREES.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_rids uuid[] := array[
    '028950e6-34ca-4f08-b8b5-7337529be45c',
    '2a991ddd-1782-4bbb-993e-d16c67db5e84',
    '68599a7b-b6d7-4b1b-bce7-caa55600af22',
    '73e3a35a-e00a-41d9-828a-ac7ef5ac7214',
    '8c0749c7-13a0-4d3a-928a-cba989ca65ec',
    '8d15b218-9005-4513-b2d8-17a5ed4fbd71',
    '931b39c9-12d8-4df9-8072-01ace9ee1ce5',
    '9f7f1bf2-11a8-4a56-ab47-6561f199989d',
    'b7c0e77d-76f5-401e-a3ea-beacbf8d27a8',
    'b96f844d-43a5-4854-8bb8-f08ebb6fd830',
    'ca0983e7-85d6-4d8b-9684-89eef3418a9a',
    'f4c5f91f-2ae4-4b71-a90d-52f160af3ef4'
  ]::uuid[];
  v_teams uuid[]; n int; nh int; nv int; ns int; na int;
begin
  if cardinality(v_rids) <> 12
     or md5(array_to_string(array(select x from unnest(v_rids) x order by x), ',')) <> '8836addda230b40f74d227d2af3f0f3b' then
    raise exception 'NEXUS: liste des 12 altérée';
  end if;
  select array_agg(id order by id) into v_teams from public.teams where rseq_team_id = any(v_rids);
  if coalesce(cardinality(v_teams), 0) <> 12 then
    raise exception 'NEXUS: % des 12 équipes en base, attendu 12 — rien écrit', coalesce(cardinality(v_teams), 0);
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
    raise exception 'NEXUS: une des 12 équipes a reçu un dépendant — rollback refusé, rien écrit';
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
  if n <> 12 then raise exception 'NEXUS: % équipe(s) supprimée(s), attendu 12 — rien écrit', n; end if;

  update public.rseq_sync_alerts
     set statut = 'OUVERTE', traite_le = null, traite_par = null, note = null
   where type = 'NOUVELLE_EQUIPE' and statut = 'TRAITEE' and rseq_team_id = any(v_rids);
  get diagnostics na = row_count;
  if na <> 12 then raise exception 'NEXUS: % alerte(s) rouverte(s), attendu 12 — rien écrit', na; end if;

  insert into public.admin_operations (operation, motif, details, par)
  values ('CEGEP_EQUIPES_RSEQ_12_RETIREES', 'Rollback des 12 équipes RSEQ de cégep',
          jsonb_build_object('equipes', n, 'cotes_domicile', nh, 'cotes_visiteur', nv, 'classements', ns,
                             'alertes_rouvertes', na, 'empreinte_rseq_team_ids', '8836addda230b40f74d227d2af3f0f3b'),
          'f51384b5-a2c2-4827-9137-8aa8d29a1fe0');
end $$;
$nexus_rb$;
begin
  if md5(t) <> 'fb7ea44ee907a948ceeee1dbccdc537b' then
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
