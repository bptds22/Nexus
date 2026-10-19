/* ═══════════════════════════════════════════════════════════════
   feuilleBas — géométrie pure de la fenêtre du bas partagée
   (components/mobile/FeuilleBas) et du champ ramené au-dessus du
   clavier (components/mobile/KeyboardInset). BP, nuit du 2026-10-18.
═══════════════════════════════════════════════════════════════ */

/** Hauteur max de la feuille : jamais sous la barre d'état ni l'encoche, clavier ouvert ou non. */
export function hauteurMaxFeuille(clavier: number, hauteur = "92dvh"): string {
  return clavier > 0
    ? `calc(100vh - ${clavier}px - env(safe-area-inset-top) - 8px)`
    : `min(${hauteur}, calc(100dvh - env(safe-area-inset-top) - 12px))`;
}

/** Le champ actif est-il caché par le clavier (son bas passe sous le haut du clavier) ? */
export function champSousClavier(basDuChamp: number, hauteurPage: number, recouvrement: number): boolean {
  return recouvrement > 0 && basDuChamp > hauteurPage - recouvrement - 8;
}
