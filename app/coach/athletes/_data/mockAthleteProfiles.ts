/* ─────────────────────────────────────────────────────────────────
   Mock Athlete Profiles — Full data for aperçu + modifier
   Sport-specific leadership badges + coach endorsement model.
───────────────────────────────────────────────────────────────── */

import type { NexusSport } from "@/lib/config/sportBadges";
import type { DistinctionEntry } from "@/lib/config/badges";

export type Position = "QB" | "RB" | "WR" | "TE" | "OL" | "DL" | "LB" | "CB" | "S" | "K/P"
  | "Passeuse" | "Attaquante" | "Libéro" | "Centrale" | "Arrière";

/* ── Athlete Profile ───────────────────────────────────────── */

export interface AthleteProfile {
  id: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  niveau: "Sec. 4" | "Sec. 5";
  position: string;
  jerseyNumber?: string;
  photo?: string;
  heightDisplay: string;
  heightCm?: number;
  weightDisplay: string;
  weightKg?: number;
  fortyYard?: string;
  bench?: string;
  squat?: string;
  videoUrl?: string;
  gpa?: number;
  program?: string;
  graduationYear: number;
  coachName: string;
  coachSchool: string;
  profilePercent: number;
  isVerified: boolean;
  views: number;
  favorites: number;
  stars: number;
  placedAt?: string;
  commitmentStatus?: string;
  school: string;
  region: string;

  // Academic preferences (recruiter-facing)
  openToRelocate?: boolean;
  openToPrivate?: boolean;
  wantsDEC?: boolean;
  openToAnglophone?: boolean;

  // Sport-specific badge model
  sport: NexusSport;
  badges: DistinctionEntry[];
  coachEndorsement?: string;
}

/* ── Marc-Antoine Tremblay — Football QB, COMPLETE ──────────── */
export const MARC_ANTOINE: AthleteProfile = {
  id: "r-001",
  firstName: "Marc-Antoine",
  lastName: "Tremblay",
  dateOfBirth: "2008-03-15",
  niveau: "Sec. 5",
  position: "QB",
  jerseyNumber: "12",
  heightDisplay: "6'2\"",
  heightCm: 188,
  weightDisplay: "195 lbs",
  weightKg: 88,
  fortyYard: "4.68s",
  bench: "225 lbs",
  squat: "335 lbs",
  videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  gpa: 82,
  program: "Sport-études",
  graduationYear: 2026,
  coachName: "Coach Bergeron",
  coachSchool: "É.S. Saint-Jean-Eudes",
  profilePercent: 100,
  isVerified: true,
  views: 34,
  favorites: 3,
  stars: 5,
  commitmentStatus: "ouvert",
  school: "École secondaire Saint-Jean-Eudes",
  region: "Québec, QC",

  openToRelocate: true,
  openToPrivate: false,
  wantsDEC: true,
  openToAnglophone: false,

  sport: "football",
  badges: [
    { badge: "captain" },
    { badge: "allstar" },
    { badge: "league_leader", detail: "Touchés par la passe" },
  ],
  coachEndorsement: "Marc-Antoine a mené notre ligue avec 18 touchés cette saison. Capitaine unanime, premier au gymnase, dernier à quitter. Il lit les défenses comme un vétéran. Je le recommande sans hésitation pour tout programme D1.",
};

/* ── Félix Gagnon-Roy — Football LB, COMPLETE ──────────────── */
export const FELIX: AthleteProfile = {
  id: "r-003",
  firstName: "Félix",
  lastName: "Gagnon-Roy",
  dateOfBirth: "2008-07-22",
  niveau: "Sec. 5",
  position: "LB",
  jerseyNumber: "55",
  heightDisplay: "6'0\"",
  heightCm: 183,
  weightDisplay: "210 lbs",
  weightKg: 95,
  fortyYard: "4.72s",
  bench: "265 lbs",
  squat: "385 lbs",
  videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  gpa: 76,
  program: "Sport-études",
  graduationYear: 2026,
  coachName: "Coach Bergeron",
  coachSchool: "É.S. Saint-Jean-Eudes",
  profilePercent: 100,
  isVerified: true,
  views: 22,
  favorites: 1,
  stars: 4,
  commitmentStatus: "committed",
  school: "École secondaire Saint-Jean-Eudes",
  region: "Québec, QC",

  openToRelocate: true,
  openToPrivate: true,
  wantsDEC: false,
  openToAnglophone: true,

  sport: "football",
  badges: [
    { badge: "team_leader", detail: "Plaqués (67)" },
    { badge: "progression" },
  ],
  coachEndorsement: "Félix est le cœur de notre défensive. Meneur en plaqués pour la 2e saison consécutive. Instinct rare pour lire les jeux. Fort et rapide, il excelle autant en couverture qu'en pression.",
};

