-- 20261014164451_nls_carte_noms_exposure
--
-- APPLIQUÉE en PROD le 2026-10-14 via MCP apply_migration, sur GO de BP (rédigée
-- sous 20261014143100 ; nom aligné sur la version réelle). Après
-- 20261014163338_nls_games_source (appliquée le 2026-10-14). Rollback :
-- supabase/rollback/20261014164451_rollback_nls_carte_noms_exposure.sql
--
-- ── POURQUOI (BP 2026-10-14) ─────────────────────────────────────────────────
-- La carte des matchs nomme une équipe par teams.name. Les équipes NLS y
-- portent le nom du CLUB (« NLS – CB ELITE ») : « CB ELITE CM » et
-- « CB ELITE (2) CM » s'y lisaient pareil, et le genre (BM / BF…) disparaissait.
-- Le nom tel que la NLS l'écrit est DÉJÀ en base, sans nouvelle colonne :
-- games.home_name_raw / visitor_name_raw, écrits par l'import
-- (scripts/plan-nls-basketball-games.mjs) depuis les PDF Exposure.
--
-- ── CE QUI CHANGE ────────────────────────────────────────────────────────────
-- Deux lignes de matchs_recherche (nom_dom / nom_vis) : pour un match
-- source_nom = 'NLS', le nom brut passe AVANT teams.name. Tout le reste de
-- la fonction est recopié À L'IDENTIQUE de la version en place (prod = local,
-- md5 56be0ec134f496a4cc256a695efa202c relevé le 2026-10-14) ; la recherche
-- texte, le tri et l'affichage suivent, puisqu'ils lisent nom_dom / nom_vis.
-- Hors NLS : aucun changement.
--
-- CREATE OR REPLACE à signature identique : pas de DROP, l'ACL n'est pas
-- emportée. Gates : version de départ attendue AVANT, ACL complète APRÈS.

do $$
begin
  if md5(pg_get_functiondef('public.matchs_recherche(date, date, text, text[], text, uuid[], text[], boolean)'::regprocedure))
     <> '56be0ec134f496a4cc256a695efa202c' then
    raise exception 'NEXUS: matchs_recherche a changé depuis le relevé du 2026-10-14 — recopier la version en place avant d''appliquer';
  end if;
end $$;

