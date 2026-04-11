/**
 * NEXUS DATA MODEL — SINGLE SOURCE OF TRUTH
 * All interfaces and types for the platform.
 * Every component and mock data file must import from here.
 * Do NOT create new interfaces in component files.
 */

/* ══════════════════════════════════════════════════════════════
   ATHLETE VERIFICATION — profile verification system
══════════════════════════════════════════════════════════════ */

/** How the athlete profile was verified */
export type VerificationMethod = "auto" | "manual_coach" | "manual_director";

/** Verification metadata attached to each athlete profile */
export interface AthleteVerification {
  isVerified: boolean;
  method: VerificationMethod | null;        // null if never verified
  verifiedAt: string | null;                // ISO 8601
  verifiedBy: string | null;               // userId of coach/director, or "system"
  verifiedByName: string | null;           // display name ("Coach Dupont", "Directeur Martin", or "Système")
  profilePercentAtVerification: number | null; // snapshot at time of verification
  autoEligible: boolean;                    // true if profilePercent >= 60
  manualOverrideActive: boolean;            // true if manually verified despite < 60%
}

/* ══════════════════════════════════════════════════════════════
   GLOBAL RECRUITMENT STATUS — LinkedIn-style visibility
══════════════════════════════════════════════════════════════ */

export type GlobalRecruitmentStatus = 'OUVERT' | 'EN_PROCESSUS' | 'RECRUTE' | 'RETIRE';

export const RECRUITMENT_STATUS_CONFIG: Record<GlobalRecruitmentStatus, {
  label: string;
  color: string;
  bgColor: string;
  dotColor: string;
}> = {
  OUVERT: { label: 'Ouvert', color: 'text-green-400', bgColor: 'bg-green-400/10', dotColor: '#22C55E' },
  EN_PROCESSUS: { label: 'En processus', color: 'text-yellow-400', bgColor: 'bg-yellow-400/10', dotColor: '#F59E0B' },
  RECRUTE: { label: 'Recruté', color: 'text-red-400', bgColor: 'bg-red-400/10', dotColor: '#E63946' },
  RETIRE: { label: 'Retiré', color: 'text-gray-500', bgColor: 'bg-gray-500/10', dotColor: '#6B7280' },
};

export interface CommitmentRequest {
  id: string;
  athlete_id: string;
  requested_by: string;
  school_id: string;
  status: 'PENDING' | 'CONFIRMED' | 'DENIED';
  open_to_offers: boolean | null;
  created_at: string;
  responded_at: string | null;
}

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
   COMMITMENT STATUS — athlete placement tracking
══════════════════════════════════════════════════════════════ */

export type CommitmentStatus =
  | "available"        // Disponible — cherche un CÉGEP
  | "in_discussion"    // En discussion avec un ou plusieurs CÉGEPs
  | "verbal_commit"    // Engagement verbal (non officiel)
  | "placed"           // Placé — lettre d'intention signée
  | "withdrawn";       // Retiré de la plateforme

/* ══════════════════════════════════════════════════════════════
   COACH REPUTATION — Score, badges, évaluations recruteurs
══════════════════════════════════════════════════════════════ */

export type CoachBadge = "none" | "evaluated" | "recommended" | "elite";

/** Badge color palette — blue check, white medal, red elite, white placeur */
export const BADGE_COLORS = {
  evaluated: "#3B82F6",   // bleu — same as verified badge system
  recommended: "#FFFFFF",  // blanc
  elite: "#E63946",        // rouge WeLead
  placeur: "#FFFFFF",      // blanc
  none: "#333333",         // gris verrouillé
} as const;

export interface CoachReview {
  id: string;
  coachId: string;
  recruiterId: string;
  conversationId: string;
  athleteId: string;
  athleteName: string;
  athletePosition: string;
  profileQuality: 1 | 2 | 3 | 4 | 5;
  responsiveness: 1 | 2 | 3 | 4 | 5;
  evaluationHonesty: 1 | 2 | 3 | 4 | 5;
  professionalism: 1 | 2 | 3 | 4 | 5;
  overallScore: number;                 // 1.0–5.0, avg of 4 criteria, 1 decimal
  wouldRecommend: boolean;
  comment?: string;                     // max 280 chars, PRIVATE (coach only)
  coachReply?: string;                  // max 280 chars, PRIVATE (admin only)
  createdAt: string;                    // ISO 8601
  status: "active" | "flagged" | "removed";
}

