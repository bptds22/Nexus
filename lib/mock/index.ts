/**
 * NEXUS MOCK DATA — central re-export
 * Import all mock data from this file.
 * Types come from @/lib/types/models.
 */

export { MOCK_ATHLETES } from "./athletes-mock-data";
export {
  mockRecruiterSettings,
  CEGEP_PROGRAMS,
} from "./recruiterSettings";
// CEGEP_LIST / CegepEntry removed (dead). RSEQ_SPORTS / QC_REGIONS
// moved to @/lib/config/recruiterReferenceData (static config, not mock).
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
