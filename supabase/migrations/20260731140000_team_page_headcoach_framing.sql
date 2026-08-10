-- ============================================================================
-- Cadrage de la photo d'entraîneur-chef — calqué sur le cadrage hero.
--
-- La photo hero a hero_focal_x / hero_focal_y / hero_zoom ; la photo du coach
-- n'avait rien : elle était affichée en `object-fit: cover` nu, donc cadrée au
-- centre par le navigateur, sans recours pour le collège.
--
-- DÉFAUTS — 50 / 50 / 100, PAS 50 / 25 / 100 comme le hero.
-- `.tp .cphoto img` et `.tpm .cphoto img` sont en `object-fit: cover` SANS
-- `object-position` : le défaut navigateur est donc `50% 50%`. Aligner la
-- colonne sur ce comportement garantit que les photos coach déjà téléversées
-- ne bougent pas d'un pixel au déploiement. Le 25 du hero est un choix propre
-- à un cadre très large (environ 2.6:1) et ne se transpose pas à une vignette.
--
-- Types, nullabilité et bornes sont ceux des colonnes hero, à l'identique.
-- Additif : aucune donnée existante n'est modifiée, aucune colonne supprimée.
-- ============================================================================

ALTER TABLE public.team_page_content
  ADD COLUMN IF NOT EXISTS headcoach_focal_x smallint NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS headcoach_focal_y smallint NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS headcoach_zoom    smallint NOT NULL DEFAULT 100;

ALTER TABLE public.team_page_content
  DROP CONSTRAINT IF EXISTS team_page_content_headcoach_focal_x_check;
ALTER TABLE public.team_page_content
  ADD CONSTRAINT team_page_content_headcoach_focal_x_check
  CHECK (headcoach_focal_x >= 0 AND headcoach_focal_x <= 100);

ALTER TABLE public.team_page_content
  DROP CONSTRAINT IF EXISTS team_page_content_headcoach_focal_y_check;
ALTER TABLE public.team_page_content
  ADD CONSTRAINT team_page_content_headcoach_focal_y_check
  CHECK (headcoach_focal_y >= 0 AND headcoach_focal_y <= 100);

ALTER TABLE public.team_page_content
  DROP CONSTRAINT IF EXISTS team_page_content_headcoach_zoom_check;
ALTER TABLE public.team_page_content
  ADD CONSTRAINT team_page_content_headcoach_zoom_check
  CHECK (headcoach_zoom >= 100 AND headcoach_zoom <= 220);

COMMENT ON COLUMN public.team_page_content.headcoach_focal_x IS
  'Point focal X (%) de la photo coach — object-position. Défaut 50 = centre.';
COMMENT ON COLUMN public.team_page_content.headcoach_focal_y IS
  'Point focal Y (%) de la photo coach. Défaut 50 = centre (comportement actuel).';
COMMENT ON COLUMN public.team_page_content.headcoach_zoom IS
  'Zoom (%) autour du point focal, 100 = taille native. Bornes alignées sur hero_zoom.';
