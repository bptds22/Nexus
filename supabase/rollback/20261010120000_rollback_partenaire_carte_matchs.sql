-- Rollback de 20261010120000_partenaire_carte_matchs.sql : retire tout l'ajout partenaire et redonne à
-- matchs_recherche et matchs_suggestions leurs définitions de 20261010003908.

DROP FUNCTION public.matchs_recherche(date, date, text, text[], text, uuid[], text[], boolean);
CREATE FUNCTION public.matchs_recherche(p_debut date, p_fin date, p_sport text DEFAULT NULL::text, p_types text[] DEFAULT NULL::text[], p_texte text DEFAULT NULL::text, p_equipes uuid[] DEFAULT NULL::uuid[], p_lieux text[] DEFAULT NULL::text[])
 RETURNS TABLE(id uuid, jour date, heure text, domicile text, visiteur text, terrain text, sport text, categorie text, division text, ligue text, type text, lat double precision, lon double precision, nb_profils integer, cible boolean, ajoute boolean)
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
  -- 31 jours au plus (BP 2026-10-09) : 360 ms côté base sur la période à venir la plus chargée
  -- (2026-10-09 → 11-08, 3 804 matchs, ~418 terrains), mesure prod du 2026-10-09.
  if not v_pastilles and p_fin - p_debut > 30 then
    raise exception 'NEXUS: 31 jours au plus (reçu % jours)', p_fin - p_debut + 1 using errcode = '22023';
  end if;
  -- Avec pastilles : une saison, pas davantage (borne de sûreté).
  if v_pastilles and p_fin - p_debut > 400 then
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
end $function$;

revoke all on function public.matchs_recherche(date, date, text, text[], text, uuid[], text[]) from public, anon, authenticated;
grant execute on function public.matchs_recherche(date, date, text, text[], text, uuid[], text[]) to authenticated, service_role;

