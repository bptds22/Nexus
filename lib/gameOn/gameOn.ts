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

/** Ce que la page sait d'un stockage : localStorage, ou un faux dans les tests. */
export interface Stockage {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

const VIDE: StockGameOn = { seances: {}, active: null };

export function lireStock(s: Stockage | null | undefined): StockGameOn {
  if (!s) return { ...VIDE, seances: {} };
  try {
    const brut = s.getItem(CLE_STOCK);
    if (!brut) return { ...VIDE, seances: {} };
    const v = JSON.parse(brut) as Partial<StockGameOn>;
    if (!v || typeof v !== "object" || typeof v.seances !== "object" || v.seances === null) return { ...VIDE, seances: {} };
    return { seances: v.seances as Record<string, EtatSeance>, active: typeof v.active === "string" ? v.active : null };
  } catch {
    return { ...VIDE, seances: {} };
  }
}

/** Vrai si l'écriture a réussi (stockage plein ou bloqué : faux, sans planter). */
export function ecrireStock(s: Stockage | null | undefined, stock: StockGameOn): boolean {
  if (!s) return false;
  try {
    s.setItem(CLE_STOCK, JSON.stringify(stock));
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

/** Numéro de maillot : 1 à 3 chiffres, zéros de tête gardés tels quels (« 07 » ≠ « 7 » pour certains). */
export function numeroValide(n: string | null | undefined): string | null {
  const v = (n ?? "").trim();
  return /^[0-9]{1,3}$/.test(v) ? v : null;
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

export function grouperParJoueur(notes: readonly NoteAffichee[]): GroupeJoueur[] {
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
    const prenom = [...tri].reverse().find((n) => (n.prenom ?? "").trim())?.prenom ?? null;
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

/** Le texte recopié dans la fiche : « Match A vs B — date », puis une ligne par note. */
export function texteRecopie(s: Pick<SeanceLocale, "equipeA" | "equipeB" | "commenceLe">, g: Pick<GroupeJoueur, "numero" | "notes">): string {
  const lignes = g.notes.map((n) => {
    const tags = n.etiquettes.length ? `[${n.etiquettes.join(", ")}] ` : "";
    const qui = n.auteurNom && !n.deMoi ? ` (${n.auteurNom})` : "";
    return `• ${tags}${n.texte.trim()}${qui}`.trimEnd();
  });
  const entete = `Match ${titreSeance(s)} — ${dateSeance(s.commenceLe)}${g.numero ? ` · #${g.numero}` : ""}`;
  return [entete, ...lignes].join("\n").slice(0, 4000);
}

export interface CarteCandidate {
  id: string;
  prenom: string;
  nom: string;
  numero: string | null;
  teamId: string | null;
  equipe: string | null;
}

/** Cartes de l'unité qui portent le même numéro ; celles de l'équipe du match d'abord. */
export function suggestionsCartes(g: Pick<GroupeJoueur, "numero" | "prenom">, cartes: readonly CarteCandidate[], equipesDuMatch: readonly string[] = []): (CarteCandidate & { memeEquipe: boolean })[] {
  if (!g.numero) return [];
  const prenom = (g.prenom ?? "").trim().toLowerCase();
  return cartes
    .filter((c) => (c.numero ?? "").trim() === g.numero)
    .map((c) => ({ ...c, memeEquipe: !!c.teamId && equipesDuMatch.includes(c.teamId) }))
    .sort((a, b) =>
      Number(b.memeEquipe) - Number(a.memeEquipe)
      || Number(!!prenom && b.prenom.toLowerCase().startsWith(prenom)) - Number(!!prenom && a.prenom.toLowerCase().startsWith(prenom))
      || `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`, "fr"))
    .slice(0, 5);
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
