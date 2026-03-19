/* ═══════════════════════════════════════════════════════════════
   ACTIVITY TYPES — Shared between Coach & Recruiter portals
   Single source of truth for the full-page activity feed.
═══════════════════════════════════════════════════════════════ */

export type ActivityType =
  | "message_received"
  | "athlete_favorited"
  | "video_added"
  | "badge_earned"
  | "profile_verified"
  | "scouting_report"
  | "athlete_added"
  | "letter_of_intent"
  | "profile_viewed"
  | "profile_incomplete"
  | "new_athlete_in_sport"
  | "favorite_profile_updated"
  | "favorite_stats_updated"
  | "coach_response";

export type ActivityPortal = "coach" | "recruiter";

export type TimeGroup =
  | "Aujourd'hui"
  | "Hier"
  | "Cette semaine"
  | "La semaine dernière"
  | "Ce mois-ci"
  | "Plus ancien";

export interface Activity {
  id: string;
  type: ActivityType;
  portal: ActivityPortal;
  timestamp: string; // ISO 8601
  isRead: boolean;
  athleteId?: string;
  athleteName?: string;
  athletePosition?: string;
  coachId?: string;
  coachName?: string;
  recruiterId?: string;
  recruiterName?: string;
  schoolId?: string;
  schoolName?: string;
  cegepId?: string;
  cegepName?: string;
  sportName?: string;
  badgeName?: string;
  profileCompleteness?: number;
  messagePreview?: string;
  ctaLabel: string;
  ctaRoute: string;
  isHighlighted?: boolean; // true for lettre d'intention
}

/* ── Icon + color config per type ──────────────────────────── */

export interface ActivityTypeConfig {
  icon: string;
  borderColor: string;
  label: string;
}

export const ACTIVITY_TYPE_CONFIG: Record<ActivityType, ActivityTypeConfig> = {
  message_received:        { icon: "message-circle", borderColor: "#22C55E", label: "Messages" },
  athlete_favorited:       { icon: "heart",          borderColor: "#E63329", label: "Favoris" },
  video_added:             { icon: "film",           borderColor: "#22C55E", label: "Vidéos" },
  badge_earned:            { icon: "award",          borderColor: "#F59E0B", label: "Badges" },
  profile_verified:        { icon: "check-circle",   borderColor: "#22C55E", label: "Vérifications" },
  scouting_report:         { icon: "file-text",      borderColor: "#E63329", label: "Rapports" },
  athlete_added:           { icon: "user-plus",      borderColor: "#6B7280", label: "Nouveaux athlètes" },
  letter_of_intent:        { icon: "pen-tool",       borderColor: "#E63329", label: "Lettres d'intention" },
  profile_viewed:          { icon: "eye",            borderColor: "#F59E0B", label: "Consultations" },
  profile_incomplete:      { icon: "alert-triangle", borderColor: "#F59E0B", label: "Profils incomplets" },
  new_athlete_in_sport:    { icon: "user-plus",      borderColor: "#E63329", label: "Nouveaux athlètes" },
  favorite_profile_updated:{ icon: "refresh-cw",     borderColor: "#E63329", label: "Mises à jour" },
  favorite_stats_updated:  { icon: "bar-chart-3",    borderColor: "#22C55E", label: "Statistiques" },
  coach_response:          { icon: "reply",          borderColor: "#6B7280", label: "Réponses" },
};

/* ── Time grouping helper ──────────────────────────────────── */

export const TIME_GROUP_ORDER: TimeGroup[] = [
  "Aujourd'hui",
  "Hier",
  "Cette semaine",
  "La semaine dernière",
  "Ce mois-ci",
  "Plus ancien",
];

export function getTimeGroup(timestamp: string, now: Date): TimeGroup {
  const d = new Date(timestamp);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const eventDay = new Date(d);
  eventDay.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((today.getTime() - eventDay.getTime()) / 86400000);

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) return "Cette semaine";
  if (diffDays < 14) return "La semaine dernière";
  if (diffDays < 30) return "Ce mois-ci";
  return "Plus ancien";
}
