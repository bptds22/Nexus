/* ═══════════════════════════════════════════════════════════════
   messagesUnite — les phrases de confirmation du tableau blanc, une seule
   source pour le web et l'app (décision BP 3, 2026-09-24 ; lot 2 de la 1.4.4).
═══════════════════════════════════════════════════════════════ */

/** « Marie », « Marie et Luc », « A, B et C ». */
export function joindreNomsUnite(noms: string[]): string {
  if (noms.length <= 1) return noms[0] ?? "";
  return `${noms.slice(0, -1).join(", ")} et ${noms[noms.length - 1]}`;
}

/** Retirer une carte prospect ne la supprime plus (BP 2026-10-18) : elle passe dans « Retiré ». */
export const MESSAGE_RETRAIT_CARTE =
  "La carte passe dans « Retiré », avec ta raison : elle reste visible à toute l'unité, pour que personne ne la recrute deux fois.";

/** Confirmation d'un retrait du processus : nomme les collègues qui suivent
 *  aussi l'athlète, et dit que le retrait vaut pour toute l'unité. */
export function messageRetraitProcessus(noms: string[], modeUnite: boolean): string {
  // BP 2026-10-18 : le dossier n'est plus supprimé, il passe dans « Retiré » avec sa raison.
  if (!modeUnite) return "Le dossier passe dans « Retiré », avec ta raison.";
  if (noms.length === 0) return "Le dossier passe dans « Retiré » pour ton unité, avec ta raison : personne ne le recrutera deux fois.";
  return `Suivi aussi par ${joindreNomsUnite(noms)}. Le dossier passe dans « Retiré » pour toute l'unité — pour ${noms.length === 1 ? "ce collègue" : "ces collègues"} aussi.`;
}
