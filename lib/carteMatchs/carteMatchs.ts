/* ═══════════════════════════════════════════════════════════════
   carteMatchs — la CARTE DES MATCHS, pur et testé. La page web n'en est
   qu'un rendu ; le lot mobile le reprendra tel quel.

   Lot B (BP 2026-10-07) : la carte est un MOTEUR DE RECHERCHE de TOUS les
   matchs d'une plage de dates (31 jours au plus), servi par la RPC
   matchs_recherche. Le mode « suivis » des lots A / A+ a disparu : le
   Calendrier reste l'endroit des matchs des athlètes suivis.

   · Une ligne = un match : équipes, heure (« 9 h 30 »), terrain, « + ».
   · Liste groupée par jour, puis par heure (l'ordre vient de la base).
   · Un point par terrain ; étoile si un athlète suivi par l'unité joue dans
     l'un de ses matchs (cible).
   · Lieu non exploitable → liste seulement, « Lieu non précisé ».
═══════════════════════════════════════════════════════════════ */

import { sourceDuMatch, type SourceMatch } from "@/lib/calendar/sourceMatch";
import { heureCarte, heureQuebec, minutesDe } from "@/lib/calendar/heureMatch";
import { nomGroupe } from "@/lib/civil/classementCivil";

/** La lecture de l'heure est PARTAGÉE (lib/calendar/heureMatch) : réexportée ici
 *  pour les appelants de la carte, jamais redéfinie. */
export { heureCarte, heureQuebec, minutesDe };

/* ── Lieu ──────────────────────────────────────────────────── */

/** Boîte du Québec (décision BP) : lat 44–63, lon -80 à -57. Même règle
 *  que la base (matchs_recherche). */
export const BORNES_QUEBEC = { latMin: 44, latMax: 63, lonMin: -80, lonMax: -57 } as const;

export function lieuExploitable(lat: number | null | undefined, lon: number | null | undefined): boolean {
  if (lat === null || lat === undefined || lon === null || lon === undefined) return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (lat === 0 || lon === 0) return false;
  return lat >= BORNES_QUEBEC.latMin && lat <= BORNES_QUEBEC.latMax
      && lon >= BORNES_QUEBEC.lonMin && lon <= BORNES_QUEBEC.lonMax;
}

export const LIEU_NON_PRECISE = "Lieu non précisé";

const norm = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/* ── Types et filtres ──────────────────────────────────────── */

export type TypeMatch = "SECONDAIRE" | "COLLEGIAL" | "CIVIL";

export const TYPES_MATCH: { v: TypeMatch; label: string }[] = [
  { v: "SECONDAIRE", label: "Secondaire" },
  { v: "COLLEGIAL", label: "Collégial" },
  { v: "CIVIL", label: "Civil" },
];

/** Collégial DÉCOCHÉ par défaut (décision BP 2). */
export const TYPES_PAR_DEFAUT: TypeMatch[] = ["SECONDAIRE", "CIVIL"];

/** Plage de 31 jours au plus (BP 2026-10-09 ; 7 avant). Même borne que la
 *  garde de matchs_recherche — mesure prod : 374 ms pour la période de 31 jours
 *  à venir la plus chargée (3 804 matchs, ~418 terrains). */
export const JOURS_MAX = 31;

/** Une ligne de la RPC `matchs_recherche` (forme PostgREST). */
export interface MatchRecherche {
  id: string;
  jour: string;
  heure: string | null;
  domicile: string;
  visiteur: string;
  terrain: string | null;
  sport: string | null;
  categorie: string | null;
  division: string | null;
  /** Zone du groupe civil (Nord, Sud…) — jamais dans le filtre Division,
   *  toujours dans le nom du groupe (BP 2026-10-09). */
  zone?: string | null;
  ligue: string | null;
  type: TypeMatch | null;
  lat: number | null;
  lon: number | null;
  nb_profils: number;
  /** Un athlète suivi par l'unité y joue : le match est déjà au Calendrier. */
  cible: boolean;
  /** Ajouté au calendrier de l'unité (matchs_ajoutes). */
  ajoute: boolean;
}

/** Nombre de jours de la plage, bornes comprises ; null si une borne manque
 *  ou si la fin précède le début. */
export function joursDansPlage(debut: string, fin: string | null | undefined): number | null {
  const d = dateLocale(debut), f = dateLocale(fin || debut);
  if (!d || !f) return null;
  const n = Math.round((f.getTime() - d.getTime()) / 86_400_000) + 1;
  return n >= 1 ? n : null;
}

