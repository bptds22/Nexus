-- ============================================================================
-- Coordonnées des établissements — carte + filtre distance (recherche cégep).
--
-- Nullable par construction : une école sans coordonnées reste affichée et
-- n'est JAMAIS exclue par le slider de distance (décision produit) — d'où
-- l'absence de NOT NULL et de valeur par défaut.
--
-- Renseignées par un script one-shot (géocodage Nominatim/OSM) après revue
-- humaine ligne par ligne ; `geo_source` garde la trace de la provenance pour
-- pouvoir re-géocoder ou corriger à la main sans deviner.
--
-- Miroir VERSION-EXACTE de la migration appliquée (ledger 20260728140719).
-- ============================================================================

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS lat        double precision CHECK (lat BETWEEN -90 AND 90),
  ADD COLUMN IF NOT EXISTS lng        double precision CHECK (lng BETWEEN -180 AND 180),
  ADD COLUMN IF NOT EXISTS geo_source text CHECK (geo_source IN ('nominatim','manuel'));

COMMENT ON COLUMN public.schools.lat IS
  'Latitude (WGS84). NULL = non géocodée : l''école reste visible et n''est jamais exclue par un filtre de distance.';
COMMENT ON COLUMN public.schools.lng IS
  'Longitude (WGS84). Voir schools.lat.';
COMMENT ON COLUMN public.schools.geo_source IS
  'Provenance des coordonnées : nominatim (géocodage OSM) ou manuel (corrigé à la main).';

-- Le filtre distance parcourt les cégeps géocodés : index partiel suffisant.
CREATE INDEX IF NOT EXISTS schools_geo_idx ON public.schools (lat, lng) WHERE lat IS NOT NULL;
