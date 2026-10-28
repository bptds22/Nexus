-- Rollback du lot E2 cégep : remet can_edit_team_page dans son corps du lot D5a étape 1 (équipe universitaire :
-- admin seulement), vérifié par md5.
create or replace function public.can_edit_team_page(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $function$
  select exists (
    select 1
    from public.teams t
    join public.users u on u.id = auth.uid()
    where t.id = p_team_id
      and (
        u.is_platform_admin
        or (
          -- équipe universitaire : admin seulement (Q5, plus tard)
          not (t.school_id = any (nexus_prive.ids_universites()))
          and (
            (
              u.role = 'COACH'
              and exists (
                select 1 from public.team_coaches tc
                where tc.team_id = t.id and tc.coach_id = u.id
              )
            )
            or (
              u.school_id = t.school_id
              and (
                (u.role = 'COACH' and u.is_school_admin)
                or u.role = 'RECRUTEUR'
              )
            )
          )
        )
      )
  );
$function$;

do $verif$
begin
  if md5(pg_get_functiondef('public.can_edit_team_page(uuid)'::regprocedure)) <> 'db8b25c92c4cc274b3ec1a8d18c1ac48' then
    raise exception 'NEXUS: rollback E2 — le corps remis ne retrouve pas son md5 (D5a)';
  end if;
end $verif$;
