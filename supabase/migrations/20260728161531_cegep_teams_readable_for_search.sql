-- ============================================================================
-- Recherche cégep : les équipes d'un CÉGEP sont lisibles par tout compte
-- authentifié.
--
-- Constat : les policies existantes sur public.teams n'exposaient à un ATHLÈTE
-- que ses propres équipes, celles des écoles SECONDAIRE (onboarding) et celles
-- des clubs LIGUE_CIVILE. Aucune ne couvrait les CÉGEPs — donc, pour le public
-- exact de la recherche, le filtre Sport était vide, les badges d'équipes
-- absents et le badge « poste recherché » impossible à afficher.
--
-- Donnée concernée : nom d'équipe, division, genre, sport d'un cégep. C'est de
-- l'information RSEQ publique (calendriers et classements sont publiés) — aucun
-- renseignement personnel. Même forme que « Secondary teams readable for
-- onboarding », qui existe déjà pour les écoles secondaires.
--
-- ADDITIVE : les policies RLS se combinent en OR, aucune n'est retirée.
-- Miroir VERSION-EXACTE de la migration appliquée (ledger 20260728161531).
-- ============================================================================

DROP POLICY IF EXISTS "Cegep teams readable for search" ON public.teams;

CREATE POLICY "Cegep teams readable for search"
ON public.teams
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.schools s
    WHERE s.id = teams.school_id AND s.type = 'CEGEP'
  )
);

COMMENT ON POLICY "Cegep teams readable for search" ON public.teams IS
  'Recherche cégep athlète : expose les équipes des CÉGEPs (sport, division, genre) à tout compte authentifié. Information RSEQ publique, aucun renseignement personnel. Additive.';
