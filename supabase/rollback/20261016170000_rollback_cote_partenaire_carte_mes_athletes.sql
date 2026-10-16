-- Rollback de 20261016170000 : retour EXACT à l'état relevé le 2026-10-16 (W2, W3b, W4d, A4a/A5, D1b).
-- Les demandes de visibilité (cloche jeune, portail parent) et leurs lignes de file push sont
-- SUPPRIMÉES : leurs types sortent des listes. Rien d'autre n'est touché.
do $$
begin
  if to_regprocedure('public.cotes_partenaires_athletes(uuid[])') is null then
    raise exception 'NEXUS: lot 20261016170000 absent — rien à défaire';
  end if;
end $$;

drop trigger trg_partenaire_demande_sur_carte on public.partenaire_prospects;
drop trigger trg_partenaire_demande_sur_optin on public.athletes;
drop function public.trg_partenaire_demande_sur_carte();
drop function public.trg_partenaire_demande_sur_optin();
drop function public.accepter_visibilite_partenaire(uuid, text);
drop function public.partenaire_demander_visibilite(uuid);
drop function public.partenaire_regler_demandes_visibilite(uuid);
drop function public.cotes_partenaires_athletes(uuid[]);

delete from public.athlete_notifications where type = 'PARTENAIRE_VISIBILITE_DEMANDE';
delete from public.parent_notifications where type = 'CHILD_PARTNER_VISIBILITY_REQUEST';
alter table public.athlete_notifications drop constraint athlete_notifications_type_check;
alter table public.athlete_notifications add constraint athlete_notifications_type_check
  check (type = any (array['PROFILE_VIEWED', 'ADDED_TO_FAVORITES', 'SUGGESTION_APPROVED', 'SUGGESTION_REJECTED', 'COACH_REPORT_UPDATED', 'COACH_VERIFIED', 'COACH_MODIFIED_PROFILE', 'COACH_DISTINCTION_ADDED', 'COACH_EVALUATION_UPDATED', 'PROFILE_MILESTONE', 'PROFILE_TIP', 'ADMIN_BROADCAST', 'TEAM_INVITATION', 'SCHOOL_CLAIM_REJECTED', 'COACH_CLAIMED', 'AMBASSADEUR_PALIER_3', 'AMBASSADEUR_PALIER_5', 'PARTENAIRE_EVALUATION', 'PARTENAIRE_BADGE', 'PARTENAIRE_EVALUATION_RECUE']::text[]));
alter table public.parent_notifications drop constraint parent_notifications_type_check;
alter table public.parent_notifications add constraint parent_notifications_type_check
  check (type = any (array['CHILD_FAVORITED', 'CHILD_PIPELINE_STAGE', 'CHILD_VISIT_PLANNED']::text[]));
delete from public.push_file where genre = 'VISIBILITE_PARTENAIRE';
alter table public.push_file drop constraint push_file_genre_check;
alter table public.push_file add constraint push_file_genre_check
  check (genre = any (array['BADGE_COACH', 'BADGE_PARTENAIRE', 'EVALUATION_COACH', 'EVALUATION_PARTENAIRE', 'CARTE_PARTENAIRE']::text[]));

