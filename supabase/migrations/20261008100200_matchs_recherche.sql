-- 20261008100200_matchs_recherche (LOCALE — à renommer à sa version prod au moment de l'apply)
-- ════════════════════════════════════════════════════════════════════════════
-- CARTE DES MATCHS, LOT B — 3/3 : RECHERCHE DE TOUS LES MATCHS
-- (BP 2026-10-07, décisions 1 à 7).
--
-- La carte devient un moteur de recherche de TOUS les matchs d'une plage de
-- dates (7 jours au plus). Une ligne par match :
--   id, jour, heure, domicile, visiteur (noms Nexus d'abord, sinon le libellé
--   source), terrain, sport, catégorie, division, ligue, type
--   (SECONDAIRE | COLLEGIAL | CIVIL), lat / lon, nb_profils, cible, ajoute.
--
--   · Type : CIVIL = source LFMM, QBFL, QMFL, QMJFL, ou secteur vide hors RSEQ ;
--     sinon le secteur RSEQ (Secondaire / Collégial).
--   · lat / lon : ceux de games s'ils sont exploitables (boîte du Québec, ni 0
--     ni vides — même règle que lieuExploitable côté web), sinon lieux_geocodes
--     par nom normalisé (lieu_normalise), sinon null → « Lieu non précisé ».
--   · nb_profils : athlètes ACTIF à l'identité visible (athlete_identity_ok)
--     des deux équipes — même règle que matchs_profils_nexus (Loi 25).
--   · cible : un athlète suivi par l'unité de l'appelant joue dans l'une des
--     deux équipes. Définition IDENTIQUE à celle du Calendrier
--     (useCalendrierUnite) : pipeline et favoris de l'unité (son cégep, SON
--     sport) ou les siens sans unité, membres de ses listes ou des listes de
--     l'unité, équipes des cartes prospect de l'unité. Ainsi un match « cible »
--     est exactement un match déjà au Calendrier.
--   · ajoute : le match est dans matchs_ajoutes pour l'unité de l'appelant.
--   · Texte : par mots, sans accents ; chaque mot doit figurer dans le nom
--     d'une équipe ou du terrain.
--   · Refus : non-recruteur Pro (même test que matchs_profils_nexus) → 42501 ;
--     plage vide, inversée ou de plus de 7 jours → 22023.
--
-- Rollback : supabase/rollback/20261008100200_rollback_matchs_recherche.sql
-- ════════════════════════════════════════════════════════════════════════════

create function public.matchs_recherche(
  p_debut date,
  p_fin   date,
  p_sport text   default null,
  p_types text[] default null,
  p_texte text   default null
)
returns table (
  id         uuid,
  jour       date,
  heure      text,
  domicile   text,
  visiteur   text,
  terrain    text,
  sport      text,
  categorie  text,
  division   text,
  ligue      text,
  type       text,
  lat        double precision,
  lon        double precision,
  nb_profils int,
  cible      boolean,
  ajoute     boolean
)
language plpgsql
stable
security definer
set search_path = public
set row_security = off
as $$
#variable_conflict use_column
declare
  v_mots text[];
