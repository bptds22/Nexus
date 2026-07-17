// components/program-page/content.ts
//
// Data contract for the Niveau-1 page body (v8.2). Kept separate from
// SchoolProgramIdentity (program-wall is out of scope). All stats/campus data
// are MOCK this ticket (real bindings / editor = later blocs).

/** Sport S2 "L'affiche" — MOCK fixture (Bloc 2 = vraies équipes DB). Pills
 *  (divisions / genre / nb) sont DÉRIVÉS de equipes[]. */
export interface SportTeam {
  nom: string;
  /** "D1" | "D2" | "D3" | null (null → aucune pill division, ex. RSEQ). */
  division: string | null;
  /** genre équipe (forme chip) : "M" | "F" | "M&F" | "Mixte". */
  genre: string;
  /** route page équipe — placeholder "#" pour l'instant (câblage Bloc 2). */
  url: string;
}
export interface Sport {
  nom: string;
  equipes: SportTeam[];
}

export interface TickerWord {
  text: string;
  hot?: boolean;
}

export interface RouteStat {
  /** SAISIE MANUELLE (fixture — Bloc 2). Undefined → item non rendu (jamais un 0). */
  count?: number;
  suffix?: string;
  label: string;
}

/** News card — saisie manuelle (Bloc 2). 0 news → section #news absente. */
export interface NewsItem {
  source: string;
  titre: string;
  url: string;
}

/** Campus carousel card. Photo card = {image, titre, legende≤60}; the video
 *  card = {type:'video', youtubeUrl}. image / youtubeUrl null → neutral
 *  gradient fallback (no invented image). MOCK this ticket — recruiter upload
 *  + real youtubeUrl binding = Bloc 2. */
export type CampusCard =
  | { type?: "photo"; image: string | null; titre: string; legende: string }
  | { type: "video"; youtubeUrl: string | null };

export interface ProgramPageContent {
  /** marquee vocabulary */
  ticker: TickerWord[];
  /** S1 — 3 type-block rows (v8: no D1 row) */
  stats: {
    teams: number; // tr-ink count
    teamsLabel: string; // "ÉQUIPES PHÉNIX"
    athletes: number; // tr-red count (+ suffix)
    athletesLabel: string; // "ÉTUDIANTS-ATHLÈTES"
    region: string; // tr-cream label "AHUNTSIC · QUÉBEC"
  };
  /** S2 — sports grid */
  sports: Sport[];
  /** Campus (v8.2 — moved before À propos) */
  language: "FR" | "EN" | "BILINGUE";
  schoolType: "PRIVÉ" | "PUBLIC";
  region: string; // fiche RÉGION value
  address: string; // mappin display
  mapQuery: string; // Google Maps keyless q
  housing: { type: "campus" | "partner" | "pension" | "none"; note?: string };
  /** installations shown as facts (mock 2 items) */
  facts: { title: string; text: string }[];
  videoUrl: string | null; // (legacy — display replaced by campusCards video card)
  /** Campus carousel — ordered 0..n cards. Empty / undefined → no carousel
   *  (never a bare strip). MOCK this ticket; DB binding = Bloc 2. */
  campusCards?: CampusCard[];
  /** S3 — à propos */
  sellText: string;
  sellTitle: string;
  /** S5 — académique */
  featuredPrograms: { title: string; blurb: string }[];
  programsList: string[];
  /** S6 — parcours */
  route: {
    stop1: { sl: string; h4: string; p: string };
    stop2: { sl: string; h4: string; p: string };
    stop3: { sl: string; h4: string; stats: RouteStat[] };
  };
  universities: string[];
  nexusStripText: string;
  nexusRecruitedCount: number;
  /** News — 0..n cards. Empty / undefined → section #news absente. MOCK (Bloc 2). */
  news?: NewsItem[];
  /** Programme visé du profil de l'athlète connecté (perfect match S5). MOCK ici
   *  depuis le fixture ; Bloc 2 = vrai athlete.programmeVise (session). Absent →
   *  board match masqué (seul "TOUS LES PROGRAMMES" s'affiche). */
  viewerProgrammeVise?: string;
  /** CTA */
  ctaTitle: string;
  ctaNotifyName: string;
}

/** LANGUE tile display. */
export const languageLabel = (l: ProgramPageContent["language"]): string =>
  l === "EN" ? "ANGLOPHONE" : l === "BILINGUE" ? "BILINGUE" : "FRANCOPHONE";
