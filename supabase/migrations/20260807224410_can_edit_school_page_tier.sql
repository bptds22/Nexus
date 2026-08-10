-- ═══════════════════════════════════════════════════════════════════════════
-- can_edit_school_page — le forfait devient une CONDITION D'ÉCRITURE
--
-- ── LE PROBLÈME ─────────────────────────────────────────────────────────────
-- La fonction ne regardait que le rôle et l'école. Aucune policy de la base ne
-- consulte `subscriptions` — vérifié : zéro. Conséquence démontrée en
-- transaction annulée, sous l'identité d'un vrai recruteur `tier='free'` :
-- can_edit_school_page = true, UPDATE school_page_content = 1 ligne, INSERT
-- school_news = 1 ligne. Le paywall de l'interface était contournable par un
-- appel Supabase direct.
--
-- Cette fonction est la porte UNIQUE : les 8 tables (school_page_content,
-- school_campus_cards, school_programs, school_news, team_page_content,
-- team_pennants, team_events, team_position_needs) et les 3 policies storage
-- (school-logos, campus-photos) l'utilisent, directement ou via
-- can_edit_team_page qui lui délègue. La corriger ici les couvre toutes.
--
-- ── CE QUE ÇA CHANGE, ET POUR QUI ───────────────────────────────────────────
-- ⚠ CETTE MIGRATION RETIRE UN DROIT EXISTANT. Comptage fait le jour de
-- l'application : 11 recruteurs rattachés à une école, dont 10 directeurs
-- (exemptés par la clause 2a) — UN SEUL compte perd effectivement l'écriture.
-- Refaire le comptage avant toute réapplication ailleurs :
--
--   select count(*) filter (
--     where not u.is_platform_admin and not u.is_school_admin
--       and not (coalesce(s.tier,'free') in ('pro','all_star')
--                and coalesce(s.status,'') in ('active','trialing')))
--   from public.users u
--   left join public.subscriptions s on s.user_id = u.id
--   where u.role='RECRUTEUR' and u.school_id is not null;
--
-- ── LES TROIS CHEMINS QUI RESTENT OUVERTS, DÉLIBÉRÉMENT ─────────────────────
--   1. is_platform_admin — le portail admin doit fonctionner sans abonnement.
--   2. is_school_admin — un directeur garde la main sur son établissement quel
--      que soit son forfait. C'est la règle `adminBypass` déjà appliquée côté
--      interface aux cinq entrées « Mon CÉGEP » ; la base doit dire pareil,
--      sinon l'écran s'ouvre et l'enregistrement échoue.
--   3. tier 'pro' ET 'all_star' — all_star inclut pro (TIER_RANK côté client).
--
-- ── LE STATUT COMPTE AUTANT QUE LE PALIER ───────────────────────────────────
-- `subscriptions.tier` seul ne suffit pas : un abonnement annulé ou impayé
-- garde son `tier`. On exige donc un `status` vivant. Les valeurs retenues
-- ('active', 'trialing') sont celles que le provider client traite comme
-- donnant accès — si cette liste change côté Stripe, elle doit changer ICI
-- AUSSI, sinon la base et l'interface divergeront en silence.
--
-- ── VÉRIFIÉ EN TRANSACTION ANNULÉE APRÈS APPLICATION ────────────────────────
--   recruteur free NON-directeur        → false, UPDATE 0 ligne
--   recruteur all_star actif            → true,  UPDATE 1 ligne
--   directeur free (is_school_admin)    → true   (bypass volontaire)
--   admin plateforme                    → true   (inchangé)
--   abonnement pro CANCELED / PAST_DUE  → false  (le statut prime sur le palier)
--   n'importe qui, école tierce         → false  (périmètre inchangé)
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.can_edit_school_page(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
set row_security to 'off'
as $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.users u
    LEFT JOIN public.subscriptions s ON s.user_id = u.id
    WHERE u.id = auth.uid()
      AND (
        -- 1. Plateforme : le portail admin ne dépend d'aucun abonnement.
        u.is_platform_admin

        -- 2. Son établissement, et l'un des deux titres suivants.
        OR (
          u.school_id = p_school_id
          AND (
            -- 2a. Directeur : garde la main quel que soit son forfait.
            u.is_school_admin

            -- 2b. Recruteur : forfait payant ET VIVANT exigé.
            OR (
              u.role = 'RECRUTEUR'
              AND s.tier IN ('pro', 'all_star')
              AND s.status IN ('active', 'trialing')
            )
          )
        )
      )
  );
$function$;

comment on function public.can_edit_school_page(uuid) is
  'Porte UNIQUE d''ecriture des pages publiques (8 tables + 3 policies storage, '
  'directement ou via can_edit_team_page). Autorise : admin plateforme ; '
  'directeur de l''etablissement (is_school_admin, sans condition de forfait) ; '
  'recruteur de l''etablissement AVEC un abonnement pro/all_star actif ou en '
  'essai. Le forfait est une condition de BASE, pas seulement d''affichage — '
  'avant cette migration un recruteur free pouvait ecrire par appel direct.';
