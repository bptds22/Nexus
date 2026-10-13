-- Rollback de 20261013094804_w0_partner_athlete_profile_actif.sql : rend la définition live
-- relevée avant (sans filtre de statut). CREATE OR REPLACE : ACL conservée.

CREATE OR REPLACE FUNCTION public.partner_athlete_profile(p_athlete_id uuid)
 RETURNS TABLE(id uuid, first_name text, last_name text, photo_url text, numero_jersey text, age integer, genre text, annee_diplomation integer, verified boolean, last_profile_validation timestamp with time zone, cote_globale numeric, taille_pieds integer, taille_pouces integer, poids_lbs numeric, bio text, sport_nom text, position_nom text, position_abbr text, school_name text, school_region text, school_city text, school_type text, is_civil boolean, team_name text, league_name text, distinctions jsonb, video_faits_saillants_url text, hudl_url text, youtube_url text, badges jsonb, profile_completion integer, envergure text, taille_mains text, main_dominante text, pied_dominant text, test_40_verges text, saut_vertical text, saut_longueur text, developpe_couche text, navette_agilite text, sprint_100m text, video_match_complet_url text, video_entrainement_url text, parcours_equipes jsonb, eval_id uuid, eval_grille_id uuid, eval_cote_globale numeric, vitesse_explosivite numeric, force_puissance numeric, endurance_cardio numeric, agilite_coordination numeric, vision_du_jeu numeric, sens_tactique numeric, leadership integer, discipline integer, coachabilite integer, intelligence_jeu integer, competitivite integer, esprit_equipe integer, resilience integer, attitude_mentalite integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select
    a.id, a.first_name, a.last_name, a.photo_url, a.numero_jersey,
    extract(year from age(a.date_naissance))::int as age,
    a.genre, a.annee_diplomation, a.verified, a.last_profile_validation,
    -- LOT 2 : la préséance du recruteur, décidée UNE fois, côté serveur.
    coalesce(e.cote_globale, a.cote_globale_entraineur) as cote_globale,
    a.taille_pieds, a.taille_pouces, a.poids_lbs,
    a.bio, s.nom, p.nom, p.abreviation, sch.name, sch.region, sch.city, sch.type,
    (a.school_id is null or sch.type = 'LIGUE_CIVILE') as is_civil,
    t.name  as team_name,
    t.league as league_name,
    e.distinctions,
    a.video_faits_saillants_url, a.hudl_url, a.youtube_url,
    ( select coalesce(jsonb_agg(jsonb_build_object(
               'code', x.code, 'libelle', x.libelle, 'famille', x.famille,
               'contexte', x.contexte, 'attribue_le', x.attribue_le)
             order by x.rang, x.ordre, x.attribue_le), '[]'::jsonb)
        from ( select b2.code, b2.libelle, b2.famille, ab.contexte,
                      ab.created_at as attribue_le, b2.ordre,
                      case b2.famille when 'honneur' then 0 when 'universel' then 1 else 2 end as rang
                 from public.athlete_badges ab
                 join public.badges b2 on b2.id = ab.badge_id
                where ab.athlete_id = a.id and ab.retire_le is null) x
    ) as badges,
    a.profile_completion,
    a.envergure, a.taille_mains, a.main_dominante, a.pied_dominant,
    a.test_40_verges, a.saut_vertical, a.saut_longueur,
    a.developpe_couche, a.navette_agilite, a.sprint_100m,
    a.video_match_complet_url, a.video_entrainement_url,
    a.parcours_equipes,
    e.id, e.grille_id, e.cote_globale,
    e.vitesse_explosivite, e.force_puissance, e.endurance_cardio,
    e.agilite_coordination, e.vision_du_jeu, e.sens_tactique,
    e.leadership, e.discipline, e.coachabilite,
    e.intelligence_jeu, e.competitivite, e.esprit_equipe,
    e.resilience, e.attitude_mentalite
  from public.athletes a
  left join public.sports    s   on s.id   = a.sport_id
  left join public.positions p   on p.id   = a.position_id
  left join public.schools   sch on sch.id = a.school_id
  -- team_athletes porte UNIQUE (athlete_id) : la jointure est 1:0..1, aucune
  -- duplication possible (verifie 2026-08-19, 0 athlete multi-equipes).
  left join public.team_athletes ta on ta.athlete_id = a.id
  left join public.teams         t  on t.id = ta.team_id
  left join lateral (
    -- L'ÉVALUATION RETENUE — même clé que selectBestEvaluation côté front
    -- (`updated_at desc`) : la divergence `created_at` d'août est corrigée.
    -- `nulls last` = le -Infinity que le frontend donne à un updated_at
    -- manquant. rapport_entraineur et notes_coach NE SONT PAS ICI, et n'y
    -- seront pas — voir LE CADRE en tête de fichier.
    select ev.id, ev.grille_id, ev.cote_globale, ev.distinctions,
           ev.vitesse_explosivite, ev.force_puissance, ev.endurance_cardio,
           ev.agilite_coordination, ev.vision_du_jeu, ev.sens_tactique,
           ev.leadership, ev.discipline, ev.coachabilite, ev.intelligence_jeu,
           ev.competitivite, ev.esprit_equipe, ev.resilience, ev.attitude_mentalite
    from public.evaluations ev
    where ev.athlete_id = a.id
    order by ev.updated_at desc nulls last, ev.created_at desc
    limit 1
  ) e on true
  where a.id = p_athlete_id
    and public.is_approved_partner(null)
    and public.is_partner_eligible_athlete(a.id);
$function$;
