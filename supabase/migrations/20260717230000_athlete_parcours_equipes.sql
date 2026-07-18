-- ═══════════════════════════════════════════════════════════════
-- Parcours d'équipes — historique déclaratif d'équipes de l'athlète.
--
-- Colonne JSONB sur `athletes` (pattern maison des listes athlète-owned :
-- mentions_academiques, matieres_fortes, programme_cegep_vise… + distinctions).
-- Array de :
--   { team_name, sport, ligue, division, year_start, year_end? }
-- year_end null/absent = équipe ACTUELLE (bague rouge + pastille « Actif ».
-- Chevauchements permis : un athlète peut jouer 2-3 équipes en même temps.
--
-- Écriture DIRECTE par l'athlète OU le coach propriétaire — couvert par les
-- policies UPDATE existantes d'`athletes` (athlete user_id / coach coach_id) :
-- ZÉRO nouvelle RLS. Pas de table, pas de lien vers teams (déclaratif, façon
-- LinkedIn). L'équipe Nexus réelle (team_athletes) reste l'ancre de recrutement.
--
-- Garde-fou : max 10 entrées + forme = array (CHECK).
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.athletes
  ADD COLUMN IF NOT EXISTS parcours_equipes jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.athletes
  DROP CONSTRAINT IF EXISTS athletes_parcours_equipes_shape;

ALTER TABLE public.athletes
  ADD CONSTRAINT athletes_parcours_equipes_shape
  CHECK (
    jsonb_typeof(parcours_equipes) = 'array'
    AND jsonb_array_length(parcours_equipes) <= 10
  );

COMMENT ON COLUMN public.athletes.parcours_equipes IS
  'Historique declaratif d''equipes (LinkedIn-style). Array JSONB de {team_name, sport, ligue, division, year_start, year_end?}. year_end null = actuel. Max 10. Ecriture athlete+coach via policies UPDATE athletes existantes.';
