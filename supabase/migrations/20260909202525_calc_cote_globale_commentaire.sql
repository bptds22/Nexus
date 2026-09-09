-- ═══════════════════════════════════════════════════════════════════════════
-- LOT D — un commentaire, et rien d'autre
--
-- APPLIQUÉE sur le cloud le 2026-09-09 (version 20260909202525). Un
--   `COMMENT ON FUNCTION public.calc_cote_globale() IS
  'Cote globale : moyenne des critères notés. La branche « passthrough » (cote fournie + les 14 critères NULL -> on préserve la valeur) est un FLUX VIVANT, pas un héritage : la « Cote rapide » (feuille d''évaluation rapide de CoachATraiterMobile, et l''étoile des formulaires coach) écrit encore aujourd''hui une cote seule. NE JAMAIS LA RETIRER : sans elle, ces évaluations retombent dans le calcul par moyenne, v_count = 0, cote_globale := NULL, et la cascade efface la cote jusque dans athletes.cote_globale_entraineur — des athlètes perdraient leurs étoiles à la première réécriture. Relevé 2026-09-09 : 7 des 9 évaluations en base sont dans ce cas.';
