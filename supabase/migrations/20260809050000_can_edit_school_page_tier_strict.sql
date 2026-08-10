-- ============================================================================
-- 20260809050000_can_edit_school_page_tier_strict.sql
--
-- is_school_admin était une branche ALTERNATIVE au forfait : un directeur
-- éditait la vitrine publique de son CÉGEP quel que soit son plan. 16 comptes
-- portent le drapeau — 10 recruteurs et 6 coachs, TOUS via un admin_claim
-- approuvé (17 demandes, 17 approuvées, 0 rejetée). Le forfait ne mordait donc
-- que sur 1 recruteur rattaché sur 11.
--
-- Après cette migration : plateforme, ou recruteur de CET établissement avec un
-- forfait pro/all_star VIVANT (active ou trialing). Rien d'autre.
--
-- CE QUI N'EST PAS TOUCHÉ — is_school_admin reste un titre de GOUVERNANCE et
-- garde tous ses autres pouvoirs :
--   · supervision des collègues — is_cegep_admin_over_recruiter, 6 policies sur
--     recruiter_favorites / recruiter_notes / recruiter_pipeline /
--     recruiter_athlete_views / recruiter_activity_log ;
--   · annuaire des recruteurs du cégep — is_cegep_admin, sur users ;
--   · garde anti-auto-élévation — users update own ;
--   · éditeur de page d'équipe — can_edit_team_page, découplé par
--     20260809030000 puis 20260809040000. Un coach directeur garde ses équipes.
-- Seule la décision COMMERCIALE change.
--
-- EFFET MESURÉ : 7 recruteurs free et 6 coachs directeurs perdent la page
-- école. Aucun préavis requis — sur les 61 lignes school_page_content,
-- 0 champ éditorial rempli, 0 carte campus, 0 nouvelle, 0 programme manuel, et
-- updated_by NULL partout. Personne n'a jamais édité ces pages. Les seules
-- lignes non nulles sont `ville` (seedée depuis schools.city) et `province`.
--
-- Éprouvée avant apply en begin;…rollback; sur 7 cas : coach directeur free
-- perd la page école et garde ses équipes, coach pro idem, recruteur free perd
-- les deux, recruteur pro garde tout, admin plateforme inchangé, et les
-- abonnements canceled comme past_due perdent tout.
-- ============================================================================

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
    left join public.subscriptions s on s.user_id = u.id
    where u.id = auth.uid()
      and (
        -- 1. Plateforme : le portail admin ne dépend d'aucun abonnement.
        u.is_platform_admin

        -- 2. Recruteur de CET établissement, forfait payant ET VIVANT.
        --    is_school_admin n'ouvre PLUS cette porte : c'est un titre de
        --    gouvernance, pas un droit commercial. Les coachs n'éditent pas la
        --    page école — leur surface est la page d'équipe, restée gratuite.
        or (
          u.school_id = p_school_id
          and u.role = 'RECRUTEUR'
          and s.tier in ('pro', 'all_star')
          and s.status in ('active', 'trialing')
        )
      )
  );
$function$;

comment on function public.can_edit_school_page(uuid) is
  'Éditeur de page école. Forfait pro/all_star actif exigé de tout recruteur ; is_school_admin n''ouvre plus cette porte.';

-- Droits : REVOKE PUBLIC ne retire PAS le grant nominatif anon, les deux sont
-- requis. La fonction porte aujourd'hui « =X/postgres » ET « anon=X/postgres ».
-- Aucun chemin anonyme ne l'évalue : les policies qui l'appellent sont toutes
-- en {authenticated}, et le rendu public passe par le service client.
revoke all on function public.can_edit_school_page(uuid) from public;
revoke all on function public.can_edit_school_page(uuid) from anon;
grant execute on function public.can_edit_school_page(uuid) to authenticated, service_role;
