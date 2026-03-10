/**
 * NEXUS DATA MODEL — SINGLE SOURCE OF TRUTH
 * All interfaces and types for the platform.
 * Every component and mock data file must import from here.
 * Do NOT create new interfaces in component files.
 */

/* ══════════════════════════════════════════════════════════════
   ATHLETE — core profile used across coach + recruiter portals
══════════════════════════════════════════════════════════════ */

/** Status for the "Mes Athlètes" list (coach-side) */
export type AthleteStatus = "actif" | "en_attente" | "brouillon" | "inactif";

/** Status for athlete_team_profiles (approval pipeline) */
export type ProfileApprovalStatus = "approved" | "pending" | "draft";

/** Video link entry for athlete profile */
export interface AthleteVideo {
  title: string;
  url: string;
  description: string;
  duration: string;
}

/** Timeline entry for athletic career history */
export interface AthleteTimelineEntry {
  yearRange: string;
  team: string;
  role: string;
  achievements: string;
}

/** Recruiter activity log entry */
export interface RecruiterActivityEntry {
  recruiterName: string;
  cegepName: string;
  action: string;
  date: string;
}

/** Coach contact info (visible to coach only) */
export interface CoachContact {
  name: string;
  email: string;
  phone: string;
}

/** Athlete as shown in the coach's "Mes Athlètes" grid/table */
export interface Athlete {
  id: string;
  firstName: string;
  lastName: string;
  gender: "M" | "F";
  dateOfBirth: string;
  sport: string;
  position: string;
  schoolName: string;
  city: string;
  gradYear: number;
  profileCompletion: number;
  status: AthleteStatus;
  recruiterViews: number;
  favoriteCount: number;
  photoUrl: string | null;
  createdAt: string;
  updatedAt: string;
  pendingRequests: number;
  hasVideo: boolean;
  hasStats: boolean;
  hasPhoto: boolean;
  coachRating: number;
  recruiterAvg: number | null;
  /* ── Profile detail fields (optional for list views) ── */
  bio?: string;
  traits?: string[];
  stats?: Record<string, string | number>;
  heightCm?: number;
  weightKg?: number;
  coteR?: number | null;
  program?: string;
  languages?: string[];
  nationality?: string;
  videos?: AthleteVideo[];
  timeline?: AthleteTimelineEntry[];
  recruiterActivity?: RecruiterActivityEntry[];
  coachContact?: CoachContact;
}

/** Athlete row in the coach dashboard table (compact view with completeness flags) */
export interface DashboardAthleteData {
  id: number;
  name: string;
  position: string;
  gradYear: string;
  sport: string;
  status: ProfileApprovalStatus;
  rating: number;
  views: number;
  favorites: number;
  teamId: string;
  hasPhoto: boolean;
  hasIdentity: boolean;
  hasTeam: boolean;
  hasEvaluation: boolean;
  hasAcademic: boolean;
  hasCegep: boolean;
  hasPhysical: boolean;
  hasTests: boolean;
  hasStats: boolean;
  hasMedia: boolean;
  hasDetailedEval: boolean;
  hasTraits: boolean;
  recruiterAvg: number | null;
  division?: string;
}

/** Athlete as seen by a recruiter (search/detail view) */
export interface RecruiterAthlete {
  id: string;
  firstName: string;
  lastName: string;
  school: string;
  sport: string;
  position: string;
  division: "D1" | "D2" | "D3";
  gradYear: number;
  heightCm: number;
  weightKg: number;
  coachRating: number;
  cegepAvgRating: number;
  keyStats: string;
  status: "approved" | "new" | "contacted";
  bio: string;
  coachNotes: string;
  hometown: string;
  jerseyNumber: number;
  isFavorite: boolean;
}

/* ══════════════════════════════════════════════════════════════
   ATHLETE FORM — multi-step create/edit wizard
══════════════════════════════════════════════════════════════ */

export interface AthleteFormIdentity {
  photo: string;
  firstName: string;
  lastName: string;
  gender: string;
  dateOfBirth: string;
  gradYear: string;
  school: string;
  city: string;
  region: string;
  phone: string;
  email: string;
  parentName: string;
  parentPhone: string;
}

export interface AthleteFormAcademic {
  academicMode: "simple" | "detailed";
  gpa: string;
  strongSubjects: string[];
  academicHonors: string[];
  cegepPrograms: string[];
  cegepProgramDetail: string;
  openToPrivate: boolean;
  openToAnglophone: boolean;
  cegepRegions: string[];
}