CREATE OR REPLACE FUNCTION public.matchs_suggestions(p_texte text, p_sport text DEFAULT NULL::text, p_types text[] DEFAULT NULL::text[], p_categorie text DEFAULT NULL::text, p_division text DEFAULT NULL::text)
 RETURNS TABLE(genre text, cle text, libelle text, detail text, nb_matchs integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
-- Suggestions du champ « Équipe, terrain… » de la carte des matchs (BP 2026-10-09).
-- Loi 25 : ÉQUIPES et TERRAINS seulement — aucune table d'athlètes n'est lue.
-- LES FILTRES S'APPLIQUENT PARTOUT (BP 2026-10-09, retour sur « la pastille gagne ») : une
-- équipe ou un terrain n'est proposé que s'il a un match à venir qui passe les filtres en
-- place — Sport (alias Ultimate), Type, Catégorie, Division —, avec les mêmes règles que
-- matchs_recherche et que la page. Le nombre affiché compte ces matchs-là.
-- Texte : accents et ponctuation ignorés (lieu_normalise), chaque mot doit figurer, et
-- « saint » / « sainte » valent « st » / « ste » des deux côtés (« st-jean » trouve
-- « Saint-Jean-Eudes », « saint jean » trouve « St-Jean-Vianney »). 8 équipes, 8 terrains.
-- Toutes les règles sont évaluées sur les VALEURS DISTINCTES (sports, secteurs, catégories,
-- divisions, noms) puis comparées telles quelles : jamais de lieu_normalise par match.
#variable_conflict use_column
declare
  v_mots text[];
  v_sport text := case when public.lieu_normalise(p_sport) like 'ultimate%' then 'ultimate'
                       else public.lieu_normalise(p_sport) end;
  v_libelles text[];
  v_coll text[];
  v_sec text[];
  v_cats text[];
  v_divs text[];
begin
  if auth.uid() is null
     or not exists (select 1 from public.users u
                     where u.id = auth.uid() and u.role = 'RECRUTEUR'::public.user_role)
     or not public.user_has_pro() then
    raise exception 'NEXUS: réservé aux recruteurs Pro' using errcode = '42501';
  end if;
  v_mots := array_remove(string_to_array(
              regexp_replace(regexp_replace(coalesce(public.lieu_normalise(p_texte), ''),
                '\msainte\M', 'ste', 'g'), '\msaint\M', 'st', 'g'), ' '), '');
  if cardinality(v_mots) = 0 or length(array_to_string(v_mots, '')) < 2 then
    return;
  end if;

  -- Valeurs distinctes des matchs à venir, une fois.
  select array_agg(x.sector) filter (where public.lieu_normalise(x.sector) = 'collegial'),
         array_agg(x.sector) filter (where public.lieu_normalise(x.sector) = 'secondaire')
    into v_coll, v_sec
    from (select distinct gm.sector from public.games gm where gm.game_date >= current_date and gm.sector is not null) x;
  if v_sport is not null then
    select array_agg(x.sport) into v_libelles
      from (select distinct gm.sport from public.games gm where gm.game_date >= current_date) x
     where (case when public.lieu_normalise(x.sport) like 'ultimate%' then 'ultimate'
                 else public.lieu_normalise(x.sport) end) = v_sport;
  end if;
  if public.lieu_normalise(p_categorie) is not null then
    select array_agg(x.category) into v_cats
      from (select distinct gm.category from public.games gm where gm.game_date >= current_date) x
     where public.lieu_normalise(x.category) = public.lieu_normalise(p_categorie);
  end if;
  if public.lieu_normalise(p_division) is not null then
    select array_agg(x.division) into v_divs
      from (select distinct gm.division from public.games gm where gm.game_date >= current_date) x
     where public.lieu_normalise(x.division) = public.lieu_normalise(p_division);
  end if;

  return query
  with futurs as (
    select gm.home_team_id, gm.visitor_team_id, gm.venue, t.le_type
      from public.games gm,
           lateral (select case
                      when gm.source_nom in ('LFMM', 'QBFL', 'QMFL', 'QMJFL')
                           or (gm.sector is null and gm.source_nom is distinct from 'RSEQ') then 'CIVIL'
                      when gm.sector = any (coalesce(v_coll, '{}')) then 'COLLEGIAL'
                      when gm.sector = any (coalesce(v_sec, '{}')) then 'SECONDAIRE'
                    end as le_type) t
     where gm.game_date >= current_date
       and (v_sport is null or gm.sport = any (coalesce(v_libelles, '{}')))
       and (p_types is null or t.le_type = any (p_types))
       and (public.lieu_normalise(p_categorie) is null or gm.category = any (coalesce(v_cats, '{}')))
       and (public.lieu_normalise(p_division) is null or gm.division = any (coalesce(v_divs, '{}')))
  ),
  par_equipe as (
    select x.team_id, count(*)::int as n, mode() within group (order by f.le_type) as le_type
      from futurs f, lateral (values (f.home_team_id), (f.visitor_team_id)) x(team_id)
     where x.team_id is not null
     group by x.team_id
  ),
  -- Équipes : le libellé « équipe + école » est normalisé UNE fois par équipe, dans une
  -- étape matérialisée — sinon le planificateur le recalcule pour le filtre ET pour le tri.
  eq as materialized (
    select pe.team_id, pe.n, pe.le_type, t.name, t.sport_id, t.age_group, t.gender, t.division, s.name as ecole,
           regexp_replace(regexp_replace(coalesce(public.lieu_normalise(t.name || ' ' || coalesce(s.name, '')), ''),
             '\msainte\M', 'ste', 'g'), '\msaint\M', 'st', 'g') as norm
      from par_equipe pe
      join public.teams t on t.id = pe.team_id
      left join public.schools s on s.id = t.school_id
  ),
  equipes as (
    select 'EQUIPE'::text as genre, eq.team_id::text as cle, btrim(eq.name) as libelle,
           concat_ws(' · ',
                     case eq.le_type when 'CIVIL' then 'Civil' when 'COLLEGIAL' then 'Collégial' when 'SECONDAIRE' then 'Secondaire' end,
                     nullif(btrim(eq.ecole), ''),
                     nullif(concat_ws(' ', sp.nom, nullif(btrim(eq.age_group), ''), nullif(btrim(eq.gender), '')), ''),
                     nullif(btrim(eq.division), '')) as detail,
           eq.n as nb_matchs,
           eq.norm as norm_nom
      from eq
      left join public.sports sp on sp.id = eq.sport_id
     where (select bool_and(strpos(eq.norm, m) > 0) from unnest(v_mots) m)
  ),
  -- Terrains : on normalise chaque NOM distinct une fois (quelques centaines), pas chaque match.
  brut as (
    select btrim(f.venue) as v, f.home_team_id, f.le_type, count(*)::int as n
      from futurs f
     where nullif(btrim(f.venue), '') is not null
     group by 1, 2, 3
  ),
  noms as materialized (
    select x.v, public.lieu_normalise(x.v) as cle from (select distinct v from brut) x
  ),
  par_lieu as (
    select nm.cle,
           (array_agg(b.v order by b.n desc, b.v))[1] as libelle,
           mode() within group (order by nullif(btrim(s.city), '')) as ville,
           array_to_string(array_agg(distinct
             case b.le_type when 'CIVIL' then 'Civil' when 'COLLEGIAL' then 'Collégial' when 'SECONDAIRE' then 'Secondaire' end)
             filter (where b.le_type is not null), ' / ') as types,
           sum(b.n)::int as n
      from brut b
      join noms nm on nm.v = b.v
      left join public.teams th on th.id = b.home_team_id
      left join public.schools s on s.id = th.school_id
     where nm.cle is not null
     group by nm.cle
  ),
  terrains as (
    select 'TERRAIN'::text as genre, pl.cle, pl.libelle, concat_ws(' · ', pl.ville, nullif(pl.types, '')) as detail,
           pl.n as nb_matchs,
           regexp_replace(regexp_replace(pl.cle || ' ' || coalesce(public.lieu_normalise(pl.ville), ''),
             '\msainte\M', 'ste', 'g'), '\msaint\M', 'st', 'g') as norm_nom
      from par_lieu pl
  )
  (select e.genre, e.cle, e.libelle, e.detail, e.nb_matchs from equipes e
    order by (e.norm_nom like v_mots[1] || '%') desc, e.nb_matchs desc, e.libelle limit 8)
  union all
  (select l.genre, l.cle, l.libelle, l.detail, l.nb_matchs from terrains l
    where (select bool_and(strpos(l.norm_nom, m) > 0) from unnest(v_mots) m)
    order by (l.norm_nom like v_mots[1] || '%') desc, l.nb_matchs desc, l.libelle limit 8);
end $function$;

DROP FUNCTION public.matchs_profils_partenaire(uuid);
DROP FUNCTION public.agenda_matchs_unite(text);
DROP FUNCTION public.agenda_matchs_partenaire(text);
DROP FUNCTION public.agenda_flux_partenaire_existe(text);
DROP FUNCTION public.agenda_jeton_partenaire_revoquer();
DROP FUNCTION public.agenda_jeton_partenaire_etat();
DROP FUNCTION public.agenda_jeton_partenaire_creer();
DROP TABLE public.agenda_jetons_partenaire;
DROP TABLE public.matchs_ajoutes_partenaire;
DROP FUNCTION public.partenaire_admis_id(uuid);
DROP FUNCTION public.partenaire_admis();

do $$
declare vus text[];
begin
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.matchs_recherche(date, date, text, text[], text, uuid[], text[])'::regprocedure;
  if vus is distinct from array['authenticated', 'postgres', 'service_role'] then
    raise exception 'NEXUS: ACL de public.matchs_recherche(date, date, text, text[], text, uuid[], text[]) = %, attendu %', vus, array['authenticated', 'postgres', 'service_role'];
  end if;
end $$;
do $$
declare vus text[];
begin
  select array_agg(t.g order by t.g) into vus
    from pg_proc pr,
         lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g
                    from unnest(pr.proacl::text[]) as x) t
   where pr.oid = 'public.matchs_suggestions(text, text, text[], text, text)'::regprocedure;
  if vus is distinct from array['authenticated', 'postgres', 'service_role'] then
    raise exception 'NEXUS: ACL de public.matchs_suggestions(text, text, text[], text, text) = %, attendu %', vus, array['authenticated', 'postgres', 'service_role'];
  end if;
end $$;

notify pgrst, 'reload schema';
