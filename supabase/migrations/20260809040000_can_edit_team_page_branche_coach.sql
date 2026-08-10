-- ============================================================================
-- 20260809040000_can_edit_team_page_branche_coach.sql
--
-- SUITE de 20260809030000_can_edit_team_page_decouple.sql, qui n'ouvrait
-- l'éditeur d'équipe qu'aux coachs porteurs de is_school_admin (6 comptes).
-- Un coach ordinaire ne pouvait pas éditer la page d'une équipe qu'il gère —
-- alors que c'est son outil de recrutement, et le canal de distribution.
--
-- Ajoute une branche COACH DÉCLARÉ SUR L'ÉQUIPE, gratuite et indépendante de
-- is_school_admin comme du forfait.
--
-- POURQUOI team_coaches ET NON « coach de l'école »
--   · Sémantique : team_coaches EST le lien coach↔équipe, avec son rôle
--     (head_coach / assistant). users.school_id ne dit rien de ce qu'il gère.
--   · Table vivante : écrite par la création d'équipe (créateur = head_coach,
--     lib/queries/coach/createTeam.ts), l'adhésion à une équipe existante
--     (app/onboarding/page.tsx), l'onboarding coach de ligue civile, et l'ajout
--     manuel (app/coach/equipes/[teamId]/PageClient.tsx). Ses 6 lignes
--     reflètent 12 coachs avant lancement, pas une table dormante.
--   · Un prédicat scolaire serait disproportionné : `teams` compte 7943 lignes
--     dont 7250 (91 %) issues du scrape RSEQ, moyenne de 14 équipes par école
--     et maximum 58. Un coach de football aurait édité jusqu'à 58 pages —
--     volleyball et natation comprises.
--
-- FORME CALQUÉE sur la policy « Coaches manage own team athletes » de
-- team_athletes, qui accorde déjà ALL sur le roster à la même condition :
-- appartenance à team_coaches, sans correspondance d'école ni contrainte de
-- rôle. On suit le précédent plutôt que d'inventer une règle parallèle.
--
-- ⚠ DETTE CONNUE, HORS PÉRIMÈTRE — la policy « team_coaches scoped insert »
-- porte `coach_id = auth.uid()` comme premier disjoint, SANS contrainte côté
-- équipe : tout utilisateur authentifié peut s'inscrire sur n'importe laquelle
-- des 7943 équipes. Ce disjoint est REQUIS par le flux « rejoindre une équipe
-- existante » de l'onboarding. La présente branche n'ouvre donc aucune classe
-- d'escalade nouvelle — team_coaches confère DÉJÀ la gestion du roster, plus
-- sensible qu'une page publique — mais elle hérite du même trou. À traiter dans
-- un ticket dédié, pas ici.
--
-- Éprouvée avant apply en begin;…rollback; : coach déclaré free édite SA page,
-- le même coach est bloqué sur une équipe d'une autre école, les 48 équipes des
-- 6 directeurs restent à 48/48, et un recruteur free reste à 0 éditable sur 3.
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

        -- 2. COACH DÉCLARÉ SUR CETTE ÉQUIPE : gratuit, sans is_school_admin.
        --    Son outil de recrutement. Même forme que la policy roster.
        or (
          u.role = 'COACH'
          and exists (
            select 1 from public.team_coaches tc
            where tc.team_id = t.id and tc.coach_id = u.id
          )
        )

        -- 3. Rattaché à l'établissement DE L'ÉQUIPE, avec un titre.
        or (
          u.school_id = t.school_id
          and (
            -- 3a. COACH directeur : toutes les équipes de son établissement.
            (u.role = 'COACH' and u.is_school_admin)

            -- 3b. RECRUTEUR : forfait payant ET VIVANT exigé.
            or (u.role = 'RECRUTEUR'
                and s.tier in ('pro', 'all_star')
                and s.status in ('active', 'trialing'))
          )
        )
      )
  );
$function$;

comment on function public.can_edit_team_page(uuid) is
  'Éditeur de page d''équipe. Coach déclaré sur l''équipe OU coach directeur de l''école : gratuit. Recruteur : forfait exigé.';

revoke all on function public.can_edit_team_page(uuid) from public;
revoke all on function public.can_edit_team_page(uuid) from anon;
grant execute on function public.can_edit_team_page(uuid) to authenticated, service_role;
