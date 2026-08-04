/* ═══════════════════════════════════════════════════════════════════════════
   haptics — LE helper haptique de l'application. Un seul, et c'est le point.

   ── CE QU'IL REMPLACE ───────────────────────────────────────────────────────
   Trois systèmes concurrents cohabitaient :
     · lib/platform/haptics.ts — 0 importateur, et SANS try/catch : un plugin
       qui lève cassait l'action appelante. Supprimé.
     · ce fichier — 4 importateurs, API sémantique (hapticTap, hapticSuccess…).
     · 38 copies LOCALES de la même fonction, réparties dans 34 écrans et 4
       modules utils.ts, en 9 variantes divergentes.

   ── POURQUOI PAS DE GARDE isNativePlatform ──────────────────────────────────
   Les anciennes versions testaient `Capacitor.isNativePlatform()` avant tout
   appel. La garde est retirée, non pas parce qu'elle serait fautive, mais
   parce qu'elle est INVÉRIFIABLE statiquement : c'est une valeur d'exécution,
   et le reste de l'app détecte le natif autrement (NEXT_PUBLIC_CAPACITOR_BUILD,
   une constante bakée au build). Deux mécanismes de détection concurrents,
   dont l'un ne peut pas être prouvé sans device.
   Sans elle, le comportement ne dépend d'aucune hypothèse : hors device
   l'import de @capacitor/haptics échoue, le catch l'absorbe, rien ne se
   produit. C'est le patron qu'utilisaient déjà 34 des 38 copies locales.

   ── LE try/catch N'EST PAS OPTIONNEL ────────────────────────────────────────
   Une haptique est un ornement. Elle ne doit JAMAIS empêcher un bouton de
   faire son travail. Toute erreur est avalée, silencieusement et volontairement.

   ── CONTRATS PRÉSERVÉS ──────────────────────────────────────────────────────
   `triggerHaptic(intensity)` et `tap()` gardent EXACTEMENT la signature des
   copies locales qu'ils remplacent : les appelants n'ont pas été réécrits, ils
   ont seulement changé de source.
   Le paramètre accepte l'union de toutes les variantes rencontrées, y compris
   "Success" — que neuf fichiers déclaraient sans jamais le passer. Mesuré avant
   migration : ZÉRO appel sans argument dans tout le dépôt, donc l'unification
   du défaut (certaines copies avaient "Medium") ne change aucun comportement.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Union de toutes les intensités que les copies locales acceptaient. */
export type HapticIntensity =
  | "Light"
  | "Medium"
  | "Heavy"
  | "Success"
  | "Warning"
  | "Error";

const NOTIFS: readonly HapticIntensity[] = ["Success", "Warning", "Error"];

/**
 * Retour haptique. Impact pour Light/Medium/Heavy, notification pour
 * Success/Warning/Error. Ne lève jamais.
 */
export async function triggerHaptic(intensity: HapticIntensity = "Light"): Promise<void> {
  try {
    const { Haptics, ImpactStyle, NotificationType } = await import("@capacitor/haptics");
    if (NOTIFS.includes(intensity)) {
      await Haptics.notification({
        type: NotificationType[intensity as "Success" | "Warning" | "Error"],
      });
      return;
    }
    await Haptics.impact({ style: ImpactStyle[intensity as "Light" | "Medium" | "Heavy"] });
  } catch {
    /* plugin absent, web, ou appel refusé : une haptique ne casse rien. */
  }
}

/** Contrat historique de la copie locale `tap()` — impact léger. */
export const tap = (): Promise<void> => triggerHaptic("Light");

/* API sémantique — préexistante, conservée telle quelle pour ses importateurs.
   On nomme l'INTENTION, pas la mécanique : le « feel » peut être rebrandé sans
   toucher un seul point d'appel. */
export const hapticTap = (): Promise<void> => triggerHaptic("Light");
export const hapticSelect = (): Promise<void> => triggerHaptic("Medium");
export const hapticSuccess = (): Promise<void> => triggerHaptic("Success");
export const hapticWarning = (): Promise<void> => triggerHaptic("Warning");
export const hapticError = (): Promise<void> => triggerHaptic("Error");