/** La date de fin à RETENIR pour une saisie : au-delà de JOURS_MAX, la fin est
 *  ramenée à début + JOURS_MAX − 1 et `ajustee` le dit (BP 2026-10-09). Avant,
 *  une plage trop longue était refusée par la base et la page restait figée sur
 *  les anciens résultats. Une fin vide reste vide ; une fin avant le début est
 *  laissée telle quelle (erreurPlage la signale). */
export function bornerFin(debut: string, fin: string | null | undefined): { fin: string; ajustee: boolean } {
  const n = joursDansPlage(debut, fin);
  if (!fin || n === null || n <= JOURS_MAX) return { fin: fin ?? "", ajustee: false };
  const d = dateLocale(debut);
  return d ? { fin: jourDecale(d, JOURS_MAX - 1), ajustee: true } : { fin, ajustee: false };
}

/** Plafond de lignes d'une réponse PostgREST (`max_rows`, 1 000 : config.toml
 *  et réglage par défaut du projet). Au-delà, la réponse est COUPÉE sans erreur. */
export const PLAFOND_LIGNES = 1000;

/** Découpe [debut, fin] en fenêtres consécutives de `taille` jours au plus,
 *  bornes comprises. La recherche est lancée par fenêtre : sur 31 jours, une
 *  seule réponse dépasserait le plafond de PostgREST (3 804 matchs sur la
 *  période la plus chargée, relevé prod 2026-10-09). */
export function fenetres(debut: string, fin: string | null | undefined, taille: number): [string, string][] {
  const d = dateLocale(debut), n = joursDansPlage(debut, fin);
  if (!d || n === null || taille < 1) return [];
  const out: [string, string][] = [];
  for (let i = 0; i < n; i += taille) out.push([jourDecale(d, i), jourDecale(d, Math.min(i + taille, n) - 1)]);
  return out;
}

/** Avec au moins une pastille Équipe / Terrain, la recherche couvre la saison
 *  à venir entière : 401 jours, la borne de sûreté de matchs_recherche. */
export const JOURS_SAISON = 401;

/** Coupe [debut, fin] en deux moitiés (la seconde commence le lendemain de la
 *  fin de la première). Une seule journée → elle-même. Sert à redemander une
 *  fenêtre dont la réponse a atteint le plafond de PostgREST. */
export function moities(debut: string, fin: string): [string, string][] {
  const d = dateLocale(debut), n = joursDansPlage(debut, fin);
  if (!d || n === null) return [];
  if (n === 1) return [[debut, debut]];
  const m = Math.floor(n / 2);
  return [[debut, jourDecale(d, m - 1)], [jourDecale(d, m), fin]];
}

/* ── Pastilles Équipe / Terrain (BP 2026-10-09) ─────────────── */

export type GenrePastille = "EQUIPE" | "TERRAIN";

/** Une suggestion de matchs_suggestions, et la pastille qu'elle devient.
 *  `cle` : l'id de l'équipe, ou la clé lieu_normalise du terrain. */
export interface PastilleCarte {
  genre: GenrePastille;
  cle: string;
  libelle: string;
  detail: string | null;
  nb_matchs?: number;
}

/** Les lignes de matchs_suggestions utilisables ; le reste est écarté. */
export function suggestionsLisibles(data: unknown): PastilleCarte[] {
  if (!Array.isArray(data)) return [];
  return (data as PastilleCarte[]).filter((s) =>
    !!s && (s.genre === "EQUIPE" || s.genre === "TERRAIN") && typeof s.cle === "string" && typeof s.libelle === "string");
}

/** Ajoute une pastille (sans doublon : même genre, même clé). */
export function ajouterPastille(liste: PastilleCarte[], p: PastilleCarte): PastilleCarte[] {
  return liste.some((x) => x.genre === p.genre && x.cle === p.cle) ? liste : [...liste, p];
}

/** Les paramètres de matchs_recherche tirés des pastilles. */
export function parametresPastilles(liste: PastilleCarte[]): { equipes: string[]; lieux: string[] } {
  return {
    equipes: liste.filter((p) => p.genre === "EQUIPE").map((p) => p.cle),
    lieux: liste.filter((p) => p.genre === "TERRAIN").map((p) => p.cle),
  };
}

/** Le message visible quand bornerFin a ramené la fin : « Période limitée à
 *  31 jours — fin ajustée au 8 novembre 2026. » */
export function avisFinAjustee(fin: string): string {
  const d = dateLocale(fin);
  const lib = d ? d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" }) : fin;
  return `Période limitée à ${JOURS_MAX} jours — fin ajustée au ${lib}.`;
}

