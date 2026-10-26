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
--        -v ON_ERROR_STOP=1 -f docs/cegep-lot-b2/prod/rejeu-blanc-20261026.sql
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
declare t text := $nexus_mig$-- ════════════════════════════════════════════════════════════════════════════
-- Chantier cégep — LOT B2 « données » : catégorie « Collégial » (décisions BP 2026-10-26).
-- NON APPLIQUÉE EN PROD. Apply par la voie psql, sur GO BP seulement.
--
-- 1. rseq_proposition_equipe : une équipe collégiale proposée par la veille RSEQ porte
--    age_group = 'Collégial' au lieu de NULL (seule la ligne v_age change ; corps prod gardé
--    par md5(prosrc) avant remplacement). Sans ce correctif, chaque alerte NOUVELLE_EQUIPE
--    traitée crée une équipe sans catégorie, et la règle de dédoublonnage n° 2 (même école +
--    sport + catégorie + division + sexe + saison) cesse de reconnaître les équipes
--    « Collégial » existantes.
-- 2. Les 256 équipes rattachées à une école de type CEGEP, age_group NULL, passent en
--    « Collégial ». Garde : schools.type = 'CEGEP' ET age_group IS NULL, compte exact 256 et
--    empreinte exacte de l'ensemble (md5 des id triés, relevé prod 2026-10-26). JAMAIS de
--    filtre par nom : « Cégep régional de Lanaudière à L'Assomption » (CEGEP) en fait partie,
--    « Collège de l'Assomption » (SECONDAIRE) n'est pas touché.
--    Ne fait partir aucun déclencheur : sur teams, trg_porte_coach_cegep regarde
--    UPDATE OF school_id et teams_resync_athlete_sport_id_trg UPDATE OF sport_id.
-- 3. Une ligne admin_operations CATEGORIE_COLLEGIALE_256 avec la liste des id.
--
-- Hors lot (décisions BP) : Champlain Cavaliers, Champlain Regional College, les 194 alertes
-- cégep ouvertes, les athlètes au cégep tapé à la main.
--
-- Rollback : supabase/rollback/20261026140000_rollback_cegep_lot_b2_categorie_collegial.sql
-- ════════════════════════════════════════════════════════════════════════════

-- ── 0. Gardes ────────────────────────────────────────────────────────────────
do $$
declare n int; e text;
begin
  if (select md5(prosrc) from pg_proc
       where oid = 'public.rseq_proposition_equipe(uuid,uuid,text,uuid,text,text)'::regprocedure)
     is distinct from '70b3e97e6039c381f27a86b836bd2c8a' then
    raise exception 'NEXUS: rseq_proposition_equipe n''est pas le corps prod relevé le 2026-10-26';
  end if;
  select count(*), md5(string_agg(t.id::text, ',' order by t.id)) into n, e
    from public.teams t join public.schools s on s.id = t.school_id
   where s.type::text = 'CEGEP' and t.age_group is null;
  if n <> 256 or e is distinct from '8d08926f78d851bf9bbd3003c5b52ec9' then
    raise exception 'NEXUS: % équipe(s) CEGEP sans catégorie (empreinte %), attendu 256 (8d08926f…)', n, e;
  end if;
end $$;

-- ── 1. rseq_proposition_equipe : collégial → « Collégial » ──────────────────
create or replace function public.rseq_proposition_equipe(
  p_rseq_team_id uuid, p_institution uuid, p_team_name text, p_league_id uuid, p_saison text, p_secteur text)
returns jsonb
language plpgsql
stable
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_sport text; v_cat text; v_div text; v_sexe text; v_ligue text;
  v_sport_nexus text; v_sport_id uuid;
  v_n_ecoles int; v_ecole uuid; v_ecole_nom text;
  v_age text; v_gender text; v_league text;
  v_deja uuid; v_doublon uuid; v_doublon_nom text; v_cotes int; v_decision text;
