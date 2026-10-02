/* ═══════════════════════════════════════════════════════════════
   messagesUnite — les phrases de confirmation du tableau blanc, une seule
   source pour le web et l'app (décision BP 3, 2026-09-24 ; lot 2 de la 1.4.4).
═══════════════════════════════════════════════════════════════ */

/** « Marie », « Marie et Luc », « A, B et C ». */
export function joindreNomsUnite(noms: string[]): string {
  if (noms.length <= 1) return noms[0] ?? "";
  return `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;
}

/** Confirmation d'un retrait du processus : nomme les collègues qui suivent
 *  aussi l'athlète, et dit que le retrait vaut pour toute l'unité. */
export function messageRetraitProcessus(noms: string[], modeUnite: boolean): string {
  if (!modeUnite) return "Il ne sera plus dans ton suivi actif.";
  if (noms.length === 0) return "Le dossier sera retiré du processus de ton unité.";
  return `Suivi aussi par ${joindreNomsUnite(noms)}. Le dossier sera retiré pour toute l'unité — pour ${noms.length === 1 ? "ce collègue" : "ces collègues"} aussi.`;
}
