/* ═══════════════════════════════════════════════════════════════
   carteMatchs — la CARTE DES MATCHS d'une journée (lot A, décisions BP
   2026-10-07), pur et testé. Tout le calcul vit ici : la page web n'en est
   qu'un rendu, et le lot mobile le réutilisera tel quel.

   · Lot A = les matchs où joue AU MOINS un athlète suivi par l'unité
     (les cibles de useCalendrierUnite, appariées par buildMatches).
   · Une journée à la fois. Collégial exclu.
   · Sport par défaut = celui de l'unité ; catégorie / division / ligue
     filtrables (la page les grise quand une seule valeur existe).
   · Un terrain = coordonnées arrondies à 4 décimales (~11 m) + nom.
   · Lieu non exploitable (0,0 ; hors Québec ; absent) → liste seulement,
     « Lieu non précisé ».
   · Distance (haversine) : fonction gardée et testée, mais l'écran ne
     l'affiche plus (décision BP 2026-10-07, étape 2).
   · Heure à la québécoise (« 9 h 30 ») ; match sans heure → agenda en
     journée entière, « (heure à confirmer) » dans le titre.
═══════════════════════════════════════════════════════════════ */

import { buildMatches } from "@/lib/calendar/recruitingCalendar";
import type { CalendarGame, CalendarTarget, RecruitingCalendarData } from "@/lib/queries/recruiter/useRecruitingCalendar";
import { generateCalendarLinks, type CalendarLinks } from "@/lib/calendar/generateCalendarLinks";
import { LOCKED_NAME_LABEL } from "@/lib/queries/shared/recruiterAthleteCards";

/* ── Lieu ──────────────────────────────────────────────────── */

/** Boîte du Québec (décision BP) : lat 44–63, lon -80 à -57. */
export const BORNES_QUEBEC = { latMin: 44, latMax: 63, lonMin: -80, lonMax: -57 } as const;

export function lieuExploitable(lat: number | null | undefined, lon: number | null | undefined): boolean {
  if (lat === null || lat === undefined || lon === null || lon === undefined) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat === 0 || lon === 0) return false;
  return lat >= BORNES_QUEBEC.latMin && lat <= BORNES_QUEBEC.latMax
      && lon >= BORNES_QUEBEC.lonMin && lon <= BORNES_QUEBEC.lonMax;
}

export const LIEU_NON_PRECISE = "Lieu non précisé";

/* ── Filtres ───────────────────────────────────────────────── */

export interface FiltresCarte {
  /** Nom du sport (games.sport, ex. « Football ») ; vide = tous. */
  sport: string;
  categorie: string;
  division: string;
  ligue: string;
}

export const FILTRES_VIDES: FiltresCarte = { sport: "", categorie: "", division: "", ligue: "" };

const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

export function estCollegial(sector: string | null | undefined): boolean {
  return norm(sector) === "collegial";
}

/* ── Matchs du jour ────────────────────────────────────────── */

export interface MatchCarte {
  game: CalendarGame;
  /** Athlètes suivis de chaque côté (cibles de l'unité). */
  suivisDomicile: CalendarTarget[];
  suivisVisiteur: CalendarTarget[];
  lieuOk: boolean;
}

/** "HH:MM" → minutes depuis minuit ; null si absente ou illisible. */
export function minutesDe(heure: string | null | undefined): number | null {
  const m = /^\s*(\d{1,2})[:h](\d{2})/.exec(heure ?? "");
  if (!m) return null;
  const h = Number(m[1]), mi = Number(m[2]);
  if (h > 23 || mi > 59) return null;
  return h * 60 + mi;
}

/** Les matchs du jour `date` ("YYYY-MM-DD") où joue au moins un athlète suivi,
 *  collégial exclu, filtrés, triés par heure (sans heure : en fin de liste). */
export function matchsDuJour(
  calendrier: Pick<RecruitingCalendarData, "games" | "targets">,
  date: string,
  filtres: FiltresCarte = FILTRES_VIDES,
): MatchCarte[] {
  const duJour = calendrier.games.filter((g) => g.gameDate === date && !estCollegial(g.sector));
  return buildMatches(duJour, calendrier.targets)
    .filter((v) => passeFiltres(v.game, filtres))
    .map((v) => ({
      game: v.game,
      suivisDomicile: v.homeTargets,
      suivisVisiteur: v.visitorTargets,
      lieuOk: lieuExploitable(v.game.venueLat, v.game.venueLon),
    }))
    .sort((a, b) => {
      const ma = minutesDe(a.game.gameTime), mb = minutesDe(b.game.gameTime);
      if (ma === null && mb === null) return 0;
      if (ma === null) return 1;
      if (mb === null) return -1;
      return ma - mb;
    });
}

