/**
 * Mock Recruiter Athlete Profile Views
 * Two profiles: one complete, one partial — for testing both states.
 */

import type { AthleteProfileRecruiterView } from "@/lib/types/models";

/* ── Marc-Antoine Tremblay — QB Football, 92% complete ───────── */
export const mockAthleteProfileFull: AthleteProfileRecruiterView = {
  id: "r-001",
  firstName: "Marc-Antoine",
  lastName: "Tremblay",
  age: 17,
  gender: "M",
  photoUrl: undefined,
  schoolName: "École secondaire Saint-Jean-Eudes",
  city: "Québec",
  region: "Capitale-Nationale",
  graduationYear: 2026,
  dateOfBirth: "2008-03-15",

  // Sport
  primarySport: "Football",
  primaryPosition: "Quart-arrière (QB)",
  jerseyNumber: "12",
  secondarySport: "Basketball",
  secondaryPosition: "Meneur",
  teamName: "Élites de Saint-Jean-Eudes",
  leagueName: "RSEQ Juvénile D1",
  teamLevel: "Juvénile D1",

  // Physical
  heightFeet: 6,
  heightInches: 2,
  heightDisplay: "6'2\"",
  weightLbs: 195,
  weightDisplay: "195 lbs",
  wingspan: "6'4\"",
  handSize: "9.5\"",
  dominantHand: "Droite",
  dominantFoot: "Droit",

  // Athletic tests
  fortyYard: "4.72s",
  verticalJump: "32\"",
  broadJump: "9'2\"",
  benchPress: "225 × 8",
  shuttleAgility: "4.31s",
  sprint100m: "10.9s",

  // Academic
  gpa: 82,
  program: "Sport-études",
  strongSubjects: ["Éducation physique", "Mathématiques", "Sciences", "Histoire"],
  academicHonors: ["Tableau d'honneur 2024-2025", "Bourse d'excellence sportive"],
  targetCegepProgram: ["DEC général (préuniversitaire)"],
  openToRelocate: true,
  openToPrivate: false,
  openToAnglophone: false,
  wantsDEC: true,
  preferredRegions: ["Québec", "Montréal", "Laurentides"],

  // Coach evaluation
  coachName: "Coach Bergeron",
  coachSchool: "É.S. Saint-Jean-Eudes",
  coachReport: "Marc-Antoine a mené notre ligue avec 18 touchés cette saison. Capitaine unanime, premier au gymnase, dernier à quitter. Il lit les défenses comme un vétéran. Je le recommande sans hésitation pour tout programme D1.",
  traitRatings: {
    speed: 4, power: 4, endurance: 3, agility: 5, gameVision: 4, tactics: 4,
    leadership: 5, discipline: 4, coachability: 5, gameIQ: 4, competitiveness: 5, teamwork: 4, resilience: 4, attitude: 5,
  },
  overallRating: 5,
  distinctions: [
    { badgeId: "captain", label: "Capitaine", icon: "captain" },
    { badgeId: "allstar", label: "Étoile provinciale", icon: "allstar" },
    { badgeId: "league_leader", label: "Meilleur joueur de la ligue", icon: "chart", detail: "Touchés par la passe" },
  ],

  // Media
  highlightVideoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  hudlUrl: "https://www.hudl.com/profile/12345",
  youtubeUrl: "https://www.youtube.com/channel/UC12345",
  instagramUrl: "https://instagram.com/matremblay12",
  fullGameUrl: "https://www.youtube.com/watch?v=example2",
  practiceVideoUrl: undefined,

  // Meta
  isVerified: true,
  profileCompleteness: 92,
  favoriteCount: 3,
  viewsThisMonth: 34,
  isOpenToOffers: true,
  commitmentStatus: "ouvert",

  // Coach reputation
  coachReputation: {
    overallScore: 4.3,
    badge: "recommended",
    totalReviews: 12,
    totalPlacements: 8,
    avgResponseTimeHours: 4,
  },
};

/* ── Samuel Côté — OL Football, 55% complete ─────────────────── */
export const mockAthleteProfilePartial: AthleteProfileRecruiterView = {
  id: "r-006",
  firstName: "Samuel",
  lastName: "Côté",
  age: 17,
  gender: "M",
  photoUrl: undefined,
  schoolName: "École secondaire De Mortagne",
  city: "Boucherville",
  region: "Montérégie",
  graduationYear: 2026,
  dateOfBirth: "2008-06-10",

  // Sport
  primarySport: "Football",
  primaryPosition: "Ligne offensive (OL)",
  jerseyNumber: "74",
  secondarySport: undefined,
  secondaryPosition: undefined,
  teamName: "Lynx de De Mortagne",
  leagueName: "RSEQ Juvénile D1",
  teamLevel: "Juvénile D1",

  // Physical
  heightFeet: 6,
  heightInches: 1,
  heightDisplay: "6'1\"",
  weightLbs: 245,
  weightDisplay: "245 lbs",
  wingspan: undefined,
  handSize: undefined,
  dominantHand: "Droite",
  dominantFoot: undefined,

  // Athletic tests — none filled
  fortyYard: undefined,
  verticalJump: undefined,
  broadJump: undefined,
  benchPress: undefined,
  shuttleAgility: undefined,
  sprint100m: undefined,

  // Academic
  gpa: 71,
  program: undefined,
  strongSubjects: ["Éducation physique"],
  academicHonors: [],
  targetCegepProgram: ["Programme technique"],
  openToRelocate: false,
  openToPrivate: false,
  openToAnglophone: false,
  wantsDEC: false,
  preferredRegions: ["Montérégie"],

  // Coach evaluation
  coachName: "Coach Lafleur",
  coachSchool: "É.S. De Mortagne",
  coachReport: "Samuel est un joueur de ligne fiable. Il progresse chaque semaine et a le gabarit pour jouer au prochain niveau.",
  traitRatings: undefined,
  overallRating: 3,
  distinctions: [],

  // Media — none
  highlightVideoUrl: undefined,
  hudlUrl: undefined,
  youtubeUrl: undefined,
  instagramUrl: undefined,
  fullGameUrl: undefined,
  practiceVideoUrl: undefined,

  // Meta
  isVerified: false,
  profileCompleteness: 55,
  favoriteCount: 0,
  viewsThisMonth: 12,
  isOpenToOffers: true,
  commitmentStatus: "ouvert",

  // Coach reputation — not public
  coachReputation: undefined,
};

