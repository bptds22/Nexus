// components/page-editor/pageBridge.ts
//
// Pont éditeur → props des VRAIS composants program-page (pattern wallBridge).
// State local de l'éditeur → contrats de CampusSection / AboutSell /
// AcademicPlanche / ParcoursRoute / NewsSection. Aucune écriture DB.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ RÈGLE — CE FICHIER NE CONTIENT AUCUNE DONNÉE D'UNE ÉCOLE RÉELLE.         ║
// ║                                                                          ║
// ║ Pas de nom de collège, pas de surnom, pas d'adresse, pas de ville, pas   ║
// ║ d'initiales, pas de couleur de marque, pas de statistique. TOUT ce qui    ║
// ║ identifie un établissement arrive en PARAMÈTRE, depuis le contexte de     ║
// ║ l'éditeur (`useEditor()` → `school` / `initial`).                        ║
// ║                                                                          ║
// ║ Une constante en dur ici finit toujours par s'afficher chez quelqu'un     ║
// ║ d'autre. C'est arrivé TROIS fois, toutes avec les données de Grasset :    ║
// ║   · la fiche campus  — « Francophone · Privé · Montréal », 1001 Crémazie ║
// ║   · « L'affiche »    — 4 rangées de sports qui n'étaient pas les siens    ║
// ║   · le parcours      — « le Phénix », « ANDRÉ-GRASSET », « AG », 12       ║
// ║                                                                          ║
// ║ Seul reste autorisé : ce qui est VRAI pour tous les collèges (libellés    ║
// ║ génériques d'étapes, rampe de texte de la coquille Nexus).                ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import type * as React from "react";
import { deriveWallTheme } from "@/components/program-wall/theme";
import type { ProgramPageContent, NewsItem, CampusCard } from "@/components/program-page/content";

/* rootStyle du shell .pp nx-dna — dérivé des 3 couleurs de l'éditeur (deriveWall
   Theme, mêmes vars que ProgramPage). Les couleurs choisies pilotent DONC les
   accents de TOUTES les previews de section (Campus/À propos/Parcours/News),
   pas seulement le mur. */
export function buildPreviewRootStyle(c1: string, c2: string, c3: string): React.CSSProperties {
  const t = deriveWallTheme(c1, c2, c3);
  return {
    "--red": t.red, "--red-deep": t.redDeep, "--ink": t.ink, "--char": t.char,
    "--cream": t.cream, "--kraft": t.kraft, "--beige": t.beige,
    "--pop": "cubic-bezier(0.34,1.56,0.64,1)", "--nx-red": "#E63946", "--green": "#22C55E",
    "--p-ink": "#EDEFF3", "--p-soft": "#C9CCD4", "--p-mut": "#8A909C", "--p-faint": "#5A616D", "--p-inv": "#15171B",
    "--dna-mark": t.red, "--dna-ink": "#EDEFF3",
  } as React.CSSProperties;
}

/* ── S3 Campus → CampusSection (props: content) ─────────────────────────── */
/** Ce que CampusSection lit RÉELLEMENT dans le contenu, hors cartes. Fourni par
 *  l'éditeur depuis `schools` : sans ça l'aperçu affichait la fiche et la carte
 *  de Grasset à tous les collèges. Absent → valeurs nulles, tuiles masquées. */
export interface CampusFiche {
  language: ProgramPageContent["language"];
  schoolType: ProgramPageContent["schoolType"];
  region: string | null;
  mapQuery: string;
}

export function campusContent(
  cards: { t: string; x: string; image?: string | null }[], yt: string,
  fiche?: CampusFiche,
): ProgramPageContent {
  const campusCards: CampusCard[] = cards
    .filter((c) => c.t)
    .map((c) => ({ type: "photo", image: c.image ?? null, titre: c.t, legende: c.x }));
  if (yt.trim()) campusCards.push({ type: "video", youtubeUrl: yt.trim() });
  // CampusSection ne lit que language/schoolType/region/mapQuery/campusCards ;
  // le reste satisfait le type (non affiché).
  return {
    language: fiche?.language ?? null,
    schoolType: fiche?.schoolType ?? null,
    region: fiche?.region ?? null,
    address: "", mapQuery: fiche?.mapQuery ?? "",
    campusCards,
    ticker: [], stats: { teams: 0, teamsLabel: "", athletes: 0, athletesLabel: "", region: "" },
    sports: [], housing: { type: "none" }, facts: [], videoUrl: null,
    sellText: "", sellTitle: "", featuredPrograms: [], programsList: [],
    route: { stop1: { sl: "", h4: "", p: "" }, stop2: { sl: "", h4: "", p: "" }, stop3: { sl: "", h4: "", stats: [] } },
    universities: [], nexusStripText: "", nexusRecruitedCount: 0,
    ctaTitle: "", ctaNotifyName: "",
  };
}

