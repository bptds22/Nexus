/* ═══════════════════════════════════════════════════════════════
   xlsx — un vrai classeur Excel, écrit à la main (lot B, décision BP
   2026-09-24). Remplace le CSV : Excel, Google Sheets et Numbers l'ouvrent
   sans question de séparateur ni d'encodage — le CSV tombait en colonne A
   sur un Windows anglais (testé dans Excel 16).

   Un .xlsx est un zip de quelques fichiers XML (SpreadsheetML). On écrit le
   strict nécessaire : un classeur, une feuille, une table de styles.
   · Texte : chaînes EN LIGNE (inlineStr) — une case de texte n'est jamais
     interprétée comme une formule : l'injection est impossible par
     construction, sans apostrophe visible.
   · Retours à la ligne gardés (notes en vrai multiligne), cases en
     « renvoi à la ligne automatique », alignées en haut.
   · Dates : vrais numéros de série Excel, affichés AAAA-MM-JJ (et hh:mm
     pour une visite avec heure) — plus de conversion à la sauce locale.
   · Nombres : vraie valeur numérique (cote au format 0.0).
   · En-tête en gras et FIGÉ, flèches de filtre, largeurs de colonnes.

   jszip est déjà une dépendance du projet (export Loi 25 de l'admin) ; il
   n'est chargé qu'à l'appel (import dynamique), pas au chargement de page.
═══════════════════════════════════════════════════════════════ */

export type CelluleXlsx =
  | null
  | { t: "texte"; v: string }
  | { t: "nombre"; v: number; format?: "0.0" }
  /** `v` : « AAAA-MM-JJ » ou « AAAA-MM-JJ hh:mm », heure LOCALE. */
  | { t: "date"; v: string };

export interface ColonneXlsx {
  titre: string;
  /** Largeur en caractères (unité Excel). */
  largeur: number;
}

/* Index des styles (cellXfs) déclarés dans STYLES, dans l'ordre. */
const STYLE = { entete: 1, texte: 2, date: 3, dateHeure: 4, decimal: 5 } as const;

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="3"><numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd"/><numFmt numFmtId="165" formatCode="yyyy\\-mm\\-dd\\ hh:mm"/><numFmt numFmtId="166" formatCode="0.0"/></numFmts>
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="6">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf>
<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf>
<xf numFmtId="166" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment horizontal="left" vertical="top"/></xf>
</cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

/** Échappement XML + retrait des caractères de contrôle interdits en XML 1.0
 *  (seuls tabulation, saut de ligne et retour chariot sont permis). */
export function echapperXml(texte: string): string {
  return texte
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Référence de colonne Excel : 0 → A, 25 → Z, 26 → AA. */
export function lettreColonne(i: number): string {
  let s = "";
  for (let n = i + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** « AAAA-MM-JJ[ hh:mm] » (heure locale) → numéro de série Excel (jours
 *  depuis le 1899-12-30, système 1900). `null` si illisible. */
export function serieExcel(v: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(v);
  if (!m) return null;
  const utc = Date.UTC(+m[1], +m[2] - 1, +m[3], m[4] ? +m[4] : 0, m[5] ? +m[5] : 0);
  if (Number.isNaN(utc)) return null;
  return utc / 86_400_000 + 25_569;
}

function cellule(ref: string, c: CelluleXlsx, entete = false): string {
  if (c === null) return "";
  if (c.t === "texte") {
    if (c.v === "") return "";
    const style = entete ? STYLE.entete : STYLE.texte;
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${echapperXml(c.v)}</t></is></c>`;
  }
  if (c.t === "nombre") {
    if (!Number.isFinite(c.v)) return "";
    return `<c r="${ref}"${c.format === "0.0" ? ` s="${STYLE.decimal}"` : ""}><v>${c.v}</v></c>`;
  }
  const serie = serieExcel(c.v);
  if (serie === null) return cellule(ref, { t: "texte", v: c.v });
  const avecHeure = /\d{2}:\d{2}/.test(c.v);
  return `<c r="${ref}" s="${avecHeure ? STYLE.dateHeure : STYLE.date}"><v>${serie}</v></c>`;
}

/** Le XML de la feuille : en-tête figé, filtres, largeurs, lignes. */
export function feuilleXml(colonnes: ColonneXlsx[], lignes: CelluleXlsx[][]): string {
  const derniere = lettreColonne(colonnes.length - 1);
  const rangees = [colonnes.map((c) => ({ t: "texte", v: c.titre }) as CelluleXlsx), ...lignes];
  const data = rangees
    .map((r, i) => `<row r="${i + 1}">${r.map((c, j) => cellule(`${lettreColonne(j)}${i + 1}`, c, i === 0)).join("")}</row>`)
    .join("");
  const cols = colonnes.map((c, j) => `<col min="${j + 1}" max="${j + 1}" width="${c.largeur}" customWidth="1"/>`).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${cols}</cols>
<sheetData>${data}</sheetData>
<autoFilter ref="A1:${derniere}${rangees.length}"/>
</worksheet>`;
}

/** Le classeur complet, en octets (application/vnd.openxmlformats-…sheet). */
export async function construireXlsx(nomFeuille: string, colonnes: ColonneXlsx[], lignes: CelluleXlsx[][]): Promise<Uint8Array> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const feuille = echapperXml(nomFeuille.slice(0, 31).replace(/[\\/?*[\]:]/g, " "));
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets><sheet name="${feuille}" sheetId="1" r:id="rId1"/></sheets>
<definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="0" hidden="1">'${feuille.replace(/'/g, "''")}'!$A$1:$${lettreColonne(colonnes.length - 1)}$${lignes.length + 1}</definedName></definedNames>
</workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
  zip.file("xl/styles.xml", STYLES);
  zip.file("xl/worksheets/sheet1.xml", feuilleXml(colonnes, lignes));
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
}