export interface CoachReputation {
  coachId: string;

  // Aggregated scores (1.0–5.0, 1 decimal)
  overallScore: number;
  profileQualityAvg: number;
  responsivenessAvg: number;
  honestyAvg: number;
  professionalismAvg: number;

  // Counts
  totalReviews: number;                 // total evaluations received
  totalReviewers: number;               // distinct recruiters
  recommendRate: number;                // 0–100 (percentage, integer)

  // Badges
  badge: CoachBadge;                    // computed: evaluated→recommended→elite
  hasPlaceurBadge: boolean;             // totalPlacements >= 5

  // Quick stats
  totalPlacements: number;              // athletes with commitmentStatus = 'placed'
  avgResponseTimeHours: number;         // avg first reply time
  profileCompletionRate: number;        // % of roster with profileCompleteness >= 60

  // Visibility
  isPublic: boolean;                    // totalReviews >= 3 AND overallScore >= 3.0

  // Career showcase (Phase 2B)
  openToOpportunities: boolean;
  targetSports?: string[];
  targetRegions?: string[];
  targetRole?: "head" | "assistant" | "both";
  careerBio?: string;

  // Meta
  lastUpdatedAt?: string;
}

/** Profile completeness section weights (must sum to 1.0) */
export interface ProfileCompletenessConfig {
  identity: 0.15;
  academic: 0.15;
  physical: 0.15;
  sport: 0.15;
  coachEvaluation: 0.20;
  media: 0.10;
  preferences: 0.10;
}

