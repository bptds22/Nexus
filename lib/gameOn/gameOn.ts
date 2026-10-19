/* ═══════════════════════════════════════════════════════════════
   Game On — le mode match (R6 option B, BP 2026-10-18). Logique PURE :
   aucune dépendance à React ni à Supabase, testée dans __tests__.

   Pendant un match, le recruteur note des joueurs par NUMÉRO (et côté A / B),
   en allers-retours constants. Tout est d'abord écrit sur l'appareil (les
   estrades ont un mauvais réseau), puis envoyé par lots, de façon idempotente :
   chaque séance et chaque note porte un identifiant généré sur l'appareil.

   Stock local (une clé) : { seances: { [id]: EtatSeance }, active: id | null }.
═══════════════════════════════════════════════════════════════ */

export type Cote = "A" | "B";

export const ETIQUETTES = ["Bras", "Vitesse", "Lecture du jeu", "Leadership", "Défense", "À revoir", "★"] as const;

export interface SeanceLocale {
  id: string;
  gameId: string | null;
  equipeA: string;
  equipeB: string | null;
  lieu: string | null;
  commenceLe: string;
  termineLe: string | null;
  /** Vrai dès que la base connaît la séance (match_seance_ouvrir a répondu). */
  ouverte: boolean;
  /** « Terminer » envoyé à la base. */
  termineeEnvoyee: boolean;
  /** Couleur du chandail de chaque côté, demandée à chaque match (BP 2026-10-18). Sur l'appareil seulement. */
  couleurA?: string | null;
  couleurB?: string | null;
  /** Prénom corrigé au crayon, par joueur (clé cleJoueur) — sur l'appareil ; mes notes le portent aussi. */
  prenoms?: Record<string, string>;
  /** « Pas lui » (BP 2026-10-19) : par joueur (clé cleJoueur), la carte ou l'athlète reconnu à écarter. */
  pasLui?: Record<string, string>;
}

export interface NoteLocale {
  id: string;
  cote: Cote;
  numero: string | null;
  prenom: string | null;
  texte: string;
  etiquettes: string[];
  noteLe: string;
  envoyee: boolean;
}

export interface EtatSeance {
  seance: SeanceLocale;
  notes: NoteLocale[];
}

export interface StockGameOn {
  seances: Record<string, EtatSeance>;
  active: string | null;
}

export const CLE_STOCK = "nexus.gameon.v1";

/** La clé du stock D'UN COMPTE (BP 2026-10-19 : un recruteur et un partenaire sur le même téléphone
 *  voyaient les mêmes « matchs en cours »). L'ancienne clé commune n'est plus jamais lue : aucune
 *  séance ni note d'un compte ne peut passer à un autre. */
export function cleStock(compte: string): string {
  return `${CLE_STOCK}:${compte}`;
}

/** Ce que la page sait d'un stockage : localStorage, ou un faux dans les tests. */
export interface Stockage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

const VIDE: StockGameOn = { seances: {}, active: null };

export function lireStock(s: Stockage | null | undefined, cle: string = CLE_STOCK): StockGameOn {
  if (!s) return { ...VIDE, seances: {} };
  try {
    const brut = s.getItem(cle);
    if (!brut) return { ...VIDE, seances: {} };
    const v = JSON.parse(brut) as Partial<StockGameOn>;
    if (!v || typeof v !== "object" || typeof v.seances !== "object" || v.seances === null) return { ...VIDE, seances: {} };
    return { seances: v.seances as Record<string, EtatSeance>, active: typeof v.active === "string" ? v.active : null };
  } catch {
    return { ...VIDE, seances: {} };
  }
}

/** Vrai si l'écriture a réussi (stockage plein ou bloqué : faux, sans planter). */
export function ecrireStock(s: Stockage | null | undefined, stock: StockGameOn, cle: string = CLE_STOCK): boolean {
  if (!s) return false;
  try {
    s.setItem(cle, JSON.stringify(stock));
    return true;
  } catch {
    return false;
  }
}