/* ── Bruno-Philippe Simard — LB Football, 100% complete ──────── */
export const mockBrunoProfile: AthleteProfileRecruiterView = {
  id: "r-020",
  firstName: "Bruno-Philippe",
  lastName: "Simard",
  age: 16,
  gender: "M",
  photoUrl: undefined,
  schoolName: "École secondaire Saint-Jean-Eudes",
  city: "Québec",
  region: "Capitale-Nationale",
  graduationYear: 2027,
  dateOfBirth: "2009-04-12",

  // Sport
  primarySport: "Football",
  primaryPosition: "Secondeur (LB)",
  jerseyNumber: "7",
  secondarySport: undefined,
  secondaryPosition: undefined,
  teamName: "Élites de Saint-Jean-Eudes",
  leagueName: "RSEQ Juvénile D1",
  teamLevel: "Juvénile D1",

  // Physical
  heightFeet: 6,
  heightInches: 2,
  heightDisplay: "6'2\"",
  weightLbs: 215,
  weightDisplay: "215 lbs",
  wingspan: "6'4\"",
  handSize: "9.75\"",
  dominantHand: "Droite",
  dominantFoot: "Droit",

  // Athletic tests
  fortyYard: "4.65s",
  verticalJump: "34\"",
  broadJump: "9'6\"",
  benchPress: "275 × 5",
  shuttleAgility: "4.18s",
  sprint100m: "11.1s",

  // Academic
  gpa: 95,
  program: "Sport-études",
  strongSubjects: ["Éducation physique", "Mathématiques", "Français", "Sciences"],
  academicHonors: ["Tableau d'honneur 2024-2025", "Mention du directeur"],
  targetCegepProgram: ["DEC général (préuniversitaire)"],
  openToRelocate: true,
  openToPrivate: false,
  openToAnglophone: false,
  wantsDEC: true,
  preferredRegions: ["Québec", "Montréal"],

  // Coach evaluation
  coachName: "Coach Bergeron",
  coachSchool: "É.S. Saint-Jean-Eudes",
  coachReport: "Bruno a mené notre ligue avec 58 plaques cette saison. Capitaine unanime, premier au gymnase, dernier à quitter. Il lit les offensives comme un vétéran. Je le recommande sans hésitation pour tout programme D1.",
  traitRatings: {
    speed: 4, power: 5, endurance: 4, agility: 4, gameVision: 5, tactics: 4,
    leadership: 5, discipline: 5, coachability: 5, gameIQ: 5, competitiveness: 5, teamwork: 5, resilience: 4, attitude: 5,
  },
  overallRating: 5,
  distinctions: [
    { badgeId: "captain", label: "Capitaine", icon: "captain" },
    { badgeId: "allstar", label: "Étoile provinciale", icon: "allstar" },
    { badgeId: "league_leader", label: "Meilleur joueur de la ligue", icon: "chart", detail: "Plaques" },
  ],

  // Media
  highlightVideoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  hudlUrl: "https://www.hudl.com/profile/67890",
  youtubeUrl: "https://www.youtube.com/channel/UC67890",
  instagramUrl: undefined,
  fullGameUrl: "https://www.youtube.com/watch?v=example3",
  practiceVideoUrl: undefined,

  // Meta
  isVerified: true,
  profileCompleteness: 100,
  favoriteCount: 5,
  viewsThisMonth: 41,
  isOpenToOffers: true,
  commitmentStatus: "ouvert",

  // Coach reputation
  coachReputation: {
    overallScore: 4.3,
    badge: "recommended",
    totalReviews: 12,
    totalPlacements: 8,
    avgResponseTimeHours: 4,
  },
};

/* ── Lookup ──────────────────────────────────────────────────── */
export const ALL_RECRUITER_PROFILES: Record<string, AthleteProfileRecruiterView> = {
  "r-001": mockAthleteProfileFull,
  "r-006": mockAthleteProfilePartial,
  "r-020": mockBrunoProfile,
};
