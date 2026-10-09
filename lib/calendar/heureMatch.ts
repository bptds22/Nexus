/* ═══════════════════════════════════════════════════════════════
   heureMatch — LA lecture de l'heure d'un match (`games.game_time`).
   Une seule fonction pour la carte des matchs, le Calendrier, le tri et
   tout export : pas de deuxième parseur (décision BP 2026-10-09).

   Deux formes en base (relevé prod 2026-10-09) :
     · RSEQ : « 18:30 », 24 h (converti des minutes de la source) ;
     · ligues civiles (LFMM, QBFL, QMFL, QMJFL) : « 6:30 PM », « 8:00 pm »,
       l'heure BRUTE de la source — exacte en base (446/446 conformes).
   L'ancienne lecture ignorait AM/PM : « 6:30 PM » s'affichait 6 h 30.
   Affichage toujours en 24 h, usage québécois (« 18 h 30 »).
═══════════════════════════════════════════════════════════════ */

/** Heure d'un match → minutes depuis minuit ; null si absente ou illisible.
 *  12:xx PM = midi, 12:xx AM = minuit. */
export function minutesDe(heure: string | null | undefined): number | null {
  const m = /^\s*(\d{1,2})\s*(?:[:h]\s*(\d{2}))?\s*(?:([ap])\.?\s*m\b\.?)?/i.exec(heure ?? "");
  if (!m || (m[2] === undefined && !m[3])) return null;
  let h = Number(m[1]);
  const mi = Number(m[2] ?? 0);
  if (mi > 59) return null;
  if (m[3]) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (m[3].toLowerCase() === "p" ? 12 : 0);
  } else if (h > 23) return null;
  return h * 60 + mi;
}

/** « 09:30 » → « 9 h 30 » ; « 18:00 » → « 18 h » (usage québécois, OQLF).
 *  Sans heure lisible → « Heure à confirmer ». */
export function heureQuebec(heure: string | null | undefined): string {
  const m = minutesDe(heure);
  if (m === null) return "Heure à confirmer";
  const h = Math.floor(m / 60), mi = m % 60;
  return mi === 0 ? `${h} h` : `${h} h ${String(mi).padStart(2, "0")}`;
}

/** L'heure d'une carte de match : « 13 h 00 », « 9 h 30 » (minutes toujours
 *  écrites, la colonne s'aligne), sinon « Heure à confirmer ». */
export function heureCarte(heure: string | null | undefined): string {
  const m = minutesDe(heure);
  if (m === null) return "Heure à confirmer";
  return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
}

/** Le fuseau des matchs : l'heure publiée est celle du terrain, au Québec. */
export const FUSEAU_MATCHS = "America/Toronto";

/** Décalage (ms) de `fuseau` par rapport à UTC à l'instant `t`. */
function decalage(t: number, fuseau: string): number {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: fuseau, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(t)).map((x) => [x.type, x.value]),
  );
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - t;
}

/** L'instant absolu d'un match : son jour (« YYYY-MM-DD ») et son heure, lus
 *  à l'heure de Montréal (heure d'été comprise). null sans heure lisible —
 *  un export ne doit pas inventer minuit. */
export function instantMatch(jour: string, heure: string | null | undefined, fuseau = FUSEAU_MATCHS): Date | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(jour);
  const mn = minutesDe(heure);
  if (!d || mn === null) return null;
  const mur = Date.UTC(+d[1], +d[2] - 1, +d[3], Math.floor(mn / 60), mn % 60);
  // Deux passes : le décalage se lit à l'instant visé, pas à l'heure « murale ».
  let t = mur - decalage(mur, fuseau);
  t = mur - decalage(t, fuseau);
  return new Date(t);
}
