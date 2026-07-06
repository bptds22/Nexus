-- ============================================================================
-- Ajoute les 7 sports offerts dans le picker d'onboarding WEB
-- (app/onboarding/page.tsx SPORTS[]) mais absents de public.sports.
--
-- Sans ces lignes, un coach web qui choisit un de ces sports ET crée une
-- équipe déclenche RAISE EXCEPTION 'INVALID_SPORT' dans finish_coach_*
-- (SELECT id FROM sports WHERE nom = TRIM(p_sport) → NULL).
--
-- Casse/accents alignés EXACTEMENT sur les libellés du web.
-- categorie : convention existante (Individuel / Collectif).
--
-- Idempotent : public.sports n'a PAS de contrainte UNIQUE sur `nom`
-- (PK sur id seul) → ON CONFLICT(nom) impossible, on garde via NOT EXISTS.
-- id + created_at sont auto (gen_random_uuid / now()).
-- ============================================================================

INSERT INTO public.sports (nom, categorie)
SELECT v.nom, v.categorie
FROM (VALUES
  ('Golf',        'Individuel'),
  ('Tennis',      'Individuel'),
  ('Ski alpin',   'Individuel'),
  ('Ski de fond', 'Individuel'),
  ('Judo',        'Individuel'),
  ('Handball',    'Collectif'),
  ('Water-polo',  'Collectif')
) AS v(nom, categorie)
WHERE NOT EXISTS (
  SELECT 1 FROM public.sports s WHERE s.nom = v.nom
);
