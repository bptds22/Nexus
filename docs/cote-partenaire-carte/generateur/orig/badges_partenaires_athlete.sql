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
$function$