begin
  select l.sport, l.category, l.division, l.sex_type, l.league_name
    into v_sport, v_cat, v_div, v_sexe, v_ligue
    from public.rseq_ligues_a_appeler l where l.rseq_league_id = p_league_id limit 1;
  if v_sport is null then
    select g.sport, g.category, g.division, g.sex_type, g.league_name
      into v_sport, v_cat, v_div, v_sexe, v_ligue
      from public.games g where g.rseq_league_id = p_league_id limit 1;
  end if;

  v_sport_nexus := case v_sport when 'Ultimate' then 'Ultimate frisbee' else v_sport end;
  select s.id into v_sport_id from public.sports s where s.nom = v_sport_nexus;

  select count(*), min(sc.id::text)::uuid, min(sc.name) into v_n_ecoles, v_ecole, v_ecole_nom
    from public.schools sc
   where p_institution is not null and sc.rseq_institution_id = p_institution
     and sc.type = case p_secteur when 'Collégial' then 'CEGEP' else 'SECONDAIRE' end;
  if v_n_ecoles <> 1 then v_ecole := null; v_ecole_nom := null; end if;

  v_gender := case v_sexe when 'Garçons' then 'Masculin' when 'Filles' then 'Féminin' else nullif(v_sexe, '') end;
  -- Lot B2 (2026-10-26) : une équipe collégiale porte la catégorie « Collégial », comme les 398 déjà en base.
  v_age    := case when p_secteur = 'Collégial' then 'Collégial' else nullif(v_cat, '') end;
  v_div    := nullif(v_div, '');
  v_league := case when p_secteur = 'Collégial' and v_ligue is not null then v_ligue || ' (' || p_saison || ')' end;

  select t.id into v_deja from public.teams t where t.rseq_team_id = p_rseq_team_id;
  if v_ecole is not null and v_sport_id is not null then
    select t.id, t.name into v_doublon, v_doublon_nom
      from public.teams t
     where t.school_id = v_ecole and t.sport_id = v_sport_id and t.season = p_saison
       and coalesce(t.age_group, '') = coalesce(v_age, '')
       and regexp_replace(lower(coalesce(t.division, '')), '^division\s*', 'd')
         = regexp_replace(lower(coalesce(v_div, '')), '^division\s*', 'd')
       and coalesce(t.gender, '') = coalesce(v_gender, '')
     order by t.created_at limit 1;
  end if;
  select (select count(*) from public.games where home_team_id is null and home_rseq_team_id = p_rseq_team_id)
       + (select count(*) from public.games where visitor_team_id is null and visitor_rseq_team_id = p_rseq_team_id)
    into v_cotes;

  v_decision := case
    when v_deja is not null    then 'deja_en_base'
    when v_sport_id is null    then 'sport_absent'
    when v_ecole is null       then 'ecole_introuvable'
    when v_doublon is not null then 'doublon'
    else 'a_creer' end;

  return jsonb_build_object(
    'decision', v_decision, 'rseq_team_id', p_rseq_team_id, 'nom', p_team_name, 'saison', p_saison,
    'secteur', p_secteur, 'school_id', v_ecole, 'ecole', v_ecole_nom, 'ecoles_candidates', v_n_ecoles,
    'sport', v_sport_nexus, 'sport_id', v_sport_id, 'age_group', v_age, 'division', v_div, 'gender', v_gender,
    'league', v_league, 'equipe_existante', v_deja, 'doublon_team_id', v_doublon, 'doublon_nom', v_doublon_nom,
    'cotes_a_relier', v_cotes,
    'confiance', case when v_ecole is not null then 'haute (InstitutionId)' else 'introuvable' end);
end;
$function$;

-- ── 2. Les 256 équipes → « Collégial » ──────────────────────────────────────
do $$
declare v_ids uuid[]; n int;
begin
  select array_agg(t.id order by t.id) into v_ids
    from public.teams t join public.schools s on s.id = t.school_id
   where s.type::text = 'CEGEP' and t.age_group is null;

  update public.teams t set age_group = 'Collégial'
   where t.id = any(v_ids) and t.age_group is null;
  get diagnostics n = row_count;
  if n <> 256 then
    raise exception 'NEXUS: % équipe(s) mise(s) à jour, attendu 256 — rien écrit', n;
  end if;
  if exists (select 1 from public.teams t join public.schools s on s.id = t.school_id
              where s.type::text = 'CEGEP' and t.age_group is null) then
    raise exception 'NEXUS: il reste une équipe CEGEP sans catégorie — rien écrit';
  end if;

  insert into public.admin_operations (operation, motif, details, par)
  values ('CATEGORIE_COLLEGIALE_256',
          'Lot B2 cégep : équipes d''école CEGEP sans catégorie passées en « Collégial » (décision BP 2026-10-26)',
          jsonb_build_object('equipes', n, 'age_group_avant', null, 'age_group_apres', 'Collégial',
                             'empreinte_ids', md5(array_to_string(v_ids, ',')),
                             'team_ids', to_jsonb(v_ids)),
          auth.uid());
