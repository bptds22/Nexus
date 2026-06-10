/* ─────────────────────────────────────────────────────────────────
   Mock data for the Coach Tableau de Bord
   All data is hardcoded — no API calls.
───────────────────────────────────────────────────────────────── */

import type { ActivityEvent } from "@/lib/types/activityEvents";

/* ── Action Bar ─────────────────────────────────────────────────── */

export interface ActionBarData {
  unreadMessages: number;
  incompleteProfiles: number;
  newAthletes: number;
  pendingSuggestions: number;
  /** Évaluations manquantes — coach n'a pas (encore) saisi une cote OU un
   *  rapport pour cet athlète. Compté par lib/coach/tasks.loadCoachTaskCounts.
   *  Ajouté lors du Step 3c (convergence "à traiter") — le tab badge, le
   *  dashboard et la page /coach/a-traiter consomment tous le même helper. */
  missingEvals: number;
}

export const ACTION_BAR: ActionBarData = {
  unreadMessages: 3,
  incompleteProfiles: 5,
  newAthletes: 0,
  pendingSuggestions: 0,
  missingEvals: 0,
};

/* ── KPI Cards ──────────────────────────────────────────────────── */

export interface KpiData {
  totalAthletes: number;
  completeProfiles: number;
  totalProfiles: number;
  completePct: number;
  recruiterViews: number;
  viewsTrend: number; // percent change vs last month
  viewsTrendLabel?: string; // e.g. "Nouveau" when last month was 0
  activeConversations: number;
}

export const KPI: KpiData = {
  totalAthletes: 42,
  completeProfiles: 37,
  totalProfiles: 42,
  completePct: 87,
  recruiterViews: 156,
  viewsTrend: 23,
  activeConversations: 5,
};

/* ── Hot Athletes ───────────────────────────────────────────────── */

export interface HotAthlete {
  id: string;
  rank: number;
  name: string;
  position: string;
  stars: number; // 1–5 rating
  viewsThisWeek: number;
  uniqueRecruiters: number;
}

export const HOT_ATHLETES: HotAthlete[] = [
  { id: "ath-101", rank: 1, name: "Marc-Antoine Tremblay", position: "QB", stars: 5, viewsThisWeek: 34, uniqueRecruiters: 8 },
  { id: "ath-102", rank: 2, name: "Jérémy Lavoie", position: "WR", stars: 4, viewsThisWeek: 28, uniqueRecruiters: 6 },
  { id: "ath-103", rank: 3, name: "Félix Gagnon-Roy", position: "LB", stars: 4, viewsThisWeek: 22, uniqueRecruiters: 5 },
  { id: "ath-104", rank: 4, name: "Alexis Bouchard", position: "RB", stars: 3, viewsThisWeek: 18, uniqueRecruiters: 4 },
  { id: "ath-105", rank: 5, name: "Samuel Côté", position: "OL", stars: 3, viewsThisWeek: 12, uniqueRecruiters: 3 },
];

/* ── Activity Feed ──────────────────────────────────────────────── */