begin
  if auth.uid() is null
     or not exists (select 1 from public.users u
                     where u.id = auth.uid() and u.role = 'RECRUTEUR'::public.user_role)
     or not public.user_has_pro() then
    raise exception 'NEXUS: réservé aux recruteurs Pro' using errcode = '42501';
  end if;
  if p_debut is null or p_fin is null or p_fin < p_debut then
    raise exception 'NEXUS: plage de dates invalide' using errcode = '22023';
  end if;
  if p_fin - p_debut > 6 then
    raise exception 'NEXUS: 7 jours au plus (reçu % jours)', p_fin - p_debut + 1 using errcode = '22023';
  end if;

  v_mots := array_remove(string_to_array(coalesce(public.lieu_normalise(p_texte), ''), ' '), '');

  return query
  with moi as (
    select u.id as uid, u.school_id, u.sport_id from public.users u where u.id = auth.uid()
  ),
  ath_suivis as (
    select p.athlete_id from public.recruiter_pipeline p, moi
     where (p.unite_cegep_id = moi.school_id and p.unite_sport_id = moi.sport_id)
        or (p.unite_cegep_id is null and p.recruiter_id = moi.uid)
    union
    select f.athlete_id from public.recruiter_favorites f, moi
     where (f.unite_cegep_id = moi.school_id and f.unite_sport_id = moi.sport_id)
        or (f.unite_cegep_id is null and f.recruiter_id = moi.uid)
    union
    select lm.athlete_id from public.recruiter_list_members lm
      join public.recruiter_lists l on l.id = lm.list_id, moi
     where l.recruiter_id = moi.uid
        or (l.unite_cegep_id = moi.school_id and l.unite_sport_id = moi.sport_id)
  ),
  equipes_suivies as (
    select ta.team_id from public.team_athletes ta
      join ath_suivis s on s.athlete_id = ta.athlete_id
      join public.athletes a on a.id = ta.athlete_id and a.status = 'ACTIF'::public.account_status
    union
    select cp.team_id from public.cartes_prospect cp, moi
     where cp.team_id is not null and cp.fusionnee_le is null
       and cp.unite_cegep_id = moi.school_id and cp.unite_sport_id = moi.sport_id
  ),
  g as (
    select gm.*,
           case
             when gm.source_nom in ('LFMM', 'QBFL', 'QMFL', 'QMJFL')
                  or (gm.sector is null and gm.source_nom is distinct from 'RSEQ') then 'CIVIL'
             when public.lieu_normalise(gm.sector) = 'collegial' then 'COLLEGIAL'
             when public.lieu_normalise(gm.sector) = 'secondaire' then 'SECONDAIRE'
           end as le_type
      from public.games gm
     where gm.game_date between p_debut and p_fin
       and (public.lieu_normalise(p_sport) is null
            or public.lieu_normalise(gm.sport) = public.lieu_normalise(p_sport))
  ),
  n as (
    select g.*,
           coalesce(nullif(btrim(th.name), ''), nullif(btrim(g.home_name_raw), ''), 'Équipe à confirmer') as nom_dom,
           coalesce(nullif(btrim(tv.name), ''), nullif(btrim(g.visitor_name_raw), ''), 'Équipe à confirmer') as nom_vis
      from g
      left join public.teams th on th.id = g.home_team_id
      left join public.teams tv on tv.id = g.visitor_team_id
     where p_types is null or g.le_type = any (p_types)
  ),
  f as (
    select n.* from n
     where cardinality(v_mots) = 0
        or (select bool_and(strpos(coalesce(public.lieu_normalise(n.nom_dom || ' ' || n.nom_vis || ' ' || coalesce(n.venue, '')), ''), m) > 0)
              from unnest(v_mots) m)
  )
  select f.id,
         f.game_date,
         nullif(btrim(f.game_time), ''),
         f.nom_dom,
         f.nom_vis,
         nullif(btrim(f.venue), ''),
         f.sport,
         f.category,
         f.division,
         f.league_name,
         f.le_type,
         case when ok.gps then f.venue_lat::double precision else lg.lat end,
         case when ok.gps then f.venue_lon::double precision else lg.lon end,
         (select count(distinct ta.athlete_id)::int
            from public.team_athletes ta
            join public.athletes a on a.id = ta.athlete_id
           where ta.team_id in (f.home_team_id, f.visitor_team_id)
             and a.status = 'ACTIF'::public.account_status
             and public.athlete_identity_ok(a.date_naissance, a.consentement_parental)),
         coalesce(f.home_team_id in (select team_id from equipes_suivies)
                  or f.visitor_team_id in (select team_id from equipes_suivies), false),
         exists (select 1 from public.matchs_ajoutes ma, moi
                  where ma.game_id = f.id
                    and ma.unite_cegep_id = moi.school_id and ma.unite_sport_id = moi.sport_id)
    from f
    cross join lateral (
      select (f.venue_lat is not null and f.venue_lon is not null
              and f.venue_lat <> 0 and f.venue_lon <> 0
              and f.venue_lat between 44 and 63 and f.venue_lon between -80 and -57) as gps
    ) ok
    left join public.lieux_geocodes lg
      on not ok.gps and lg.nom_normalise = public.lieu_normalise(f.venue)
   order by f.game_date,
            (substring(f.game_time from '^\s*(\d{1,2})[:h]'))::int nulls last,
            (substring(f.game_time from '^\s*\d{1,2}[:h](\d{2})'))::int nulls last,
            f.nom_dom;
end $$;

comment on function public.matchs_recherche(date, date, text, text[], text) is
  'Carte des matchs (lot B) : tous les matchs d''une plage de 7 jours au plus, filtrés par sport, type et texte. Recruteur Pro seulement.';

-- ACL — liste COMPLÈTE triée (CLAUDE.md, 2026-09-07) : PUBLIC et anon retirés.
revoke all on function public.matchs_recherche(date, date, text, text[], text) from public, anon;
grant execute on function public.matchs_recherche(date, date, text, text[], text) to authenticated;

do $$
declare vus text[];
begin
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.matchs_recherche(date, date, text, text[], text)'::regprocedure;
  if vus is distinct from array['authenticated', 'postgres', 'service_role'] then
    raise exception 'NEXUS: ACL de matchs_recherche = %, attendu {authenticated,postgres,service_role}', vus;
  end if;
end $$;