export function nouvelleSeance(id: string, p: {
  gameId?: string | null; equipeA: string; equipeB?: string | null; lieu?: string | null;
}, maintenant = new Date()): EtatSeance {
  return {
    seance: {
      id,
      gameId: p.gameId ?? null,
      equipeA: p.equipeA.trim() || "Équipe A",
      equipeB: p.equipeB?.trim() || null,
      lieu: p.lieu?.trim() || null,
      commenceLe: maintenant.toISOString(),
      termineLe: null,
      ouverte: false,
      termineeEnvoyee: false,
    },
    notes: [],
  };
}

/* ── Couleurs des chandails (BP 2026-10-18) ─────────────────────────────
   On ne connaît pas les couleurs des équipes (aucun champ en base pour les équipes,
   et un chandail change entre maison et visiteur) : on DEMANDE à chaque match.
   Ce que chacun choisit lui suffit pour se repérer. */
export const CHANDAILS: readonly { nom: string; hex: string }[] = [
  { nom: "Blanc", hex: "#F8FAFC" },
  { nom: "Noir", hex: "#27272A" },
  { nom: "Gris", hex: "#9CA3AF" },
  { nom: "Rouge", hex: "#E63946" },
  { nom: "Bleu", hex: "#3B82F6" },
  { nom: "Marine", hex: "#1E3A8A" },
  { nom: "Vert", hex: "#22C55E" },
  { nom: "Jaune", hex: "#FACC15" },
  { nom: "Orange", hex: "#F97316" },
  { nom: "Mauve", hex: "#8B5CF6" },
];

const PAR_DEFAUT: Record<Cote, string> = { A: "#E63946", B: "#3B82F6" };

/** Couleur d'un côté : celle choisie au début du match, sinon rouge / bleu (anciennes séances). */
export function couleurCote(s: Pick<SeanceLocale, "couleurA" | "couleurB"> | null | undefined, cote: Cote): string {
  const c = cote === "A" ? s?.couleurA : s?.couleurB;
  return c && /^#[0-9a-f]{6}$/i.test(c) ? c : PAR_DEFAUT[cote];
}

/** Texte lisible sur cette couleur : foncé sur un chandail pâle (blanc, jaune), blanc sinon. */
export function texteSur(hex: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return "#FFFFFF";
  const [r, g, b] = m.slice(1).map((x) => parseInt(x, 16) / 255);
  return 0.299 * r + 0.587 * g + 0.114 * b > 0.62 ? "#111317" : "#FFFFFF";
}

export function avecCouleurs(e: EtatSeance, couleurA: string, couleurB: string): EtatSeance {
  return { ...e, seance: { ...e.seance, couleurA, couleurB } };
}

/** Numéro de maillot : 1 à 3 chiffres, zéros de tête gardés tels quels (« 07 » ≠ « 7 » pour certains). */
export function numeroValide(n: string | null | undefined): string | null {
  const v = (n ?? "").trim();
  return /^[0-9]{1,3}$/.test(v) ? v : null;
}

/** Le numéro pour COMPARER : « 06 » et « 6 » sont le même chandail (BP 2026-10-19 : un profil Nexus
 *  porte « 06 », on tape « 6 »). La note garde ce qui a été tapé ; seule la reconnaissance compare ainsi. */
export function numeroCle(n: string | null | undefined): string | null {
  const v = numeroValide(n);
  return v === null ? null : String(Number(v));
}

export function numeroEgal(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = numeroCle(a);
  return x !== null && x === numeroCle(b);
}

export function noteValide(n: Pick<NoteLocale, "numero" | "prenom" | "texte" | "etiquettes">): boolean {
  const qui = !!numeroValide(n.numero) || !!(n.prenom ?? "").trim();
  const quoi = !!n.texte.trim() || n.etiquettes.length > 0;
  return qui && quoi;
}

