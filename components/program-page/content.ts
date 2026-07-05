// components/program-page/content.ts
//
// Data contract for the Niveau-1 page body (v8.2). Kept separate from
// SchoolProgramIdentity (program-wall is out of scope). All stats/campus data
// are MOCK this ticket (real bindings / editor = later blocs).

export interface SportCard {
  slug:
    | "football" | "basketball" | "soccer" | "volleyball" | "flag"
    | "cross" | "badminton" | "cheer" | "hockey" | "natation";
  name: string;
  desc: string;
  badges: { label: string; kind: "d1" | "rec" }[];
  href: string;
}

export interface TickerWord {
  text: string;
  hot?: boolean;
}

export interface RouteStat {
  count: number;
  suffix?: string;
  label: string;
}

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
  sports: SportCard[];
  /** Campus (v8.2 — moved before À propos) */
  language: "FR" | "EN" | "BILINGUE";
  schoolType: "PRIVÉ" | "PUBLIC";
  region: string; // fiche RÉGION value
  address: string; // mappin display
  mapQuery: string; // Google Maps keyless q
  housing: { type: "campus" | "partner" | "pension" | "none"; note?: string };
  /** installations shown as facts (mock 2 items) */
  facts: { title: string; text: string }[];
  videoUrl: string | null; // null → vstrip "à venir"; set → compact embed/link
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
  /** CTA */
  ctaTitle: string;
  ctaNotifyName: string;
}

/** LANGUE tile display. */
export const languageLabel = (l: ProgramPageContent["language"]): string =>
  l === "EN" ? "ANGLOPHONE" : l === "BILINGUE" ? "BILINGUE" : "FRANCOPHONE";