CREATE OR REPLACE FUNCTION public.matchs_recherche(p_debut date, p_fin date, p_sport text DEFAULT NULL::text, p_types text[] DEFAULT NULL::text[], p_texte text DEFAULT NULL::text, p_equipes uuid[] DEFAULT NULL::uuid[], p_lieux text[] DEFAULT NULL::text[], p_mes_matchs boolean DEFAULT false)
 RETURNS TABLE(id uuid, jour date, heure text, domicile text, visiteur text, terrain text, sport text, categorie text, division text, zone text, ligue text, type text, lat double precision, lon double precision, nb_profils integer, cible boolean, ajoute boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
#variable_conflict use_column
declare
  v_mots text[];
  -- Au moins une pastille Équipe / Terrain (BP 2026-10-09) : la saison à venir entière.
  v_pastilles boolean := coalesce(cardinality(p_equipes), 0) + coalesce(cardinality(p_lieux), 0) > 0;
  -- PARTENAIRE (BP 2026-10-09) : rôle PARTNER et fiche APPROVED. Même moteur ; la branche
  -- partenaire ne touche ni l'unité, ni les suivis, ni les cartes prospect.
  v_partenaire boolean := public.partenaire_admis();
  -- « Mes matchs » : seulement les matchs ajoutés (au partenaire, ou à l'unité du
  -- recruteur), sur la saison à venir, comme une pastille.
  v_saison boolean := v_pastilles or coalesce(p_mes_matchs, false);
begin
  if not v_partenaire
     and (auth.uid() is null
          or not exists (select 1 from public.users u
                          where u.id = auth.uid() and u.role = 'RECRUTEUR'::public.user_role)
          or not public.user_has_pro()) then
    raise exception 'NEXUS: réservé aux recruteurs Pro' using errcode = '42501';
  end if;
  if p_debut is null or p_fin is null or p_fin < p_debut then
    raise exception 'NEXUS: plage de dates invalide' using errcode = '22023';
  end if;
  -- 31 jours au plus (BP 2026-10-09) : 360 ms côté base sur la période à venir la plus chargée
  -- (2026-10-09 → 11-08, 3 804 matchs, ~418 terrains), mesure prod du 2026-10-09.
  if not v_saison and p_fin - p_debut > 30 then
    raise exception 'NEXUS: 31 jours au plus (reçu % jours)', p_fin - p_debut + 1 using errcode = '22023';
  end if;
  -- Avec pastilles : une saison, pas davantage (borne de sûreté).
  if v_saison and p_fin - p_debut > 400 then
    raise exception 'NEXUS: 401 jours au plus avec une équipe ou un terrain (reçu % jours)', p_fin - p_debut + 1 using errcode = '22023';
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
       -- ALIAS (BP 2026-10-09) : le RSEQ publie « Ultimate » (secondaire) et « Ultimate frisbee »
       -- (collégial 2026-2027) pour le même sport ; même repli que rseq_family_key().
       -- LES FILTRES S'APPLIQUENT PARTOUT (BP 2026-10-09, retour sur « la pastille gagne ») :
       -- Sport et Type filtrent aussi les matchs d'une pastille (Catégorie et Division sont
       -- filtrées côté page, de même). Seul le texte libre est ignoré avec une pastille : il sert
       -- alors à chercher la pastille suivante.
       and (public.lieu_normalise(p_sport) is null
            or (case when public.lieu_normalise(gm.sport) like 'ultimate%' then 'ultimate'
                     else public.lieu_normalise(gm.sport) end)
             = (case when public.lieu_normalise(p_sport) like 'ultimate%' then 'ultimate'
                     else public.lieu_normalise(p_sport) end))
       -- PASTILLES (BP 2026-10-09) : un match passe s'il touche AU MOINS UNE pastille —
       -- une équipe choisie, à domicile ou au visiteur, ou un terrain choisi. Sans pastille,
       -- le prédicat est vrai : résultats identiques à 20261009171716.
       and (not v_pastilles
            or gm.home_team_id = any (coalesce(p_equipes, '{}'))
            or gm.visitor_team_id = any (coalesce(p_equipes, '{}'))
            or (coalesce(cardinality(p_lieux), 0) > 0 and public.lieu_normalise(gm.venue) = any (p_lieux)))
       -- MES MATCHS : ceux du partenaire, ou ceux de l'unité du recruteur.
       and (not coalesce(p_mes_matchs, false)
            or (v_partenaire and exists (select 1 from public.matchs_ajoutes_partenaire mp
                                          where mp.game_id = gm.id and mp.partenaire_id = auth.uid()))
            or (not v_partenaire and exists (select 1 from public.matchs_ajoutes ma, public.users u
                                              where u.id = auth.uid() and ma.game_id = gm.id
                                                and ma.unite_cegep_id = u.school_id and ma.unite_sport_id = u.sport_id)))
  ),
  n as (
    select g.*,
           coalesce(case when g.source_nom = 'NLS' then nullif(btrim(g.home_name_raw), '') end,
                    nullif(btrim(th.name), ''), nullif(btrim(g.home_name_raw), ''), 'Équipe à confirmer') as nom_dom,
           coalesce(case when g.source_nom = 'NLS' then nullif(btrim(g.visitor_name_raw), '') end,
                    nullif(btrim(tv.name), ''), nullif(btrim(g.visitor_name_raw), ''), 'Équipe à confirmer') as nom_vis
      from g
      left join public.teams th on th.id = g.home_team_id
      left join public.teams tv on tv.id = g.visitor_team_id
     where p_types is null or g.le_type = any (p_types)
  ),
  f as (
    select n.* from n
     where v_pastilles or cardinality(v_mots) = 0
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
         f.zone,
         f.league_name,
         f.le_type,
         case when ok.gps then f.venue_lat::double precision else lg.lat end,
         case when ok.gps then f.venue_lon::double precision else lg.lon end,
         (select count(distinct ta.athlete_id)::int
            from public.team_athletes ta
            join public.athletes a on a.id = ta.athlete_id
           where ta.team_id in (f.home_team_id, f.visitor_team_id)
             and a.status = 'ACTIF'::public.account_status
             -- Recruteur : identité visible seulement (inchangé). Partenaire : TOUS les
             -- actifs, nommés ou non (BP) ; les noms passent par matchs_profils_partenaire.
             and (v_partenaire or public.athlete_identity_ok(a.date_naissance, a.consentement_parental))),
         -- L'étoile « joueur suivi » n'existe pas pour un partenaire.
         (not v_partenaire) and coalesce(f.home_team_id in (select team_id from equipes_suivies)
                  or f.visitor_team_id in (select team_id from equipes_suivies), false),
         case when v_partenaire
              then exists (select 1 from public.matchs_ajoutes_partenaire mp
                            where mp.game_id = f.id and mp.partenaire_id = auth.uid())
              else exists (select 1 from public.matchs_ajoutes ma, moi
                            where ma.game_id = f.id
                              and ma.unite_cegep_id = moi.school_id and ma.unite_sport_id = moi.sport_id)
         end
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
end $function$;


do $$
declare
  vus  text[];
  veut text[] := array['authenticated', 'postgres', 'service_role'];
begin
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.matchs_recherche(date, date, text, text[], text, uuid[], text[], boolean)'::regprocedure;
  if vus is distinct from veut then
    raise exception 'NEXUS: ACL de matchs_recherche = %, attendu %', vus, veut;
  end if;
  -- la fonction obtenue doit être EXACTEMENT celle prouvée en local : une faute de
  -- recopie, où qu'elle soit dans le corps, annule la migration.
  if md5(pg_get_functiondef('public.matchs_recherche(date, date, text, text[], text, uuid[], text[], boolean)'::regprocedure))
     <> 'e73fb91e794676172235ecb46db6f392' then
    raise exception 'NEXUS: matchs_recherche obtenue différente de la version prouvée en local';
  end if;
  raise notice 'NEXUS: matchs_recherche — noms NLS tels qu''écrits, ACL %', vus;
end $$;
