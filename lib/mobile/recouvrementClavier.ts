/* ═══════════════════════════════════════════════════════════════
   recouvrementClavier — de combien le clavier natif RECOUVRE la WebView.

   `keyboardHeight` (événements Capacitor) est la hauteur du clavier, pas
   ce qu'il cache. Sur iOS (KeyboardResize.None), la WebView ne bouge pas :
   les deux sont égaux. Sur Android 15 et plus (bord à bord, targetSdk 36),
   la WebView est RÉTRÉCIE par les insets du clavier malgré
   `adjustNothing` : relevé émulateur 1.4.5, innerHeight 914 → 530 px pour
   un clavier de 336 px. Remonter encore de keyboardHeight compensait deux
   fois : la feuille « Nouvelle carte » ne gardait que 182 px, champ caché.

   Recouvrement = hauteur du clavier − ce dont la WebView a déjà rétréci,
   jamais négatif. Recalculé au `resize`, parce que le rétrécissement
   arrive APRÈS keyboardWillShow. iOS : rétrécissement nul, valeur inchangée.
═══════════════════════════════════════════════════════════════ */

/** Pur : la part du clavier qui cache encore la page. */
export function calculerRecouvrement(hauteurClavier: number, hauteurSansClavier: number, hauteurActuelle: number): number {
  if (hauteurClavier <= 0) return 0;
  const retreci = Math.max(0, hauteurSansClavier - hauteurActuelle);
  return Math.max(0, Math.round(hauteurClavier - retreci));
}

/* Hauteur de la page clavier FERMÉ, partagée par tous les abonnés : une
   surface montée clavier déjà ouvert ne doit pas prendre la hauteur réduite
   pour référence. KeyboardInset est monté au démarrage, donc elle est tenue. */
let sansClavier = typeof window !== "undefined" ? window.innerHeight : 0;
let clavierOuvert = false;
let clavier = 0;

/** Écoute le clavier et rend le recouvrement à `rappel`. Web ou plugin
 *  absent → aucun appel. Rend la fonction de désabonnement. */
export function ecouterRecouvrementClavier(rappel: (px: number) => void): () => void {
  let annule = false;
  let show: { remove: () => void } | null = null;
  let hide: { remove: () => void } | null = null;

  const publier = () => rappel(calculerRecouvrement(clavier, sansClavier, window.innerHeight));
  const surResize = () => {
    if (!clavierOuvert) { sansClavier = window.innerHeight; return; }
    publier();
  };

  (async () => {
    try {
      const { Keyboard } = await import("@capacitor/keyboard");
      if (annule) return;
      // keyboardWillShow et non Did : l'animation part avec celle du clavier.
      show = await Keyboard.addListener("keyboardWillShow", (info) => {
        if (!clavierOuvert) sansClavier = Math.max(sansClavier, window.innerHeight);
        clavierOuvert = true;
        clavier = info.keyboardHeight;
        publier();
      });
      hide = await Keyboard.addListener("keyboardWillHide", () => {
        clavier = 0;
        clavierOuvert = false;
        rappel(0);
      });
      window.addEventListener("resize", surResize);
      // Abonné arrivé clavier déjà ouvert : il reçoit l'état courant.
      if (clavierOuvert) publier();
    } catch { /* web — no-op */ }
  })();

  return () => {
    annule = true;
    show?.remove();
    hide?.remove();
    if (typeof window !== "undefined") window.removeEventListener("resize", surResize);
  };
}