/* ── Sophie Bergeron — Volleyball, COMPLETE ─────────────────── */
export const SOPHIE: AthleteProfile = {
  id: "r-016",
  firstName: "Sophie",
  lastName: "Bergeron",
  dateOfBirth: "2008-09-10",
  niveau: "Sec. 5",
  position: "Attaquante",
  jerseyNumber: "7",
  heightDisplay: "5'10\"",
  heightCm: 178,
  weightDisplay: "145 lbs",
  weightKg: 66,
  fortyYard: undefined,
  bench: undefined,
  squat: undefined,
  videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  gpa: 88,
  program: "Sport-études",
  graduationYear: 2026,
  coachName: "Coach Lafleur",
  coachSchool: "É.S. De Mortagne",
  profilePercent: 100,
  isVerified: true,
  views: 19,
  favorites: 2,
  stars: 4,
  commitmentStatus: "en_visite",
  school: "École secondaire De Mortagne",
  region: "Montérégie, QC",

  openToRelocate: false,
  openToPrivate: false,
  wantsDEC: true,
  openToAnglophone: false,

  sport: "volleyball",
  badges: [
    { badge: "captain" },
    { badge: "team_leader", detail: "Attaques" },
  ],
  coachEndorsement: "Sophie est notre passeuse-attaquante la plus complète. 245 attaques marquantes cette saison. Leadership vocal exceptionnel sur le terrain, calme sous pression.",
};

/* ── Émile Tanguay — Cross-country, PARTIAL ─────────────────── */
export const EMILE: AthleteProfile = {
  id: "r-013",
  firstName: "Émile",
  lastName: "Tanguay",
  dateOfBirth: "2009-04-18",
  niveau: "Sec. 4",
  position: "Coureur",
  jerseyNumber: "23",
  heightDisplay: "5'8\"",
  heightCm: 173,
  weightDisplay: "140 lbs",
  weightKg: 64,
  fortyYard: undefined,
  bench: undefined,
  squat: undefined,
  videoUrl: undefined,
  gpa: 79,
  program: undefined,
  graduationYear: 2027,
  coachName: "Coach Dupont",
  coachSchool: "É.S. De Mortagne",
  profilePercent: 55,
  isVerified: false,
  views: 0,
  favorites: 0,
  stars: 2,
  commitmentStatus: "ouvert",
  school: "École secondaire De Mortagne",
  region: "Montérégie, QC",

  openToRelocate: true,
  openToPrivate: false,
  wantsDEC: true,
  openToAnglophone: false,

  sport: "cross_country",
  badges: [
    { badge: "team_leader", detail: "5 km" },
  ],
  coachEndorsement: "Émile a amélioré son temps au 5 km de 45 secondes cette saison. Travailleur acharné, toujours le premier à l'entraînement matinal.",
};

/* ── Étienne Fortin — Football S, INCOMPLETE (no badges) ───── */
export const ETIENNE: AthleteProfile = {
  id: "r-010",
  firstName: "Étienne",
  lastName: "Fortin",
  dateOfBirth: "2009-11-22",
  niveau: "Sec. 4",
  position: "S",
  jerseyNumber: "3",
  heightDisplay: "5'11\"",
  heightCm: 180,
  weightDisplay: "172 lbs",
  weightKg: 78,
  fortyYard: undefined,
  bench: undefined,
  squat: undefined,
  videoUrl: undefined,
  gpa: undefined,
  program: undefined,
  graduationYear: 2027,
  coachName: "Coach Bergeron",
  coachSchool: "É.S. Saint-Jean-Eudes",
  profilePercent: 30,
  isVerified: false,
  views: 0,
  favorites: 0,
  stars: 2,
  commitmentStatus: "ouvert",
  school: "École secondaire de Rochebelle",
  region: "Québec, QC",

  openToRelocate: undefined,
  openToPrivate: undefined,
  wantsDEC: undefined,
  openToAnglophone: undefined,

  sport: "football",
  badges: [],
  coachEndorsement: undefined,
};

/* ── Bruno-Philippe Simard — Football LB, COMPLETE ─────────── */
export const BRUNO: AthleteProfile = {
  id: "r-020",
  firstName: "Bruno-Philippe",
  lastName: "Simard",
  dateOfBirth: "2009-04-12",
  niveau: "Sec. 4",
  position: "LB",
  jerseyNumber: "7",
  heightDisplay: "6'2\"",
  heightCm: 188,
  weightDisplay: "215 lbs",
  weightKg: 98,
  fortyYard: "4.65s",
  bench: "275 lbs",
  squat: "365 lbs",
  videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  gpa: 95,
  program: "Sport-études",
  graduationYear: 2027,
  coachName: "Coach Bergeron",
  coachSchool: "É.S. Saint-Jean-Eudes",
  profilePercent: 100,
  isVerified: true,
  views: 41,
  favorites: 5,
  stars: 5,
  commitmentStatus: "ouvert",
  school: "École secondaire Saint-Jean-Eudes",
  region: "Québec, QC",

  openToRelocate: true,
  openToPrivate: false,
  wantsDEC: true,
  openToAnglophone: false,

  sport: "football",
  badges: [
    { badge: "captain" },
    { badge: "allstar" },
    { badge: "league_leader", detail: "Plaques" },
  ],
  coachEndorsement: "Bruno a mené notre ligue avec 58 plaques cette saison. Capitaine unanime, premier au gymnase, dernier à quitter. Il lit les offensives comme un vétéran. Je le recommande sans hésitation pour tout programme D1.",
};

/* ── Lookup by ID ────────────────────────────────────────────── */
export const ALL_PROFILES: Record<string, AthleteProfile> = {
  "r-001": MARC_ANTOINE,
  "r-003": FELIX,
  "r-010": ETIENNE,
  "r-013": EMILE,
  "r-016": SOPHIE,
  "r-020": BRUNO,
};