export const ACTIVITY_FEED: ActivityEvent[] = [
  /* ── Aujourd'hui ─────────────────────────────────────── */
  {
    id: "cev-001",
    type: "coach_replied",
    priority: 1,
    direction: "inbound",
    athleteId: "ath-101",
    athleteName: "Marc-Antoine Tremblay",
    athletePosition: "QB",
    recruiterId: "rec-001",
    recruiterName: "Pierre Dufour",
    cegepId: "ceg-001",
    cegepName: "CÉGEP Garneau",
    message: "Nouveau message de {recruiter}, {cegep}, concernant {athlete}.",
    icon: "message-circle",
    iconColor: "#22C55E",
    actionLabel: "Voir la conversation",
    actionUrl: "/coach/demandes",
    timestamp: "2026-03-11T09:15:00",
    relativeTime: "Il y a 45 min",
    timeGroup: "Aujourd'hui",
    metadata: { threadId: "thread-001" },
  },
  {
    id: "cev-002",
    type: "competitor_favorited",
    priority: 1,
    direction: "inbound",
    athleteId: "ath-102",
    athleteName: "Jérémy Lavoie",
    athletePosition: "WR",
    message: "{athlete} a été ajouté aux favoris par 5 recruteurs cette semaine.",
    icon: "heart",
    iconColor: "#E63946",
    actionLabel: "Voir le profil",
    actionUrl: "/coach/athletes/ath-102",
    timestamp: "2026-03-11T08:30:00",
    relativeTime: "Il y a 1h30",
    timeGroup: "Aujourd'hui",
    metadata: { favCount: 5 },
  },
  {
    id: "cev-003",
    type: "video_added",
    priority: 1,
    direction: "inbound",
    athleteId: "ath-103",
    athleteName: "Félix Gagnon-Roy",
    athletePosition: "LB",
    message: "{athlete} a ajouté une nouvelle vidéo highlights.",
    icon: "film",
    iconColor: "#22C55E",
    actionLabel: "Regarder la vidéo",
    actionUrl: "/coach/athletes/ath-103",
    timestamp: "2026-03-11T07:45:00",
    relativeTime: "Il y a 2h",
    timeGroup: "Aujourd'hui",
  },

  /* ── Hier ─────────────────────────────────────────────── */
  {
    id: "cev-004",
    type: "badge_added",
    priority: 2,
    direction: "inbound",
    athleteId: "ath-103",
    athleteName: "Félix Gagnon-Roy",
    athletePosition: "LB",
    message: "{athlete} a reçu le badge Capitaine.",
    icon: "award",
    iconColor: "#F59E0B",
    actionLabel: "Voir le profil",
    actionUrl: "/coach/athletes/ath-103",
    timestamp: "2026-03-10T16:00:00",
    relativeTime: "Hier, 16h",
    timeGroup: "Hier",
    metadata: { badgeName: "Capitaine", badgeIcon: "award" },
  },
  {
    id: "cev-005",
    type: "profile_verified",
    priority: 2,
    direction: "inbound",
    athleteId: "ath-106",
    athleteName: "William Pelletier",
    athletePosition: "OL",
    message: "{athlete} est maintenant un profil vérifié.",
    icon: "check-circle",
    iconColor: "#22C55E",
    actionLabel: "Voir le profil",
    actionUrl: "/coach/athletes/ath-106",
    timestamp: "2026-03-10T14:30:00",
    relativeTime: "Hier, 14h30",
    timeGroup: "Hier",
  },
  {
    id: "cev-006",
    type: "scouting_report_updated",
    priority: 2,
    direction: "inbound",
    athleteId: "ath-101",
    athleteName: "Marc-Antoine Tremblay",
    athletePosition: "QB",
    message: "Le rapport de dépistage de {athlete} a été mis à jour.",
    icon: "file-text",
    iconColor: "#F59E0B",
    actionLabel: "Lire le rapport",
    actionUrl: "/coach/athletes/ath-101",
    timestamp: "2026-03-10T11:00:00",
    relativeTime: "Hier, 11h",
    timeGroup: "Hier",
  },
  {
    id: "cev-007",
    type: "new_athlete",
    priority: 2,
    direction: "inbound",
    athleteId: "ath-107",
    athleteName: "Gabriel Morin",
    athletePosition: "LB",
    message: "{athlete} (LB) a été ajouté à la plateforme.",
    icon: "user-plus",
    iconColor: "#22C55E",
    actionLabel: "Voir le profil",
    actionUrl: "/coach/athletes/ath-107",
    timestamp: "2026-03-10T09:00:00",
    relativeTime: "Hier, 9h",
    timeGroup: "Hier",
  },

  /* ── Cette semaine ────────────────────────────────────── */
  {
    id: "cev-008",
    type: "status_lettre_signee",
    priority: 1,
    direction: "outbound",
    athleteId: "ath-108",
    athleteName: "Thomas Carrier-Brault",
    athletePosition: "DL",
    message: "{athlete} a signé sa lettre d'intention!",
    icon: "pen-tool",
    iconColor: "#E63946",
    actionLabel: "Voir le profil",
    actionUrl: "/coach/athletes/ath-108",
    timestamp: "2026-03-07T15:00:00",
    relativeTime: "Vendredi",
    timeGroup: "Cette semaine",
  },
  {
    id: "cev-009",
    type: "competitor_favorited",
    priority: 2,
    direction: "inbound",
    athleteId: "ath-104",
    athleteName: "Alexis Bouchard",
    athletePosition: "RB",
    cegepId: "ceg-003",
    cegepName: "CÉGEP Saint-Laurent",
    message: "Le profil d'{athlete} a été consulté par un recruteur du {cegep}.",
    icon: "heart",
    iconColor: "#F59E0B",
    actionLabel: "Voir le profil",
    actionUrl: "/coach/athletes/ath-104",
    timestamp: "2026-03-06T14:00:00",
    relativeTime: "Jeudi",
    timeGroup: "Cette semaine",
  },
  {
    id: "cev-010",
    type: "coach_replied",
    priority: 2,
    direction: "inbound",
    athleteId: "ath-105",
    athleteName: "Samuel Côté",
    athletePosition: "OL",
    recruiterId: "rec-003",
    recruiterName: "Martin Lapointe",
    cegepId: "ceg-005",
    cegepName: "CÉGEP de Jonquière",
    message: "Nouveau message de {recruiter}, {cegep}, à propos de {athlete}.",
    icon: "message-circle",
    iconColor: "#22C55E",
    actionLabel: "Voir la conversation",
    actionUrl: "/coach/demandes",
    timestamp: "2026-03-05T17:20:00",
    relativeTime: "Mercredi",
    timeGroup: "Cette semaine",
    metadata: { threadId: "thread-002" },
  },
];
