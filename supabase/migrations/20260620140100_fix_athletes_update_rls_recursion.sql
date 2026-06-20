-- ════════════════════════════════════════════════════════════════════
-- Fix 42P17 — récursion RLS infinie sur public.athletes (UPDATE)
--
-- CAUSE : cycle de policies croisé athletes ⇄ team_athletes.
--   - athletes."Coaches update own team athletes" (USING + WITH CHECK)
--     sous-requête team_athletes.
--   - team_athletes."Athletes read own team rows" / "Recruiters read
--     verified team athletes" (SELECT) sous-requêtent athletes.
--   → tout UPDATE sur athletes (Postgres évalue le OR de TOUTES les policies
--     UPDATE permissives, donc celle-ci même quand elle est fausse pour
--     l'appelant) ré-entre dans la RLS de athletes via team_athletes → 42P17.
--
-- FIX (pattern F1) : encapsuler EXACTEMENT la condition de la policy coach
-- dans une fonction SECURITY DEFINER + row_security=off. row_security off →
-- les sous-requêtes (team_athletes, athletes) ne déclenchent plus la RLS →
-- cycle rompu. auth.uid() reste l'identité de l'appelant. Condition reproduite
-- À L'IDENTIQUE (ni plus, ni moins permissif). On ne touche QUE cette policy ;
-- les policies team_athletes et les autres policies athletes sont intactes.
-- ════════════════════════════════════════════════════════════════════

-- ── 1. Fonction-écran (DROP+recreate sur la signature exacte) ────────
DROP FUNCTION IF EXISTS public.coach_can_manage_athlete(uuid);

CREATE OR REPLACE FUNCTION public.coach_can_manage_athlete(p_athlete_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET row_security TO 'off'
 SET search_path TO 'public'
AS $function$
  -- Reproduit À L'IDENTIQUE la policy "Coaches update own team athletes" :
  --   coach via team_coaches/team_athletes OU directeur/directeur_interim de
  --   l'école de l'athlète. athletes.id → p_athlete_id ;
  --   athletes.school_id → sous-requête sur athletes (row_security off → pas
  --   de récursion).
  SELECT
    EXISTS (
      SELECT 1
      FROM public.team_coaches tc
      JOIN public.team_athletes ta ON ta.team_id = tc.team_id
      WHERE tc.coach_id = auth.uid()
        AND ta.athlete_id = p_athlete_id
    )
    OR EXISTS (
      SELECT 1
      FROM public.school_coaches sc
      WHERE sc.coach_id = auth.uid()
        AND sc.school_id = (SELECT school_id FROM public.athletes WHERE id = p_athlete_id)
        AND sc.role = ANY (ARRAY['DIRECTEUR'::public.coach_school_role,
                                 'DIRECTEUR_INTERIM'::public.coach_school_role])
    );
$function$;

-- EXECUTE réservé à authenticated (un coach est authentifié). Supabase
-- auto-grant anon/authenticated/service_role → on retire anon explicitement.
REVOKE ALL     ON FUNCTION public.coach_can_manage_athlete(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.coach_can_manage_athlete(uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.coach_can_manage_athlete(uuid) TO authenticated;

-- ── 2. Réécrire la policy récursive via la fonction-écran ────────────
-- DROP+recreate proprement. USING + WITH CHECK appellent la fonction (plus de
-- sous-requête inline sur team_athletes → plus de cycle). Mêmes cmd/role/
-- caractère permissif que l'originale.
DROP POLICY IF EXISTS "Coaches update own team athletes" ON public.athletes;

CREATE POLICY "Coaches update own team athletes" ON public.athletes
  AS PERMISSIVE
  FOR UPDATE
  TO authenticated
  USING (public.coach_can_manage_athlete(athletes.id))
  WITH CHECK (public.coach_can_manage_athlete(athletes.id));
