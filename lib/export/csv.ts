/* ═══════════════════════════════════════════════════════════════
   csv — un fichier texte qu'Excel ouvre EN COLONNES et AVEC LES ACCENTS,
   quelle que soit la langue de Windows (lot B, export du pipeline).

   ── CE QUI A ÉTÉ TESTÉ DANS LE VRAI EXCEL (Excel 16, Windows en-US,
      séparateur de liste « , » — le poste de BP, 2026-09-24) ──────────
   · UTF-8 + BOM, « ; »          → tout en colonne A (Excel coupe à la
                                   virgule de SA langue), accents OK.
   · UTF-8 + BOM + « sep=; »     → colonnes OK, mais ACCENTS CASSÉS :
                                   dès qu'il lit « sep= », Excel ignore le
                                   BOM et relit le fichier en ANSI.
   · « sep=; » sans BOM          → idem, accents cassés.
   · UTF-16LE + BOM, TABULATION  → 13 colonnes, accents OK, 6'0" OK,
                                   notes sur une ligne. ← RETENU.
   Excel reconnaît l'UTF-16 avec tabulations comme son propre format
   « Texte Unicode » : il n'applique ni séparateur de liste ni page de code
   locale. C'est le seul format TEXTE qui marche sur un Windows français
   comme sur un Windows anglais.

   ── LES CASES ──────────────────────────────────────────────────────
   · Jamais de retour à la ligne dans une case : remplacés par « · »
     (décision BP — une note ne casse jamais une ligne du fichier).
   · Une case contenant une tabulation ou un guillemet est entourée de
     guillemets, ses guillemets doublés : Excel affiche 6'0".
   · INJECTION DE FORMULE : une case qui commence par = + - @ serait
     EXÉCUTÉE par Excel. Noms et notes sont saisis par des tiers : on
     préfixe par une apostrophe (qui reste visible, c'est le prix de la
     sûreté en format texte).

   Pur : rend des octets, le téléchargement vit chez l'appelant.
═══════════════════════════════════════════════════════════════ */

export type ValeurCsv = string | number | null | undefined;

const DEBUT_DE_FORMULE = /^[=+\-@]/;
/** Séparateur en ligne qui remplace les retours à la ligne d'une case. */
export const SEPARATEUR_EN_LIGNE = " · ";

/** Une case, prête à écrire. `null` / `undefined` → case vide. */
export function caseCsv(valeur: ValeurCsv): string {
  if (valeur === null || valeur === undefined) return "";
  let texte = String(valeur);
  // Jamais de retour à la ligne dans une case (une ligne = un athlète).
  texte = texte.replace(/\s*(\r\n|\r|\n)+\s*/g, SEPARATEUR_EN_LIGNE);
  // Un NOMBRE négatif légitime n'est pas une formule ; seules les chaînes
  // saisies par des tiers sont neutralisées.
  if (typeof valeur === "string" && DEBUT_DE_FORMULE.test(texte)) texte = `'${texte}`;
  return /["\t]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
}

/** Le texte du fichier : en-têtes + lignes, TABULATION, CRLF (sans BOM). */
export function texteCsv(entetes: string[], lignes: ValeurCsv[][]): string {
  return [entetes, ...lignes].map((r) => r.map(caseCsv).join("\t")).join("\r\n") + "\r\n";
}

/** Le fichier complet, en OCTETS : BOM UTF-16LE (FF FE) + texte en UTF-16LE. */
export function construireCsv(entetes: string[], lignes: ValeurCsv[][]): Uint8Array {
  const texte = texteCsv(entetes, lignes);
  const octets = new Uint8Array(2 + texte.length * 2);
  octets[0] = 0xff;
  octets[1] = 0xfe;
  for (let i = 0; i < texte.length; i++) {
    const code = texte.charCodeAt(i);
    octets[2 + i * 2] = code & 0xff;
    octets[3 + i * 2] = code >> 8;
  }
  return octets;
}

/** Nombre décimal à la française (4,5). */
export function decimalFr(n: number, decimales = 1): string {
  return n.toFixed(decimales).replace(".", ",");
}
