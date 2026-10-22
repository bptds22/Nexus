/* ═══════════════════════════════════════════════════════════════
   Écran mural (/admin/ecran) — calculs purs, sans réseau.

   Toutes les limites de temps sont en HEURE DE MONTRÉAL (décision BP
   2026-10-22). Le serveur Vercel tourne en UTC : un `setHours(0)` y
   donnerait minuit UTC, soit 20 h ou 19 h la veille à Montréal. On passe
   donc par l'heure murale de America/Toronto (même fuseau que Montréal,
   changements d'heure compris).

   - 7 derniers jours = [maintenant − 7 jours, maintenant), à la même
     heure murale : un changement d'heure dans la fenêtre ne la décale pas.
     C'est le `now() - interval '7 days'` de Postgres sous
     `set timezone = 'America/Toronto'` — la requête de contrôle à la main.
   - Semaines = du lundi 00:00 au lundi suivant 00:00, heure de Montréal.

   Aucune donnée de personne ici : des dates et des nombres.
═══════════════════════════════════════════════════════════════ */

export const FUSEAU_MONTREAL = "America/Toronto";

export interface PartiesMurales {
  annee: number;
  mois: number; // 1–12
  jour: number;
  heure: number;
  minute: number;
  seconde: number;
  /** 0 = lundi … 6 = dimanche */
  jourSemaine: number;
}

const formatMural = new Intl.DateTimeFormat("en-CA", {
  timeZone: FUSEAU_MONTREAL,
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
  weekday: "short", hourCycle: "h23",
});

const JOURS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Heure murale de Montréal d'un instant. */
export function partiesMontreal(instant: Date): PartiesMurales {
  const p: Record<string, string> = {};
  for (const x of formatMural.formatToParts(instant)) p[x.type] = x.value;
  return {
    annee: Number(p.year),
    mois: Number(p.month),
    jour: Number(p.day),
    heure: Number(p.hour),
    minute: Number(p.minute),
    seconde: Number(p.second),
    jourSemaine: JOURS.indexOf(p.weekday),
  };
}

