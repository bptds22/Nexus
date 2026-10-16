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
$function$

