-- Same name + same city but different type (e.g. Séminaire de Sherbrooke
-- SECONDAIRE vs CEGEP) are distinct schools sharing a campus brand. Add type
-- to the identity index. (Unique INDEX, not a table constraint.)
DROP INDEX IF EXISTS public.schools_name_city_unique;
CREATE UNIQUE INDEX schools_name_city_unique
  ON public.schools (lower(name), COALESCE(lower(city), ''::text), type);