export function ajouterNote(etat: EtatSeance, n: Omit<NoteLocale, "envoyee">): EtatSeance {
  const propre: NoteLocale = {
    ...n,
    numero: numeroValide(n.numero),
    prenom: (n.prenom ?? "").trim().slice(0, 60) || null,
    texte: n.texte.trim().slice(0, 2000),
    etiquettes: n.etiquettes.slice(0, 10),
    envoyee: false,
  };
  const autres = etat.notes.filter((x) => x.id !== n.id);
  return { ...etat, notes: [...autres, propre] };
}

export function retirerNote(etat: EtatSeance, id: string): EtatSeance {
  return { ...etat, notes: etat.notes.filter((n) => n.id !== id) };
}

export function notesEnAttente(etat: EtatSeance): NoteLocale[] {
  return etat.notes.filter((n) => !n.envoyee);
}

export function marquerEnvoyees(etat: EtatSeance, ids: readonly string[]): EtatSeance {
  const s = new Set(ids);
  return { ...etat, notes: etat.notes.map((n) => (s.has(n.id) ? { ...n, envoyee: true } : n)) };
}

/** Lots de taille bornée (la base refuse plus de 200 notes par appel). */
export function lots<T>(xs: readonly T[], taille = 100): T[][] {
  const r: T[][] = [];
  for (let i = 0; i < xs.length; i += taille) r.push(xs.slice(i, i + taille));
  return r;
}

/** Corps de match_notes_envoyer. */
export function versEnvoi(notes: readonly NoteLocale[]) {
  return notes.map((n) => ({
    id: n.id, cote: n.cote, numero: n.numero, prenom: n.prenom,
    texte: n.texte, etiquettes: n.etiquettes, note_le: n.noteLe,
  }));
}

/** match_seance_ouvrir a rendu un AUTRE id (un collègue a déjà ouvert ce match) :
 *  la séance locale et ses notes passent sous cet id ; l'active suit. */
export function remapperSeance(stock: StockGameOn, ancien: string, nouveau: string): StockGameOn {
  const etat = stock.seances[ancien];
  if (!etat || ancien === nouveau) return stock;
  const seances = { ...stock.seances };
  delete seances[ancien];
  const deja = seances[nouveau];
  // Si l'appareil connaissait déjà la séance du collègue : on fusionne les notes.
  const notes = deja ? [...deja.notes, ...etat.notes.filter((n) => !deja.notes.some((d) => d.id === n.id))] : etat.notes;
  seances[nouveau] = { seance: { ...(deja?.seance ?? etat.seance), id: nouveau, ouverte: true }, notes };
  return { seances, active: stock.active === ancien ? nouveau : stock.active };
}

/* ── Regroupement par joueur ───────────────────────────────────── */

/** Une note telle que l'écran la montre : locale (la mienne) ou venue de la base. */
export interface NoteAffichee {
  id: string;
  cote: Cote;
  numero: string | null;
  prenom: string | null;
  texte: string;
  etiquettes: string[];
  noteLe: string;
  auteurNom: string | null;
  deMoi: boolean;
  enAttente: boolean;
  athleteId?: string | null;
  carteId?: string | null;
  lieLe?: string | null;
}

/** Clé d'un joueur : côté + numéro ; sans numéro, côté + prénom (casse ignorée). */
export function cleJoueur(n: Pick<NoteAffichee, "cote" | "numero" | "prenom">): string {
  return n.numero ? `${n.cote}|#${n.numero}` : `${n.cote}|p:${(n.prenom ?? "").trim().toLowerCase()}`;
}

export interface GroupeJoueur {
  cle: string;
  cote: Cote;
  numero: string | null;
  /** Le dernier prénom noté pour ce joueur, s'il y en a un. */
  prenom: string | null;
  notes: NoteAffichee[];
  derniere: string;
  /** Lié (ou gardé) : toutes les notes du groupe ont lie_le. */
  traite: boolean;
  athleteId: string | null;
  carteId: string | null;
}

