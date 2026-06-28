-- ════════════════════════════════════════════════════════════════════
-- coach_lookup_civil_unclaimed — répare + élargit le ramassage coach →
-- athlète civil NON-COACHÉ, par email.
--
-- PROBLÈME (avant) : la policy users."Coaches lookup orphan athletes" faisait
-- un EXISTS inline sur public.athletes → soumis à la RLS athletes (aucune
-- policy coach→orphelin) → EXISTS faux → le lookup renvoyait 0 ligne en
-- runtime (cassé, confirmé : dropdown vide + réponse []).
--
-- APPROCHE — RPC SECURITY DEFINER (pas de policy SELECT large sur athletes) :
--   • bypasse la RLS proprement (row_security=off ; pattern is_coach() /
--     delete_my_account) → plus de récursion 42501/42P17 ;
--   • ne renvoie QUE le minimum (nom / email / sport) → AUCUNE fuite PII
--     (date_naissance, parent_email, téléphone…). La RLS étant row-level
--     (pas column-level), une policy SELECT exposerait toute la row d'un
--     mineur civil non-coaché → on l'évite délibérément ;
--   • garde is_coach() (keyée sur auth.uid() = l'APPELANT, pas le définer)
--     + min 4 caractères + LIMIT 3 (anti-énumération).
--
-- ÉLARGISSEMENT — critère :
--   coach_id IS NULL AND (school_id IS NULL OR schools.type = 'LIGUE_CIVILE')
--   → couvre (a) orphelin total + (b) civil club-rattaché sans coach ;
--   → exclut (c) scolaire/cégep (SECONDAIRE/CEGEP) + (d) déjà-coaché.
--
-- Le flux d'invitation reste inchangé : la RPC renvoie athlete_id → le coach
-- insère team_invitations (policy gardée sur l'équipe, pas sur l'athlète) →
-- l'athlète accepte → trigger apply_team_invitation_acceptance attache.
-- ════════════════════════════════════════════════════════════════════

BEGIN;

-- 1. Retrait de la policy cassée (le client passe désormais par la RPC ;
--    son EXISTS inline sur athletes était aussi une source de récursion).
DROP POLICY IF EXISTS "Coaches lookup orphan athletes" ON public.users;

-- 2. RPC de lookup — colonnes minimales uniquement.
CREATE OR REPLACE FUNCTION public.lookup_civil_unclaimed_by_email(p_prefix text)
RETURNS TABLE (
  user_id    uuid,
  athlete_id uuid,
  email      text,
  first_name text,
  last_name  text,
  sport_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
DECLARE
  v_prefix text := lower(trim(coalesce(p_prefix, '')));
BEGIN
  -- Garde rôle : seuls les coachs (auth.uid() = appelant, jamais le définer).
  IF NOT public.is_coach() THEN
    RETURN;
  END IF;
  -- Garde longueur : anti-énumération (miroir du minimum côté TS).
  IF length(v_prefix) < 4 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT u.id, a.id, u.email, a.first_name, a.last_name, sp.nom
  FROM public.users u
  JOIN public.athletes a ON a.user_id = u.id
  LEFT JOIN public.schools s  ON s.id  = a.school_id
  LEFT JOIN public.sports  sp ON sp.id = a.sport_id
  WHERE u.role = 'ATHLETE'::public.user_role
    AND u.email ILIKE v_prefix || '%'
    AND a.coach_id IS NULL
    AND (a.school_id IS NULL OR s.type = 'LIGUE_CIVILE')
  ORDER BY u.email
  LIMIT 3;
END;
$$;

-- 3. Grants : authentifiés seulement (is_coach() restreint encore aux coachs) ;
--    jamais anon (données potentiellement de mineurs).
REVOKE ALL     ON FUNCTION public.lookup_civil_unclaimed_by_email(text) FROM PUBLIC;
REVOKE ALL     ON FUNCTION public.lookup_civil_unclaimed_by_email(text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.lookup_civil_unclaimed_by_email(text) TO authenticated;

COMMIT;