/* ── S5 Académique → AcademicPlanche ───────────────────────────────────── */
/** Programme visé SIMULÉ, pour montrer au collège à quoi ressemble le board
 *  « perfect match » vu par un athlète. Ce n'est pas une donnée d'école : c'est
 *  un exemple de saisie côté ATHLÈTE, et l'aperçu l'annonce comme tel. */
export const MOCK_VISE = "Sciences de la nature";
export function academicProps(programs: string[], schoolName: string) {
  return { programs, viewerProgrammeVise: MOCK_VISE, schoolName };
}

/* ── S6 Parcours → ParcoursRoute ───────────────────────────────────────── */
const numOrUndef = (s: string): number | undefined => {
  const n = Number((s || "").trim());
  return s.trim() && Number.isFinite(n) ? n : undefined;
};
export interface ParcoursInput {
  pniv: string; nbath: string; enc: string[];
  /** Compte RÉEL de count_recruited_by_school, remonté par le contexte.
   *  Jamais une valeur d'exemple : c'est le même nombre que la page publique,
   *  et à 0 la bande Nexus disparaît des deux côtés. */
  recrutes: number;
  pus: string; pusa: string; pdip: string;
  universities: string[]; initials: string; slogan: string;
  /** Identité RÉELLE de l'école éditée — jamais une constante de ce fichier. */
  schoolName: string;
  /** Surnom saisi en S1 ; vide → le nom de l'école prend sa place, comme sur
   *  la page publique (`nn(c.nickname, school.name)`). */
  nickname: string;
}
export function parcoursProps(i: ParcoursInput) {
  const encText = i.enc.length ? i.enc.join(" · ") : "encadrement sport-études";
  // stop2 : composition qui SAUTE les parties vides → jamais de virgule orpheline
  // (« , étudiants-athlètes, … » quand le niveau est vide).
  const stop2parts = [
    i.pniv.trim(),
    i.nbath.trim() ? `${i.nbath.trim()} étudiants-athlètes` : "",
    encText,
  ].filter(Boolean);
  // L'étiquette de l'étape 2 reprend EXACTEMENT la formule publique
  // (dbToProgramPage) : surnom si saisi, sinon nom de l'école.
  const marque = (i.nickname.trim() || i.schoolName).toUpperCase();
  return {
    schoolName: i.schoolName,
    initials: i.initials,
    slogan: i.slogan || null,
    route: {
      // stop1 et stop3 (sl/h4) sont GÉNÉRIQUES — vrais pour tout collège, et
      // identiques mot pour mot à ce que rend la page publique.
      stop1: { sl: "AUJOURD'HUI · SECONDAIRE", h4: "Ton profil Nexus", p: "Stats, vidéos, bulletins — tout ce que les coachs veulent voir." },
      stop2: { sl: `2027–2029 · ${marque}`, h4: "Tu portes les couleurs", p: `${stop2parts.join(", ")}.` },
      stop3: {
        sl: "ENSUITE · U SPORTS", h4: "Tu montes encore",
        stats: [
          { count: i.recrutes, label: "RECRUTÉS" },
          { count: numOrUndef(i.pus), label: "EN U SPORTS" },
          { count: numOrUndef(i.pusa), label: "AUX ÉTATS-UNIS" },
          { count: numOrUndef(i.pdip), suffix: "%", label: "DIPLOMATION" },
        ],
      },
    },
    universities: i.universities,
    nexusStripText: `Des athlètes du secondaire ont rejoint ${i.schoolName} grâce à leur profil Nexus — vus, évalués, recrutés.`,
    nexusRecruitedCount: i.recrutes,
  };
}

/* ── S7 News → NewsSection ─────────────────────────────────────────────── */
function domainOf(url: string): string {
  try { return new URL(url).hostname.replace("www.", "").toUpperCase(); } catch { return "—"; }
}
export function newsItems(news: { t: string; u: string }[]): NewsItem[] {
  return news.filter((n) => n.t).map((n) => ({ source: domainOf(n.u), titre: n.t, url: n.u || "#" }));
}
