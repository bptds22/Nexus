-- ============================================================================
-- 20260809030000_can_edit_team_page_decouple.sql
--
-- can_edit_team_page déléguait entièrement à can_edit_school_page :
--   SELECT EXISTS (SELECT 1 FROM teams t
--                  WHERE t.id = p_team_id AND can_edit_school_page(t.school_id))
-- Elle héritait donc du paywall recruteur. Fermer la branche is_school_admin de
-- can_edit_school_page (migration suivante) aurait retiré l'éditeur d'équipe à
-- 6 coachs directeurs — 48 équipes réelles, dont 28 à l'École secondaire du
-- Rocher et 16 aux Grandes-Marées.
--
-- Les coachs sont le CANAL DE DISTRIBUTION, pas le marché payant : leur éditeur
-- d'équipe reste gratuit. Les recruteurs, eux, restent soumis au forfait, à la
-- même règle que la page école (pro/all_star + active/trialing).
--
-- La population coach est INCHANGÉE : coach + is_school_admin, exactement les 6
-- comptes qui y avaient accès avant. Élargir à tout coach pour ses propres
-- équipes serait une décision produit distincte, non prise ici.
--
-- Éprouvée avant apply sur 7 cas en begin;…rollback; — coach free garde ses
-- équipes et perd la page école, coach pro garde ses équipes, recruteur free
-- perd les deux, recruteur pro garde tout, admin plateforme inchangé,
-- abonnements canceled et past_due perdent tout.
-- ============================================================================

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
    left join public.subscriptions s on s.user_id = u.id
    where t.id = p_team_id
      and (
        -- 1. Plateforme : le portail admin ne dépend d'aucun abonnement.
        u.is_platform_admin

        -- 2. Son établissement, et l'un des deux titres suivants.
        or (
          u.school_id = t.school_id
          and (
            -- 2a. COACH directeur : GRATUIT. Canal de distribution.
            (u.role = 'COACH' and u.is_school_admin)

            -- 2b. RECRUTEUR : forfait payant ET VIVANT exigé.
            or (u.role = 'RECRUTEUR'
                and s.tier in ('pro', 'all_star')
                and s.status in ('active', 'trialing'))
          )
        )
      )
  );
$function$;

comment on function public.can_edit_team_page(uuid) is
  'Éditeur de page d''équipe. Coach directeur : gratuit. Recruteur : forfait exigé. Ne délègue plus à can_edit_school_page.';

-- Droits : REVOKE PUBLIC ne retire PAS le grant nominatif anon, les deux sont
-- requis. La fonction portait « =X/postgres » et « anon=X/postgres ».
revoke all on function public.can_edit_team_page(uuid) from public;
revoke all on function public.can_edit_team_page(uuid) from anon;
grant execute on function public.can_edit_team_page(uuid) to authenticated, service_role;