/** Notes locales + notes de la base (collègues, et les miennes déjà envoyées), sans doublon. */
export function fusionnerNotes(locales: readonly NoteLocale[], serveur: readonly NoteAffichee[], moi: string | null): NoteAffichee[] {
  const parId = new Map<string, NoteAffichee>();
  for (const n of serveur) parId.set(n.id, { ...n, deMoi: !!moi && n.deMoi });
  for (const n of locales) {
    const s = parId.get(n.id);
    parId.set(n.id, {
      id: n.id, cote: n.cote, numero: n.numero, prenom: n.prenom, texte: n.texte, etiquettes: n.etiquettes,
      noteLe: n.noteLe, auteurNom: s?.auteurNom ?? null, deMoi: true, enAttente: !n.envoyee,
      athleteId: s?.athleteId ?? null, carteId: s?.carteId ?? null, lieLe: s?.lieLe ?? null,
    });
  }
  return [...parId.values()];
}

export function grouperParJoueur(notes: readonly NoteAffichee[], prenoms?: Record<string, string> | null): GroupeJoueur[] {
  const m = new Map<string, NoteAffichee[]>();
  for (const n of notes) {
    const k = cleJoueur(n);
    const l = m.get(k);
    if (l) l.push(n); else m.set(k, [n]);
  }
  const groupes: GroupeJoueur[] = [];
  for (const [cle, l] of m) {
    const tri = [...l].sort((a, b) => a.noteLe.localeCompare(b.noteLe));
    const derniere = tri[tri.length - 1];
    // Le prénom corrigé au crayon (BP 2026-10-18) passe avant celui des notes.
    const prenom = prenoms?.[cle]?.trim() || ([...tri].reverse().find((n) => (n.prenom ?? "").trim())?.prenom ?? null);
    groupes.push({
      cle, cote: derniere.cote, numero: derniere.numero, prenom, notes: tri, derniere: derniere.noteLe,
      traite: tri.every((n) => !!n.lieLe),
      athleteId: tri.find((n) => n.athleteId)?.athleteId ?? null,
      carteId: tri.find((n) => n.carteId)?.carteId ?? null,
    });
  }
  // La plus récente d'abord : le joueur qu'on vient de noter reste sous le pouce.
  return groupes.sort((a, b) => b.derniere.localeCompare(a.derniere));
}

/** Les pastilles d'un côté, de la plus récente à la plus ancienne. */
export function pastillesCote(groupes: readonly GroupeJoueur[], cote: Cote): GroupeJoueur[] {
  return groupes.filter((g) => g.cote === cote);
}

export function libelleJoueur(g: Pick<GroupeJoueur, "numero" | "prenom">): string {
  if (g.numero && g.prenom) return `#${g.numero} ${g.prenom}`;
  if (g.numero) return `#${g.numero}`;
  return g.prenom ?? "Sans numéro";
}

/* ── Après le match ────────────────────────────────────────────── */

export function titreSeance(s: Pick<SeanceLocale, "equipeA" | "equipeB">): string {
  return s.equipeB ? `${s.equipeA} vs ${s.equipeB}` : s.equipeA;
}

/** Date courte fr-CA d'une séance (« 18 oct. 2026 »). */
export function dateSeance(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" });
}

/** Titre du bloc recopié dans le fil de la carte (BP 2026-10-18) : « Match X vs Y, date ». */
export function titreRecopie(s: Pick<SeanceLocale, "equipeA" | "equipeB" | "commenceLe">): string {
  const d = dateSeance(s.commenceLe);
  return `Notes du match ${titreSeance(s)}${d ? `, ${d}` : ""}`;
}

/** Le texte recopié dans la fiche : le titre « Match X vs Y, date », puis une ligne par note (heure, auteur). */
export function texteRecopie(s: Pick<SeanceLocale, "equipeA" | "equipeB" | "commenceLe">, g: Pick<GroupeJoueur, "numero" | "notes">): string {
  const lignes = g.notes.map((n) => {
    const tags = n.etiquettes.length ? `[${n.etiquettes.join(", ")}] ` : "";
    const qui = n.auteurNom && !n.deMoi ? ` (${n.auteurNom})` : "";
    const h = heureLigne(n.noteLe);
    return `• ${h ? `${h} : ` : ""}${tags}${n.texte.trim()}${qui}`.trimEnd();
  });
  return [titreRecopie(s), ...lignes].join("\n").slice(0, 4000);
}

