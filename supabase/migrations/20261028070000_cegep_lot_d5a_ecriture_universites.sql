-- Lot D5a cégep, étape 1 — fermer la faille d'écriture du recruteur rattaché à une université (décision BP
-- 2026-10-28 : « Ferme d'abord la faille d'écriture », avant la « Ma page » universitaire).
-- Aujourd'hui, can_edit_school_page / can_edit_team_page ne regardent ni le type d'école ni le contexte du compte,
-- et les policies d'écriture de teams ne regardent que school_id = current_user_school_id(). Un compte rattaché à
-- une université pourrait donc écrire la page de son université, ses pages d'équipes et ses équipes elles-mêmes.
-- Ce compte ne peut pas exister sous OFF (verrous D0, D2a) : la faille est latente, on la ferme avant d'ouvrir.
--   1. can_edit_school_page : pour une UNIVERSITÉ, l'admin plateforme, ou le recruteur universitaire de CETTE
--      université sous ON (nexus_prive.mon_universite(), D2a). Pour les autres écoles, rien ne change, sauf qu'un
--      compte au contexte universitaire n'y écrit jamais.
--   2. can_edit_team_page : une équipe universitaire n'est modifiable que par l'admin (Q5 : pages d'équipes
--      universitaires plus tard). Rien ne change pour les autres équipes.
--   3. teams : policies RESTRICTIVES d'écriture — insérer, modifier ou supprimer une équipe universitaire (ou
--      déplacer une équipe vers une université) est réservé à l'admin. Les équipes universitaires viennent des lots
--      D1 / D1b.
-- Les 11 policies (8 tables de page, 3 sur storage.objects) et les 5 RPC replace_* passent par ces deux fonctions :
-- elles suivent sans être touchées. Corps de départ gardés par leur md5 (prod = local, relevés le 2026-10-28).

do $garde$
begin
  if md5(pg_get_functiondef('public.can_edit_school_page(uuid)'::regprocedure)) <> '1443bedc4d195ffe5c136040456973c7'
     or md5(pg_get_functiondef('public.can_edit_team_page(uuid)'::regprocedure)) <> '4d2ec9960dc8ef39d8a6a71775dbf31a' then
    raise exception 'NEXUS: D5a — can_edit_school_page ou can_edit_team_page a changé depuis le relevé ; régénérer';
  end if;
  if to_regprocedure('nexus_prive.mon_universite()') is null or to_regprocedure('nexus_prive.ids_universites()') is null then
    raise exception 'NEXUS: D5a — préalables nexus_prive (D1a2, D2a) absents';
  end if;
end $garde$;

-- ── 1. Page d'école ──────────────────────────────────────────────────────────
create or replace function public.can_edit_school_page(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $function$
  select exists (
    select 1
    from public.users u
    where u.id = auth.uid()
      and (
        u.is_platform_admin
        or (
          u.school_id = p_school_id
          and u.role = 'RECRUTEUR'
          and (
            -- université : son recruteur universitaire, sous ON seulement
            p_school_id = nexus_prive.mon_universite()
            or (
              not (p_school_id = any (nexus_prive.ids_universites()))
              and u.context is distinct from 'universitaire'
            )
          )
        )
      )
  );
$function$;

-- ── 2. Page d'équipe ─────────────────────────────────────────────────────────
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

-- ── 3. Équipes universitaires : écriture admin seulement ─────────────────────
create policy universites_ecriture_admin_insert on public.teams as restrictive for insert to public
  with check ((select public.is_admin()) or not (school_id = any ((select nexus_prive.ids_universites())::uuid[])));
create policy universites_ecriture_admin_update on public.teams as restrictive for update to public
  using ((select public.is_admin()) or not (school_id = any ((select nexus_prive.ids_universites())::uuid[])))
  with check ((select public.is_admin()) or not (school_id = any ((select nexus_prive.ids_universites())::uuid[])));
create policy universites_ecriture_admin_delete on public.teams as restrictive for delete to public
  using ((select public.is_admin()) or not (school_id = any ((select nexus_prive.ids_universites())::uuid[])));
