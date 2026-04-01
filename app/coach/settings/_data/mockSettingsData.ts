/* ─────────────────────────────────────────────────────────────────
   Settings Data Types & Labels — Coach Settings
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

export const NOTIFICATION_LABELS: Record<keyof NotificationPreferences, string> = {
  newContactRequest: "Nouvelle demande de contact",
  requestAccepted: "Demande acceptée par un recruteur",
  newMessage: "Nouveau message reçu",
  profileApproved: "Profil athlète approuvé",
  profileRejected: "Profil athlète refusé",
  weeklyDigest: "Résumé hebdomadaire",
};
