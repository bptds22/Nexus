-- Rollback de 20261018140000 : « Retiré » redevient une suppression (côté base), les 4 fonctions
-- reprennent leur corps EXACT d'avant (avec matchs_recherche : 5 fonctions) (empreintes vérifiées après), les listes d'étapes perdent RETIRE.
-- REFUSE si un dossier ou une carte est à l'étape RETIRE, ou si une raison existe : aucune donnée
-- n'est réécrite ni effacée en silence — à traiter à la main avant.
do $$
begin
  if to_regclass('public.retraits_processus') is null then
    raise exception 'NEXUS: 20261018140000 absente — rien à défaire';
  end if;
  if exists (select 1 from public.recruiter_pipeline where stage = 'RETIRE')
  or exists (select 1 from public.cartes_prospect where etape = 'RETIRE')
  or exists (select 1 from public.retraits_processus) then
    raise exception 'NEXUS: des dossiers retirés existent — rollback refusé, rien n''est touché';
  end if;
end $$;

drop trigger retraits_menage on public.recruiter_pipeline;
drop trigger retraits_menage on public.cartes_prospect;
drop function public.retraits_menage_carte();
drop function public.retraits_menage_pipeline();
drop function public.unite_retraits();
drop function public.carte_retirer(uuid, text, text);
drop function public.unite_retirer(uuid, uuid, text, text);
drop table public.retraits_processus;

alter table public.recruiter_pipeline drop constraint chk_recruiter_pipeline_stage;
alter table public.recruiter_pipeline add constraint chk_recruiter_pipeline_stage
  check (stage::text = any (array['IDENTIFIE','CONTACTE','EN_DISCUSSION','VISITE_PLANIFIEE','ENGAGE','LETTRE_SIGNEE']));
alter table public.cartes_prospect drop constraint cartes_prospect_etape_check;
alter table public.cartes_prospect add constraint cartes_prospect_etape_check
  check (etape = any (array['IDENTIFIE','CONTACTE','EN_DISCUSSION','VISITE_PLANIFIEE','ENGAGE','LETTRE_SIGNEE']));

CREATE OR REPLACE FUNCTION public.notify_parent_pipeline_stage()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare v_notify boolean := false;
begin
  -- Lot B1 : pas de notification pour une ligne sœur recopiée.
  if coalesce(current_setting('nexus.sync_unite', true), '') = 'on' then
    return NEW;
  end if;
  if TG_OP = 'INSERT' then
    v_notify := NEW.stage is distinct from 'IDENTIFIE';
    -- Lot B1 : un collègue qui rejoint un dossier déjà à cette étape ne fait
    -- pas progresser le dossier de l'enfant.
    if v_notify and NEW.unite_cegep_id is not null and exists (
         select 1 from public.recruiter_pipeline s
          where s.unite_cegep_id = NEW.unite_cegep_id
            and s.unite_sport_id = NEW.unite_sport_id
            and s.athlete_id = NEW.athlete_id
            and s.id <> NEW.id
            and public.rang_etape(s.stage) >= public.rang_etape(NEW.stage)) then
      v_notify := false;
    end if;
  elsif TG_OP = 'UPDATE' then
    v_notify := OLD.stage is distinct from NEW.stage;
  end if;
  if v_notify then
    perform public.emit_parent_notification(
      NEW.athlete_id, 'CHILD_PIPELINE_STAGE', 'Progression du dossier',
      'Le dossier de votre enfant a progressé : ' || public.pipeline_stage_label_fr(NEW.stage) || '.',
      jsonb_build_object('event','stage','stage',NEW.stage,'recruiter_id',NEW.recruiter_id,'athlete_id',NEW.athlete_id)
    );
  end if;
  return NEW;
end;
$function$

;

CREATE OR REPLACE FUNCTION public.pipeline_stage_label_fr(p_stage text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select case p_stage
    when 'IDENTIFIE'        then 'Identifié'
    when 'CONTACTE'         then 'Contacté'
    when 'EN_DISCUSSION'    then 'En discussion'
    when 'VISITE_PLANIFIEE' then 'Visite planifiée'
    when 'ENGAGE'           then 'Engagé'
    when 'LETTRE_SIGNEE'    then 'Lettre signée'
    else coalesce(p_stage, '—')
  end;
$function$

;

CREATE OR REPLACE FUNCTION public.coach_pipeline_for_my_athletes(p_athlete_ids uuid[] DEFAULT NULL::uuid[], p_stages text[] DEFAULT NULL::text[])
 RETURNS TABLE(athlete_id uuid, recruiter_id uuid, stage text, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  select p.athlete_id, p.recruiter_id, p.stage::text, p.updated_at
    from public.recruiter_pipeline p
   where public.is_coach()
     and (p_athlete_ids is null or p.athlete_id = any(p_athlete_ids))
     and (p_stages      is null or p.stage::text = any(p_stages))
     and (
           exists (select 1 from public.athletes a
                    where a.id = p.athlete_id and a.coach_id = auth.uid())
        or p.athlete_id in (select s.athlete_id from public.get_coach_athletes(true) s)
     );
$function$

;

CREATE OR REPLACE FUNCTION public.recruteurs_suivant_athlete(p_athlete uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  select count(distinct r.recruteur)::int
    from (
      select f.recruiter_id as recruteur from public.recruiter_favorites f where f.athlete_id = p_athlete
      union
      select p.recruiter_id from public.recruiter_pipeline p where p.athlete_id = p_athlete
      union
      -- Carte prospect fusionnée avec CETTE fiche (rapprochement accepté) : son auteur la suit.
      select c.cree_par
        from public.fusions_cartes fc
        join public.cartes_prospect c on c.id = fc.carte_id
       where fc.athlete_id = p_athlete and fc.etat in ('ACTIVE', 'DEFINITIVE')
      union
      select fc.acteur
        from public.fusions_cartes fc
       where fc.athlete_id = p_athlete and fc.etat in ('ACTIVE', 'DEFINITIVE')
    ) r
    join public.users u on u.id = r.recruteur
   where u.role = 'RECRUTEUR'::public.user_role
     and u.status = 'ACTIF'::public.account_status
$function$

;

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
  f text; attendu text; vu text;
begin
  for f, attendu in select * from (values
    ('notify_parent_pipeline_stage',   'cf621b667eb47a7d411c8bf604db506a'),
    ('pipeline_stage_label_fr',        '7339b0f64d5a4a83f7179bb551c7c20b'),
    ('coach_pipeline_for_my_athletes', '0b3150c2a03c7908823671a3c2f54f16'),
    ('recruteurs_suivant_athlete',     'ab50b9b850b34ee34090650ae5e9828a'),
    ('matchs_recherche',               '9e220b8b5fee8d74002c1f66dc84b1ab')) v(f, attendu)
  loop
    select md5(replace(prosrc, E'\r', '')) into vu from pg_proc
     where pronamespace = 'public'::regnamespace and proname = f;
    if vu is distinct from attendu then
      raise exception 'NEXUS: rollback — % ne retrouve pas son corps d''avant (%, attendu %)', f, vu, attendu;
    end if;
  end loop;
end $$;
