/* ═══════════════════════════════════════════════════════════════
   Pastilles — rafraîchissement à la reprise de l'appli (C3, 1.4.5).

   Les pastilles de la barre d'onglets ne se recalculaient qu'au changement
   de route : revenir dans l'appli après un message laissait l'ancien
   compte. Ce module branche la reprise (Capacitor App 'appStateChange',
   et visibilitychange en filet) sur un rappel, et vide les notifications
   déjà livrées du plateau — sur Android, la pastille de l'icône vient du
   plateau : ouvrir l'appli = les avoir vues.

   La pastille CHIFFRÉE de l'icône (iOS aps.badge) demande un compte serveur
   dans send-push : chantier à part, non fait ici.
═══════════════════════════════════════════════════════════════ */

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/** Vide les notifications livrées (plateau Android, centre de notifications iOS). Silencieux en cas d'échec. */
export async function viderNotificationsLivrees(): Promise<void> {
  if (!IS_CAPACITOR) return;
  try {
    const { FirebaseMessaging } = await import("@capacitor-firebase/messaging");
    await FirebaseMessaging.removeAllDeliveredNotifications();
  } catch { /* plugin absent (web) ou refus : rien à vider */ }
}

/** Appelle `rappel` quand l'appli revient au premier plan. Rend le nettoyage. */
export function surReprise(rappel: () => void): () => void {
  const visible = () => { if (document.visibilityState === "visible") rappel(); };
  document.addEventListener("visibilitychange", visible);
  let retirer: (() => void) | null = null;
  let annule = false;
  if (IS_CAPACITOR) {
    void import("@capacitor/app").then(({ App }) =>
      App.addListener("appStateChange", ({ isActive }) => { if (isActive) rappel(); }),
    ).then((h) => {
      if (annule) void h.remove();
      else retirer = () => { void h.remove(); };
    }).catch(() => { /* hors appli */ });
  }
  return () => {
    annule = true;
    document.removeEventListener("visibilitychange", visible);
    retirer?.();
  };
}