/* ── Fiche du joueur : ajouter à une de MES notes (BP 2026-10-18) ──── */

/** « 14 h 32 » — l'heure locale d'une note, vide si illisible. */
export function heureLigne(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getHours()} h ${String(d.getMinutes()).padStart(2, "0")}`;
}

/** Ajoute une ligne datée sous le texte d'avant, sans l'écraser (« 14 h 32 : … »). Plafond de la base : 2000. */
export function ajouterLigneDatee(avant: string, ajout: string, maintenant = new Date()): string {
  const a = ajout.trim();
  if (!a) return avant;
  const ligne = `${heureLigne(maintenant)} : ${a}`;
  return (avant.trim() ? `${avant.trimEnd()}\n${ligne}` : ligne).slice(0, 2000);
}

/** Corrige le prénom d'un joueur : la séance le retient (clé du joueur). */
export function avecPrenom(e: EtatSeance, cle: string, prenom: string): EtatSeance {
  const p = prenom.trim().slice(0, 60);
  const prenoms = { ...(e.seance.prenoms ?? {}) };
  if (p) prenoms[cle] = p; else delete prenoms[cle];
  return { ...e, seance: { ...e.seance, prenoms } };
}

export interface CarteCandidate {
  id: string;
  prenom: string;
  nom: string;
  numero: string | null;
  teamId: string | null;
  equipe: string | null;
  /** L'établissement de la carte (BP 2026-10-19 : une suggestion reste dans la même école). */
  schoolId?: string | null;
}

/** Cartes de l'unité qui portent le même numéro ; celles de l'équipe du match d'abord. */
export function suggestionsCartes(g: Pick<GroupeJoueur, "numero" | "prenom">, cartes: readonly CarteCandidate[], equipesDuMatch: readonly string[] = []): (CarteCandidate & { memeEquipe: boolean })[] {
  if (!g.numero) return [];
  const prenom = (g.prenom ?? "").trim().toLowerCase();
  return cartes
    .filter((c) => numeroEgal(c.numero, g.numero))
    .map((c) => ({ ...c, memeEquipe: !!c.teamId && equipesDuMatch.includes(c.teamId) }))
    .sort((a, b) =>
      Number(b.memeEquipe) - Number(a.memeEquipe)
      || Number(!!prenom && b.prenom.toLowerCase().startsWith(prenom)) - Number(!!prenom && a.prenom.toLowerCase().startsWith(prenom))
      || `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`, "fr"))
    .slice(0, 5);
}

/* ── Trier : suggestions athlètes Nexus ET cartes (BP 2026-10-18) ──── */

export interface AthleteCandidat {
  id: string;
  prenom: string;
  nom: string;
  numero: string | null;
  /** Côté du match où il joue (DOMICILE = A, VISITEUR = B). */
  cote: Cote;
}

export interface Suggestion {
  type: "athlete" | "carte";
  id: string;
  nom: string;
  numero: string | null;
  equipe: string | null;
  /** Pourquoi on la propose : même numéro, ou nom proche. */
  raison: "numero" | "nom";
  /** De l'équipe du côté noté (sinon : même école, autre équipe). */
  memeEquipe: boolean;
}

const sansAccents = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Le prénom noté au match ressemble-t-il à celui-ci ? (« Alex » ↔ « Alexandre », casse et accents ignorés.) */
export function prenomProche(note: string | null | undefined, candidat: string): boolean {
  const premier = (s: string) => sansAccents(s).split(/[\s.\-']+/).filter(Boolean)[0] ?? "";
  const a = premier(note ?? ""), b = premier(candidat);
  if (a.length < 2 || b.length < 2) return false;
  return a.startsWith(b) || b.startsWith(a);
}

/** Les suggestions du tri, avec les MÊMES règles que les cartes (BP 2026-10-19 : « école, équipe,
 *  nom, après numéro » — plus jamais un joueur d'une autre école) :
 *  1. le lieu : l'équipe du côté noté, puis une autre équipe de la même école ;
 *  2. la correspondance : nom proche ET numéro, puis nom proche, puis numéro.
 *  À rang égal, l'athlète Nexus avant la carte. Six au plus. */
export function suggestionsTri(
  g: Pick<GroupeJoueur, "cote" | "numero" | "prenom">,
  athletes: readonly AthleteCandidat[],
  cartes: readonly CarteCandidate[],
  equipeCote: string | null,
  ecoleCote: string | null = null,
): Suggestion[] {
  const r: (Suggestion & { rang: number })[] = [];
  const vu = new Set<string>();
  const correspondance = (prenom: string, numero: string | null): number | null => {
    const n = !!g.numero && numeroEgal(numero, g.numero);
    const p = prenomProche(g.prenom, prenom);
    if (n && p) return 0;
    if (p) return 1;
    if (n) return 2;
    return null;
  };
  const pousser = (s: Suggestion, rang: number) => {
    const k = `${s.type}:${s.id}`;
    if (vu.has(k)) return;
    vu.add(k);
    r.push({ ...s, rang });
  };
  for (const a of athletes) {
    if (a.cote !== g.cote) continue;
    const c = correspondance(a.prenom, a.numero);
    if (c === null) continue;
    pousser({ type: "athlete", id: a.id, nom: `${a.prenom} ${a.nom}`.trim(), numero: a.numero, equipe: null,
      raison: c === 2 ? "numero" : "nom", memeEquipe: true }, c * 2);
  }
  for (const x of cartes) {
    const memeEquipe = !!equipeCote && x.teamId === equipeCote;
    const memeEcole = !memeEquipe && !!ecoleCote && x.schoolId === ecoleCote;
    if (!memeEquipe && !memeEcole) continue;
    const c = correspondance(x.prenom, x.numero);
    if (c === null) continue;
    pousser({ type: "carte", id: x.id, nom: `${x.prenom} ${x.nom}`.trim(), numero: x.numero, equipe: x.equipe,
      raison: c === 2 ? "numero" : "nom", memeEquipe }, (memeEquipe ? 0 : 6) + c * 2 + 1);
  }
  return r
    .sort((a, b) => a.rang - b.rang || a.nom.localeCompare(b.nom, "fr"))
    .slice(0, 6)
    .map((x): Suggestion => ({ type: x.type, id: x.id, nom: x.nom, numero: x.numero, equipe: x.equipe, raison: x.raison, memeEquipe: x.memeEquipe }));
}

/* ── Joueur déjà connu (BP 2026-10-19) ──────────────────────────────
   « Si je le connais déjà, je veux continuer mes notes là, pas recommencer. »
   Pendant le match, un numéro est RECONNU quand un seul candidat sûr le porte
   dans l'équipe de ce côté : un athlète Nexus du match, sinon une carte de
   l'unité de cette équipe. Le nom proche ne suffit pas (trop de faux amis) :
   il reste une suggestion au tri. Deux cartes au même numéro : on ne choisit
   pas, le tri tranche. */
export function joueurConnu(
  g: Pick<GroupeJoueur, "cote" | "numero">,
  athletes: readonly AthleteCandidat[],
  cartes: readonly CarteCandidate[],
  equipeCote: string | null,
  ecarte?: string | null,
): Suggestion | null {
  if (!g.numero) return null;
  const memeNumero = (n: string | null) => numeroEgal(n, g.numero);
  const a = athletes.filter((x) => x.cote === g.cote && memeNumero(x.numero) && x.id !== ecarte);
  if (a.length === 1) {
    return { type: "athlete", id: a[0].id, nom: `${a[0].prenom} ${a[0].nom}`.trim(), numero: a[0].numero, equipe: null, raison: "numero", memeEquipe: true };
  }
  if (a.length > 1 || !equipeCote) return null;
  const c = cartes.filter((x) => x.teamId === equipeCote && memeNumero(x.numero) && x.id !== ecarte);
  if (c.length !== 1) return null;
  return { type: "carte", id: c[0].id, nom: `${c[0].prenom} ${c[0].nom}`.trim(), numero: c[0].numero, equipe: c[0].equipe, raison: "numero", memeEquipe: true };
}

/** Dès le début du match (BP 2026-10-19) : les joueurs DÉJÀ CONNUS d'un côté, avec leur numéro —
 *  pour revoir ses notes avant même de noter. Un numéro par pastille (celui que joueurConnu reconnaît) ;
 *  ceux qui ont déjà des notes dans ce match sont déjà à l'écran et ne sont pas répétés. */
export function connusDuCote(
  cote: Cote,
  athletes: readonly AthleteCandidat[],
  cartes: readonly CarteCandidate[],
  equipeCote: string | null,
  dejaNotes: ReadonlySet<string>,
  pasLui: Readonly<Record<string, string>> = {},
): { numero: string; connu: Suggestion }[] {
  const numeros = new Set<string>();
  // Un numéro par chandail : « 06 » et « 6 » ne font qu'une pastille, affichée « 6 ».
  for (const a of athletes) { const k = a.cote === cote ? numeroCle(a.numero) : null; if (k) numeros.add(k); }
  for (const c of cartes) { const k = equipeCote && c.teamId === equipeCote ? numeroCle(c.numero) : null; if (k) numeros.add(k); }
  const notes = new Set([...dejaNotes].map((n) => numeroCle(n)).filter((n): n is string => !!n));
  const r: { numero: string; connu: Suggestion }[] = [];
  for (const numero of numeros) {
    if (notes.has(numero)) continue;
    const connu = joueurConnu({ cote, numero }, athletes, cartes, equipeCote, pasLui[`${cote}|#${numero}`] ?? null);
    if (connu) r.push({ numero, connu });
  }
  return r.sort((a, b) => Number(a.numero) - Number(b.numero) || a.numero.localeCompare(b.numero));
}