export interface AthleteFormPhysical {
  physicalMode: "simple" | "detailed";
  heightFeet: string;
  heightInches: string;
  weightLbs: string;
  wingspan: string;
  handSize: string;
  dominantHand: string;
  dominantFoot: string;
  fortyYard: string;
  verticalJump: string;
  broadJump: string;
  benchPress: string;
  shuttleAgility: string;
  sprint100m: string;
}

export interface AthleteFormSports {
  primarySport: string;
  primarySportDetail: string;
  secondarySport: string;
  secondarySportDetail: string;
  primaryPosition: string;
  secondaryPosition: string;
  secondarySportPosition: string;
  selectedTeamId: string;
  currentTeam: string;
  teamLevel: string;
  teamDivision: string;
  jerseyNumber: string;
  league: string;
  secondaryTeamId: string;
  secondaryTeam: string;
  secondaryTeamLevel: string;
  secondaryTeamDivision: string;
  secondaryLeague: string;
  recruitingLevel: string;
  openToCoaching: boolean;
}

export interface AthleteFormMedia {
  hudlLink: string;
  youtubeLink: string;
  instagramLink: string;
  highlightVideo: string;
  fullGameVideo: string;
  trainingVideo: string;
}

export interface AthleteFormEvaluation {
  evalMode: "simple" | "detailed";
  overallRating: number;
  speed: number;
  strength: number;
  endurance: number;
  agility: number;
  gameVision: number;
  tacticalSense: number;
  workEthic: number;
  coachability: number;
  leadership: number;
  teamSpirit: number;
  competitiveLevel: number;
  coachComments: string;
  personalityTraits: string[];
}

export interface AthleteFormSubmission {
  recruitingStatus: string;
  preferredDivision: string;
}

export interface AthleteFormData {
  identity: AthleteFormIdentity;
  academic: AthleteFormAcademic;
  physical: AthleteFormPhysical;
  sports: AthleteFormSports;
  stats: Record<string, string>;
  media: AthleteFormMedia;
  evaluation: AthleteFormEvaluation;
  submission: AthleteFormSubmission;
}

/* ══════════════════════════════════════════════════════════════
   SPORTS DATA
══════════════════════════════════════════════════════════════ */

export interface PositionEntry {
  abbr: string;
  label: string;
  group?: string;
}

/* ══════════════════════════════════════════════════════════════
   COACH PORTAL — UI component props & helpers
══════════════════════════════════════════════════════════════ */

export interface NxOption {
  value: string;
  label: string;
  group?: string;
}

export interface NxSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: NxOption[];
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  "aria-label"?: string;
}

export interface SportPositionSelectProps {
  sport: string;
  value: string;
  onChange: (abbr: string) => void;
  label: string;
  required?: boolean;
  disabled?: boolean;
  hasError?: boolean;
}

export interface SportStatsFieldsProps {
  sport: string;
  stats: Record<string, string>;
  onChange: (key: string, value: string) => void;
}

export interface StatField {
  key: string;
  label: string;
  type: "number" | "text";
  placeholder?: string;
  decimal?: boolean;
}

export interface DatePickerProps {
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
  hasError?: boolean;
}

export interface StarRatingInputProps {
  value: number;
  onChange: (rating: number) => void;
  max?: number;
  label?: string;
  compact?: boolean;
  gold?: boolean;
  hideScore?: boolean;
}

export interface TagInputProps {
  label?: string;
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxTags?: number;
}

export interface StepIndicatorStep {
  number: number;
  name: string;
}

export interface StepIndicatorProps {
  steps: StepIndicatorStep[];
  currentStep: number;
  completedSteps: Set<number>;
  onStepClick: (step: number) => void;
}

export interface CoachSidebarProps {
  mobileOpen: boolean;
  onClose: () => void;
}

/* ══════════════════════════════════════════════════════════════
   RECRUITER PORTAL
══════════════════════════════════════════════════════════════ */

export type ContactRequestStatus = "open" | "approved" | "declined" | "closed";

export interface ContactRequest {
  id: number;
  recruiterName: string;
  recruiterOrg: string;
  athlete: string;
  sport: string;
  position: string;
  date: string;
  status: ContactRequestStatus;
}

/* ══════════════════════════════════════════════════════════════
   ROADMAP
══════════════════════════════════════════════════════════════ */

export type PhaseStatus = "completed" | "in-progress" | "planned";

export interface RoadmapPhase {
  id: string;
  phase: string;
  title: string;
  summary: string;
  status: PhaseStatus;
  features: string[];
}

/* ══════════════════════════════════════════════════════════════
   SORT HELPERS
══════════════════════════════════════════════════════════════ */

export type AthleteSortKey = "name" | "sport" | "position" | "school" | "gradYear" | "completion" | "views" | "status";
