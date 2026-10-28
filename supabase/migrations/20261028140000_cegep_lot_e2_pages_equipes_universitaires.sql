-- Lot E2 cégep — pages d'équipes universitaires (retour du test de bout en bout de BP, 2026-10-28 : A2 ; Q3 : le
-- recruteur universitaire de l'université + l'admin). Même modèle que les cégeps : en-tête et présentation
-- (team_page_content), fanions (team_pennants), calendrier et camps (team_events), besoins par poste
-- (team_position_needs) — tous écrits sous can_edit_team_page, par policy ou par les RPC replace_team_*.
-- D5a étape 1 réservait l'équipe universitaire à l'admin. Ici, une seule branche s'ajoute : un compte RECRUTEUR dont
-- nexus_prive.mon_universite() (contexte universitaire, interrupteur ON, D2a) est l'école de l'équipe.
-- Sous OFF, mon_universite() est nulle pour tout le monde : rien ne change. Aucune autre branche ne bouge (coachs,
-- directeurs et recruteurs collégiaux de leur école ; jamais une équipe universitaire). Corps de départ gardé par md5.

do $garde$
begin
  if md5(pg_get_functiondef('public.can_edit_team_page(uuid)'::regprocedure)) <> 'db8b25c92c4cc274b3ec1a8d18c1ac48' then
    raise exception 'NEXUS: E2 — can_edit_team_page a changé depuis le relevé (D5a) ; régénérer';
  end if;
end $garde$;

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
        -- équipe universitaire : le recruteur universitaire de CETTE université, sous ON (lot E2, Q3)
        or (
          u.role = 'RECRUTEUR'
          and t.school_id = nexus_prive.mon_universite()
        )
        or (
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
