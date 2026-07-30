-- Élargit geo_source : 'approx' = coordonnée de repli (centre-ville ou point
-- proche du campus) quand l'établissement n'est pas cartographié sous son nom.
-- Assumé pour un filtre « ≤ 60 km » ; la valeur distingue ces lignes pour
-- pouvoir les repasser un jour avec les vraies adresses (backlog).
ALTER TABLE public.schools DROP CONSTRAINT IF EXISTS schools_geo_source_check;
ALTER TABLE public.schools
  ADD CONSTRAINT schools_geo_source_check
  CHECK (geo_source IN ('nominatim','approx','manuel'));

COMMENT ON COLUMN public.schools.geo_source IS
  'Provenance des coordonnées : nominatim (bâtiment trouvé par son nom), approx (repli ville / point voisin du campus), manuel (corrigé à la main).';