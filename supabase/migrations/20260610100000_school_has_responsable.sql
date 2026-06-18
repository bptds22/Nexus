-- ═══════════════════════════════════════════════════════════════
-- iter coach-responsable-2a — RPC de détection partagée web + mobile.
--
-- Définition "un responsable existe pour school X" :
--   EXISTS admin_claims
--   WHERE school_id = X
--     AND claim_type IN ('DIRECTEUR', 'INTERIM')
--     AND status IN ('PENDING', 'APPROVED')
--
-- - PENDING compte : le coach a attesté sa responsabilité via RPRP
--   (Loi 25), même si la modération admin n'a pas encore approuvé.
-- - REJECTED ne compte pas : l'école est de nouveau "ouverte".
-- - L'écriture qui couvre cette définition côté serveur arrive en
--   sprint 2b (finish_coach_school_onboarding).
--
-- Sécurité SECURITY DEFINER :
-- - row_security=off pour bypasser la RLS restrictive sur admin_claims
--   (les coachs ne peuvent lire que leurs propres claims côté SELECT).
-- - search_path explicite pour SECURITY DEFINER (canon Supabase).
-- - N'expose qu'un boolean — ni qui a claim, ni détails (privacy).
-- - GRANT authenticated → callable par tout user connecté pour
--   n'importe quel school_id (c'est le but).
--
-- STABLE = résultat constant dans une transaction (optimisable par
-- le planner).
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.school_has_responsable(p_school_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.admin_claims
    WHERE school_id = p_school_id
      AND claim_type IN ('DIRECTEUR', 'INTERIM')
      AND status IN ('PENDING', 'APPROVED')
  );
$$;

GRANT EXECUTE ON FUNCTION public.school_has_responsable(uuid) TO authenticated;
