-- ═══════════════════════════════════════════════════════════════
-- Index sur cote_globale_entraineur (athlètes actifs).
--
-- cote_globale_entraineur porte le tri par défaut de la recherche
-- recruteur ('rating_desc'), le tri 'rating_asc', et le filtre
-- p_min_rating. Aucun index ne le couvrait — les 13 index
-- d'athletes portent sur status, sport, school, coach, verified,
-- user_id, completion, league_team, partner_opt_in.
--
-- Partiel sur status='ACTIF' : la RPC ne lit jamais d'autre statut,
-- et 10 des 26 lignes actuelles sont hors périmètre.
--
-- ⚠ CE QUE CET INDEX NE FAIT PAS — DETTE CONSIGNÉE
-- Il ne servira PAS au tri de recruiter_search_athletes. L'ORDER BY
-- de la RPC est une EXPRESSION, pas une colonne :
--     CASE WHEN v_sort = 'rating_desc'
--          THEN a.cote_globale_entraineur END DESC NULLS LAST
-- Le planificateur ne peut apparier un index de colonne à un CASE :
-- le tri restera un tri complet, index ou non.
--
-- L'index sert donc le filtre p_min_rating et les autres lecteurs
-- de la colonne — c'est pourquoi il est posé quand même.
--
-- Rendre le TRI indexable demanderait de construire l'ORDER BY en
-- SQL dynamique (EXECUTE) ou en branches séparées. C'est un
-- chantier de performance, pas du Lot A : décision de BP le
-- 2026-08-12, à rouvrir quand le volume d'athlètes ACTIF approche
-- le millier. À 16 athlètes aujourd'hui, l'écart n'est pas
-- mesurable.
--
-- CREATE INDEX simple, pas CONCURRENTLY : apply_migration ouvre une
-- transaction, et CONCURRENTLY y est interdit. À 288 kB / 26 lignes
-- le verrou est imperceptible. À 4 chiffres de lignes, refaire cet
-- index en CONCURRENTLY hors transaction.
-- ═══════════════════════════════════════════════════════════════

BEGIN;

CREATE INDEX IF NOT EXISTS idx_athletes_cote_globale_actif
  ON public.athletes (cote_globale_entraineur DESC NULLS LAST)
  WHERE status = 'ACTIF'::public.account_status;

COMMIT;
