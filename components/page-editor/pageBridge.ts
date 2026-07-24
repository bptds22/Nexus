// components/page-editor/pageBridge.ts
//
// Pont éditeur → props des VRAIS composants program-page (pattern wallBridge).
// State local de l'éditeur → contrats de CampusSection / AboutSell /
// AcademicPlanche / ParcoursRoute / NewsSection. Aucune écriture DB (Bloc 2).

import type * as React from "react";
import { deriveWallTheme } from "@/components/program-wall/theme";
import type { ProgramPageContent, NewsItem, CampusCard } from "@/components/program-page/content";

export const SCHOOL_NAME = "Collège André-Grasset";

/* rootStyle du shell .pp nx-dna — réplique EXACTEMENT ProgramPage (thème Grasset)
   pour que les composants scopés .pp rendent à l'identique. */
const t = deriveWallTheme("#A6192E", "#5A0E1B", "#E8C7CD");
export const PREVIEW_ROOT_STYLE = {
  "--red": t.red, "--red-deep": t.redDeep, "--ink": t.ink, "--char": t.char,
  "--cream": t.cream, "--kraft": t.kraft, "--beige": t.beige,
  "--pop": "cubic-bezier(0.34,1.56,0.64,1)", "--nx-red": "#E63946", "--green": "#22C55E",
  "--p-ink": "#EDEFF3", "--p-soft": "#C9CCD4", "--p-mut": "#8A909C", "--p-faint": "#5A616D", "--p-inv": "#15171B",
  "--dna-mark": t.red, "--dna-ink": "#EDEFF3",
} as React.CSSProperties;

/* ── S3 Campus → CampusSection (props: content) ─────────────────────────── */
export function campusContent(
  cards: { t: string; x: string }[], yt: string,
): ProgramPageContent {
  const campusCards: CampusCard[] = cards
    .filter((c) => c.t)
    .map((c) => ({ type: "photo", image: null, titre: c.t, legende: c.x }));
  if (yt.trim()) campusCards.push({ type: "video", youtubeUrl: yt.trim() });
  // CampusSection ne lit que language/schoolType/region/mapQuery/campusCards ;
  // le reste satisfait le type (fixture, non affiché).
  return {
    language: "FR", schoolType: "PRIVÉ", region: "Montréal",
    address: "1001, boul. Crémazie Est, Montréal", mapQuery: "Collège André-Grasset, Montréal",
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
  return {
    schoolName: SCHOOL_NAME,
    initials: i.initials || "AG",
    slogan: i.slogan || null,
    route: {
      // stop1/stop3(sl,h4) = fixture ; stop2 COMPOSÉ depuis pniv+nbath+enc.
      stop1: { sl: "AUJOURD'HUI · SECONDAIRE", h4: "Ton profil Nexus", p: "Stats, vidéos, bulletins — tout ce que les coachs veulent voir." },
      stop2: { sl: "2027–2029 · ANDRÉ-GRASSET", h4: "Tu portes le rouge", p: `${i.pniv}, ${i.nbath} étudiants-athlètes, ${encText}.` },
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