/** L'allure d'une pastille (BP 2026-10-19) : le TRAIT dit qui c'est — plein = profil Nexus, pointillé =
 *  carte seulement, neutre = pas encore reconnu ; l'OPACITÉ dit s'il est dans mon processus — pleine s'il y
 *  est, estompée sinon. Une carte est toujours dans le processus (elle n'existe que là) ; un numéro pas encore
 *  reconnu reste plein : c'est celui qu'on est en train de noter. */
export function allurePastille(
  connu: Pick<Suggestion, "type" | "id"> | null,
  dansProcessus: ReadonlySet<string>,
): { trait: "plein" | "pointille" | "neutre"; estompe: boolean } {
  if (!connu) return { trait: "neutre", estompe: false };
  if (connu.type === "carte") return { trait: "pointille", estompe: false };
  return { trait: "plein", estompe: !dansProcessus.has(connu.id) };
}

/** Le prénom d'un joueur reconnu, pour préremplir (« Marc Tremblay » → « Marc »). */
export function prenomDe(connu: Pick<Suggestion, "nom"> | null | undefined): string | null {
  return connu?.nom.trim().split(/\s+/)[0] || null;
}

/** Peut-être le même joueur (BP 2026-10-19) : le numéro est reconnu comme un ATHLÈTE Nexus, et
 *  l'unité a aussi UNE carte de cette équipe au même numéro — la fausse carte d'avant son arrivée
 *  sur Nexus. On propose de les fusionner (la carte et son fil passent au profil). */
