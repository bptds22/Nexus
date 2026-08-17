-- 20260817030000_can_edit_pages_sans_palier.sql
--
-- OBJET : retirer le test de PALIER dans can_edit_school_page et
-- can_edit_team_page. Publier la vitrine de son CÉGEP et de ses équipes
-- relève de l'ACQUISITION, pas de la valeur payante — c'est ce qui amène
-- un recruteur sur la plateforme. La valeur payante (voir qui consulte,
-- chercher, contacter, suivre) est gardée ailleurs, par user_has_pro() et
-- par le v_tier_ok des 3 RPC recruteur. Aucune de ces surfaces n'est
-- touchée ici.
--
-- ── UNE SEULE MIGRATION POUR LES DEUX FONCTIONS ─────────────────────────
-- Les deux portent la MÊME décision. Les séparer laisserait un état
-- intermédiaire incohérent : la page école éditable et les pages d'équipe
-- non, alors que l'éditeur d'équipe téléverse ses images sous le school_id
-- et dépend donc de can_edit_school_page pour le stockage. Un seul
-- changement atomique, ou aucun.
--
-- ── CE QUI EST RETIRÉ, ET RIEN D'AUTRE ──────────────────────────────────
-- Dans la branche RECRUTEUR de chaque fonction, deux lignes :
--     and s.tier   in ('pro', 'all_star')
--     and s.status in ('active', 'trialing')
--
-- La jointure `left join public.subscriptions s` devient alors SANS AUCUN
-- USAGE dans les deux corps — elle n'y servait qu'à ces deux tests. Elle
-- est donc retirée aussi : la laisser produirait une jointure morte à
-- chaque appel, sur une fonction évaluée par la RLS ligne par ligne.
--
-- ── CE QUI RESTE, ET QUI N'EST PAS UN PALIER ────────────────────────────
-- `u.school_id = p_school_id` (école) et `u.school_id = t.school_id`
-- (équipe) sont le CLOISONNEMENT : ils empêchent un recruteur d'éditer
-- l'établissement d'un autre. Ils ne bougent pas.
-- `u.role = 'RECRUTEUR'` ne bouge pas non plus.
--
-- Les autres branches sont intactes :
--   · is_platform_admin                     (les deux fonctions)
--   · COACH inscrit à team_coaches          (équipe — jamais eu de palier)
--   · COACH is_school_admin de l'école      (équipe — jamais eu de palier)
--
-- ── INVARIANTS ──────────────────────────────────────────────────────────
-- SECURITY DEFINER, STABLE, search_path=public, row_security=off,
-- propriétaire et privilèges EXECUTE : inchangés. CREATE OR REPLACE
-- préserve l'ACL, donc `anon` reste sans EXECUTE sur les deux.
--
-- ── DÉPENDANCE UI (déjà livrée) ─────────────────────────────────────────
-- Le requiredTier "pro" de l'entrée « Ma page » et le FeatureGate de
-- /recruteur/ma-page ont été retirés avant cette migration. Les deux
-- couches redeviennent d'accord une fois ce fichier appliqué.

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════
-- 1. can_edit_school_page — deux branches : admin plateforme, recruteur
-- ═══════════════════════════════════════════════════════════════════════

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

-- ═══════════════════════════════════════════════════════════════════════
-- 2. can_edit_team_page — quatre branches, seule la 4e change
-- ═══════════════════════════════════════════════════════════════════════

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

COMMIT;

-- ── VÉRIFICATION MANUELLE (ne s'exécute pas) ────────────────────────────
-- Sous psql ou MCP, auth.uid() est NUL : ces deux fonctions rendent
-- TOUJOURS false, et tout test écrit ici serait vert pour la mauvaise
-- raison. La preuve se fait avec un VRAI JWT recruteur :
--
--   a) recruteur gratuit → écriture sur SON école : doit RÉUSSIR
--   b) recruteur gratuit → écriture sur une AUTRE école : doit ÉCHOUER
--   c) téléversement dans school-logos / campus-photos sous son
--      school_id : doit RÉUSSIR