end $$;
$nexus_mig$;
begin
  if md5(t) <> '0d8d3f694ffbb1d265f5eec53ec93de6' then
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
declare t text := $nexus_rb$-- ════════════════════════════════════════════════════════════════════════════
-- ROLLBACK du lot B2 cégep (20261026140000_cegep_lot_b2_categorie_collegial).
-- 1. Les 256 équipes, par LISTE D'ID (relevé prod 2026-10-26, empreinte 8d08926f…), repassent de
--    « Collégial » à NULL. Garde : la liste est exacte et les 256 sont encore « Collégial ».
-- 2. rseq_proposition_equipe reprend son corps prod d'avant B2 (texte de
--    20261008205120_rseq_equipes_proposees.sql, md5(prosrc) 70b3e97e…), garde md5 avant et après.
-- 3. Une ligne admin_operations CATEGORIE_COLLEGIALE_256_RETIREE (la ligne de l'apply reste : table immuable).
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_ids uuid[] := array[
    '01796b7d-0142-45c9-80b9-a9dd87b86f91',
    '01fbeeac-d963-4a76-bb42-7b832f54ef8d',
    '026ea91a-76d1-4f77-bc11-216a1ac2bc2f',
    '028e5c0b-7d22-4458-8a3e-ac4b0b6a9765',
    '060493e3-923d-4acd-9148-804986732941',
    '06351845-b571-4bd8-9757-065a6be76d82',
    '066a08fd-cb27-458c-a1e7-9e060568da73',
    '07713c37-3e46-4a38-9973-b13500f349d0',
    '08e90253-d759-4e74-9794-30df3ab1c848',
    '095eb64b-279a-439c-9ea8-a8519a945b65',
    '0c2b334d-e8d2-4a71-a7a6-8a776a093893',
    '0e3d62ce-5c14-4f7b-862d-20144e4a7ee1',
    '1079068f-5e31-47bb-bc1c-fcbe9966ee28',
    '109ec262-b2b2-4a31-b7a4-4a61d8fbd044',
    '1157fef8-b7ff-4605-90ce-c751783223a3',
    '12411e9a-79a6-4830-9d39-eb134526bce8',
    '12abd96c-ca34-4c3b-8658-4223adecf810',
    '12b4eacd-735c-49cb-87fe-e832d2ab1838',
    '12fb4ed6-6ccd-4e68-91ea-1636a7f803d0',
    '13f4e134-a1bd-4a19-a93e-b53bd64c99ac',
    '145142ed-cbc0-48ba-a15b-5a73ba1dfea3',
    '148e77ee-0326-400e-8232-d70b79309b32',
    '14eeb5d2-0370-4077-bf4d-16f7d07b55f6',
    '156bba99-cfcf-45b7-8f83-a62ddfadf806',
    '15c102a0-4e14-4aec-adbb-3a82273b86d6',
    '15f930a3-cd7c-4367-8b20-2ff80939da8a',
    '161b2390-6de5-48da-aae6-63da7294876b',
    '16d64299-e1e1-442a-be64-77eb39ab6e4e',
    '19545747-2239-41bb-8eae-2c18f735286d',
    '1c313f34-6e97-45a0-b79a-dd68d4881dd0',
    '1d3b7d9b-d1d3-4213-ab82-37fe6b23b383',
    '1d99b4ba-888d-4f86-834e-ddf88ec50104',
    '1da2fa9f-1dec-4c3f-9e2e-5525f42dba6b',
    '1de1b53e-7852-419b-9338-e7c9ddf555ca',
    '1f27ebba-b083-4f24-a2e4-8efad659c548',
    '21ed3339-d32a-4668-b415-baaffeb23285',
    '21fd9530-721c-4a1c-af03-c795e370147f',
    '245fb587-2cd8-4efa-96c0-880b71637313',
    '2489fda4-8bee-4214-9534-0b5d39b2ebed',
    '24c7d19b-0394-4bd4-886f-67f18416ec84',
    '24e0aa47-a065-4b79-a084-3e7acdf33ba1',
    '25cca35f-66df-47aa-be22-d9ee48546bd8',
    '2606d496-bcc2-4d9d-95c1-70155688e44a',
    '2702ca4c-2428-4e81-aa3d-2efa819859e4',
    '29b8b5f1-5b53-4500-b10e-fc2b906c24ca',
    '29dc9f0d-cd95-40ad-8622-50750c872bfa',
    '2ac8142e-d0db-473e-8d23-863ef3897a09',
    '2ae649f4-3411-4cdf-b1c4-de6376d13352',
    '2b781bce-22dd-498f-88e3-3fcd1074e437',
    '2ba7dad7-6cb4-47b3-a1ec-cb614ff2b645',
    '2c02e19b-2147-4d41-9d69-a66f937de60c',
    '2ccc3843-5921-4e8a-8cbb-51251ff09d81',
    '2cd87344-3978-4606-9add-564e587880d8',
    '2cf33a58-367f-4cd3-8115-7ac63fc46859',
    '2d28ba3d-19bd-4fac-b5b1-7633831301f3',
    '2df9896a-19bf-4c8e-b421-a28634483a23',
    '2e86d46d-8a94-4963-b003-fb96421f0b99',
    '2f7e043f-1b3f-4512-a610-d310544a5328',
    '2f96265a-0215-4916-a5e3-e7328b7fd1ce',
    '2fd29897-e8ba-41d2-9ac7-73626271e38b',
    '307ad6d5-28f5-4e1b-8696-8a47b5bef9a8',
    '318de6b7-13bb-4e50-a412-79f04d7a4dba',
    '31a7d9fc-f069-4c92-8dc0-ab5b9e3cd497',
    '32924bbc-5455-4907-85e2-aab3aa93bf2e',
    '337947ac-441c-4e43-a4f8-985d21e5b58d',
    '3620c228-b642-4c33-ad08-ff88563af1c8',
    '36a1cd9b-d332-4d3c-8732-072c580bcc21',
    '3725c513-7d00-42bd-8478-17ca989c04d6',
    '372e28ed-a818-4db5-8d8b-852b32f98dba',
    '38e387b3-a1a9-45a8-82dc-6524765e42ae',
    '38ff863e-e2e8-434c-8cb3-9a1497378bbb',
    '3924172f-a940-485b-b7ad-a02b7f8267b9',
    '3aa5f524-259e-4781-840a-407c135d6d9f',
    '3ac963b8-ef21-4c0f-a562-024e4d3d41b0',
    '3b2d49f2-a74d-4e48-bc04-05d4a2f18159',
    '3c684024-775d-442f-ba63-e24d2f040b8d',
    '3f042205-0bbf-48f0-9e3f-65a9993aeaff',
    '3f938768-2d07-4726-ba03-8db803caacf7',
    '3fe03525-dbef-46d7-9ac2-777bdc5635af',
    '4133a47f-7692-48a0-b9b6-e39f99cbe81a',
    '41808f2c-28fa-4782-a3d9-59d5a366b18d',
    '434ee2dd-b39d-430f-80e6-2ce2e78a329d',
    '43b54d76-19a2-4108-9dc1-38067962b7a7',
    '44bfc0ab-2da3-4acb-a8d1-c96997418325',
    '455a9413-915f-44e0-a8e0-18a170cf7942',
    '4717eda9-7dd2-49fa-94ba-336c45d47652',
    '471dc0b8-02e3-486b-b1c4-17248f732a3c',
    '480ccca0-b660-4555-946f-062612b0ec6e',
    '4c29de74-8a5a-4778-b41c-099ffed8751b',
    '4ee89c1c-8fda-4fd6-bd79-b113834328e8',
    '4f433144-09af-4cf7-ba25-10593abecbd7',
    '4f72f477-a283-45aa-8e16-a6e77c499152',
    '50c5a8f2-bf5c-4986-bbec-fe7a38d3a5ab',
    '513b9d93-39dc-4ecd-8412-de49ebdb7ca1',
    '543cd234-3940-4bd8-8161-fc321c68c40b',
    '5450dd3f-2205-40b9-8d8a-9a935feaa9d4',
    '5538ef72-b274-42c9-a168-38b46a0dbc2e',
    '55eacaa5-6796-42bc-832c-5e0ec9ce6e85',
    '569e9d13-8902-4bde-b06d-dc006d8b706c',
    '56da3d2e-17cc-4824-ad84-94f0409dea16',
    '5780ce23-50b5-4c42-9571-bf04510cbab7',
    '58454115-b00c-49b8-9de4-ecf8c2c8012d',
    '585b6706-e1cb-4946-abf6-ef34f0b2d1e6',
    '5a2e0bb5-0e0e-44bf-b3c2-536b89281c5b',
    '5a8f53a2-7c8b-48dc-b5cb-f101431656cc',
    '5c469d04-7482-4639-a5fc-275f15ecf704',
    '6052e299-5ee6-4afc-9e51-765dc7273ee3',
    '61099312-b338-4726-9219-5b4bc07289d2',
    '61fb2762-7c00-4bcc-b432-a548d23d8e66',
    '634f465a-2b06-4761-acbf-c9987285fc74',
    '63837a17-f8c2-48ba-bc9c-ba48a25253d5',
    '64af68d8-6bcf-4207-a715-c5fa8a255975',
    '663a6ab8-1e9a-4964-b447-9eca8f41fd53',
    '66c425b6-805c-4575-ad4a-fa6cce7516aa',
    '66e9c6c3-dda0-41a9-b224-d5065105ddeb',
    '66ffc51a-1944-448e-90bc-6e7939e828fe',
    '67888978-8e66-4caf-91f1-f51a19ffda90',
    '67a71e06-55dd-4c13-9e99-196c9b35e8b1',
    '68ce9e52-65a8-48d0-9653-533ffcc0e683',
    '69b17530-d0c5-4dc3-b3eb-5ac4138aaa9d',
    '6a008f90-7598-4e53-b80e-7cbbeaa79a10',
    '6b214e17-630b-48c9-b638-d648d73946cc',
    '6b8c5ed1-80ea-4cbc-af4e-f50fd437b012',
    '6baaf78f-8f69-4dce-b1b8-7220175c1c3e',
    '6bb76de7-0bab-41e6-8157-03ebe392ac09',
    '6bf736b8-7dad-4f38-b6d7-ae9e64110aff',
    '6d50a119-6c7c-4ec9-9e74-3f5f2ea1bc35',
    '6dc1679e-9ed1-4b88-b9d5-9b85a23af55c',
    '6f14df85-35d2-4704-92a8-1ea5f63f0cf8',
    '715717da-8be1-4165-b677-b98f3b138b73',
    '71ed73c9-20e0-4c9c-bbbd-3d5edda483f1',
    '739e84a3-ad73-44fd-9021-5ad16ab60bf9',
    '75899dda-733b-4a25-ab15-c100271ac02d',
    '75d33a30-96e4-4c0d-9c16-50ebcfd162fb',
    '761d122d-35f9-4027-b6a0-ea89fea3198c',
    '76552e18-9146-405a-b724-fcbf64b228aa',
    '76916ccd-6290-4050-ab7f-bc1dba0169f5',
    '7695a360-0d5e-47bc-a527-9f2c4eded4d3',
    '795468d7-162c-4aac-b3b7-446d37ba98ef',
    '79d8de94-069c-476f-9f8c-3ce3514d2dfd',
    '7b1e6e9a-3da1-40e7-a629-7f25e3c4e703',
    '7b8a4dde-e2b9-4e26-b3ed-95343b95add1',
    '7bdad331-5d9a-4295-95ed-16bef4d98586',
    '7c6fc9d9-e1cd-4b3d-a898-793bcfba021b',
    '7d8d7890-487f-4f2e-9023-b3b2dc5fd2c4',
    '7dedaebb-c9ef-497c-bc82-b6b87f24d816',
    '7e3b2219-57b5-489c-bd6c-9f67c155b450',
    '7ec8b402-ba1f-4199-977e-6a3dab07b2d6',
    '7f20c9ee-3d19-457d-afff-42362e299386',
    '7f7d4398-3b5c-4cd4-a375-b25ae86a231a',
    '7f800820-f1d0-4b17-ae1b-9d79848f4f2f',
    '8267b1d5-1360-4de3-b66d-1496f9e0dbb6',
    '834d4ec1-7876-4123-9a24-91efb8401cc5',
    '84906179-b6c9-4756-895e-0cdea2dc10d2',
    '84b86b61-fc07-40c6-aa10-94327f4a99d5',
    '8698616a-5b08-443e-a1a0-2bb5d0074822',
    '86a4e874-0b44-459d-abd9-48915f8074c1',
    '87b1ca89-7976-4d9a-9c27-51e440d98f06',
    '8a3c4e92-0bf3-4cd6-bba8-41cff4694243',
    '8a6a8d9e-8710-4b93-9c83-bb93b33a67e7',
    '8ced3b12-98d4-45cb-8b67-af0d279f0868',
    '8dea86e8-f92f-41a0-a8dc-faeaa6d2aafc',
    '8e82d1e4-352b-4ce6-8e4d-28da216d4b55',
    '8f7afbbe-6bb1-4494-8a45-c2fa0f3a91c3',
    '9190141f-42c8-47d8-9e51-880297d8cb20',
    '932426e9-0026-4a7a-b5d4-6102e8d8db86',
    '954e8d9d-32d8-47f7-8cf9-2a6cbc81e5f5',
    '97076c49-c69b-4272-bd75-6a2d1fb439fb',
    '985c0bd5-a30b-450c-a375-1eb84c977eb8',
    '993f308d-917d-410f-85c7-76b6651ec95b',
    '99d1cd85-fd24-4826-b601-5752b1d610eb',
    '9a2f90be-563f-424c-8eb2-f96bbb64f324',
    '9bbbd0ea-db5e-4beb-960a-4a9426f6514c',
    '9be49ef8-2624-4da9-bf42-163b2a704840',
    '9ddd839e-6068-45c6-b12f-304a9b103fe4',
    '9e2ed4e2-4630-4107-a988-eb9242186f77',
    'a117574f-8b5b-4342-9506-f934c044523c',
    'a49b4aa4-bc2b-41cd-8b41-7977b863a6d6',
    'a619e18f-53c5-4094-8748-1820fd32e80e',
    'a6bf98db-c60c-4c70-974d-716614af03cf',
    'a9f75c48-e5ff-4aaa-a2ca-cc37a4805d0c',
    'abcbce3d-950b-4133-9129-6b9b89113afc',
    'ac835e9c-f084-4402-b0c6-f5ded4fc0c24',
    'acd700a9-446a-4446-bbb1-5c6613b3aa63',
    'ad2339d2-4743-431c-a23d-ebd3e70d777c',
    'aeefaabf-d71e-4412-b80c-c709f447fbfc',
    'af498beb-9f02-45a6-8c1b-2b5dc5355495',
    'afcd3be6-eb42-4de9-bc70-64a1440d8a14',
    'b0d3b8be-21f7-4f80-a7c8-4dca2b61df40',
    'b0efb28f-5115-4fe0-806f-910667138a36',
    'b3ab75e9-4415-4f5b-9f34-e95b81574b39',
    'b4582833-d36c-4d35-b8c2-47fb14e309c9',
    'b58466b3-e74a-4f0d-81e1-c9b514dc1358',
    'b638cbea-3d39-479f-939e-a318617ec57d',
    'b687db9c-a092-4d8f-bb04-b83b2aa5fd34',
    'b77b1826-36f9-4e87-968e-28303f175bca',
    'b94eae03-f082-4ff8-9a48-c1b06fa4c8ab',
    'b9b43c18-9e76-4c99-880a-52e98976a282',
    'bb10344c-2330-4a3b-bc41-c36aa66f05ad',
    'bd192501-82ef-4437-8c40-6be916241253',
    'bdbce23b-5f36-4685-b9b5-7fc5e8c374b3',
    'c180936a-d663-4750-b48c-d2813d9b75b3',
    'c3b7d4f0-fd77-460e-9b85-403408016fe1',
    'c41e0812-c933-4194-adc7-c8d31fa3a1f6',
    'c558da5f-bd24-4b5b-8989-0c4b161ff393',
    'c96d432a-8d27-434a-ad09-3ee3ed3e1d8c',
    'ca081ee3-834c-477b-80bb-17d9848ba4db',
    'cc041660-79fe-41ea-bd90-a849eeba504e',
    'ce97adbc-d7e0-4a7b-bb30-93577c11182d',
    'cf232ad3-d4da-43c1-8d62-89a5dd2bb70b',
    'cf4a673d-e34f-4576-b3e3-4b0fdb872985',
    'd05368ed-476c-4322-87ed-963a07f459c1',
    'd0932b76-c5b5-478f-9d36-dbe9004d5a7f',
    'd185b497-68f2-4083-a9de-d650e61c372d',
    'd1b2ecce-7faa-42b3-bb75-cf3d20d8ece9',
    'd1edb622-5667-42b3-a628-387598e28caa',
    'd252002d-cbd9-4ae1-8314-fcd5a28f36d1',
    'd2c2a3c1-a29c-4ba0-aefe-c20ef59d5dd5',
    'd469c1ce-6262-4fec-9c49-548d1b7844ae',
    'd4b96526-7773-418b-bede-a2e5db254a7d',
    'd561b249-3bc1-47a0-b27c-94f6f72f80b9',
    'd5db5f3f-9c67-4fd2-8f7b-f56d3e2ec3cb',
    'd6e8f6e5-e725-418f-9c0a-f85e4506b758',
    'd9a21f43-a3cc-4934-bd6f-6c3b83b0d69e',
    'd9daabaa-4823-4018-8759-09779a08c88a',
    'd9eeb12e-1e91-4c25-875b-ace700b7436c',
    'da972fc1-5144-47c7-80f5-ab65924571b6',
    'dacf7863-9397-486b-a810-9b4ff29baba2',
    'db517874-f442-4cf0-af7b-f76ca759db20',
    'dc9612b6-5b2d-42b3-aa38-08f97238a9cf',
    'ddd0a0a7-b896-4343-a2c1-48f582a8c088',
    'e27c8c34-4d41-4274-9df4-a35476937b13',
    'e5fe3b3b-18b2-49c1-bcd7-26be49d608a4',
    'e6ce4fec-f54a-4217-a1a7-16763b8bdab8',
    'e9dacee1-be72-4e82-b7fd-65ae7565dddc',
    'ea09975f-9208-46a4-8d29-5c0696ea4ddc',
    'ea467799-f617-4c7d-892f-63d7c39d5975',
    'eaab104e-0bbf-4085-be71-0513d8ce90ff',
    'eb77a167-c8f1-41ef-a0a8-d3ee3c48eb23',
    'eb797bc7-5fad-481f-b7e5-4dfdf6baa8df',
    'ebb4be5e-4b72-445e-9540-1fc4ceb31958',
    'ebfd58da-12f1-4412-b751-670beb8eac92',
    'ecf8839f-27e8-4d25-9bde-0f0d5a2e3f1a',
    'ecfaece4-def2-4fd0-a1f1-7fae39eb071d',
    'eff7f621-e74d-4faf-934f-386bd8607724',
    'f10e1844-db9d-44c3-8e25-21e0a9fd0b69',
    'f277ab82-fffb-4410-b7b2-63fa67763f9c',
    'f2e0f95e-7438-4c6e-bde4-431449d7a6dd',
    'f5e5cb58-21a5-4ea6-a950-9c18da7fc100',
    'f625940e-3ca2-4988-b4bb-79bd98d4a174',
    'f63b3ccb-229e-4c81-b458-7af641d2da13',
    'f6e86b30-922b-4eee-b23d-965b3ad0d263',
    'f9afd1d2-fdeb-48ad-83f9-3f41cd86f6c1',
    'fa35452c-59ee-4e14-982f-714e56caf2c1',
    'fe1c9919-3864-44ea-9b10-5c60ca6396ee',
    'ff479086-a338-456a-bcac-b3dcdfd03b93'
  ]::uuid[];
  n int;
begin
  if cardinality(v_ids) <> 256
     or md5(array_to_string(array(select x from unnest(v_ids) x order by x), ',')) <> '8d08926f78d851bf9bbd3003c5b52ec9' then
    raise exception 'NEXUS: liste des 256 altérée';
  end if;
  if (select md5(prosrc) from pg_proc
       where oid = 'public.rseq_proposition_equipe(uuid,uuid,text,uuid,text,text)'::regprocedure)
     is distinct from '0ab7d3953ceacfae2a2eff8493d83617' then
    raise exception 'NEXUS: rseq_proposition_equipe n''est pas la version du lot B2';
  end if;
  select count(*) into n from public.teams where id = any(v_ids) and age_group = 'Collégial';
  if n <> 256 then
    raise exception 'NEXUS: % des 256 équipes sont encore « Collégial », attendu 256 — rien écrit', n;
  end if;

  update public.teams set age_group = null where id = any(v_ids) and age_group = 'Collégial';
  get diagnostics n = row_count;
  if n <> 256 then
    raise exception 'NEXUS: % équipe(s) remise(s) à NULL, attendu 256 — rien écrit', n;
  end if;

  insert into public.admin_operations (operation, motif, details, par)
  values ('CATEGORIE_COLLEGIALE_256_RETIREE', 'Rollback du lot B2 cégep : les 256 équipes repassent sans catégorie',
          jsonb_build_object('equipes', n, 'empreinte_ids', '8d08926f78d851bf9bbd3003c5b52ec9'), auth.uid());
end $$;

create or replace function public.rseq_proposition_equipe(
  p_rseq_team_id uuid, p_institution uuid, p_team_name text, p_league_id uuid, p_saison text, p_secteur text)
returns jsonb
language plpgsql
stable
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_sport text; v_cat text; v_div text; v_sexe text; v_ligue text;
  v_sport_nexus text; v_sport_id uuid;
  v_n_ecoles int; v_ecole uuid; v_ecole_nom text;
  v_age text; v_gender text; v_league text;
  v_deja uuid; v_doublon uuid; v_doublon_nom text; v_cotes int; v_decision text;
begin
  select l.sport, l.category, l.division, l.sex_type, l.league_name
    into v_sport, v_cat, v_div, v_sexe, v_ligue
    from public.rseq_ligues_a_appeler l where l.rseq_league_id = p_league_id limit 1;
  if v_sport is null then
    select g.sport, g.category, g.division, g.sex_type, g.league_name
      into v_sport, v_cat, v_div, v_sexe, v_ligue
      from public.games g where g.rseq_league_id = p_league_id limit 1;
  end if;

  v_sport_nexus := case v_sport when 'Ultimate' then 'Ultimate frisbee' else v_sport end;
  select s.id into v_sport_id from public.sports s where s.nom = v_sport_nexus;

  select count(*), min(sc.id::text)::uuid, min(sc.name) into v_n_ecoles, v_ecole, v_ecole_nom
    from public.schools sc
   where p_institution is not null and sc.rseq_institution_id = p_institution
     and sc.type = case p_secteur when 'Collégial' then 'CEGEP' else 'SECONDAIRE' end;
  if v_n_ecoles <> 1 then v_ecole := null; v_ecole_nom := null; end if;

  v_gender := case v_sexe when 'Garçons' then 'Masculin' when 'Filles' then 'Féminin' else nullif(v_sexe, '') end;
  v_age    := case when p_secteur = 'Collégial' then null else nullif(v_cat, '') end;
  v_div    := nullif(v_div, '');
  v_league := case when p_secteur = 'Collégial' and v_ligue is not null then v_ligue || ' (' || p_saison || ')' end;

  select t.id into v_deja from public.teams t where t.rseq_team_id = p_rseq_team_id;
  if v_ecole is not null and v_sport_id is not null then
    select t.id, t.name into v_doublon, v_doublon_nom
      from public.teams t
     where t.school_id = v_ecole and t.sport_id = v_sport_id and t.season = p_saison
       and coalesce(t.age_group, '') = coalesce(v_age, '')
       and regexp_replace(lower(coalesce(t.division, '')), '^division\s*', 'd')
         = regexp_replace(lower(coalesce(v_div, '')), '^division\s*', 'd')
       and coalesce(t.gender, '') = coalesce(v_gender, '')
     order by t.created_at limit 1;
  end if;
  select (select count(*) from public.games where home_team_id is null and home_rseq_team_id = p_rseq_team_id)
       + (select count(*) from public.games where visitor_team_id is null and visitor_rseq_team_id = p_rseq_team_id)
    into v_cotes;

  v_decision := case
    when v_deja is not null    then 'deja_en_base'
    when v_sport_id is null    then 'sport_absent'
    when v_ecole is null       then 'ecole_introuvable'
    when v_doublon is not null then 'doublon'
    else 'a_creer' end;

  return jsonb_build_object(
    'decision', v_decision, 'rseq_team_id', p_rseq_team_id, 'nom', p_team_name, 'saison', p_saison,
    'secteur', p_secteur, 'school_id', v_ecole, 'ecole', v_ecole_nom, 'ecoles_candidates', v_n_ecoles,
    'sport', v_sport_nexus, 'sport_id', v_sport_id, 'age_group', v_age, 'division', v_div, 'gender', v_gender,
    'league', v_league, 'equipe_existante', v_deja, 'doublon_team_id', v_doublon, 'doublon_nom', v_doublon_nom,
    'cotes_a_relier', v_cotes,
    'confiance', case when v_ecole is not null then 'haute (InstitutionId)' else 'introuvable' end);
end;
$function$;

do $$
begin
  if (select md5(prosrc) from pg_proc
       where oid = 'public.rseq_proposition_equipe(uuid,uuid,text,uuid,text,text)'::regprocedure)
     is distinct from '70b3e97e6039c381f27a86b836bd2c8a' then
    raise exception 'NEXUS: rseq_proposition_equipe n''a pas repris son corps prod';
  end if;
end $$;
$nexus_rb$;
begin
  if md5(t) <> '6a62c459d91168d9beded95ef32e7905' then
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