export function carteJumelle(
  g: Pick<GroupeJoueur, "cote" | "numero">,
  connu: Pick<Suggestion, "type" | "id"> | null,
  cartes: readonly CarteCandidate[],
  equipeCote: string | null,
): CarteCandidate | null {
  if (!g.numero || !connu || connu.type !== "athlete" || !equipeCote) return null;
  const c = cartes.filter((x) => x.teamId === equipeCote && numeroEgal(x.numero, g.numero));
  return c.length === 1 ? c[0] : null;
}

/** « Pas lui » : on écarte (ou on rétablit, id null) le joueur reconnu pour ce numéro. */
export function avecPasLui(e: EtatSeance, cle: string, id: string | null): EtatSeance {
  const pasLui = { ...(e.seance.pasLui ?? {}) };
  if (id) pasLui[cle] = id; else delete pasLui[cle];
  return { ...e, seance: { ...e.seance, pasLui } };
}

/** Prénom court pour la pastille : « Marc T. ». */
export function nomCourt(nom: string): string {
  const [p, ...r] = nom.trim().split(/\s+/);
  const n = r.join(" ");
  return n ? `${p} ${n[0].toUpperCase()}.` : (p ?? "");
}

/* ── Tableau de bord : les quatre pastilles (BP 2026-10-18) ──────── */

