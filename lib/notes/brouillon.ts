/* ═══════════════════════════════════════════════════════════════
   Brouillon de note — sauvegardé tout seul (1.4.5, option C du R6).

   Une note commencée n'est jamais perdue : fermer le panneau, changer d'écran,
   perdre le réseau ou fermer l'appli la laisse intacte dans l'appareil. Elle
   revient à la réouverture et s'efface dès qu'elle est postée (ou vidée).

   Stockage LOCAL à l'appareil seulement (localStorage), jamais envoyé : un
   brouillon n'est pas une note, personne d'autre ne le lit. Le stockage peut
   manquer ou lever (mode privé, données bloquées) : tout est dans un try/catch
   et l'écran fonctionne sans.

   La clé suit le SUJET de la note, pas l'écran : le fil d'un joueur est le même
   dans Mon processus, dans une liste et sur sa fiche — un brouillon commencé
   dans l'un se retrouve dans l'autre.
═══════════════════════════════════════════════════════════════ */

export const PREFIXE_BROUILLON = "nx-note-brouillon:";
/** Un brouillon oublié depuis plus de 30 jours est écarté à la lecture. */
export const DUREE_BROUILLON_MS = 30 * 24 * 60 * 60 * 1000;

export interface StockageLocal {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
}

function stockageDefaut(): StockageLocal | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function cleBrouillon(sujet: string): string {
  return `${PREFIXE_BROUILLON}${sujet}`;
}

export function lireBrouillon(sujet: string, maintenant = Date.now(), stockage: StockageLocal | null = stockageDefaut()): string {
  if (!stockage) return "";
  try {
    const brut = stockage.getItem(cleBrouillon(sujet));
    if (!brut) return "";
    const o = JSON.parse(brut) as { t?: unknown; le?: unknown };
    if (typeof o.t !== "string" || typeof o.le !== "number") return "";
    if (maintenant - o.le > DUREE_BROUILLON_MS) { stockage.removeItem(cleBrouillon(sujet)); return ""; }
    return o.t;
  } catch {
    return "";
  }
}

/** Texte vide (ou que des espaces) = on efface : rien à garder. */
export function ecrireBrouillon(sujet: string, texte: string, maintenant = Date.now(), stockage: StockageLocal | null = stockageDefaut()): void {
  if (!stockage) return;
  try {
    if (!texte.trim()) { stockage.removeItem(cleBrouillon(sujet)); return; }
    stockage.setItem(cleBrouillon(sujet), JSON.stringify({ t: texte, le: maintenant }));
  } catch {
    /* quota ou stockage bloqué : l'écran marche sans brouillon */
  }
}

export function viderBrouillon(sujet: string, stockage: StockageLocal | null = stockageDefaut()): void {
  ecrireBrouillon(sujet, "", Date.now(), stockage);
}
