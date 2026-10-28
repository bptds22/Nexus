-- Lot D3d cégep — le nom de l'école d'un recruteur, montré à qui lui parle (décision BP 2026-10-28, Q4).
-- Les universités restent masquées en base (policies universites_masquees, D1a) : un athlète ou un coach ne lit
-- pas l'école UNIVERSITE d'un recruteur universitaire, et ses messages afficheraient un nom vide. Cette fonction
-- rend l'école des recruteurs avec qui l'appelant a une conversation — et seulement eux, comme le permettent déjà
-- les policies de lecture de conversations (coach : coach_id / coach_b_id ; athlète : sa fiche, RECRUTEUR_ATHLETE).
-- Tout type d'école, pour un appel unique côté web ; aucune autre colonne de l'école n'est rendue.

create function public.ecoles_recruteurs(p_recruteurs uuid[])
  returns table (recruiter_id uuid, school_id uuid, school_name text)
  language sql stable security definer
  set search_path = public set row_security = off
as $function$
  select u.id, s.id, s.name
    from public.users u
    join public.schools s on s.id = u.school_id
   where u.id = any (coalesce(p_recruteurs, '{}'::uuid[]))
     and u.role = 'RECRUTEUR'::public.user_role
     and auth.uid() is not null
     and (public.is_admin()
          or exists (select 1 from public.conversations c
                      where c.recruiter_id = u.id
                        and (c.coach_id = auth.uid() or c.coach_b_id = auth.uid()
                             or (c.conversation_type = 'RECRUTEUR_ATHLETE'::public.conversation_type
                                 and exists (select 1 from public.athletes a
                                              where a.id = c.athlete_id and a.user_id = auth.uid())))));
$function$;
revoke all on function public.ecoles_recruteurs(uuid[]) from public, anon;
grant execute on function public.ecoles_recruteurs(uuid[]) to authenticated, service_role;