/** Écart (ms) entre l'heure murale de Montréal et l'UTC à cet instant. */
function ecartMontreal(instant: Date): number {
  const p = partiesMontreal(instant);
  const commeUtc = Date.UTC(p.annee, p.mois - 1, p.jour, p.heure, p.minute, p.seconde);
  return commeUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** L'instant qui porte cette heure murale à Montréal. Le jour peut déborder
 *  (jour 0, jour 32…) : Date.UTC le normalise, ce qui sert au calcul des
 *  semaines. Une heure qui n'existe pas (saut de printemps, 2 h 30) RECULE
 *  d'une heure (1 h 30 HNE) — vérifié par les tests du QG ; voir
 *  `memeMomentMural` pour les comparaisons « à date ». */
export function montrealVersInstant(
  annee: number, mois: number, jour: number, heure = 0, minute = 0, seconde = 0,
): Date {
  const mural = Date.UTC(annee, mois - 1, jour, heure, minute, seconde);
  let instant = mural - ecartMontreal(new Date(mural));
  // Second passage : l'écart peut changer entre la supposition et le résultat.
  instant = mural - ecartMontreal(new Date(instant));
  return new Date(instant);
}

/** Même heure murale, `n` jours plus tôt (n > 0) ou plus tard (n < 0),
 *  millisecondes comprises (l'heure murale s'arrête à la seconde). */
export function joursAvant(instant: Date, n: number): Date {
  const p = partiesMontreal(instant);
  const ms = ((instant.getTime() % 1000) + 1000) % 1000;
  return new Date(montrealVersInstant(p.annee, p.mois, p.jour - n, p.heure, p.minute, p.seconde).getTime() + ms);
}

export interface Fenetre {
  /** inclus */
  de: Date;
  /** exclu */
  a: Date;
}

/** Les 7 derniers jours et les 7 d'avant. */
export function fenetres7Jours(maintenant: Date): { courant: Fenetre; precedent: Fenetre } {
  const il7 = joursAvant(maintenant, 7);
  const il14 = joursAvant(maintenant, 14);
  return {
    courant: { de: il7, a: maintenant },
    precedent: { de: il14, a: il7 },
  };
}

/** Lundi 00:00 (Montréal) de la semaine qui contient `instant`. */
export function lundiMontreal(instant: Date): Date {
  const p = partiesMontreal(instant);
  return montrealVersInstant(p.annee, p.mois, p.jour - p.jourSemaine);
}

/** Début de chacune des `n` dernières semaines, la plus ancienne d'abord ;
 *  la dernière est la semaine en cours. */
export function debutsSemaines(maintenant: Date, n = 12): Date[] {
  const lundi = partiesMontreal(lundiMontreal(maintenant));
  const debuts: Date[] = [];
  for (let i = n - 1; i >= 0; i--) {
    debuts.push(montrealVersInstant(lundi.annee, lundi.mois, lundi.jour - 7 * i));
  }
  return debuts;
}

/** Rang de la semaine de `instant` dans `debuts` (trié, la plus ancienne
 *  d'abord), ou −1 si l'instant est avant la première ou après `fin`. */
export function rangSemaine(instant: Date, debuts: Date[], fin: Date): number {
  const t = instant.getTime();
  if (debuts.length === 0 || t < debuts[0].getTime() || t >= fin.getTime()) return -1;
  for (let i = debuts.length - 1; i >= 0; i--) {
    if (t >= debuts[i].getTime()) return i;
  }
  return -1;
}

/** Nombre de dates dans [de, a). Les valeurs vides ou illisibles sont ignorées. */
export function compterDans(dates: Iterable<string | null | undefined>, f: Fenetre): number {
  const de = f.de.getTime();
  const a = f.a.getTime();
  let n = 0;
  for (const d of dates) {
    if (!d) continue;
    const t = new Date(d).getTime();
    if (Number.isFinite(t) && t >= de && t < a) n++;
  }
  return n;
}

/** Comptes par semaine pour une série de dates. */
export function parSemaine(
  dates: Iterable<string | null | undefined>, debuts: Date[], fin: Date,
): number[] {
  const comptes = debuts.map(() => 0);
  for (const d of dates) {
    if (!d) continue;
    const t = new Date(d);
    if (!Number.isFinite(t.getTime())) continue;
    const i = rangSemaine(t, debuts, fin);
    if (i >= 0) comptes[i]++;
  }
  return comptes;
}

/** Libellé court d'un début de semaine, à la française : « 13 oct. ». */
export function libelleSemaine(debut: Date): string {
  return debut.toLocaleDateString("fr-CA", { timeZone: FUSEAU_MONTREAL, day: "numeric", month: "short" });
}

/* ── Périodes du QG admin (/admin/qg) : jour, semaine, mois ─────────
   « À date vs même moment » (décision BP 2026-10-22), heure murale de
   Montréal, changements d'heure compris :
   - jour    : aujourd'hui 0 h → maintenant  vs  hier 0 h → même heure ;
   - semaine : lundi 0 h → maintenant  vs  lundi précédent → même jour, même heure ;
   - mois    : le 1er → maintenant  vs  le 1er du mois précédent → même jour,
               même heure, borné à la fin de ce mois (31 mars → fin février).
   ───────────────────────────────────────────────────────────────── */

export type Granularite = "jour" | "semaine" | "mois";

/** Longueur des séries du QG (décision BP) : 30 jours, 12 semaines, 12 mois. */
export const LONGUEUR_SERIE: Record<Granularite, number> = { jour: 30, semaine: 12, mois: 12 };

/** 0 h (Montréal) du jour qui contient `instant`. */
export function debutJourMontreal(instant: Date): Date {
  const p = partiesMontreal(instant);
  return montrealVersInstant(p.annee, p.mois, p.jour);
}

/** Le 1er à 0 h (Montréal) du mois qui contient `instant`. */
export function debutMoisMontreal(instant: Date): Date {
  const p = partiesMontreal(instant);
  return montrealVersInstant(p.annee, p.mois, 1);
}

/** Début de la période (jour, semaine du lundi, mois) qui contient `instant`. */
export function debutPeriode(instant: Date, g: Granularite): Date {
  if (g === "jour") return debutJourMontreal(instant);
  if (g === "semaine") return lundiMontreal(instant);
  return debutMoisMontreal(instant);
}

/** Début de la période située `n` périodes avant celle qui commence à `debut`. */
function periodeAvant(debut: Date, g: Granularite, n: number): Date {
  const p = partiesMontreal(debut);
  if (g === "jour") return montrealVersInstant(p.annee, p.mois, p.jour - n);
  if (g === "semaine") return montrealVersInstant(p.annee, p.mois, p.jour - 7 * n);
  // Date.UTC normalise le mois 0, −1… vers l'année précédente.
  return montrealVersInstant(p.annee, p.mois - n, 1);
}

/** L'instant qui porte cette heure murale, millisecondes comprises. Si elle
 *  n'existe pas (2 h 30 le jour du saut de printemps), on rend le moment du
 *  saut (3 h 00 HAE) : tout ce qui précède 2 h 30 à l'horloge, ni plus ni moins. */
function memeMomentMural(annee: number, mois: number, jour: number, heure: number, minute: number, seconde: number, ms: number): Date {
  const x = montrealVersInstant(annee, mois, jour, heure, minute, seconde);
  const p = partiesMontreal(x);
  if (p.heure !== heure || p.minute !== minute) {
    return montrealVersInstant(annee, mois, jour, heure + 1, 0, 0);
  }
  return new Date(x.getTime() + ms);
}

/** La période en cours jusqu'à maintenant, et la précédente jusqu'au même moment. */
export function fenetresADate(maintenant: Date, g: Granularite): { courant: Fenetre; precedent: Fenetre } {
  const debut = debutPeriode(maintenant, g);
  const debutAvant = periodeAvant(debut, g, 1);
  const p = partiesMontreal(maintenant);
  const ms = ((maintenant.getTime() % 1000) + 1000) % 1000;
  let finAvant: Date;
  if (g === "jour") finAvant = memeMomentMural(p.annee, p.mois, p.jour - 1, p.heure, p.minute, p.seconde, ms);
  else if (g === "semaine") finAvant = memeMomentMural(p.annee, p.mois, p.jour - 7, p.heure, p.minute, p.seconde, ms);
  else {
    const memeMoment = memeMomentMural(p.annee, p.mois - 1, p.jour, p.heure, p.minute, p.seconde, ms);
    // Le 31 n'existe pas toujours le mois d'avant : on s'arrête à la fin de ce mois.
    finAvant = memeMoment.getTime() > debut.getTime() ? debut : memeMoment;
  }
  return {
    courant: { de: debut, a: maintenant },
    precedent: { de: debutAvant, a: finAvant },
  };
}

/** Début de chacune des `n` dernières périodes, la plus ancienne d'abord ;
 *  la dernière est la période en cours. */
export function debutsPeriodes(maintenant: Date, g: Granularite, n = LONGUEUR_SERIE[g]): Date[] {
  const debut = debutPeriode(maintenant, g);
  const debuts: Date[] = [];
  for (let i = n - 1; i >= 0; i--) debuts.push(periodeAvant(debut, g, i));
  return debuts;
}

/** Comptes par période (mêmes règles que `parSemaine` : périodes contiguës, la dernière jusqu'à `fin`). */
export function parPeriode(dates: Iterable<string | null | undefined>, debuts: Date[], fin: Date): number[] {
  return parSemaine(dates, debuts, fin);
}

/** Libellé court d'un début de période : « 22 oct. » (jour, semaine) ou « oct. 2026 » (mois). */
export function libellePeriode(debut: Date, g: Granularite): string {
  if (g === "mois") {
    return debut.toLocaleDateString("fr-CA", { timeZone: FUSEAU_MONTREAL, month: "short", year: "numeric" });
  }
  return libelleSemaine(debut);
}

/* ── Ce que la route renvoie au navigateur : des nombres, rien d'autre ── */

export interface Comparaison {
  courant: number;
  precedent: number;
}

export interface EcranMuralDonnees {
  /** ISO — moment du calcul côté serveur. */
  calcule_le: string;
  fenetres: { courant_de: string; precedent_de: string };
  tuiles: {
    nouveaux_athletes: Comparaison;
    athletes_actifs: number;
    profils_vus: Comparaison;
    recruteurs_actifs: Comparaison;
    mouvements_processus: Comparaison;
    nouveaux_coachs: Comparaison;
    nouveaux_recruteurs: Comparaison;
  };
  inscriptions: {
    semaine: string; // libellé « 13 oct. »
    athletes: number;
    autres: number;
    en_cours: boolean;
  }[];
  activite: {
    profils_consultes: Comparaison;
    favoris: Comparaison;
    mouvements_processus: Comparaison;
    suivi_cartes: Comparaison;
    notes_match: Comparaison;
    messages: Comparaison;
  };
  parcours: {
    inscrits: number;
    profil_80: number;
    valide_coach: number;
    vu_recruteur: number;
    suivi_recruteur: number;
  };
  files: {
    invitations_parent: { reclamees: number; en_attente: number; expirees: number };
    /** 4 cases (BP 2026-10-22) : la somme fait tous les athlètes admissibles. */
    consentements_v2: { acceptes: number; refuses: number; en_attente: number; jamais_demande: number };
    ecoles_non_listees: number;
    loi25_ouvertes: number;
    reclamations_etablissement: number;
  };
}

/** Actions du journal des cartes qui ne sont PAS du suivi : la création, les
 *  notes et les modifications viennent en masse des imports (décision BP). */
export const ACTIONS_CARTES_EXCLUES = ["CREEE", "NOTE", "MODIFIEE"] as const;
