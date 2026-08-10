-- ═══════════════════════════════════════════════════════════════
-- evaluations — READ scoping (Director oversight Part A, Step 1)
--
-- SÉCURITÉ : supprime la policy "anyone can read evaluations" (SELECT, rôle
-- public, USING(true)) qui rendait les évaluations d'athlètes — MINEURS inclus,
-- rapport texte-libre du coach compris — lisibles avec la seule clé anon.
--   ⚠️ Vérifié : cette policy existe UNIQUEMENT en local ; nexus-prod ne l'a
--   jamais eue (anon → HTTP 200 mais [] : RLS bloque déjà). Cette migration
--   aligne le local sur prod ET formalise le modèle scopé comme migration
--   tracée, pour que les deux bases restent identiques.
--
-- MODÈLE DE LECTURE (SELECT) après cette migration :
--   • anon / public                → RIEN
--   • coach                        → ses PROPRES évaluations (coach_id = uid)
--   • directeur / dir. intérimaire → toutes les évals des athlètes de SON école
--                                    (c'est le déblocage « oversight » Part A)
--   • recruteur                    → évals des athlètes ACTIFS uniquement
--   • athlète                      → ses propres évals
--   • admin plateforme             → tout (policy "admins read all" inchangée)
--
-- Helpers SECURITY DEFINER (jamais de sous-requête brute sur `users` — risque
-- de récursion RLS, cf. CLAUDE.md). La sous-requête sur `athletes` (branche
-- athlète-propriétaire) est conservée telle quelle : elle est déjà en prod et
-- ne vise pas `users`.
--
-- N'AFFECTE PAS les policies d'ÉCRITURE (evaluations coach / admins insert /
-- admins update) — inchangées.
-- ═══════════════════════════════════════════════════════════════

-- ── helper : le user courant est-il directeur/intérimaire de l'école de cet athlète ?
CREATE OR REPLACE FUNCTION public.is_director_of_athlete_school(p_athlete_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.school_coaches sc
    WHERE sc.coach_id = auth.uid()
      AND sc.role IN ('DIRECTEUR'::public.coach_school_role,
                      'DIRECTEUR_INTERIM'::public.coach_school_role)
      AND sc.school_id = (SELECT a.school_id FROM public.athletes a WHERE a.id = p_athlete_id)
  );
$$;

-- ── helper : cet athlète est-il ACTIF ? (scope recruteur)
CREATE OR REPLACE FUNCTION public.athlete_is_active(p_athlete_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.athletes a WHERE a.id = p_athlete_id AND a.status = 'ACTIF'
  );
$$;

-- ── 1. tuer la fuite (local-only ; no-op sur prod)
DROP POLICY IF EXISTS "anyone can read evaluations" ON public.evaluations;

-- ── 2. remplacer la lecture scopée par la version resserrée
DROP POLICY IF EXISTS "authenticated read evaluations" ON public.evaluations;
CREATE POLICY "authenticated read evaluations"
ON public.evaluations
FOR SELECT
TO authenticated
USING (
  coach_id = auth.uid()                                              -- coach : ses évals
  OR public.is_director_of_athlete_school(athlete_id)                -- directeur : école
  OR (public.is_recruiter() AND public.athlete_is_active(athlete_id)) -- recruteur : actifs
  OR EXISTS (                                                         -- athlète : les siennes
    SELECT 1 FROM public.athletes a
    WHERE a.id = evaluations.athlete_id AND a.user_id = auth.uid()
  )
  OR public.is_admin()                                               -- admin : tout
);
