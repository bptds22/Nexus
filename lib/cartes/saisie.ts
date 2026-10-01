/* ═══════════════════════════════════════════════════════════════
   saisie — lecture des champs libres de la carte prospect (lot C).

   Retour BP : « Un champ n'est pas valide » était inutilisable. Chaque
   champ se lit ici, rend soit sa valeur pour la base, soit la RÈGLE
   attendue — affichée SOUS le champ fautif.

   Les bornes sont CELLES DE LA BASE (contraintes de cartes_prospect) :
   pieds 3–8, pouces 0–11, poids 50–450 lb, lien http(s), courriel
   « x@y.z ». La base reste le dernier mot ; ceci évite d'y arriver.
═══════════════════════════════════════════════════════════════ */

export type Lecture<T> = { ok: true; valeur: T } | { ok: false; regle: string };

export const REGLE_TAILLE = `Taille : 6'2" ou 188 cm (entre 3 pi et 8 pi 11 po)`;
export const REGLE_POIDS = "Poids : 121 ou 121 lbs (ou 55 kg), entre 50 et 450 lb";
export const REGLE_COURRIEL = "Courriel : nom@exemple.com";
export const REGLE_LIEN = "Lien vidéo : une adresse web, ex. youtube.com/watch?v=… ou https://hudl.com/…";

const nombre = (s: string) => Number(s.replace(",", "."));

/** « 6'2" », « 6'2 », « 6 pi 2 », « 6-2 », « 6 2 », « 6' », « 188 cm », « 188 ». */
export function lireTaille(brut: string): Lecture<{ pieds: number | null; pouces: number | null }> {
  const s = brut.trim().toLowerCase().replace(/[’`´]/g, "'").replace(/[”″]|''/g, '"');
  if (!s) return { ok: true, valeur: { pieds: null, pouces: null } };
  let pieds: number | null = null;
  let pouces = 0;
  const cm = s.match(/^(\d{2,3}(?:[.,]\d+)?)\s*cm$/) ?? s.match(/^(\d{3})$/);
  const imp = s.match(/^(\d)\s*(?:'|pi|pieds?|ft|-|\s)\s*(?:(\d{1,2})\s*(?:"|po|pouces?|in)?)?$/) ?? s.match(/^(\d)$/);
  if (cm) {
    const totalPo = Math.round(nombre(cm[1]) / 2.54);
    pieds = Math.floor(totalPo / 12);
    pouces = totalPo % 12;
  } else if (imp) {
    pieds = Number(imp[1]);
    pouces = imp[2] ? Number(imp[2]) : 0;
  } else {
    return { ok: false, regle: REGLE_TAILLE };
  }
  if (pieds < 3 || pieds > 8 || pouces > 11) return { ok: false, regle: REGLE_TAILLE };
  return { ok: true, valeur: { pieds, pouces } };
}

/** « 121 », « 121 lbs », « 121 lb », « 121 livres », « 55 kg ». */
export function lirePoids(brut: string): Lecture<number | null> {
  const s = brut.trim().toLowerCase();
  if (!s) return { ok: true, valeur: null };
  const m = s.match(/^(\d{2,3}(?:[.,]\d+)?)\s*(lbs?|livres?|kg|kilos?)?$/);
  if (!m) return { ok: false, regle: REGLE_POIDS };
  const lb = m[2] && /^k/.test(m[2]) ? nombre(m[1]) * 2.20462 : nombre(m[1]);
  const arrondi = Math.round(lb);
  if (arrondi < 50 || arrondi > 450) return { ok: false, regle: REGLE_POIDS };
  return { ok: true, valeur: arrondi };
}

/** La même règle que la contrainte de la base. */
/** Le parent (décision BP 2026-09-30) : nom libre, 120 caractères au plus. */
export const REGLE_NOM_PARENT = "Nom du parent : 120 caractères au plus";
export const REGLE_COURRIEL_PARENT = "Courriel du parent : nom@exemple.com";
export function lireNomParent(brut: string): Lecture<string | null> {
  const s = brut.trim().replace(/\s+/g, " ");
  if (!s) return { ok: true, valeur: null };
  return s.length <= 120 ? { ok: true, valeur: s } : { ok: false, regle: REGLE_NOM_PARENT };
}
export function lireCourrielParent(brut: string): Lecture<string | null> {
  const l = lireCourriel(brut);
  return l.ok ? l : { ok: false, regle: REGLE_COURRIEL_PARENT };
}

export function lireCourriel(brut: string): Lecture<string | null> {
  const s = brut.trim();
  if (!s) return { ok: true, valeur: null };
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s) ? { ok: true, valeur: s } : { ok: false, regle: REGLE_COURRIEL };
}

/** Accepte une adresse sans « https:// » (youtube.com/…) et l'ajoute. */
export function lireLien(brut: string): Lecture<string | null> {
  const s = brut.trim();
  if (!s) return { ok: true, valeur: null };
  const avecSchema = /^https?:\/\//i.test(s) ? s : /^[^\s/]+\.[^\s/]+/.test(s) ? `https://${s}` : null;
  if (!avecSchema || /\s/.test(avecSchema)) return { ok: false, regle: REGLE_LIEN };
  return { ok: true, valeur: avecSchema };
}

/* ── Téléphone (décision BP 2026-09-30) ─────────────────────────────
   Format libre à la saisie ; on garde les chiffres, sans le 1 initial d'un
   numéro à 11 chiffres. 10 chiffres attendus. La base normalise de même
   (telephone_normalise) : ceci évite seulement d'y arriver avec une faute. */
export const REGLE_TELEPHONE = "Téléphone : 10 chiffres, ex. 438 555-0123";

export function normaliserTelephone(brut: string): string {
  const d = brut.replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
}

export function lireTelephone(brut: string): Lecture<string | null> {
  if (!brut.trim()) return { ok: true, valeur: null };
  const d = normaliserTelephone(brut);
  return d.length === 10 ? { ok: true, valeur: d } : { ok: false, regle: REGLE_TELEPHONE };
}

/** « 4385550123 » → « 438 555-0123 » ; autre chose, tel quel. */
export function formaterTelephone(t: string | null | undefined): string {
  if (!t) return "";
  return /^\d{10}$/.test(t) ? `${t.slice(0, 3)} ${t.slice(3, 6)}-${t.slice(6)}` : t;
}