function passeFiltres(g: CalendarGame, f: FiltresCarte): boolean {
  if (f.sport && norm(g.sport) !== norm(f.sport)) return false;
  if (f.categorie && norm(g.category) !== norm(f.categorie)) return false;
  if (f.division && norm(g.division) !== norm(f.division)) return false;
  if (f.ligue && norm(g.leagueName) !== norm(f.ligue)) return false;
  return true;
}

/** Les valeurs offertes par chaque filtre pour ce jour-là (collégial exclu).
 *  Catégorie / division / ligue se calculent DANS le sport choisi. Une liste
 *  d'une seule valeur → la page grise le filtre (jamais caché, décision BP). */
export function optionsFiltres(
  calendrier: Pick<RecruitingCalendarData, "games" | "targets">,
  date: string,
  sport: string,
): { sports: string[]; categories: string[]; divisions: string[]; ligues: string[] } {
  const tous = matchsDuJour(calendrier, date, FILTRES_VIDES).map((m) => m.game);
  const duSport = sport ? tous.filter((g) => norm(g.sport) === norm(sport)) : tous;
  const valeurs = (gs: CalendarGame[], cle: (g: CalendarGame) => string | null | undefined) =>
    [...new Set(gs.map(cle).map((v) => (v ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  return {
    sports: valeurs(tous, (g) => g.sport),
    categories: valeurs(duSport, (g) => g.category),
    divisions: valeurs(duSport, (g) => g.division),
    ligues: valeurs(duSport, (g) => g.leagueName),
  };
}

/* ── Terrains ──────────────────────────────────────────────── */

export interface TerrainCarte {
  /** Clé stable : coordonnées arrondies à 4 décimales + nom normalisé. */
  id: string;
  nom: string;
  lat: number;
  lon: number;
  /** Ses matchs du jour, par heure. */
  matchs: MatchCarte[];
}

export function cleTerrain(lat: number, lon: number, nom: string): string {
  return `${lat.toFixed(4)},${lon.toFixed(4)}|${norm(nom)}`;
}

/** Un point par terrain : coordonnées arrondies à 4 décimales + nom. Deux
 *  terrains au même nom à des endroits différents restent DEUX points ; deux
 *  matchs au même terrain, un seul. Les matchs sans lieu exploitable n'y
 *  sont pas (liste seulement). */
/** Le terrain d'un match (clé, nom, coordonnées arrondies) ; null sans lieu
 *  exploitable. Une seule définition, pour la carte ET la liste. */
export function terrainDuMatch(m: MatchCarte): { id: string; nom: string; lat: number; lon: number } | null {
  if (!m.lieuOk) return null;
  const lat = Number(m.game.venueLat!.toFixed(4));
  const lon = Number(m.game.venueLon!.toFixed(4));
  const nom = m.game.venue.trim() || LIEU_NON_PRECISE;
  return { id: cleTerrain(lat, lon, nom), nom, lat, lon };
}

export function terrainsDuJour(matchs: MatchCarte[]): TerrainCarte[] {
  const parCle = new Map<string, TerrainCarte>();
  for (const m of matchs) {
    const tm = terrainDuMatch(m);
    if (!tm) continue;
    const { id, nom, lat, lon } = tm;
    const t = parCle.get(id) ?? { id, nom, lat, lon, matchs: [] };
    t.matchs.push(m);
    parCle.set(id, t);
  }
  // Ordre : premier match du terrain (les matchs arrivent déjà triés).
  return [...parCle.values()];
}

/* ── Distance ──────────────────────────────────────────────── */

/** Km à vol d'oiseau (haversine, R = 6371 km). null si un point manque. */
export function distanceKm(
  depuis: { lat: number | null | undefined; lon: number | null | undefined } | null | undefined,
  vers: { lat: number | null | undefined; lon: number | null | undefined } | null | undefined,
): number | null {
  if (!depuis || !vers) return null;
  const { lat: a1, lon: o1 } = depuis, { lat: a2, lon: o2 } = vers;
  if (![a1, o1, a2, o2].every((v) => typeof v === "number" && Number.isFinite(v))) return null;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(a2! - a1!), dLon = rad(o2! - o1!);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a1!)) * Math.cos(rad(a2!)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function libelleDistance(km: number | null): string | null {
  if (km === null) return null;
  return km < 10 ? `${km.toFixed(1).replace(".", ",")} km` : `${Math.round(km)} km`;
}

/* ── Actions par match ─────────────────────────────────────── */

/** Itinéraire Google Maps jusqu'au terrain (nouvel onglet côté page). */
export function lienItineraire(lat: number, lon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}

/** « Équipe A vs Équipe B ». */
export function titreMatch(g: Pick<CalendarGame, "homeName" | "visitorName">): string {
  return `${g.homeName} vs ${g.visitorName}`;
}

/** L'événement d'agenda d'un match (Google, Outlook, .ics). Heure LOCALE du
 *  navigateur (games.game_time n'a pas de fuseau ; le recruteur est au
 *  Québec). Sans heure lisible → événement « journée entière », titre
 *  « A vs B (heure à confirmer) » (décision BP 2026-10-07) : on n'invente
 *  jamais une heure. */
export function evenementMatch(g: CalendarGame): CalendarLinks {
  const minutes = minutesDe(g.gameTime);
  const [y, mo, d] = g.gameDate.split("-").map(Number);
  const description = g.competition ? `${g.competition} — via Nexus` : "Via Nexus";
  if (minutes === null) {
    return generateCalendarLinks({
      title: `${titreMatch(g)} (heure à confirmer)`,
      location: g.venue.trim(),
      description,
      startDate: new Date(y, (mo ?? 1) - 1, d ?? 1),
      allDay: true,
    });
  }
  const debut = new Date(y, (mo ?? 1) - 1, d ?? 1, Math.floor(minutes / 60), minutes % 60, 0, 0);
  return generateCalendarLinks({
    title: titreMatch(g),
    location: g.venue.trim(),
    description,
    startDate: debut,
    durationMinutes: 120,
  });
}

/* ── Libellés ──────────────────────────────────────────────── */

/** « 09:30 » → « 9 h 30 » ; « 18:00 » → « 18 h » (usage québécois, OQLF).
 *  Sans heure lisible → « Heure à confirmer ». */
export function heureQuebec(heure: string | null | undefined): string {
  const m = minutesDe(heure);
  if (m === null) return "Heure à confirmer";
  const h = Math.floor(m / 60), mi = m % 60;
  return mi === 0 ? `${h} h` : `${h} h ${String(mi).padStart(2, "0")}`;
}

/** « D1 » → « Division 1 » ; toute autre forme est rendue telle quelle.
 *  Les codes de LIGUE (« Volleyball C F D1 ») restent bruts : aucune table
 *  de correspondance n'existe dans le dépôt (vérifié 2026-10-07). */
export function libelleDivision(division: string | null | undefined): string {
  const v = (division ?? "").trim();
  const m = /^D\s*(\d+)$/i.exec(v);
  return m ? `Division ${m[1]}` : v;
}

/** Les matchs d'un terrain pour sa bulle : celui qu'on a cliqué EN PREMIER,
 *  puis les autres par heure. */
export function matchsBulle(terrain: Pick<TerrainCarte, "matchs">, premierId: string | null): MatchCarte[] {
  const premier = terrain.matchs.find((m) => m.game.id === premierId);
  return premier ? [premier, ...terrain.matchs.filter((m) => m !== premier)] : terrain.matchs;
}

/* ── Journées ──────────────────────────────────────────────── */

/** "YYYY-MM-DD" local, décalé de `jours` depuis `base`. */
export function jourDecale(base: Date, jours: number): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + jours);
  const p = (v: number) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Statistique par jour, pour mesurer la charge (combien de terrains et de
 *  matchs), sans filtre de catégorie / division / ligue. */
export function chargeParJour(
  calendrier: Pick<RecruitingCalendarData, "games" | "targets">,
  sport: string,
): { date: string; matchs: number; terrains: number; sansLieu: number }[] {
  const dates = [...new Set(calendrier.games.map((g) => g.gameDate))].sort();
  return dates.map((date) => {
    const m = matchsDuJour(calendrier, date, { ...FILTRES_VIDES, sport });
    return { date, matchs: m.length, terrains: terrainsDuJour(m).length, sansLieu: m.filter((x) => !x.lieuOk).length };
  }).filter((j) => j.matchs > 0);
}

/* ── Athlètes suivis ───────────────────────────────────────── */

/** Loi 25 : identité non visible → « Identité réservée », comme le Calendrier
 *  et le flux d'agenda. Jamais d'initiale ni de fragment de nom. */
export const IDENTITE_RESERVEE = LOCKED_NAME_LABEL;

export function nomSuivi(t: Pick<CalendarTarget, "identityVisible" | "fullName">): string {
  return t.identityVisible ? (t.fullName.trim() || IDENTITE_RESERVEE) : IDENTITE_RESERVEE;
}

/* ── Profils Nexus dans ce match (lot A+, BP 2026-10-07) ───── */

/** Une ligne de la RPC `matchs_profils_nexus` (forme PostgREST). La base ne
 *  rend que des profils ACTIF à l'identité visible (athlete_identity_ok) :
 *  rien n'est filtré ici, rien n'est à masquer. */
export interface LigneProfilNexus {
  game_id: string;
  athlete_id: string;
  prenom: string | null;
  nom: string | null;
  position: string | null;
  promotion: number | null;
  cote: "DOMICILE" | "VISITEUR";
}

export interface ProfilNexus {
  athleteId: string;
  prenom: string;
  nom: string;
  position: string | null;
  promotion: number | null;
  cote: "DOMICILE" | "VISITEUR";
  /** Suivi par l'unité du recruteur (ses cibles). */
  suivi: boolean;
}

export interface ProfilsMatch {
  total: number;
  suivis: number;
  /** Suivis d'abord, puis par nom et prénom. */
  profils: ProfilNexus[];
}

/** Regroupe les lignes de la RPC par match. `suivis` = les athlete_id suivis
 *  par l'unité ; vide pour un écran qui ne connaît pas l'unité (le lot B
 *  l'appellera sur « tous les matchs » : aucun couplage au mode « suivis »).
 *  Un athlète présent deux fois dans un match n'est compté qu'une fois. */
export function profilsParMatch(
  lignes: LigneProfilNexus[],
  suivis: ReadonlySet<string> = new Set(),
): Map<string, ProfilsMatch> {
  const parMatch = new Map<string, Map<string, ProfilNexus>>();
  for (const l of lignes) {
    const m = parMatch.get(l.game_id) ?? new Map<string, ProfilNexus>();
    if (!m.has(l.athlete_id)) {
      m.set(l.athlete_id, {
        athleteId: l.athlete_id,
        prenom: (l.prenom ?? "").trim(),
        nom: (l.nom ?? "").trim(),
        position: l.position?.trim() || null,
        promotion: l.promotion ?? null,
        cote: l.cote,
        suivi: suivis.has(l.athlete_id),
      });
    }
    parMatch.set(l.game_id, m);
  }
  const cle = (p: ProfilNexus) => `${p.nom} ${p.prenom}`;
  const out = new Map<string, ProfilsMatch>();
  for (const [gameId, m] of parMatch) {
    const profils = [...m.values()].sort((a, b) =>
      Number(b.suivi) - Number(a.suivi) || cle(a).localeCompare(cle(b), "fr", { sensitivity: "base" }));
    out.set(gameId, { total: profils.length, suivis: profils.filter((p) => p.suivi).length, profils });
  }
  return out;
}

/** « 4 profils Nexus », « 1 profil Nexus » ; null si aucun (rien à afficher). */
export function libelleProfils(p: Pick<ProfilsMatch, "total"> | null | undefined): string | null {
  if (!p || p.total <= 0) return null;
  return `${p.total} profil${p.total > 1 ? "s" : ""} Nexus`;
}

/** « dont 1 suivi », « dont 2 suivis » ; null si l'unité n'en suit aucun. */
export function libelleDontSuivis(p: Pick<ProfilsMatch, "suivis"> | null | undefined): string | null {
  if (!p || p.suivis <= 0) return null;
  return `dont ${p.suivis} suivi${p.suivis > 1 ? "s" : ""}`;
}
