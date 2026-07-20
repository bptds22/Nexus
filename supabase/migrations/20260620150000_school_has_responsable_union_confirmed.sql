-- ════════════════════════════════════════════════════════════════════
-- Fix détection « un responsable existe ? » — school_has_responsable
--
-- PROBLÈME (diagnostic confirmé, prod) : la version précédente ne lisait
-- QUE admin_claims (claim_type DIRECTEUR/INTERIM, status PENDING+APPROVED).
-- Elle se trompait dans les deux sens :
--   (a) FAUX POSITIFS — comptait les claims PENDING : un claim non approuvé
--       « tenait la place » → le suivant débloqué en coach-seul alors
--       qu'aucun responsable n'est CONFIRMÉ. (4 institutions en prod :
--       Cégep Beauce-Appalaches, Cégep de Drummondville, Albatros du
--       Collège Notre-Dame, Académie les Estacades.)
--   (b) FAUX NÉGATIFS — ignorait users.is_school_admin et
--       school_coaches.role ∈ {DIRECTEUR, DIRECTEUR_INTERIM} → ratait un
--       responsable réel défini autrement → forçait le suivant en directeur.
--       (2 institutions en prod : Wildcats Laurentides-Lanaudière [sc_dir],
--       Académie De Roberval [is_school_admin + sc_dir].)
--
-- Les 3 sources NE sont PAS redondantes (ex. APPROVED sans is_school_admin
-- sur Cégep de Lévis / École André-Laurendeau) → il faut leur UNION.
--
-- DÉFINITION CORRECTE — « responsable existe » = vrai SSI au moins une :
--   1. admin_claims (DIRECTEUR/INTERIM) en status = 'APPROVED'  [PENDING EXCLU]
--   2. OR un user is_school_admin=true rattaché à l'institution
--      (lien réel : users.school_id = p_school_id — posé par les finish_* ;
--       les 10 admins prod ont tous un school_id non-null, 0 orphelin).
--   3. OR school_coaches.role ∈ {DIRECTEUR, DIRECTEUR_INTERIM} pour l'école.
--
-- Un seul point DB → corrige école + civil + cégep (les 3 RPC finish_* et
-- les 4 UIs consomment cette fonction telle quelle). On NE touche QUE le
-- corps de la fonction. Config inchangée : LANGUAGE sql, STABLE, SECURITY
-- DEFINER, row_security=off, search_path=public (rompre la récursion RLS —
-- leçon 42P17/F1). CREATE OR REPLACE → signature identique → binding et ACL
-- existants préservés (aucun GRANT/REVOKE modifié, hors scope).
-- ════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.school_has_responsable(p_school_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET row_security TO 'off'
 SET search_path TO 'public'
AS $function$
  SELECT
    -- 1. Claim directeur/intérim CONFIRMÉ (APPROVED uniquement — un PENDING
    --    ne « tient » plus la place : anti-faux-compte, exigence PO).
    EXISTS (
      SELECT 1
      FROM public.admin_claims
      WHERE school_id  = p_school_id
        AND claim_type IN ('DIRECTEUR', 'INTERIM')
        AND status     = 'APPROVED'
    )
    -- 2. Admin d'établissement déjà flaggé (lien user↔institution =
    --    users.school_id). Couvre les approbations qui ont posé
    --    is_school_admin sans claim APPROVED résiduel.
    OR EXISTS (
      SELECT 1
      FROM public.users
      WHERE school_id        = p_school_id
        AND is_school_admin  = true
    )
    -- 3. Rôle directeur/intérim matérialisé dans school_coaches (chemin de
    --    promotion peu utilisé mais autoritaire quand présent).
    OR EXISTS (
      SELECT 1
      FROM public.school_coaches
      WHERE school_id = p_school_id
        AND role IN ('DIRECTEUR'::public.coach_school_role,
                     'DIRECTEUR_INTERIM'::public.coach_school_role)
    );
$function$;
