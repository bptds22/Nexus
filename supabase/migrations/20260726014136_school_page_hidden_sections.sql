-- Bloc 2 « Ma page » — visibilité par section (Round 3 #3).
-- hidden_sections : tableau des clés de sections masquées sur la page publique
-- (about / campus / programs / parcours / news). Défaut [] = tout visible.
ALTER TABLE public.school_page_content
  ADD COLUMN IF NOT EXISTS hidden_sections jsonb NOT NULL DEFAULT '[]'::jsonb
  CHECK (jsonb_typeof(hidden_sections) = 'array');
