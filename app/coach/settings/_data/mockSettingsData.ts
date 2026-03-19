/* ─────────────────────────────────────────────────────────────────
   Mock Settings Data — Coach Bergeron profile
───────────────────────────────────────────────────────────────── */

export interface CoachProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: string;
  sport: string;
  avatarInitials: string;
}

export interface SchoolInfo {
  name: string;
  city: string;
  region: string;
  division: string;
  ageGroup: string;
  conference: string;
  teamName: string;
  website: string;
}

export interface NotificationPreferences {
  newContactRequest: { email: boolean; push: boolean; sms: boolean };
  requestAccepted: { email: boolean; push: boolean; sms: boolean };
  newMessage: { email: boolean; push: boolean; sms: boolean };
  profileApproved: { email: boolean; push: boolean; sms: boolean };
  profileRejected: { email: boolean; push: boolean; sms: boolean };
  weeklyDigest: { email: boolean; push: boolean; sms: boolean };
}

export interface AccountInfo {
  email: string;
  createdAt: string;
  lastLogin: string;
  twoFactorEnabled: boolean;
}

export const MOCK_COACH_PROFILE: CoachProfile = {
  firstName: "Michel",
  lastName: "Bergeron",
  email: "m.bergeron@sje.qc.ca",
  phone: "(418) 555-0147",
  role: "Coach principal",
  sport: "Football",
  avatarInitials: "MB",
};

export const MOCK_SCHOOL_INFO: SchoolInfo = {
  name: "É.S. Saint-Jean-Eudes",
  city: "Québec",
  region: "Capitale-Nationale",
  division: "Division 1",
  ageGroup: "Juvénile",
  conference: "RSEQ — Région de Québec",
  teamName: "Condors",
  website: "https://www.sje.qc.ca",
};

export const MOCK_NOTIFICATIONS: NotificationPreferences = {
  newContactRequest: { email: true, push: true, sms: false },
  requestAccepted: { email: true, push: true, sms: false },
  newMessage: { email: true, push: true, sms: true },
  profileApproved: { email: true, push: false, sms: false },
  profileRejected: { email: true, push: false, sms: false },
  weeklyDigest: { email: true, push: false, sms: false },
};

export const MOCK_ACCOUNT: AccountInfo = {
  email: "m.bergeron@sje.qc.ca",
  createdAt: "2025-09-15",
  lastLogin: "2026-03-10T08:45:00",
  twoFactorEnabled: false,
};

export const NOTIFICATION_LABELS: Record<keyof NotificationPreferences, string> = {
  newContactRequest: "Nouvelle demande de contact",
  requestAccepted: "Demande acceptée par un recruteur",
  newMessage: "Nouveau message reçu",
  profileApproved: "Profil athlète approuvé",
  profileRejected: "Profil athlète refusé",
  weeklyDigest: "Résumé hebdomadaire",
};