CREATE OR REPLACE FUNCTION public.evaluations_partenaires_athlete(p_athlete_id uuid)
 RETURNS TABLE(id uuid, organisation text, cote_globale numeric, leadership integer, discipline integer, coachabilite integer, intelligence_jeu integer, competitivite integer, esprit_equipe integer, resilience integer, attitude_mentalite integer, vitesse_explosivite numeric, force_puissance numeric, endurance_cardio numeric, agilite_coordination numeric, vision_du_jeu numeric, sens_tactique numeric, grille_id uuid, updated_at timestamp with time zone, est_la_mienne boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  with lecteur as (
    select (
         public.is_admin()
      or (public.is_recruiter() and public.athlete_is_active(p_athlete_id))
      or public.coach_can_read_athlete_evals(p_athlete_id)
      or public.is_director_of_athlete_school(p_athlete_id)
      or exists (select 1 from public.athletes a
                  where a.id = p_athlete_id and a.user_id = auth.uid())
    ) as tout
  )
  select pe.id, mp.organization_name, pe.cote_globale,
         pe.leadership, pe.discipline, pe.coachabilite, pe.intelligence_jeu,
         pe.competitivite, pe.esprit_equipe, pe.resilience, pe.attitude_mentalite,
         pe.vitesse_explosivite, pe.force_puissance, pe.endurance_cardio,
         pe.agilite_coordination, pe.vision_du_jeu, pe.sens_tactique,
         pe.grille_id, pe.updated_at,
         (mp.user_id is not distinct from auth.uid())
    from public.partner_evaluations pe
    join public.media_partners mp on mp.id = pe.partner_id and mp.status = 'APPROVED'
    cross join lecteur
   where pe.athlete_id = p_athlete_id
     and auth.uid() is not null
     and (lecteur.tout or mp.user_id = auth.uid())
   order by pe.updated_at desc
$function$;

CREATE OR REPLACE FUNCTION public.badges_partenaires_athlete(p_athlete_id uuid)
 RETURNS TABLE(id uuid, badge_id uuid, libelle text, icone_path text, organisation text, created_at timestamp with time zone, est_masque boolean, est_le_mien boolean, peut_masquer boolean, badge_code text, est_nexus boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
  with lecteur as (
    select
      public.is_admin() as admin,
      (public.coach_can_read_athlete_evals(p_athlete_id)
        or public.is_director_of_athlete_school(p_athlete_id)) as encadrement,
      public.coach_can_award_badge(p_athlete_id) as coach,
      (    public.is_admin()
        or (public.is_recruiter() and public.athlete_is_active(p_athlete_id))
        or public.coach_can_read_athlete_evals(p_athlete_id)
        or public.is_director_of_athlete_school(p_athlete_id)
        or exists (select 1 from public.athletes a
                    where a.id = p_athlete_id and a.user_id = auth.uid())
      ) as tout
  )
  select x.id, coalesce(b.id, n.id), coalesce(b.libelle, n.libelle), b.icone_path, mp.organization_name, x.created_at,
         (x.masque_le is not null),
         (mp.user_id is not distinct from auth.uid()),
         (lecteur.admin or lecteur.coach),
         n.code,
         (n.id is not null)
    from public.partner_athlete_badges x
    join public.media_partners mp on mp.id = x.partner_id and mp.status = 'APPROVED'
    left join public.partner_badges b on b.id = x.partner_badge_id
    left join public.badges n on n.id = x.badge_id
    cross join lecteur
   where x.athlete_id = p_athlete_id
     and x.retire_le is null
     and (b.actif or n.actif)
     and auth.uid() is not null
     and (lecteur.tout or mp.user_id = auth.uid())
     and (x.masque_le is null or lecteur.admin or lecteur.encadrement or mp.user_id = auth.uid())
   order by x.created_at
$function$;

CREATE OR REPLACE FUNCTION public.partenaire_badges_nexus_admissibles(p_athlete_id uuid)
 RETURNS TABLE(badge_id uuid, code text, libelle text, famille text, deja_par text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
declare
  v_sport  uuid;
  v_mp     uuid;
begin
  select a.sport_id into v_sport from public.athletes a where a.id = p_athlete_id;
  if not found then
    raise exception 'NEXUS: athlète introuvable' using errcode = 'P0002';
  end if;
  if not public.is_admin() then
    select mp.id into v_mp from public.media_partners mp where mp.user_id = auth.uid();
    if v_mp is null or not public.partenaire_peut_evaluer(v_mp, v_sport) then
      raise exception 'NEXUS: attribution non permise (permission, sport ou statut du partenaire)' using errcode = '42501';
    end if;
  end if;

  return query
  select b.id, b.code, b.libelle, b.famille,
         case
           when exists (select 1 from public.athlete_badges ab
                         where ab.athlete_id = p_athlete_id and ab.badge_id = b.id and ab.retire_le is null)
             then 'son coach'
           else (select coalesce(mp.organization_name, 'un partenaire')
                   from public.partner_athlete_badges x
                   join public.media_partners mp on mp.id = x.partner_id
                  where x.athlete_id = p_athlete_id and x.badge_id = b.id and x.retire_le is null
                  limit 1)
         end
    from public.badges b
   where b.actif
     and b.famille in ('universel', 'sport')
     and not b.requiert_contexte
     and (b.famille = 'universel'
          or exists (select 1 from public.badge_sports bs where bs.badge_id = b.id and bs.sport_id = v_sport))
   order by case b.famille when 'universel' then 0 else 1 end, b.ordre, b.libelle;
end $function$;

CREATE OR REPLACE FUNCTION public.recruiter_search_athletes(p_search text DEFAULT NULL::text, p_sport_id uuid DEFAULT NULL::uuid, p_promotion integer DEFAULT NULL::integer, p_verified_only boolean DEFAULT false, p_with_video_only boolean DEFAULT false, p_min_gpa numeric DEFAULT NULL::numeric, p_min_rating numeric DEFAULT NULL::numeric, p_ouvert_demenager boolean DEFAULT false, p_ouvert_prive boolean DEFAULT false, p_ouvert_anglophone boolean DEFAULT false, p_new_only boolean DEFAULT false, p_sort_by text DEFAULT 'rating_desc'::text, p_limit integer DEFAULT NULL::integer, p_programme_ids uuid[] DEFAULT NULL::uuid[], p_offert_par_mon_cegep boolean DEFAULT false, p_inclure_partenaires boolean DEFAULT false)
 RETURNS TABLE(id uuid, identity_visible boolean, first_name text, last_name text, photo_url text, numero_jersey text, age integer, annee_diplomation integer, verified boolean, last_profile_validation timestamp with time zone, cote_globale numeric, profile_completion integer, taille_pieds integer, taille_pouces integer, poids_lbs numeric, moyenne_generale numeric, mentions_academiques jsonb, recruitment_status text, statut_recrutement_override text, open_to_offers boolean, a_une_video boolean, context text, created_at timestamp with time zone, sport_nom text, position_nom text, position_abbr text, school_id uuid, school_name text, school_region text, school_type text, committed_school_name text, evaluations jsonb, team_gender text, programmes jsonb, team_division text, team_league text, team_is_rseq boolean, team_school_type text, cote_partenaire numeric, cote_partenaire_organisation text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
DECLARE
  v_tier_ok boolean;
  v_mots    text[];
  v_sort    text;
  v_school  uuid;
BEGIN
  IF NOT public.is_recruiter() THEN
    RAISE EXCEPTION 'acces reserve aux recruteurs' USING ERRCODE = '42501';
  END IF;

  v_tier_ok := public.get_user_tier() IN ('pro', 'all_star');

  -- RECHERCHE TEXTE — ouverte a TOUS les paliers depuis le 2026-09-17, mais la
  -- branche NOM du predicat reste Pro (et identite visible) : voir l'en-tete
  -- de la migration 20260917120000. Mots sans accent, jokers LIKE echappes.
  -- NULL si la saisie est vide.
  SELECT array_agg(replace(replace(replace(
           extensions.unaccent('extensions.unaccent'::regdictionary, m),
           '\', '\\'), '%', '\%'), '_', '\_'))
    INTO v_mots
    FROM regexp_split_to_table(btrim(COALESCE(p_search, '')), '\s+') AS m
   WHERE m <> '';

  -- Oracle ferme pour les Free : le tri alphabetique est rabattu sur la cote —
  -- sinon l'ORDRE trahirait le nom qu'on vient de masquer.
  --
  -- VITRINE : volontairement NON assoupli. La vitrine sort de toute facon en
  -- tete du tri par cote.
  v_sort := CASE WHEN p_sort_by = 'name_asc' AND NOT v_tier_ok
                 THEN 'rating_desc' ELSE p_sort_by END;

  -- Une liste a zero doit toujours pouvoir dire POURQUOI elle est a zero.
  IF p_offert_par_mon_cegep THEN
    SELECT u.school_id INTO v_school FROM public.users u WHERE u.id = auth.uid();
    IF v_school IS NULL THEN
      RAISE EXCEPTION 'NEXUS: aucun cegep rattache a ce compte — le filtre « offert par mon cegep » est indisponible'
        USING ERRCODE = '22023';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.school_programs sp WHERE sp.school_id = v_school) THEN
      RAISE EXCEPTION 'NEXUS: aucun programme au catalogue de ce cegep — le filtre « offert par mon cegep » ne peut rien rendre'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    a.id,
    (public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase)),
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.first_name END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.last_name END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.photo_url END,
    CASE WHEN public.athlete_identity_ok(a.date_naissance, a.consentement_parental) AND (v_tier_ok OR a.is_showcase) THEN a.numero_jersey END,
    CASE WHEN a.date_naissance IS NOT NULL
         THEN EXTRACT(YEAR FROM age(a.date_naissance))::integer END,
    a.annee_diplomation, a.verified, a.last_profile_validation,
    a.cote_globale_entraineur, a.profile_completion,
    a.taille_pieds, a.taille_pouces, a.poids_lbs,
    a.moyenne_generale, a.mentions_academiques,
    a.recruitment_status::text, a.statut_recrutement_override, a.open_to_offers,
    -- « A une vidéo » : l'un des CINQ liens vidéo, non vide (2026-10-03).
    (COALESCE(NULLIF(btrim(a.video_faits_saillants_url), ''), NULLIF(btrim(a.hudl_url), ''),
              NULLIF(btrim(a.youtube_url), ''), NULLIF(btrim(a.video_match_complet_url), ''),
              NULLIF(btrim(a.video_entrainement_url), '')) IS NOT NULL),
    a.context, a.created_at,
    sp.nom, po.nom, po.abreviation,
    a.school_id, sc.name, sc.region, sc.type,
    cs.name,
    -- Badges SANS évaluation (2026-10-03) : l'agrégat ne passait que par
    -- evaluations — un athlète badgé mais jamais évalué perdait ses badges sur
    -- la carte ET dans « Avec distinction » (1 cas en prod). Repli : une ligne
    -- qui ne porte QUE les badges, sans cote (le client n'en lit que les
    -- distinctions).
    COALESCE((SELECT jsonb_agg(jsonb_build_object(
              'cote_globale', ev.cote_globale,
              'distinctions', (select coalesce(jsonb_agg(jsonb_build_object('badge', b2.code, 'detail', ab.contexte, 'libelle', b2.libelle) order by b2.ordre), '[]'::jsonb) from public.athlete_badges ab join public.badges b2 on b2.id = ab.badge_id where ab.athlete_id = ev.athlete_id and ab.retire_le is null),
              'updated_at',   ev.updated_at))
       FROM public.evaluations ev
      WHERE ev.athlete_id = a.id),
     (SELECT jsonb_build_array(jsonb_build_object(
               'cote_globale', NULL,
               'distinctions', jsonb_agg(jsonb_build_object('badge', b2.code, 'detail', ab.contexte, 'libelle', b2.libelle) ORDER BY b2.ordre),
               'updated_at',   NULL))
        FROM public.athlete_badges ab JOIN public.badges b2 ON b2.id = ab.badge_id
       WHERE ab.athlete_id = a.id AND ab.retire_le IS NULL
      HAVING count(*) > 0)),
    tm.gender,
    -- Projection : sans elle le filtre est aveugle. Le LIBELLE choisi par
    -- l'athlete, pas le nom ministeriel.
    (SELECT jsonb_agg(jsonb_build_object(
              'id', l.id, 'label', l.label, 'code', p.code, 'program_id', p.id)
              ORDER BY idx.ord)
       FROM unnest(a.programmes_vises) WITH ORDINALITY AS idx(lid, ord)
       JOIN public.cegep_program_labels l ON l.id = idx.lid
       JOIN public.cegep_programs       p ON p.id = l.program_id),
    -- LOT 3 — meme jointure qu'au-dessus, quatre colonnes de plus.
    tm.division,
    tm.league,
    (tm.rseq_team_id IS NOT NULL),
    tsc.type,
    -- W2 — l'évaluation PARTENAIRE, à part : jamais fusionnée dans cote_globale
    -- (qui reste la note du coach, lue telle quelle par les binaires mobiles).
    pe.cote_globale,
    pe.organisation
  FROM public.athletes a
  LEFT JOIN public.sports        sp ON sp.id = a.sport_id
  LEFT JOIN public.positions     po ON po.id = a.position_id
  LEFT JOIN public.schools       sc ON sc.id = a.school_id
  LEFT JOIN public.schools       cs ON cs.id = a.committed_school_id
  LEFT JOIN public.team_athletes ta ON ta.athlete_id = a.id
  LEFT JOIN public.teams         tm ON tm.id = ta.team_id
  -- L'ecole de L'EQUIPE, pas celle de l'athlete : les deux divergent deja en
  -- prod (2 athletes au 2026-09-07). `teams.school_id` est NOT NULL, donc
  -- `team_school_type` non nul <=> l'athlete a une equipe.
  LEFT JOIN public.schools       tsc ON tsc.id = tm.school_id
  -- W2 — la plus récente évaluation d'un partenaire APPROUVÉ. Une seule ligne
  -- (LIMIT 1) : le join ne multiplie rien.
  LEFT JOIN LATERAL (
    SELECT pev.cote_globale, mp.organization_name AS organisation
      FROM public.partner_evaluations pev
      JOIN public.media_partners mp ON mp.id = pev.partner_id AND mp.status = 'APPROVED'
     WHERE pev.athlete_id = a.id
     ORDER BY pev.updated_at DESC
     LIMIT 1) pe ON true
  WHERE a.status = 'ACTIF'::public.account_status
    -- D1b (2026-10-15) : une fiche sans prénom, sans nom, ou au nom recopié de Google et pas encore
    -- confirmé par l'athlète, n'apparaît pas dans la recherche.
    AND COALESCE(btrim(a.first_name), '') <> '' AND COALESCE(btrim(a.last_name), '') <> ''
    AND NOT a.nom_a_confirmer
    -- RECHERCHE PAR MOTS (2026-09-17). Lu : « aucun mot saisi n'est introuvable ».
    -- Un mot est trouve s'il figure dans :
    --   · le prenom ou le nom — PRO SEULEMENT et IDENTITE VISIBLE (oracle ferme) ;
    --   · l'ecole de l'athlete, l'ecole de son equipe, ou son equipe — tous paliers.
    AND (v_mots IS NULL OR NOT EXISTS (
          SELECT 1
            FROM unnest(v_mots) AS mot
           WHERE NOT COALESCE(
                   (    v_tier_ok
                    AND public.athlete_identity_ok(a.date_naissance, a.consentement_parental)
                    AND (   extensions.unaccent('extensions.unaccent'::regdictionary, a.first_name) ILIKE '%' || mot || '%'
                         OR extensions.unaccent('extensions.unaccent'::regdictionary, a.last_name)  ILIKE '%' || mot || '%'))
                   OR extensions.unaccent('extensions.unaccent'::regdictionary, sc.name)  ILIKE '%' || mot || '%'
                   OR extensions.unaccent('extensions.unaccent'::regdictionary, tsc.name) ILIKE '%' || mot || '%'
                   OR extensions.unaccent('extensions.unaccent'::regdictionary, tm.name)  ILIKE '%' || mot || '%',
                 false)))
    AND (p_sport_id  IS NULL OR a.sport_id = p_sport_id)
    AND (p_promotion IS NULL OR a.annee_diplomation = p_promotion)
    AND (NOT p_verified_only    OR a.verified = true)
    AND (NOT p_with_video_only  OR (COALESCE(NULLIF(btrim(a.video_faits_saillants_url), ''), NULLIF(btrim(a.hudl_url), ''),
              NULLIF(btrim(a.youtube_url), ''), NULLIF(btrim(a.video_match_complet_url), ''),
              NULLIF(btrim(a.video_entrainement_url), '')) IS NOT NULL))
    AND (p_min_gpa    IS NULL OR a.moyenne_generale >= p_min_gpa)
    -- W2 — cote du coach si elle existe, sinon celle du partenaire (décision BP),
    -- seulement si l'appelant le demande (web). Sinon : cote du coach seule,
    -- comme avant W2 (binaires mobiles publiés).
    AND (p_min_rating IS NULL OR
         CASE WHEN p_inclure_partenaires THEN COALESCE(a.cote_globale_entraineur, pe.cote_globale)
              ELSE a.cote_globale_entraineur END >= p_min_rating)
    AND (NOT p_ouvert_demenager  OR a.pret_changer_region = true)
    AND (NOT p_ouvert_prive      OR a.ouvert_cegep_prive = true)
    AND (NOT p_ouvert_anglophone OR a.ouvert_cegep_anglophone = true)
    AND (NOT p_new_only OR a.created_at >= now() - INTERVAL '10 days')
    -- Comparaison au niveau du PROGRAMME, pas du libelle.
    AND (p_programme_ids IS NULL OR EXISTS (
          SELECT 1 FROM public.cegep_program_labels l
           WHERE l.id = ANY(a.programmes_vises)
             AND l.program_id = ANY(p_programme_ids)))
    AND (NOT p_offert_par_mon_cegep OR EXISTS (
          SELECT 1
            FROM public.cegep_program_labels l
            JOIN public.school_programs spx ON spx.program_id = l.program_id
           WHERE l.id = ANY(a.programmes_vises)
             AND spx.school_id = v_school
             AND spx.is_displayed))
  ORDER BY
    CASE WHEN v_sort = 'rating_desc' THEN
      CASE WHEN p_inclure_partenaires THEN COALESCE(a.cote_globale_entraineur, pe.cote_globale)
           ELSE a.cote_globale_entraineur END END DESC NULLS LAST,
    CASE WHEN v_sort = 'rating_asc'  THEN
      CASE WHEN p_inclure_partenaires THEN COALESCE(a.cote_globale_entraineur, pe.cote_globale)
           ELSE a.cote_globale_entraineur END END ASC  NULLS LAST,
    CASE WHEN v_sort = 'grad_asc'    THEN a.annee_diplomation END ASC,
    CASE WHEN v_sort = 'grad_desc'   THEN a.annee_diplomation END DESC,
    CASE WHEN v_sort = 'name_asc'    THEN a.last_name END ASC,
    a.id
  LIMIT CASE WHEN p_limit IS NULL OR p_limit < 0 THEN NULL ELSE p_limit END;
END;
$function$;

CREATE OR REPLACE FUNCTION public.push_textes(p_genre text, p_source_nom text, p_n integer, p_libelle text)
 RETURNS TABLE(titre text, texte text)
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  select
    case
      when p_genre in ('BADGE_COACH', 'BADGE_PARTENAIRE') and p_n > 1 then p_n || ' nouveaux badges'
      when p_genre in ('BADGE_COACH', 'BADGE_PARTENAIRE') then 'Nouveau badge'
      when p_genre in ('EVALUATION_COACH', 'EVALUATION_PARTENAIRE') then 'Nouvelle évaluation'
      when p_genre = 'CARTE_PARTENAIRE' then coalesce(nullif(btrim(p_source_nom), ''), 'Un partenaire') || ' t''a évalué. C''est toi ?'
    end,
    case
      when p_genre = 'BADGE_PARTENAIRE' and p_n > 1 then
        p_n || ' nouveaux badges de ' || coalesce(nullif(btrim(p_source_nom), ''), 'un partenaire') || '.'
      when p_genre = 'BADGE_PARTENAIRE' and nullif(btrim(p_libelle), '') is not null then
        'Tu as reçu le badge ' || btrim(p_libelle) || ' de ' || coalesce(nullif(btrim(p_source_nom), ''), 'un partenaire') || '.'
      when p_genre = 'BADGE_PARTENAIRE' then
        'Tu as reçu un badge de ' || coalesce(nullif(btrim(p_source_nom), ''), 'un partenaire') || '.'
      when p_genre = 'BADGE_COACH' and p_n > 1 then
        p_n || ' nouveaux badges de ' || coalesce('ton coach ' || nullif(btrim(p_source_nom), ''), 'ton entraîneur') || '.'
      when p_genre = 'BADGE_COACH' then
        coalesce('Ton coach ' || nullif(btrim(p_source_nom), ''), 'Ton entraîneur') || ' t''a donné un badge.'
      when p_genre = 'EVALUATION_COACH' then
        coalesce('Ton coach ' || nullif(btrim(p_source_nom), ''), 'Ton entraîneur') || ' t''a évalué.'
      when p_genre = 'EVALUATION_PARTENAIRE' then
        coalesce(nullif(btrim(p_source_nom), ''), 'Un partenaire') || ' t''a évalué.'
      when p_genre = 'CARTE_PARTENAIRE' then 'Réponds dans l''appli Nexus ou sur nexussports.ca.'
    end
$function$;

CREATE OR REPLACE FUNCTION public.push_traiter_file(p_maintenant timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
 SET row_security TO 'off'
AS $function$
declare
  g          record;
  v_ids      bigint[];
  v_n        integer;
  v_titre    text;
  v_texte    text;
  v_envoi    bigint;
  v_collapse text;
  v_envoyes  integer := 0;
  v_elements integer := 0;
  v_annules  integer := 0;
  v_pref     integer := 0;
  v_jeton    integer := 0;
  v_k        integer;
begin
  if public.push_heure_calme(p_maintenant) then
    return jsonb_build_object('heures_calmes', true,
                              'en_attente', (select count(*) from public.push_file where statut = 'EN_ATTENTE'));
  end if;

  -- Carte partenaire qui n'attend plus de réponse (caduque, confirmée, infirmée) : rien ne part.
  update public.push_file f
     set statut = 'ANNULE', traite_le = p_maintenant
   where f.statut = 'EN_ATTENTE' and f.genre = 'CARTE_PARTENAIRE'
     and not exists (
       select 1
         from public.athlete_notifications n
         join public.partenaire_prospects_rapprochements r
           on r.carte_id::text = n.metadata->>'carte_id' and r.athlete_id = n.athlete_id
        where n.id::text = f.detail->>'notification_id'
          and not coalesce((n.metadata->>'caduque')::boolean, false)
          and r.statut = 'PROPOSE');
  get diagnostics v_k = row_count;
  v_annules := v_annules + v_k;

  -- Compte qui n'est plus actif : rien ne part.
  update public.push_file f
     set statut = 'ANNULE', traite_le = p_maintenant
    from public.users u
   where f.statut = 'EN_ATTENTE' and u.id = f.user_id and u.status <> 'ACTIF'::public.account_status;
  get diagnostics v_k = row_count;
  v_annules := v_annules + v_k;

  for g in
    select f.user_id, f.cle, max(f.categorie) as categorie, max(f.genre) as genre,
           max(f.source_nom) as source_nom
      from public.push_file f
     where f.statut = 'EN_ATTENTE'
     group by f.user_id, f.cle
    having min(f.cree_le) <= p_maintenant - interval '10 minutes'
     order by min(f.cree_le)
  loop
    select array_agg(s.id order by s.id) into v_ids
      from (select id from public.push_file
             where statut = 'EN_ATTENTE' and user_id = g.user_id and cle = g.cle
             for update skip locked) s;
    if v_ids is null then
      continue;
    end if;
    v_n := array_length(v_ids, 1);

    if exists (select 1 from public.push_preferences p
                where p.user_id = g.user_id and p.categorie = g.categorie and not p.actif) then
      update public.push_file set statut = 'PREFERENCE', traite_le = p_maintenant where id = any (v_ids);
      v_pref := v_pref + v_n;
      continue;
    end if;

    if not exists (select 1 from public.device_tokens d where d.user_id = g.user_id) then
      update public.push_file set statut = 'SANS_JETON', traite_le = p_maintenant where id = any (v_ids);
      v_jeton := v_jeton + v_n;
      continue;
    end if;

    select t.titre, t.texte into v_titre, v_texte
      from public.push_textes(g.genre, g.source_nom, v_n,
                              (select f.detail->>'libelle' from public.push_file f where f.id = v_ids[1])) t;

    insert into public.push_envois (user_id, categorie, cle, titre, texte, collapse_id, nb_elements, envoye_le)
    values (g.user_id, g.categorie, g.cle, v_titre, v_texte, 'nx-en-attente', v_n, p_maintenant)
    returning id into v_envoi;
    -- Une carte proposée de nouveau remplace son push précédent ; le reste ne remplace rien.
    v_collapse := case when g.genre = 'CARTE_PARTENAIRE' then 'nx-' || g.cle else 'nx-envoi-' || v_envoi end;
    update public.push_envois set collapse_id = v_collapse where id = v_envoi;

    perform public.push_to_user(g.user_id, v_titre, v_texte,
              jsonb_build_object('type', 'announcement', 'categorie', g.categorie, 'envoi_id', v_envoi)
                || public.push_destination(g.genre),
              v_collapse);

    update public.push_file set statut = 'ENVOYE', traite_le = p_maintenant, envoi_id = v_envoi
     where id = any (v_ids);
    v_envoyes := v_envoyes + 1;
    v_elements := v_elements + v_n;
  end loop;

  -- Purge : la file traitée est gardée 90 jours, le journal 180.
  delete from public.push_file where statut <> 'EN_ATTENTE' and traite_le < p_maintenant - interval '90 days';
  delete from public.push_envois where envoye_le < p_maintenant - interval '180 days';

  return jsonb_build_object('heures_calmes', false, 'pushs', v_envoyes, 'elements', v_elements,
                            'annules', v_annules, 'preference', v_pref, 'sans_jeton', v_jeton,
                            'en_attente', (select count(*) from public.push_file where statut = 'EN_ATTENTE'));
end;
$function$;

drop function public.partenaire_mes_athletes();

create function public.partenaire_mes_athletes()
returns table (
  athlete_id uuid, prenom text, nom text, sport text, ecole text,
  evaluation_id uuid, cote_globale numeric, evaluee_le timestamptz,
  badges jsonb, derniere_action timestamptz)
language sql
stable
security definer
set search_path = public
set row_security = off
as $$
  with mes as (
    select mp.id from public.media_partners mp where mp.user_id = auth.uid()
  ), cibles as (
    select pe.athlete_id from public.partner_evaluations pe where pe.partner_id in (select id from mes)
    union
    select pab.athlete_id from public.partner_athlete_badges pab
     where pab.partner_id in (select id from mes) and pab.retire_le is null
  )
  select a.id, a.first_name, a.last_name, s.nom, sc.name,
         ev.id, ev.cote_globale, ev.updated_at,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'attribution_id', pab.id,
                    'libelle', coalesce(pb.libelle, b.libelle),
                    'nexus', pab.badge_id is not null,
                    'code', b.code,
                    'icone_path', pb.icone_path,
                    'masque', pab.masque_le is not null,
                    'le', pab.created_at) order by pab.created_at desc)
             from public.partner_athlete_badges pab
             left join public.partner_badges pb on pb.id = pab.partner_badge_id
             left join public.badges b on b.id = pab.badge_id
            where pab.athlete_id = a.id and pab.partner_id in (select id from mes) and pab.retire_le is null), '[]'::jsonb),
         greatest(ev.updated_at,
                  (select max(pab.created_at) from public.partner_athlete_badges pab
                    where pab.athlete_id = a.id and pab.partner_id in (select id from mes) and pab.retire_le is null))
    from cibles c
    join public.athletes a on a.id = c.athlete_id
    left join public.sports s on s.id = a.sport_id
    left join public.schools sc on sc.id = a.school_id
    left join lateral (
      select pe.id, pe.cote_globale, pe.updated_at from public.partner_evaluations pe
       where pe.athlete_id = a.id and pe.partner_id in (select id from mes)
       order by pe.updated_at desc limit 1) ev on true
   where public.partenaire_voit_athlete(a.id)
   order by 10 desc nulls last, a.last_name, a.first_name
$$;


revoke all on function public.partenaire_mes_athletes() from public, anon, authenticated;
grant execute on function public.partenaire_mes_athletes() to authenticated, service_role;

do $$
begin
  if exists (
    select 1
      from (values
        ('public.partenaire_mes_athletes()', '71a92e788d13bc85ee8d9d9baa675e30'),
        ('public.evaluations_partenaires_athlete(uuid)', '33d0544f27a8b62fa9e21902f2e62310'),
        ('public.badges_partenaires_athlete(uuid)', '6baa5e2d5c2f219a0bd1baac97f99e72'),
        ('public.partenaire_badges_nexus_admissibles(uuid)', 'd55783f816d54757ee2e18c94e7d3757'),
        ('public.recruiter_search_athletes(text,uuid,integer,boolean,boolean,numeric,numeric,boolean,boolean,boolean,boolean,text,integer,uuid[],boolean,boolean)', '957289faec17d8e027681a155ba80bc7'),
        ('public.push_textes(text,text,integer,text)', 'd8b270c9d129866b636e4d9ee1bbe8a3'),
        ('public.push_traiter_file(timestamptz)', '8e7bfc261e8041074486d5395f17b198')
      ) as v(f, attendu)
     where (select md5(replace(p.prosrc, E'\r', '')) from pg_proc p where p.oid = to_regprocedure(v.f)) is distinct from v.attendu)
  then
    raise exception 'NEXUS: rollback — une fonction n''est pas revenue à l''identique';
  end if;
  if (select md5(pg_get_constraintdef(oid)) from pg_constraint where conname = 'athlete_notifications_type_check')
       is distinct from 'f7c3e05c8d78780c77afe27967fedb61'
     or (select md5(pg_get_constraintdef(oid)) from pg_constraint where conname = 'parent_notifications_type_check')
       is distinct from '521852a6656bff4344aae982c7623209'
     or (select md5(pg_get_constraintdef(oid)) from pg_constraint where conname = 'push_file_genre_check')
       is distinct from '2e673d7536774b4c181d9897db778521' then
    raise exception 'NEXUS: rollback — contraintes de type non restaurées';
  end if;
  if (select array_agg(t.g order by t.g)
        from pg_proc pr,
             lateral (select coalesce(nullif(split_part(x, '=', 1), ''), 'PUBLIC') as g from unnest(pr.proacl::text[]) as x) t
       where pr.oid = 'public.partenaire_mes_athletes()'::regprocedure)
     is distinct from array['authenticated', 'postgres', 'service_role'] then
    raise exception 'NEXUS: rollback — ACL de partenaire_mes_athletes';
  end if;
  raise notice 'NEXUS rollback 20261016170000 : retour à l''état relevé — OK';
end $$;
