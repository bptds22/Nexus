/**
 * NEXUS MOCK DATA — central re-export
 * Import all mock data from this file.
 * Types come from @/lib/types/models.
 */

export { MOCK_ATHLETES } from "./athletes-mock-data";
export {
  mockRecruiterSettings,
  CEGEP_LIST,
  RSEQ_SPORTS,
  QC_REGIONS,
  CEGEP_PROGRAMS,
} from "./recruiterSettings";
export type { CegepEntry } from "./recruiterSettings";
export type {
  Athlete,
  AthleteVideo,
  AthleteTimelineEntry,
  RecruiterActivityEntry,
  CoachContact,
  RecruiterSettings,
  RecruiterNotificationPrefs,
  RecruiterVisibility,
} from "@/lib/types/models";

/* ── Director portals ─────────────────────────────────────── */
export {
  mockDirectorHS,
  mockDirectorCegep,
  mockHSDashboardStats,
  mockCegepDashboardStats,
  mockCoachOverviews,
  mockTrainerOverviews,
  mockPlacementsHS,
  mockRecruitsCegep,
  mockRecruitmentStatsBySport,
  mockInvitations,
  mockDirectorActivitiesHS,
  mockDirectorActivitiesCegep,
  mockViewsBySport,
  mockViewsTrend,
  mockFunnelData,
  mockCegepPipelineBySport,
  mockCegepRegions,
  mockInterestedCegeps,
  mockCohortData,
  mockTopAthletes,
  mockRecruitmentFunnel,
  mockRecruiterPerformance,
  mockCegepRosterNeeds,
  mockCegepCohortData,
  mockCegepTopTargets,
  mockCegepSeasonComparison,
  mockDeactivationEvents,
} from "./director";
export type {
  DirectorProfile,
  DirectorDashboardStats,
  CoachOverview,
  TrainerOverview,
  Placement,
  RecruitmentStatsBySport,
  Invitation,
  DirectorActivity,
  DirectorNotificationPrefs,
  DirectorSettings,
  CegepRecruitmentFunnel,
  RecruiterPerformance,
  CegepRosterNeed,
  CegepCohortData,
  CegepTopTarget,
  CegepSeasonComparison,
  CoachDeactivationEvent,
  CoachAccountStatus,
  AuditLogEntry,
  AuditLogAction,
} from "@/lib/types/models";

/* ── Coach Reputation ───────────────────────────────────────── */
export { mockCoachReputation, mockCoachReviews } from "./coachReputation";
export type { CoachReputation, CoachReview } from "@/lib/types/models";

/* ── Review Widget ────────────────────────────────────────── */
export {
  mockReviewWidgetReady,
  mockReviewWidgetSubmitted,
  mockReviewWidgetHidden,
  mockSubmittedReview,
  REVIEW_WIDGET_STATES,
  SUBMITTED_REVIEWS,
} from "./reviewWidget";
export type { ReviewWidgetState } from "@/lib/types/models";

/* ── Recruiter Athlete Profile ─────────────────────────────── */
export {
  mockAthleteProfileFull,
  mockAthleteProfilePartial,
  ALL_RECRUITER_PROFILES,
} from "./athleteProfileRecruiter";
export type { AthleteProfileRecruiterView, AthleteTraitRatings } from "@/lib/types/models";
