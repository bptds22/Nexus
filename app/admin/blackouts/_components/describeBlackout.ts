/* ═══════════════════════════════════════════════════════════════
   describeBlackout — une période de silence RSEQ, en français lisible.

   L'écran d'admin ne doit pas afficher des champs bruts. Une ligne de
   `blackout_periods` est une RÈGLE ; elle doit se relire comme la phrase
   qu'un responsable de ligue prononcerait. C'est ce qui permet de repérer
   une erreur de saisie d'un coup d'œil — une fourchette de promotions à
   l'envers ou un sport oublié se voient dans une phrase, pas dans quatre
   colonnes de nombres.

   Fonctions pures, sans dépendance React : la liste et la page de détail
   les partagent, et elles restent testables telles quelles.
═══════════════════════════════════════════════════════════════ */

export interface BlackoutLike {
  sport_id: string | null;
  promo_min: number | null;
  promo_max: number | null;
  date_debut: string;
  date_fin: string;
  actif: boolean;
}

const MOIS = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

/** Date ISO (`2026-03-01`) → « 1er mars 2026 ». Parsée en composants et non
 *  via `new Date(iso)` : ce dernier interprète une date nue en UTC et recule
 *  d'un jour dès qu'on est à l'ouest de Greenwich. */
export function formatDateFr(iso: string, withYear = true): string {
  const [y, m, d] = iso.split("-").map((n) => Number.parseInt(n, 10));
  if (!y || !m || !d) return iso;
  const jour = d === 1 ? "1er" : String(d);
  return withYear ? `${jour} ${MOIS[m - 1]} ${y}` : `${jour} ${MOIS[m - 1]}`;
}

/** « du 1er au 15 mars 2026 » quand le mois et l'année coïncident,
 *  « du 28 février au 3 mars 2026 » sinon. */
export function formatPeriodeFr(debut: string, fin: string): string {
  const [yd, md] = debut.split("-");
  const [yf, mf] = fin.split("-");
  if (debut === fin) return `le ${formatDateFr(debut)}`;
  if (yd === yf && md === mf) {
    return `du ${formatDateFr(debut, false).split(" ")[0]} au ${formatDateFr(fin)}`;
  }
  if (yd === yf) return `du ${formatDateFr(debut, false)} au ${formatDateFr(fin)}`;
  return `du ${formatDateFr(debut)} au ${formatDateFr(fin)}`;
}

/** « de promotion 2027 à 2028 », « de promotion 2027 et après », etc.
 *  Chaîne vide quand aucune borne — l'appelant dit alors « tous ». */
export function formatPromosFr(min: number | null, max: number | null): string {
  if (min === null && max === null) return "";
  if (min !== null && max !== null) {
    return min === max ? `de promotion ${min}` : `de promotion ${min} à ${max}`;
  }
  if (min !== null) return `de promotion ${min} et après`;
  return `de promotion ${max} et avant`;
}

/**
 * La phrase complète.
 *
 * « Du 1er au 15 mars 2026, les recruteurs ne peuvent pas écrire aux
 *   athlètes de promotion 2027 à 2028 en football. »
 *
 * Sans sport ni promotion : « … à tous les athlètes, toutes disciplines. »
 */
export function describeBlackout(b: BlackoutLike, sportNom: string | null): string {
  const periode = formatPeriodeFr(b.date_debut, b.date_fin);
  const promos = formatPromosFr(b.promo_min, b.promo_max);

  const cible = promos && sportNom
    ? `aux athlètes ${promos} en ${sportNom.toLowerCase()}`
    : promos
    ? `aux athlètes ${promos}, toutes disciplines`
    : sportNom
    ? `aux athlètes en ${sportNom.toLowerCase()}, toutes promotions`
    : "à tous les athlètes, toutes disciplines";

  const tete = periode.charAt(0).toUpperCase() + periode.slice(1);
  return `${tete}, les recruteurs ne peuvent pas écrire ${cible}.`;
}

/** Aujourd'hui à Montréal, en ISO. Le fuseau est explicite pour la même
 *  raison que dans is_messaging_blacked_out : une date nue comparée en UTC
 *  bascule d'un jour en soirée. */
export function todayMontrealIso(): string {
  return new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Montreal" }),
  )
    .toISOString()
    .slice(0, 10);
}

/** En vigueur MAINTENANT : armée et aujourd'hui dans l'intervalle, bornes
 *  incluses — exactement le `between` de is_messaging_blacked_out. */
export function estEnCours(b: BlackoutLike, todayIso = todayMontrealIso()): boolean {
  return b.actif && b.date_debut <= todayIso && todayIso <= b.date_fin;
}

/** À venir : armée, mais elle commence après aujourd'hui. */
export function estAVenir(b: BlackoutLike, todayIso = todayMontrealIso()): boolean {
  return b.actif && b.date_debut > todayIso;
}