export type Pastille = "en-cours" | "du-jour" | "a-trier" | "unite";

export const PASTILLES: readonly { cle: Pastille; libelle: string }[] = [
  { cle: "en-cours", libelle: "En cours" },
  { cle: "du-jour", libelle: "Mes matchs du jour" },
  { cle: "a-trier", libelle: "À trier" },
  { cle: "unite", libelle: "Mon unité" },
];

/** Une séance vue de la base (match_seances_recentes), forme minimale pour le tableau de bord. */
export interface SeanceResume {
  id: string;
  cree_par: string;
  termine_le: string | null;
  nb_notes: number;
  nb_a_lier: number;
}

/** Range les séances : en cours (les miennes, ouvertes), à trier (des notes à lier), mon unité
 *  (celles des collègues, ouvertes : on peut les rejoindre). Les séances déjà sur l'appareil sont en cours. */
export function rangerSeances<T extends SeanceResume>(seances: readonly T[], moi: string | null, surAppareil: ReadonlySet<string>) {
  const enCours = seances.filter((s) => !s.termine_le && !surAppareil.has(s.id) && s.cree_par === moi);
  const aTrier = seances.filter((s) => s.nb_a_lier > 0);
  const unite = seances.filter((s) => !s.termine_le && !surAppareil.has(s.id) && s.cree_par !== moi);
  return { enCours, aTrier, unite };
}

/** La pastille ouverte par défaut : en cours s'il y a un match ouvert, sinon les matchs du jour. */
export function pastilleParDefaut(n: { enCours: number; duJour: number; aTrier: number }): Pastille {
  if (n.enCours > 0) return "en-cours";
  if (n.duJour > 0) return "du-jour";
  if (n.aTrier > 0) return "a-trier";
  return "du-jour";
}

/* ── Erreurs ───────────────────────────────────────────────────── */

/** Les fonctions Game On n'existent pas encore (prod sans la migration). */
export function fonctionAbsente(e: { code?: string | null; message?: string | null } | null | undefined): boolean {
  if (!e) return false;
  return e.code === "PGRST202" || e.code === "42883" || /could not find the function/i.test(e.message ?? "");
}

/** Le message « NEXUS: … » de la base, sans le préfixe ; sinon un message général. */
export function messageErreur(e: { message?: string | null } | null | undefined, defaut = "Une erreur est survenue. Réessaie."): string {
  const m = /NEXUS:\s*(.+)/.exec(e?.message ?? "");
  return m ? m[1].trim() : defaut;
}

export function resumeEnvoi(enAttente: number, enLigne: boolean): string {
  if (enAttente === 0) return "Tout est envoyé";
  const n = enAttente === 1 ? "1 note en attente" : `${enAttente} notes en attente`;
  return enLigne ? `${n} · envoi…` : `${n} · hors ligne`;
}
