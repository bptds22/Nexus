export type ActivityEventType =
  | "coach_replied"
  | "recruiter_sent_message"
  | "competitor_favorited"
  | "recruiter_favorited"
  | "favorites_spike"
  | "video_added"
  | "profile_verified"
  | "badge_added"
  | "scouting_report_updated"
  | "physical_updated"
  | "academic_updated"
  | "photo_added"
  | "profile_updated_bulk"
  | "status_visite"
  | "status_engage"
  | "status_lettre_signee"
  | "status_retire"
  | "new_athlete"
  | "new_athletes_weekly";

export type EventPriority = 1 | 2 | 3;
export type EventDirection = "inbound" | "outbound";

export interface ActivityEvent {
  id: string;
  type: ActivityEventType;
  priority: EventPriority;
  direction: EventDirection;
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
  message: string;
  icon: string;
  iconColor: string;
  actionLabel?: string;
  actionUrl?: string;
  timestamp: string;
  relativeTime: string;
  timeGroup: "Aujourd'hui" | "Hier" | "Cette semaine" | "Semaine dernière";
  metadata?: {
    badgeName?: string;
    badgeIcon?: string;
    favCount?: number;
    favGain?: number;
    visitDate?: string;
    retireReason?: string;
    bulkFields?: string[];
    newAthleteCount?: number;
    threadId?: string;
  };
}
