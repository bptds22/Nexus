-- ════════════════════════════════════════════════════════════════════════════
-- Lot B2 cégep — REJEU À BLANC (local ou prod) : « assure-toi que ça brise rien » (BP 2026-10-26).
-- NE LAISSE RIEN : UNE transaction qui finit par ROLLBACK ; toute erreur arrête psql avant
-- (ON_ERROR_STOP) et la session se ferme sans COMMIT.
--
-- Fichier GÉNÉRÉ par scripts/cegep-lot-b2/generer.sh à partir de ce gabarit : la migration et le
-- rollback y sont embarqués tels quels (fins de ligne LF), gardés par leur md5.
--
-- Lancement prod (BP, pooler de session, SANS -1) :
--   $env:PGCLIENTENCODING="UTF8"
--   psql "host=aws-1-ca-central-1.pooler.supabase.com port=5432 dbname=postgres user=postgres.<ref>" `
--        -v ON_ERROR_STOP=1 -f docs/cegep-lot-b2/prod/rejeu-blanc-@@DATE@@.sql
--
-- Déroulé : mesure AVANT → migration → mesure APRÈS → rollback → mesure APRÈS ROLLBACK → rapports
-- → ROLLBACK. Les sondes de compte tournent sous le rôle du compte (authenticated +
-- request.jwt.claims), jamais en superuser, dans une sous-transaction annulée. Le rapport n'affiche
-- que des compteurs, des md5 et des débuts d'identifiant, aucun nom de personne.
--
-- Chaque cellule est une liste « clé=valeur;… ». Une clé qui commence par « libelle » est la SEULE
-- partie qui a le droit de changer (la catégorie affichée des 256) ; toute autre clé qui change est
-- un écart INTERDIT (verdict ≠ 0 = ARRÊT).
-- ════════════════════════════════════════════════════════════════════════════

\set ON_ERROR_STOP 1
\pset pager off
\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '900s';
set local search_path = public, extensions;
set local application_name = 'nexus-rejeu-blanc-lot-b2';
select now() as debut, current_user, current_setting('server_version') as version;

-- ── Gardes : B2 pas encore en place ─────────────────────────────────────────
do $$
begin
  if (select md5(prosrc) from pg_proc
       where oid = 'public.rseq_proposition_equipe(uuid,uuid,text,uuid,text,text)'::regprocedure)
     is distinct from '70b3e97e6039c381f27a86b836bd2c8a' then
    raise exception 'NEXUS: rseq_proposition_equipe n''est pas le corps prod d''avant B2';
  end if;
  if exists (select 1 from public.admin_operations where operation = 'CATEGORIE_COLLEGIALE_256') then
    raise exception 'NEXUS: le lot B2 a déjà été appliqué';
  end if;
end $$;

-- ── Les 256 (fixés AVANT la migration) et les listes de sonde ────────────────
create temp table _v as
select t.id from public.teams t join public.schools s on s.id = t.school_id
 where s.type::text = 'CEGEP' and t.age_group is null;
do $$
begin
  if (select count(*) from _v) <> 256
     or (select md5(string_agg(id::text, ',' order by id)) from _v) <> '8d08926f78d851bf9bbd3003c5b52ec9' then
    raise exception 'NEXUS: les 256 ont bougé (% équipes)', (select count(*) from _v);
  end if;
end $$;

-- Matchs d'une équipe de cégep (dépistage : équipes sœurs par catégorie).
create temp table _gc as
select g.id from public.games g
 where exists (select 1 from public.teams t join public.schools s on s.id = t.school_id
                where s.type::text = 'CEGEP' and t.id in (g.home_team_id, g.visitor_team_id));
-- Alertes NOUVELLE_EQUIPE ouvertes (194 cégep + 10 école introuvable au 2026-10-26).
create temp table _al as
select a.id, a.rseq_team_id, a.rseq_institution_id, a.payload->>'team_name' as nom, a.rseq_league_id,
       a.payload->>'saison' as saison, a.school_id
  from public.rseq_sync_alerts a where a.type = 'NOUVELLE_EQUIPE' and a.statut = 'OUVERTE';
-- Textes de recherche (matchs_suggestions) : tous les cégeps, 15 écoles secondaires, mots généraux.
create temp table _tx as
select name as t from public.schools where type::text = 'CEGEP'
union select name from (select name from public.schools where type::text = 'SECONDAIRE' order by name limit 15) x
union select unnest(array['Collégial', 'Volleyball', 'Champlain', 'Assomption', 'Lanaudière', 'Juvénile', 'Cavaliers']);

create temp table _lit (k text primary key, v text);
insert into _lit values
  ('{V256}',    (select 'array[' || string_agg(quote_literal(id::text), ',' order by id) || ']::uuid[]' from _v)),
  ('{GCEGEP}',  (select coalesce('array[' || string_agg(quote_literal(id::text), ',' order by id) || ']::uuid[]', 'array[]::uuid[]') from _gc)),
  ('{TEXTES}',  (select 'array[' || string_agg(quote_literal(t), ',' order by t) || ']::text[]' from _tx)),
  ('{CODES}',   (select coalesce('array[' || string_agg(quote_literal(code), ',' order by code) || ']::text[]', 'array[]::text[]') from public.team_join_tokens)),
  ('{ALERTES}', (select coalesce('array[' || string_agg(quote_literal(id::text), ',' order by id) || ']::uuid[]', 'array[]::uuid[]') from _al));

-- ── Les comptes ──────────────────────────────────────────────────────────────
-- Admin, tous les recruteurs Pro, tous les partenaires admis, les destinataires d'une invitation
-- d'équipe en attente (avec leur jeton), anon. R1 = le premier recruteur Pro (sondes lourdes).
create temp table _c (cle text primary key, uid uuid, role text, cat text, jeton text);
insert into _c
select 'ADMIN', coalesce((select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0' and role = 'ADMIN'::public.user_role),
                         (select id from public.users where role = 'ADMIN'::public.user_role order by id limit 1)),
       'authenticated', 'admin', null;
insert into _c
select 'R' || lpad(row_number() over (order by u.id)::text, 2, '0') || ' ' || left(u.id::text, 8), u.id, 'authenticated',
       'recruteur Pro, école ' || coalesce(s.type::text, 'aucune')
       || case when public.unite_voit_cegepiens(u.school_id) then ' (voit les cégépiens)' else '' end, null
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
insert into _c values ('ANON', null, 'anon', 'anon', null);
delete from _c where uid is null and role <> 'anon';
do $$
begin
  if not exists (select 1 from _c where cle like 'R%') then raise exception 'NEXUS: aucun recruteur Pro pour sonder'; end if;
  if not exists (select 1 from _c where cle = 'ADMIN') then raise exception 'NEXUS: aucun admin pour sonder'; end if;
end $$;
select cat, count(*) as comptes from _c group by cat order by cat;
select (select count(*) from _v) as les_256, (select count(*) from _gc) as matchs_d_equipe_de_cegep,
       (select count(*) from _al) as alertes_nouvelle_equipe_ouvertes, (select count(*) from _tx) as textes_de_recherche,
       (select count(*) from public.team_join_tokens) as jetons_d_equipe;

-- ── Les sondes ───────────────────────────────────────────────────────────────
-- portee : PRO (recruteurs Pro + partenaires), R1 (premier recruteur Pro), ADMIN, INV (destinataires), SU (superuser, une fois).
create temp table _s (cle text primary key, portee text, q text);
insert into _s values
  -- (b) carte des matchs : les matchs des 256, toute la saison (pastille Équipe).
  ('a01 matchs_recherche : matchs des 256, saison', 'PRO',
   $$select 'n=' || count(*) || ';avenir=' || count(*) filter (where r.jour >= current_date)
            || ';md5=' || md5(coalesce(string_agg(r::text, '|' order by r.id), ''))
       from public.matchs_recherche('2026-07-01', '2027-08-04', null, array['SECONDAIRE','COLLEGIAL','CIVIL'], null, {V256}, null, false) r$$),
  -- (b) carte des matchs : toute la saison par fenêtres de 31 jours, trois types.
  ('a02 matchs_recherche : saison, fenêtres de 31 j', 'R1',
   $$select string_agg('f' || to_char(w.d, 'YYYYMMDD') || '=' ||
              (select count(*) || '/' || md5(coalesce(string_agg(r::text, '|' order by r.id), ''))
                 from public.matchs_recherche(w.d, w.d + 30, null, array['SECONDAIRE','COLLEGIAL','CIVIL'], null, null, null, false) r),
              ';' order by w.d)
       from (select d0::date as d from generate_series('2026-07-01'::date, '2027-07-31'::date, interval '31 days') d0) w$$),
  -- (b) filtres Type : les 7 combinaisons, fenêtre des 31 prochains jours.
  ('a03 matchs_recherche : filtres Type, 31 prochains jours', 'R1',
   $$select string_agg(array_to_string(ty.t, '+') || '=' ||
              (select count(*) || '/' || md5(coalesce(string_agg(r::text, '|' order by r.id), ''))
                 from public.matchs_recherche(current_date, current_date + 30, null, ty.t, null, null, null, false) r),
              ';' order by array_to_string(ty.t, '+'))
       from (values (array['SECONDAIRE']), (array['COLLEGIAL']), (array['CIVIL']), (array['SECONDAIRE','COLLEGIAL']),
                    (array['SECONDAIRE','CIVIL']), (array['COLLEGIAL','CIVIL']), (array['SECONDAIRE','COLLEGIAL','CIVIL'])) ty(t)$$),
  -- (a) matchs_suggestions : seul le détail (sport + catégorie + sexe) des équipes parmi les 256 peut changer.
  ('a04 matchs_suggestions : cégeps, écoles, mots', 'R1',
   $$select 'lignes=' || count(*)
            || ';hors256=' || md5(coalesce(string_agg(x.tx || '|' || r::text, '§' order by x.tx, r.genre, r.cle)
                                     filter (where not ((case when r.genre = 'EQUIPE' then r.cle::uuid = any({V256}) else false end))), ''))
            || ';les256_sans_detail=' || md5(coalesce(string_agg(x.tx || '|' || r.genre || '|' || r.cle || '|' || r.libelle || '|' || r.nb_matchs, '§' order by x.tx, r.cle)
                                     filter (where (case when r.genre = 'EQUIPE' then r.cle::uuid = any({V256}) else false end)), ''))
            || ';libelle_les256=' || md5(coalesce(string_agg(x.tx || '|' || r.cle || '|' || r.detail, '§' order by x.tx, r.cle)
                                     filter (where (case when r.genre = 'EQUIPE' then r.cle::uuid = any({V256}) else false end)), ''))
            || ';libelle_les256_lignes=' || count(*) filter (where (case when r.genre = 'EQUIPE' then r.cle::uuid = any({V256}) else false end))
       from unnest({TEXTES}) x(tx), lateral public.matchs_suggestions(x.tx) r$$),
  -- (a) depistage_profils_match : chaque match d'une équipe de cégep ; matchs non vides listés.
  ('a05 depistage_profils_match : matchs d''équipes de cégep', 'R1',
   $$select 'matchs=' || count(*) || ';non_vides=' || count(*) filter (where z.n > 0)
            || ';contenu=' || coalesce(string_agg(g::text || ':' || z.n || ':' || z.h, ',' order by g) filter (where z.n > 0), '-')
       from unnest({GCEGEP}) g,
            lateral (select count(*) as n, md5(coalesce(string_agg(d::text, '|' order by d::text), '')) as h
                       from public.depistage_profils_match(g) d) z$$),
  -- (a) apercu_code_equipe + resolve_team_join_token : tous les jetons d'équipe.
  ('a06 jetons d''équipe (apercu_code_equipe, resolve_team_join_token)', 'ADMIN',
   $$select 'jetons=' || count(*)
            || ';hors256=' || md5(coalesce(string_agg(c || '|' || a::text || '|' || r::text, '§' order by c)
                                     filter (where not coalesce(a.team_id = any({V256}), false)), ''))
            || ';les256_sans_categorie=' || md5(coalesce(string_agg(c || '|' || (to_jsonb(a) - 'age_group')::text || '|' || (to_jsonb(r) - 'age_group')::text, '§' order by c)
                                     filter (where coalesce(a.team_id = any({V256}), false)), ''))
            || ';libelle_les256=' || coalesce(string_agg(coalesce(a.age_group, 'NULL') || '/' || coalesce(r.age_group, 'NULL'), ',' order by c)
                                     filter (where coalesce(a.team_id = any({V256}), false)), '-')
       from unnest({CODES}) c left join lateral public.apercu_code_equipe(c) a on true
                              left join lateral public.resolve_team_join_token(c) r on true$$),
  -- (a) resolve_transfer_token : chaque invitation en attente, par son destinataire.
  ('a07 resolve_transfer_token (destinataire)', 'INV',
   $$select 'lignes=' || count(*)
            || ';hors256=' || md5(coalesce(string_agg(r::text, '|') filter (where not coalesce(r.team_id = any({V256}), false)), ''))
            || ';les256_sans_categorie=' || md5(coalesce(string_agg((to_jsonb(r) - 'age_group')::text, '|') filter (where coalesce(r.team_id = any({V256}), false)), ''))
            || ';libelle_les256=' || coalesce(string_agg(coalesce(r.age_group, 'NULL'), ',') filter (where coalesce(r.team_id = any({V256}), false)), '-')
       from public.resolve_transfer_token({JETON}) r$$),
  -- (c) rseq_creer_equipes_proposees À BLANC (sous-transaction annulée) : mêmes créations, mêmes refus.
  ('a08 rseq_creer_equipes_proposees à blanc (alertes ouvertes)', 'ADMIN',
   $$select 'equipes=' || (r->>'equipes_creees') || ';cotes_domicile=' || (r->>'cotes_domicile') || ';cotes_visiteur=' || (r->>'cotes_visiteur')
            || ';refusees=' || md5(coalesce((select string_agg(e::text, '|' order by e->>'rseq_team_id') from jsonb_array_elements(r->'refusees') e), ''))
            || ';refusees_n=' || jsonb_array_length(r->'refusees')
       from (select public.rseq_creer_equipes_proposees({ALERTES}) as r) z$$),
  -- (d) les équipes hors des 256, les 256, les cas nommés par BP.
  ('t01 teams hors des 256 (ligne complète)', 'SU',
   $$select 'n=' || count(*) || ';md5=' || md5(string_agg(to_jsonb(t)::text, '|' order by t.id))
       from public.teams t where t.id <> all({V256})$$),
  ('t02 les 256 sans age_group', 'SU',
   $$select 'n=' || count(*) || ';md5=' || md5(string_agg((to_jsonb(t) - 'age_group')::text, '|' order by t.id))
       from public.teams t where t.id = any({V256})$$),
  ('t03 les 256 : catégorie et ligne complète', 'SU',
   $$select 'libelle_categories=' || string_agg(distinct coalesce(t.age_group, 'NULL'), ',')
            || ';libelle_md5_complet=' || md5(string_agg(to_jsonb(t)::text, '|' order by t.id))
       from public.teams t where t.id = any({V256})$$),
  ('t04 SECONDAIRE en « Collégial » (Collège de l''Assomption)', 'SU',
   $$select 'n=' || count(*) || ';ecoles=' || count(distinct t.school_id) || ';md5=' || md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by t.id), ''))
       from public.teams t join public.schools s on s.id = t.school_id
      where s.type::text = 'SECONDAIRE' and t.age_group = 'Collégial'$$),
  ('t05 LIGUE_CIVILE en « cegep » (Champlain Cavaliers)', 'SU',
   $$select 'n=' || count(*) || ';md5=' || md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by t.id), ''))
       from public.teams t where t.age_group = 'cegep'$$),
  ('t06 index teams_identity_unique', 'SU',
   $$select 'valide=' || (select bool_and(i.indisvalid and i.indisunique) from pg_index i where i.indexrelid = 'public.teams_identity_unique'::regclass)
            || ';groupes_en_double=' || (select count(*) from (select 1 from public.teams
                                          where school_id is not null and sport_id is not null and name is not null and age_group is not null
                                            and division is not null and gender is not null and season is not null and league is not null and zone is not null
                                          group by school_id, sport_id, name, age_group, division, gender, season, league, zone having count(*) > 1) d)
            || ';les256_jumelle_collegial=' || (select count(*) from public.teams v where v.id = any({V256})
                                          and exists (select 1 from public.teams t2 where t2.id <> v.id and t2.school_id = v.school_id
                                                         and t2.sport_id = v.sport_id and t2.name = v.name and t2.age_group = 'Collégial'
                                                         and t2.division is not distinct from v.division and t2.gender is not distinct from v.gender
                                                         and t2.season is not distinct from v.season and t2.league is not distinct from v.league
                                                         and t2.zone is not distinct from v.zone))$$),
  -- (b) matchs liés aux 256, tous les matchs.
  ('t07 matchs liés aux 256', 'SU',
   $$select 'n=' || count(*) || ';avenir=' || count(*) filter (where g.game_date >= current_date)
            || ';md5=' || md5(coalesce(string_agg(to_jsonb(g)::text, '|' order by g.id), ''))
       from public.games g where g.home_team_id = any({V256}) or g.visitor_team_id = any({V256})$$),
  ('t08 tous les matchs', 'SU',
   $$select 'n=' || count(*) || ';md5=' || md5(string_agg(to_jsonb(g)::text, '|' order by g.id)) from public.games g$$),
  -- (b) classements : rseq_standings, et le classement tel qu'affiché (ligne + équipe + école).
  ('t09 classements rseq_standings', 'SU',
   $$select 'n=' || count(*) || ';des256=' || count(*) filter (where s.team_id = any({V256}))
            || ';md5=' || md5(string_agg(to_jsonb(s)::text, '|' order by s.id))
       from public.rseq_standings s$$),
  ('t10 classements affichés (équipe et école jointes)', 'SU',
   $$select 'n=' || count(*) || ';md5=' || md5(string_agg(s.id || '|' || coalesce(t.name, '') || '|' || coalesce(t.season, '') || '|'
                                                    || coalesce(t.division, '') || '|' || coalesce(t.gender, '') || '|' || coalesce(sc.name, ''), '§' order by s.id))
            || ';libelle_categories_des256=' || coalesce(string_agg(distinct coalesce(t.age_group, 'NULL'), ',') filter (where t.id = any({V256})), '-')
       from public.rseq_standings s left join public.teams t on t.id = s.team_id left join public.schools sc on sc.id = t.school_id$$),
  -- (b) filtres et regroupements d'écran : clé « catégorie ?? Collégial » (dbToProgramPage.ts:165, searchData.ts:191).
  ('t11 clé de regroupement écran des équipes de cégep', 'SU',
   $$select 'n=' || count(*) || ';md5=' || md5(string_agg(t.id || '|' || coalesce(t.age_group, 'Collégial'), '|' order by t.id))
       from public.teams t join public.schools s on s.id = t.school_id where s.type::text = 'CEGEP'$$),
  ('t12 dépendants des 256', 'SU',
   $$select 'team_athletes=' || (select count(*) from public.team_athletes where team_id = any({V256}))
            || ';team_coaches=' || (select count(*) from public.team_coaches where team_id = any({V256}))
            || ';team_invitations=' || (select count(*) from public.team_invitations where team_id = any({V256}))
            || ';team_join_tokens=' || (select count(*) from public.team_join_tokens where team_id = any({V256}))
            || ';cartes_prospect=' || (select count(*) from public.cartes_prospect where team_id = any({V256}))
            || ';alertes=' || (select count(*) from public.rseq_sync_alerts where team_id = any({V256}))
            || ';matchs_ajoutes=' || (select count(*) from public.matchs_ajoutes ma join public.games g on g.id = ma.game_id
                                        where g.home_team_id = any({V256}) or g.visitor_team_id = any({V256}))$$),
  -- Cas qu'une équipe sœur rendrait visibles : athlètes ACTIF d'une équipe « Collégial » d'une école + sport
  -- qui a une des 256 ; cégépiens (masqués aux recruteurs, lot A) et non-cégépiens.
  ('t13 athlètes sur une équipe sœur « Collégial »', 'SU',
   $$select 'cegepiens=' || count(*) filter (where public.athlete_est_cegepien(a.id))
            || ';non_cegepiens=' || count(*) filter (where not public.athlete_est_cegepien(a.id))
       from public.team_athletes ta join public.teams t on t.id = ta.team_id join public.athletes a on a.id = ta.athlete_id
      where a.status = 'ACTIF' and t.age_group = 'Collégial' and t.id <> all({V256})
        and exists (select 1 from public.teams v where v.id = any({V256}) and v.school_id = t.school_id and v.sport_id = t.sport_id)$$);

create function pg_temp.sonde(p_uid uuid, p_role text, p_sql text, p_jeton text)
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
              where (s.portee = 'PRO' and (cle like 'R%' or cle like 'P%'))
                 or (s.portee = 'R1' and cle = (select min(cle) from _c where cle like 'R%'))
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

-- (c) Les propositions de la veille, alerte par alerte (rseq_proposition_equipe, en superuser).
create temp table _p (phase text, alerte uuid, decision text, doublon uuid, ecole uuid, age_group text, cotes int, j jsonb);
create function pg_temp.propositions(p_phase text)
returns void
language sql
as $$
  insert into _p
  select p_phase, a.id, j->>'decision', nullif(j->>'doublon_team_id', '')::uuid, nullif(j->>'school_id', '')::uuid,
         j->>'age_group', (j->>'cotes_a_relier')::int, j
    from _al a, lateral public.rseq_proposition_equipe(a.rseq_team_id, a.rseq_institution_id, a.nom, a.rseq_league_id,
                                                        a.saison, 'Collégial') j
$$;

-- Empreinte du schéma public : fonctions (md5 + ACL + réglages), policies, déclencheurs, index de teams.
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
  union all
  select p_phase, 'I|' || indexrelid::regclass::text || '|' || pg_get_indexdef(indexrelid)
    from pg_index where indrelid = 'public.teams'::regclass
$$;

-- ── 1. AVANT ─────────────────────────────────────────────────────────────────
select clock_timestamp() as debut_mesure_avant;
select pg_temp.mesurer('1 avant');
select pg_temp.propositions('1 avant');
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

-- ── 3. APRÈS ─────────────────────────────────────────────────────────────────
select pg_temp.mesurer('2 après');
select pg_temp.propositions('2 après');
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
select pg_temp.propositions('3 après rollback');
select pg_temp.empreinte('3 après rollback');
select clock_timestamp() as fin_mesures;

-- ── Rapports ─────────────────────────────────────────────────────────────────
create temp view _kv as
select m.phase, m.compte, m.surface, split_part(x.kv, '=', 1) as k, substr(x.kv, length(split_part(x.kv, '=', 1)) + 2) as v
  from _m m, lateral regexp_split_to_table(m.v, ';') x(kv);

\echo '== 0. Valeurs AVANT (une ligne par sonde, premier compte ; md5 abrégés)'
select m.surface, min(m.compte) as compte, count(*) as comptes,
       regexp_replace(min(m.v), '([0-9a-f]{8})[0-9a-f]{24}', '\1…', 'g') as valeur
  from _m m where m.phase = '1 avant'
 group by m.surface, m.v order by m.surface, 2;

\echo '== A. Écarts AVANT → APRÈS, clé par clé (seules les clés « libelle… » ont le droit de changer)'
select a.surface, a.k as cle, case when a.k like 'libelle%' then 'permis' else 'INTERDIT' end as nature,
       count(*) as comptes, left(regexp_replace(a.v, '([0-9a-f]{8})[0-9a-f]{24}', '\1…', 'g'), 70) as avant,
       left(regexp_replace(b.v, '([0-9a-f]{8})[0-9a-f]{24}', '\1…', 'g'), 70) as apres
  from _kv a join _kv b on b.compte = a.compte and b.surface = a.surface and b.k = a.k and b.phase = '2 après'
 where a.phase = '1 avant' and a.v is distinct from b.v
 group by a.surface, a.k, a.v, b.v order by a.surface, a.k;

\echo '== A2. Dépistage : matchs dont le contenu change (attendu : seulement des matchs d''une des 256)'
with av as (select compte, unnest(string_to_array(v, ',')) e from _kv where phase = '1 avant' and k = 'contenu' and v <> '-'),
     ap as (select compte, unnest(string_to_array(v, ',')) e from _kv where phase = '2 après' and k = 'contenu' and v <> '-'),
     d as ((select compte, e, 'avant seulement' cote from av except select compte, e, 'avant seulement' from ap)
           union all (select compte, e, 'après seulement' from ap except select compte, e, 'après seulement' from av))
select d.compte, d.cote, left(split_part(d.e, ':', 1), 8) as match, split_part(d.e, ':', 2) as profils,
       exists (select 1 from public.games g where g.id = split_part(d.e, ':', 1)::uuid
                 and (g.home_team_id in (select id from _v) or g.visitor_team_id in (select id from _v))) as match_d_une_des_256
  from d order by 3, 2;

\echo '== C. Propositions de la veille, alerte par alerte (rseq_proposition_equipe)'
select a.decision as avant, b.decision as apres, count(*) as alertes,
       count(*) filter (where a.doublon is distinct from b.doublon) as doublon_change,
       count(*) filter (where a.ecole is distinct from b.ecole) as ecole_change,
       count(*) filter (where a.cotes is distinct from b.cotes) as cotes_change,
       string_agg(distinct coalesce(a.age_group, 'NULL') || ' → ' || coalesce(b.age_group, 'NULL'), ', ') as categorie
  from _p a join _p b on b.alerte = a.alerte and b.phase = '2 après'
 where a.phase = '1 avant'
 group by a.decision, b.decision order by 1, 2;
\echo '== C2. Les doublons : même équipe visée avant et après'
select left(a.alerte::text, 8) as alerte, left(a.doublon::text, 8) as doublon_avant, left(b.doublon::text, 8) as doublon_apres,
       b.doublon in (select id from _v) as equipe_visee_parmi_les_256
  from _p a join _p b on b.alerte = a.alerte and b.phase = '2 après'
 where a.phase = '1 avant' and (a.decision = 'doublon' or b.decision = 'doublon') order by 1;

\echo '== D. Rollback : AVANT → APRÈS ROLLBACK (attendu : 0, 0, 0)'
select (select count(*) from _m a join _m r on r.compte = a.compte and r.surface = a.surface and r.phase = '3 après rollback'
         where a.phase = '1 avant' and a.v is distinct from r.v) as cellules_differentes,
       (select count(*) from _p a join _p r on r.alerte = a.alerte and r.phase = '3 après rollback'
         where a.phase = '1 avant' and a.j is distinct from r.j) as propositions_differentes,
       (select count(*) from ((select ligne from _e where phase = '1 avant' except all select ligne from _e where phase = '3 après rollback')
                               union all
                              (select ligne from _e where phase = '3 après rollback' except all select ligne from _e where phase = '1 avant')) d)
         as lignes_d_empreinte_differentes,
       (select count(*) from _e where phase = '1 avant') as lignes_d_empreinte;

\echo '== E. Ce que la migration change au schéma (empreinte AVANT → APRÈS ; attendu : rseq_proposition_equipe seule)'
select left(ligne, 90) as objet, 'avant seulement' as cote from (select ligne from _e where phase = '1 avant' except select ligne from _e where phase = '2 après') x
union all
select left(ligne, 90), 'après seulement' from (select ligne from _e where phase = '2 après' except select ligne from _e where phase = '1 avant') y
order by 1, 2;

\echo '== F. Durées (ms) par sonde et par phase'
select surface, phase, count(*) as appels, round(avg(ms), 1) as ms_moyen, round(max(ms), 1) as ms_max
  from _m group by surface, phase order by surface, phase;

\echo '== VERDICT (attendu : tout à 0 et refus à 0)'
select (select count(*) from _kv a join _kv b on b.compte = a.compte and b.surface = a.surface and b.k = a.k and b.phase = '2 après'
         where a.phase = '1 avant' and a.v is distinct from b.v and a.k not like 'libelle%') as ecarts_interdits,
       (select count(*) from _p a join _p b on b.alerte = a.alerte and b.phase = '2 après'
         where a.phase = '1 avant' and (a.decision is distinct from b.decision or a.doublon is distinct from b.doublon)) as decisions_changees,
       (select count(*) from _m a join _m r on r.compte = a.compte and r.surface = a.surface and r.phase = '3 après rollback'
         where a.phase = '1 avant' and a.v is distinct from r.v) as ecarts_apres_rollback,
       (select count(*) from ((select ligne from _e where phase = '1 avant' except all select ligne from _e where phase = '3 après rollback')
                               union all
                              (select ligne from _e where phase = '3 après rollback' except all select ligne from _e where phase = '1 avant')) d)
         as empreinte_apres_rollback,
       (select count(*) from _m where v like 'refus=%') as refus;
select m.surface, m.compte, m.phase, m.v from _m m where m.v like 'refus=%' order by 1, 2, 3 limit 20;

select clock_timestamp() as fin;
rollback;
\echo '== ROLLBACK fait : rien n''est resté.'