/** null si la plage est valide, sinon le message à afficher. */
export function erreurPlage(debut: string, fin: string | null | undefined): string | null {
  const n = joursDansPlage(debut, fin);
  if (n === null) return "La date de fin précède la date de début.";
  if (n > JOURS_MAX) return `${JOURS_MAX} jours au plus (${n} demandés).`;
  return null;
}

/** Catégorie et division se filtrent côté page, sur le résultat de la RPC.
 *  Une liste d'une seule valeur → la page grise le filtre (jamais caché). */
export function optionsCatDiv(matchs: Pick<MatchRecherche, "categorie" | "division">[]): { categories: string[]; divisions: string[] } {
  const valeurs = (cle: (m: Pick<MatchRecherche, "categorie" | "division">) => string | null) =>
    [...new Set(matchs.map(cle).map((v) => (v ?? "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "fr"));
  return { categories: valeurs((m) => m.categorie), divisions: valeurs((m) => m.division) };
}

export function filtrerCatDiv<T extends Pick<MatchRecherche, "categorie" | "division">>(matchs: T[], categorie: string, division: string): T[] {
  return matchs.filter((m) =>
    (!categorie || norm(m.categorie) === norm(categorie)) && (!division || norm(m.division) === norm(division)));
}

/* ── Jours ─────────────────────────────────────────────────── */

function dateLocale(iso: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso ?? "");
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}

/** "YYYY-MM-DD" local, décalé de `jours` depuis `base`. */
export function jourDecale(base: Date, jours: number): string {
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + jours);
  const p = (v: number) => String(v).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** La valeur d'un <input type="date"> à retenir, ou null tant que la saisie
 *  n'est pas une vraie date. Au clavier, Chrome émet un `change` à CHAQUE
 *  chiffre de l'année : « 2026 » passe par 0002, 0020, 0202 — autant de
 *  recherches lancées sur des années absurdes — et une sixième frappe donne
 *  « 202620-10-09 », que la plage lisait comme « fin avant début ». */
export function dateSaisie(v: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v ?? "");
  if (!m) return null;
  const an = Number(m[1]);
  return an >= 2000 && an <= 2100 && dateLocale(v) ? v! : null;
}

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** « samedi 10 octobre » — sans dépendre de la locale du navigateur. */
export function libelleJour(iso: string): string {
  const d = dateLocale(iso);
  return d ? `${JOURS[d.getDay()]} ${d.getDate()}${d.getDate() === 1 ? "er" : ""} ${MOIS[d.getMonth()]}` : iso;
}

const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];

/** « 9 oct. 2026 » — le libellé des champs de date (BP 2026-10-09) : jamais
 *  « 10/09/2026 », que le navigateur affiche selon SA locale et qui se lit
 *  9 octobre ou 10 septembre selon le lecteur. Vide si la date est illisible. */
export function dateCourte(iso: string | null | undefined): string {
  const d = dateLocale(iso);
  if (!d) return "";
  return `${d.getDate()}${d.getDate() === 1 ? "er" : ""} ${MOIS_COURTS[d.getMonth()]} ${d.getFullYear()}`;
}

const JOURS_COURTS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

/** « ven. 9 oct. » — la date en petit sous l'heure de chaque carte (BP
 *  2026-10-09). Jamais numérique. Vide si la date est illisible. */
export function dateCarte(iso: string | null | undefined): string {
  const d = dateLocale(iso);
  if (!d) return "";
  return `${JOURS_COURTS[d.getDay()]} ${d.getDate()}${d.getDate() === 1 ? "er" : ""} ${MOIS_COURTS[d.getMonth()]}`;
}

/** L'en-tête collant d'un jour : « Samedi 10 octobre » / « 42 matchs ».
 *  Aujourd'hui et demain le disent, sans perdre la date ; l'année n'apparaît
 *  que si elle n'est pas celle d'aujourd'hui (plage à cheval sur janvier). */
export function enTeteJour(iso: string, aujourdhui: string, nb: number): { jour: string; compte: string } {
  const d = dateLocale(iso), a = dateLocale(aujourdhui);
  const compte = `${nb} match${nb > 1 ? "s" : ""}`;
  if (!d) return { jour: iso, compte };
  const date = libelleJour(iso) + (a && a.getFullYear() !== d.getFullYear() ? ` ${d.getFullYear()}` : "");
  const prefixe = iso === aujourdhui ? "Aujourd'hui" : a && iso === jourDecale(a, 1) ? "Demain" : null;
  return { jour: prefixe ? `${prefixe} · ${date}` : date.charAt(0).toUpperCase() + date.slice(1), compte };
}


/** Par date, puis par heure (heure inconnue en fin de journée), puis par
 *  équipe à domicile. La base trie déjà ainsi ; la page ne s'y fie plus, les
 *  résultats arrivant par fenêtres de 7 jours. Tri stable, sans muter. */
export function trierMatchs<T extends Pick<MatchRecherche, "jour" | "heure" | "domicile">>(matchs: T[]): T[] {
  const cle = (m: T) => minutesDe(m.heure) ?? 24 * 60;
  return [...matchs].sort((x, y) =>
    x.jour < y.jour ? -1 : x.jour > y.jour ? 1 : cle(x) - cle(y) || (x.domicile ?? "").localeCompare(y.domicile ?? "", "fr"));
}

/** Groupé par jour, dans l'ordre reçu (passer par trierMatchs avant). */
export function grouperParJour<T extends Pick<MatchRecherche, "jour">>(matchs: T[]): { jour: string; matchs: T[] }[] {
  const groupes: { jour: string; matchs: T[] }[] = [];
  for (const m of matchs) {
    const dernier = groupes[groupes.length - 1];
    if (dernier && dernier.jour === m.jour) dernier.matchs.push(m);
    else groupes.push({ jour: m.jour, matchs: [m] });
  }
  return groupes;
}

/* ── Terrains (un point par terrain) ───────────────────────── */

export interface TerrainCarte {
  /** Clé stable : coordonnées arrondies à 4 décimales + nom normalisé. */
  id: string;
  nom: string;
  lat: number;
  lon: number;
  /** Un athlète suivi par l'unité joue dans l'un de ses matchs → étoile. */
  cible: boolean;
  /** Ses matchs, dans l'ordre reçu. */
  matchIds: string[];
}

export function cleTerrain(lat: number, lon: number, nom: string): string {
  return `${lat.toFixed(4)},${lon.toFixed(4)}|${norm(nom)}`;
}

/** Le terrain d'un match ; null sans lieu exploitable. */
export function terrainDe(m: Pick<MatchRecherche, "lat" | "lon" | "terrain">): { id: string; nom: string; lat: number; lon: number } | null {
  if (!lieuExploitable(m.lat, m.lon)) return null;
  const lat = Number(m.lat!.toFixed(4)), lon = Number(m.lon!.toFixed(4));
  const nom = (m.terrain ?? "").trim() || LIEU_NON_PRECISE;
  return { id: cleTerrain(lat, lon, nom), nom, lat, lon };
}

/** Un point par terrain (même nom à deux endroits = deux points). */
export function terrainsCarte(matchs: Pick<MatchRecherche, "id" | "lat" | "lon" | "terrain" | "cible">[]): TerrainCarte[] {
  const parCle = new Map<string, TerrainCarte>();
  for (const m of matchs) {
    const t = terrainDe(m);
    if (!t) continue;
    const c = parCle.get(t.id) ?? { ...t, cible: false, matchIds: [] };
    c.cible = c.cible || m.cible;
    c.matchIds.push(m.id);
    parCle.set(t.id, c);
  }
  return [...parCle.values()];
}

/* ── Calendrier de l'unité (+ / ✓) ─────────────────────────── */

/** SUIVI : déjà au Calendrier parce qu'un athlète suivi y joue — ✓ non
 *  retirable. AJOUTE : ajouté par l'unité — ✓, un clic le retire.
 *  LIBRE : « + » l'ajoute. */
export type EtatCalendrier = "SUIVI" | "AJOUTE" | "LIBRE";

export function etatCalendrier(m: Pick<MatchRecherche, "cible" | "ajoute">): EtatCalendrier {
  return m.cible ? "SUIVI" : m.ajoute ? "AJOUTE" : "LIBRE";
}

/* ── Libellés et actions ───────────────────────────────────── */


/** « D1 » → « Division 1 » ; toute autre forme est rendue telle quelle.
 *  Les codes de LIGUE (« Volleyball C F D1 ») restent bruts : aucune table
 *  de correspondance n'existe dans le dépôt (vérifié 2026-10-07). */
export function libelleDivision(division: string | null | undefined): string {
  const v = (division ?? "").trim();
  const m = /^D\s*(\d+)$/i.exec(v);
  return m ? `Division ${m[1]}` : v;
}

/** Itinéraire Google Maps jusqu'au terrain (nouvel onglet côté page). */
export function lienItineraire(lat: number, lon: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}`;
}

/** Le groupe d'un match, zone comprise : « Atome Nord », « Pee-Wee AAA Sud »,
 *  « Benjamin D4 ». '' quand la source n'en dit rien. */
export function groupeMatch(m: Pick<MatchRecherche, "categorie" | "division" | "zone">): string {
  return nomGroupe(m);
}

/** « Équipe A vs Équipe B ». */
export function titreMatch(m: { domicile: string; visiteur: string }): string {
  return `${m.domicile} vs ${m.visiteur}`;
}

/* ── Journal de l'unité : le « + » et le « ✓ » (migration 4, BP 2026-10-08) ── */

/** Les deux types écrits par le trigger de matchs_ajoutes — sans athlète, le
 *  match est dans `details`. */
export const GESTES_MATCH = ["MATCH_AJOUTE", "MATCH_RETIRE"] as const;

export function estGesteMatch(actionType: string): boolean {
  return (GESTES_MATCH as readonly string[]).includes(actionType);
}

/** « Match ajouté au calendrier : A vs B — samedi 10 octobre, 9 h 30 ». */
export function libelleGesteMatch(actionType: string, details: Record<string, unknown> | null | undefined): string {
  const d = details ?? {};
  const texte = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const verbe = actionType === "MATCH_RETIRE" ? "Match retiré du calendrier" : "Match ajouté au calendrier";
  const domicile = texte(d.domicile), visiteur = texte(d.visiteur);
  const jour = texte(d.jour), heure = texte(d.heure);
  const quand = [jour ? libelleJour(jour) : null, heure ? heureQuebec(heure) : null].filter(Boolean).join(", ");
  return `${verbe}${domicile && visiteur ? ` : ${titreMatch({ domicile, visiteur })}` : ""}${quand ? ` — ${quand}` : ""}`;
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

/* ── Source (BP 2026-10-09) ────────────────────────────────── */

/** Les colonnes de `games` que lit la source — celles du Calendrier. */
export const COLONNES_SOURCE = "id, source_nom, source_url, collecte_le, rseq_league_id, league_name";

export interface LigneSource {
  id: string;
  source_nom: string | null;
  source_url: string | null;
  collecte_le: string | null;
  rseq_league_id: string | null;
  league_name: string | null;
}

/** La source de chaque match, dérivée EXACTEMENT comme au Calendrier
 *  (sourceDuMatch). Un match sans source n'est pas dans la Map : rien ne
 *  s'affiche, comme SourceMatchLigne le fait déjà pour `nom` vide. */
export function sourcesParMatch(lignes: unknown): Map<string, SourceMatch> {
  const parId = new Map<string, SourceMatch>();
  // Le cache TanStack est réhydraté depuis sessionStorage : une charge illisible
  // (ancienne forme, `{}`) rend une carte vide, jamais une exception.
  if (!Array.isArray(lignes)) return parId;
  for (const l of lignes as LigneSource[]) {
    if (!l || typeof l.id !== "string") continue;
    const s = sourceDuMatch(l);
    if (s.nom) parId.set(l.id, s);
  }
  return parId;
}

/** Les lignes de matchs_recherche telles que la page peut les afficher : une
 *  charge réhydratée illisible (pas un tableau, ligne sans id) est écartée
 *  plutôt que de faire planter le rendu. */
export function matchsLisibles(data: unknown): MatchRecherche[] {
  if (!Array.isArray(data)) return [];
  return (data as MatchRecherche[]).filter((m) => !!m && typeof m.id === "string" && typeof m.jour === "string");
}

/** Découpe une liste d'ids en paquets : un `in.(…)` de 1 000 uuid dépasse la
 *  longueur d'URL d'un GET PostgREST. */
export function paquets<T>(xs: T[], taille: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += taille) out.push(xs.slice(i, i + taille));
  return out;
}

/* ── Partenaire (BP 2026-10-09) ──────────────────────────────── */

/** Joueurs Nexus d'un match, côté PARTENAIRE (RPC matchs_profils_partenaire) :
 *  le NOMBRE de tous les athlètes actifs des deux équipes, et les NOMS des seuls
 *  athlètes qui ont coché la visibilité partenaire. Rien d'autre ne revient. */
export interface ProfilPartenaire {
  athlete_id: string;
  prenom: string;
  nom: string;
  position: string | null;
  promotion: number | null;
  cote: "DOMICILE" | "VISITEUR";
}

/** Une réponse illisible donne 0 et aucun nom, jamais une exception. */
export function profilsPartenaireLisibles(data: unknown): { total: number; profils: ProfilPartenaire[] } {
  const d = (data && typeof data === "object" ? data : {}) as { total?: unknown; profils?: unknown };
  const total = typeof d.total === "number" && d.total >= 0 ? d.total : 0;
  const profils = Array.isArray(d.profils)
    ? (d.profils as ProfilPartenaire[]).filter((x) => !!x && typeof x.athlete_id === "string")
    : [];
  return { total, profils };
}


