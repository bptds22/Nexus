import type { ReviewWidgetState, CoachReview } from "@/lib/types/models";

/* ─────────────────────────────────────────────────────────────────
   Mock data — 3 review widget scenarios
───────────────────────────────────────────────────────────────── */

/** Widget visible, not yet submitted — Coach Bergeron, Marc-Antoine Tremblay (QB) */
export const mockReviewWidgetReady: ReviewWidgetState = {
  conversationId: "rth-001",
  recruiterId: "recruiter-current",
  coachId: "coach-001",
  canReview: true,
  showWidget: true,
  dismissCount: 0,
  reviewSubmitted: false,
};

/** Widget in confirmation state — already submitted */
export const mockReviewWidgetSubmitted: ReviewWidgetState = {
  conversationId: "rth-005",
  recruiterId: "recruiter-current",
  coachId: "coach-004",
  canReview: true,
  showWidget: true,
  dismissCount: 0,
  reviewSubmitted: true,
};

/** Widget hidden — conditions not met (too early / not enough messages) */
export const mockReviewWidgetHidden: ReviewWidgetState = {
  conversationId: "rth-004",
  recruiterId: "recruiter-current",
  coachId: "coach-003",
  canReview: false,
  showWidget: false,
  dismissCount: 0,
  reviewSubmitted: false,
};

/** Submitted review for the confirmation display */
export const mockSubmittedReview: CoachReview = {
  id: "review-submitted-001",
  coachId: "coach-004",
  recruiterId: "recruiter-current",
  conversationId: "rth-005",
  athleteId: "r-006",
  athleteName: "Samuel Côté",
  athletePosition: "OL",
  profileQuality: 4,
  responsiveness: 5,
  evaluationHonesty: 4,
  professionalism: 5,
  overallScore: 4.5,
  wouldRecommend: true,
  comment: "Très bon coach, réactif et professionnel.",
  createdAt: "2026-03-03T14:00:00Z",
  status: "active",
};

/** Map thread id → review widget state for easy lookup */
export const REVIEW_WIDGET_STATES: Record<string, ReviewWidgetState> = {
  "rth-001": mockReviewWidgetReady,
  "rth-005": mockReviewWidgetSubmitted,
  "rth-004": mockReviewWidgetHidden,
};

/** Map thread id → submitted review (if any) */
export const SUBMITTED_REVIEWS: Record<string, CoachReview> = {
  "rth-005": mockSubmittedReview,
};
