-- ═══════════════════════════════════════════════════════════════
-- Backfill teams.season — débloque la revendication des équipes scrapées.
--
-- POURQUOI (ce n'est pas du nettoyage cosmétique) :
--   TeamPickerSheet filtre par saison quand on lui en passe une —
--     if (season) q = q.eq("season", season)          (TeamPickerSheet.tsx)
--   et les deux appelants lui passent getCurrentSeason() :
--     app/coach/equipes/page.tsx          (web)
--     components/shared/CoachEquipesMobile.tsx (mobile)
--   Or le scraper RSEQ n'écrit pas `season` → NULL sur les 111 équipes
--   scrapées. `NULL = '2025-2026'` est faux ⇒ elles étaient EXCLUES du
--   picker, donc impossibles à rejoindre. Ce backfill les y fait entrer.
--
-- Le DEFAULT '2025-2026' de la colonne ne s'applique qu'aux INSERT qui
-- omettent la valeur ; il n'a jamais rétro-agi sur les lignes existantes.
--
-- IDEMPOTENT : ne touche que les NULL, rejouable sans effet.
-- NE RENOMME RIEN et ne touche pas à `equipes` (dette séparée).
-- ═══════════════════════════════════════════════════════════════

UPDATE public.teams
SET season = '2025-2026'
WHERE season IS NULL;
