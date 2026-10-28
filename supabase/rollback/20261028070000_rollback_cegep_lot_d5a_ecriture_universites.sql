-- Rollback du lot D5a cégep, étape 1 : remet can_edit_school_page / can_edit_team_page dans leur corps du
-- 20260817030000 (sans palier) et retire les trois policies restrictives d'écriture de teams.
drop policy universites_ecriture_admin_insert on public.teams;
drop policy universites_ecriture_admin_update on public.teams;
drop policy universites_ecriture_admin_delete on public.teams;

CREATE OR REPLACE FUNCTION public.can_edit_school_page(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and (
        u.is_platform_admin
        or (
          u.school_id = p_school_id
          and u.role = 'RECRUTEUR'
        )
      )
  );
$function$;

CREATE OR REPLACE FUNCTION public.can_edit_team_page(p_team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
  select exists (
    select 1
    from public.teams t
    join public.users u on u.id = auth.uid()
    where t.id = p_team_id
      and (
        u.is_platform_admin
        or (
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
  );
$function$;

do $verif$
begin
  if md5(pg_get_functiondef('public.can_edit_school_page(uuid)'::regprocedure)) <> '1443bedc4d195ffe5c136040456973c7'
     or md5(pg_get_functiondef('public.can_edit_team_page(uuid)'::regprocedure)) <> '4d2ec9960dc8ef39d8a6a71775dbf31a' then
    raise exception 'NEXUS: rollback D5a — les corps remis ne retrouvent pas leur md5 d''origine';
  end if;
end $verif$;
