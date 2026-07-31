// components/page-editor/pageBridge.ts
//
// Pont éditeur → props des VRAIS composants program-page (pattern wallBridge).
// State local de l'éditeur → contrats de CampusSection / AboutSell /
// AcademicPlanche / ParcoursRoute / NewsSection. Aucune écriture DB (Bloc 2).

import type * as React from "react";
import { deriveWallTheme } from "@/components/program-wall/theme";
import type { ProgramPageContent, NewsItem, CampusCard } from "@/components/program-page/content";

export const SCHOOL_NAME = "Collège André-Grasset";

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
/** Défaut Grasset — repli quand le contexte n'a pas encore de couleurs. */
export const PREVIEW_ROOT_STYLE = buildPreviewRootStyle("#A6192E", "#5A0E1B", "#E8C7CD");

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
export const MOCK_VISE = "Sciences de la nature"; // « vue athlète simulée »
export function academicProps(programs: string[]) {
  return { programs, viewerProgrammeVise: MOCK_VISE, schoolName: SCHOOL_NAME };
}

/* ── S6 Parcours → ParcoursRoute ───────────────────────────────────────── */
const numOrUndef = (s: string): number | undefined => {
  const n = Number((s || "").trim());
  return s.trim() && Number.isFinite(n) ? n : undefined;
};
export interface ParcoursInput {
  pniv: string; nbath: string; enc: string[];
  recrutes: number; pus: string; pusa: string; pdip: string;
  universities: string[]; initials: string; slogan: string;
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
  return {
    schoolName: SCHOOL_NAME,
    initials: i.initials || "AG",
    slogan: i.slogan || null,
    route: {
      // stop1/stop3(sl,h4) = fixture ; stop2 COMPOSÉ depuis pniv+nbath+enc.
      stop1: { sl: "AUJOURD'HUI · SECONDAIRE", h4: "Ton profil Nexus", p: "Stats, vidéos, bulletins — tout ce que les coachs veulent voir." },
      stop2: { sl: "2027–2029 · ANDRÉ-GRASSET", h4: "Tu portes le rouge", p: `${stop2parts.join(", ")}.` },
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
    nexusStripText: "Des athlètes du secondaire ont rejoint le Phénix grâce à leur profil Nexus — vus, évalués, recrutés.",
    nexusRecruitedCount: 12,
  };
}

/* ── S7 News → NewsSection ─────────────────────────────────────────────── */
function domainOf(url: string): string {
  try { return new URL(url).hostname.replace("www.", "").toUpperCase(); } catch { return "—"; }
}
export function newsItems(news: { t: string; u: string }[]): NewsItem[] {
  return news.filter((n) => n.t).map((n) => ({ source: domainOf(n.u), titre: n.t, url: n.u || "#" }));
}