/** Review widget state per conversation (recruiter-side) */
export interface ReviewWidgetState {
  conversationId: string;
  recruiterId: string;
  coachId: string;
  canReview: boolean;                   // computed from interaction rules
  showWidget: boolean;                  // 24h delay + dismiss logic
  dismissCount: number;                 // 0, 1, or 2 (permanent hide at 2)
  lastDismissedAt?: string;
  reviewSubmitted: boolean;
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
   DIRECTOR PORTALS — École Secondaire & CÉGEP
══════════════════════════════════════════════════════════════ */

export type DirectorRole = "director_hs" | "director_cegep";

export interface DirectorProfile {
  id: string;
  role: DirectorRole;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  establishmentId: string;
  establishmentName: string;
  region: string;
  roleTitle: string;
  accountStatus: "active" | "deactivated";
}

export interface DirectorDashboardStats {
  // École secondaire
  totalAthletes?: number;
  athletesTrend?: number;
  avgProfileCompletion?: number;
  completionTrend?: number;
  recruiterViews30d?: number;
  viewsTrend?: number;
  placementsSeason?: number;
  // CÉGEP
  recruitsConfirmed?: number;
  activePipeline?: number;
  messagesSent30d?: number;
  profilesViewed30d?: number;
}

export type CoachAccountStatus = "ACTIF" | "DESACTIVE";

export interface CoachOverview {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  sport: string;
  athleteCount: number;
  profilesCompleted: number;
  profileCompletionRate: number;
  recruiterViews30d: number;
  viewsTrend: number;
  messagesReceived: number;
  lastLoginAt: string;
  status: "active" | "inactive_7d" | "inactive_30d";
  accountStatus: CoachAccountStatus;
  deactivatedAt?: string | null;
  deactivatedBy?: string | null;
  deactivationReason?: string | null;
}

export interface TrainerOverview {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  sports: string[];
  division: ("D1" | "D2" | "D3")[];
  activeFavorites: number;
  messagesSent30d: number;
  recruitsConfirmed: number;
  lastLoginAt: string;
  status: "active" | "inactive" | "season_ended";
  accountStatus: CoachAccountStatus;
  deactivatedAt?: string | null;
  deactivatedBy?: string | null;
  deactivationReason?: string | null;
}

export interface Placement {
  id: string;
  athleteId: string;
  athleteName: string;
  sport: string;
  position: string;
  destinationCegep: string;
  sourceSchool?: string;
  coachId?: string;
  coachName: string;
  recruiterId?: string;
  recruiterName?: string;
  signedAt: string;
}

export interface RecruitmentStatsBySport {
  sport: string;
  athletes: number;
  profilesCompleted: number;
  views: number;
  contacts: number;
  placements: number;
}

export interface Invitation {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  sports: string[];
  role?: string;
  message?: string;
  sentAt: string;
  status: "pending" | "accepted" | "expired";
}

export type DirectorActivityType =
  | "coach_added_athlete"
  | "athlete_viewed"
  | "letter_of_intent"
  | "coach_inactive"
  | "profile_verified"
  | "recruit_confirmed"
  | "new_favorite"
  | "message_sent"
  | "recruiter_inactive"
  | "coach_joined"
  | "recruiter_joined"
  | "coach_deactivated"
  | "coach_reactivated"
  | "athlete_reassigned"
  | "pipeline_transferred"
  | "pipeline_frozen";

export interface DirectorActivity {
  id: string;
  type: DirectorActivityType;
  timestamp: string;
  isRead: boolean;
  athleteId?: string;
  athleteName?: string;
  coachId?: string;
  coachName?: string;
  recruiterName?: string;
  schoolName?: string;
  cegepName?: string;
  sportName?: string;
  daysInactive?: number;
  ctaLabel: string;
  ctaRoute: string;
  isHighlighted?: boolean;
}

export interface DirectorNotificationPrefs {
  newPlacement: { inApp: boolean; email: boolean };
  staffInactive: { inApp: boolean; email: boolean };
  newStaffJoined: { inApp: boolean; email: boolean };
  weeklyDigest: boolean;
}

export interface DirectorSettings {
  profile: DirectorProfile;
  notifications: DirectorNotificationPrefs;
}

/* ══════════════════════════════════════════════════════════════
   CÉGEP DIRECTOR DASHBOARD — Value & ROI
══════════════════════════════════════════════════════════════ */

export interface CegepRecruitmentFunnel {
  identified: number;
  contacted: number;
  in_discussion: number;
  visit_planned: number;
  engaged: number;
  signed: number;
  retired: number;
  avg_contacts_to_sign: number;
  avg_visits_to_sign: number;
  avg_days_to_sign: number;
}

export interface RecruiterPerformance {
  recruiter_id: string;
  name: string;
  identified: number;
  contacted: number;
  in_discussion: number;
  visits: number;
  signed: number;
  conversion_rate: number;
  avg_days_to_sign: number;
  activity_7d: number; // 0-1 scale for sparkbar
  status: "ACTIF" | "DESACTIVE";
}

export interface CegepRosterNeed {
  sport: string;
  positions_needed: number;
  positions_filled: number;
}

export interface CegepCohortData {
  year: number;
  identified: number;
  contacted: number;
  signed: number;
}

export interface CegepTopTarget {
  rank: number;
  athleteId: string;
  name: string;
  sport: string;
  position: string;
  pipelineStatus: string;
  recruiterName: string;
  views: number;
  rating: number;
}

export interface CegepSeasonComparison {
  metric: string;
  current: number;
  previous: number;
  unit?: string;
}

/* ══════════════════════════════════════════════════════════════
   RECRUITER ATHLETE PROFILE — Full detailed view
══════════════════════════════════════════════════════════════ */

export interface AthleteTraitRatings {
  // Capacités athlétiques
  speed: number;
  power: number;
  endurance: number;
  agility: number;
  // Intelligence sportive
  gameVision: number;
  tactics: number;
  // Caractère
  leadership: number;
  discipline: number;
  coachability: number;
  gameIQ: number;
  competitiveness: number;
  teamwork: number;
  resilience: number;
  attitude: number;
}

export interface AthleteProfileRecruiterView {
  // Identity (filtered — no email, phone, parent)
  id: string;
  firstName: string;
  lastName: string;
  age: number;
  gender: "M" | "F" | "Autre";
  photoUrl?: string;
  schoolName: string;
  city: string;
  region: string;
  graduationYear: number;
  dateOfBirth: string;

  // Sport
  primarySport: string;
  primaryPosition: string;
  jerseyNumber: string;
  secondarySport?: string;
  secondaryPosition?: string;
  teamName?: string;
  leagueName?: string;
  teamLevel?: string;

  // Physical
  heightFeet: number;
  heightInches: number;
  heightDisplay: string;
  weightLbs: number;
  weightDisplay: string;
  wingspan?: string;
  handSize?: string;
  dominantHand?: "Droite" | "Gauche" | "Ambidextre";
  dominantFoot?: "Droit" | "Gauche" | "Les deux";

