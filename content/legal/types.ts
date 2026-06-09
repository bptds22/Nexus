/* ═══════════════════════════════════════════════════════════════
   content/legal/types.ts — iter 7.50-a-bis (legal-1)

   Type Block + Section unifiés pour les 3 documents légaux
   (confidentialité, conditions, collecte-donnees). Source de vérité
   utilisée à la fois par les pages web et par le futur LegalSheet
   mobile (legal-2).

   Block model :
   - p              : paragraphe (mb-4 par défaut)
                       trailing=true → mt-4 sans mb (utilisé pour les
                       paragraphes en fin de section qui suivent des
                       bullets, préservant le rendu byte-identique de
                       collecte-donnees où les `after` paragraphes
                       avaient mt-4 dans le rendu original).
   - bullets        : liste à puces
   - table          : tableau avec headers + rows (utilisé par
                       confidentialite uniquement)
   - callout        : encadré coloré (red/yellow/green/blue)
   - definitions    : dl term/def (utilisé par confidentialite
                       uniquement, section 1.1)
   - contact-card   : carte de coordonnées (RPRP, etc.)
   - subsection     : sous-section avec id + title + blocs imbriqués
═══════════════════════════════════════════════════════════════ */

export type Block =
  | { type: "p"; text: string; trailing?: boolean }
  | { type: "bullets"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "callout"; tone: "red" | "yellow" | "green" | "blue"; title?: string; text: string }
  | { type: "definitions"; items: { term: string; def: string }[] }
  | { type: "contact-card"; rows: { label: string; value: string; href?: string }[] }
  | { type: "subsection"; id: string; title: string; blocks: Block[] };

export type Section = {
  id: string;
  title: string;
  /** Si true, ajoute une bordure latérale ambre + padding (visuel
      "section sensible", utilisé par confidentialite section
      "Consentement parental"). */
  emphasized?: boolean;
  blocks: Block[];
};
