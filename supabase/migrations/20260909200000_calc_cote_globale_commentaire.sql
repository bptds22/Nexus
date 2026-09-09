-- ═══════════════════════════════════════════════════════════════════════════
-- LOT D — un commentaire, et rien d'autre
--
-- ⚠ NON APPLIQUÉE à l'écriture. Un `COMMENT ON FUNCTION` ne touche ni au corps
--   ni aux droits : c'est la migration la plus inoffensive possible, et elle
--   attend quand même le GO — la règle ne se plie pas parce que le geste est
--   petit.
--
-- POURQUOI. Le retrait du mode « Simplifié » va donner envie à quelqu'un de
-- nettoyer la branche « simple-mode passthrough » de `calc_cote_globale` :
-- celle qui, quand `cote_globale` arrive renseignée et les 14 critères NULL,
-- PRÉSERVE la valeur au lieu de la recalculer.
--
-- La retirer ferait tomber ces lignes dans la seconde branche : `v_count = 0`
-- -> `cote_globale := NULL` -> et la cascade écrit NULL dans
-- `athletes.cote_globale_entraineur`. Des athlètes perdraient leurs étoiles à
-- la première réécriture de leur évaluation, sans que personne ne l'ait
-- demandé.
--
-- ET CE N'EST PAS QU'UN HÉRITAGE. Relevé du 2026-09-09 : 7 des 9 évaluations
-- en base n'ont aucun critère noté — mais surtout, `CoachATraiterMobile` écrit
-- ENCORE des évaluations `cote_globale` seule (feuille d'éval rapide, mobile).
-- La branche est donc ALIMENTÉE AUJOURD'HUI, pas seulement lue. Elle ne
-- pourra partir que le jour où cette feuille aura changé, et pas avant.
-- ═══════════════════════════════════════════════════════════════════════════

COMMENT ON FUNCTION public.calc_cote_globale() IS
  'Cote globale : moyenne des critères notés. La branche « simple-mode passthrough » (cote fournie + les 14 critères NULL -> on préserve la valeur) est CONSERVÉE et ne doit PAS être retirée avec le mode Simplifié : la retirer recalculerait NULL et effacerait la cote de tout athlète évalué à l''étoile seule, jusque dans athletes.cote_globale_entraineur. Elle reste alimentée par la feuille d''évaluation rapide de CoachATraiterMobile (relevé 2026-09-09).';