  // Athletic tests
  fortyYard?: string;
  verticalJump?: string;
  broadJump?: string;
  benchPress?: string;
  shuttleAgility?: string;
  sprint100m?: string;

  // Academic
  gpa?: number;
  program?: string;
  strongSubjects: string[];
  academicHonors: string[];
  targetCegepProgram: string[];
  openToRelocate: boolean;
  openToPrivate: boolean;
  openToAnglophone: boolean;
  wantsDEC: boolean;
  preferredRegions: string[];

  // Coach evaluation
  coachName: string;
  coachSchool: string;
  coachReport?: string;
  traitRatings?: AthleteTraitRatings;
  overallRating: number;
  distinctions: { badgeId: string; label: string; icon: string; char?: string; detail?: string }[];

  // Media
  highlightVideoUrl?: string;
  hudlUrl?: string;
  youtubeUrl?: string;
  instagramUrl?: string;
  fullGameUrl?: string;
  practiceVideoUrl?: string;

  // Meta
  isVerified: boolean;
  profileCompleteness: number;
  favoriteCount: number;
  viewsThisMonth: number;
  isOpenToOffers: boolean;
  commitmentStatus?: string;

  // Coach reputation (if public)
  coachReputation?: {
    overallScore: number;
    badge: "none" | "evaluated" | "recommended" | "elite";
    totalReviews: number;
    totalPlacements: number;
    avgResponseTimeHours: number;
  };
}

/* ══════════════════════════════════════════════════════════════
   SORT HELPERS
══════════════════════════════════════════════════════════════ */

export type AthleteSortKey = "name" | "sport" | "position" | "school" | "gradYear" | "completion" | "views" | "status";

/* ══════════════════════════════════════════════════════════════
   RECRUITER SETTINGS
══════════════════════════════════════════════════════════════ */

export interface RecruiterNotificationPrefs {
  newAthleteInSport: { inApp: boolean; email: boolean };
  favoriteUpdated: { inApp: boolean; email: boolean };
  coachResponse: { inApp: boolean; email: boolean };
  scoutingReport: { inApp: boolean; email: boolean };
  letterOfIntentSigned: { inApp: boolean; email: boolean };
  profileVerified: { inApp: boolean; email: boolean };
  weeklyDigest: boolean;
  emailFrequency: "realtime" | "daily" | "weekly" | "disabled";
}

export interface RecruiterVisibility {
  profileVisible: boolean;
  showConsultationHistory: boolean;
  showFullName: boolean;
}

export interface RecruiterSettings {
  accountId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  avatarUrl?: string;
  locale: "fr";
  cegepId: string;
  campusId?: string;
  roleTitle: string;
  sportIds: string[];
  divisions: ("D1" | "D2" | "D3")[];
  programIds: string[];
  targetRegions: string[];
  targetGradYears: number[];
  targetPositions: string[];
  minMoyenne?: number;
  minCoteGlobale?: number;
  alertNewProfiles: boolean;
  notifications: RecruiterNotificationPrefs;
  visibility: RecruiterVisibility;
  accountStatus: "active" | "deactivated";
}

/* ══════════════════════════════════════════════════════════════
   COACH DEACTIVATION — soft delete + reassignment flow
══════════════════════════════════════════════════════════════ */

export interface CoachDeactivationEvent {
  id: string;
  coachId: string;
  coachName: string;
  directorId: string;
  directorName: string;
  coachType: "COACH_HS" | "RECRUTEUR_CEGEP";
  orphanedAthletes: { id: string; name: string; sport: string }[];
  frozenPipelines: { id: string; athleteName: string; status: string }[];
  frozenConversations: string[];
  reassignmentStatus: "PENDING" | "PARTIAL" | "COMPLETE";
  reason: string | null;
  timestamp: string;
  establishmentName: string;
}

export type AuditLogAction =
  | "COACH_DEACTIVATED"
  | "COACH_REACTIVATED"
  | "ATHLETE_REASSIGNED"
  | "PIPELINE_TRANSFERRED";

export interface AuditLogEntry {
  id: string;
  action: AuditLogAction;
  performedBy: string;
  performedByName: string;
  targetId: string;
  targetName: string;
  details: Record<string, string | number | boolean>;
  timestamp: string;
}
