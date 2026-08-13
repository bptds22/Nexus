/* ─────────────────────────────────────────────────────────────────
   Mock Dashboard Data — Recruiter Tableau de Bord
───────────────────────────────────────────────────────────────── */

/* ── Action Bar ──────────────────────────────────────────────── */
export interface RecruiterActionBarData {
  coachReplies: number;
  newAthletesThisWeek: number;
}

export const ACTION_BAR: RecruiterActionBarData = {
  coachReplies: 2,
  newAthletesThisWeek: 5,
};

/* ── KPI Cards ───────────────────────────────────────────────── */
export interface RecruiterKpiData {
  totalFavoris: number;
  messagesSent: number;
  responsesReceived: number;
  responseRate: number;
  upcomingVisits: number;
}

export const KPI: RecruiterKpiData = {
  totalFavoris: 12,
  messagesSent: 8,
  responsesReceived: 5,
  responseRate: 63,
  upcomingVisits: 2,
};

/* ── Pipeline Summary ────────────────────────────────────────── */
export const PIPELINE_SUMMARY = {
  identifie: 2,
  contacte: 2,
  en_discussion: 3,
  visite: 2,
  engage: 2,
};

/* ── Trending Athletes ───────────────────────────────────────── */
export interface TrendingAthlete {
  id: string;
  rank: number;
  name: string;
  position: string;
  school: string;
  stars: number;
  viewsThisWeek: number;
  favoritedBy: number;
  // Iter 6.2-fix — exposés par useTrendingAthletes pour rendering mobile premium
  // (carrousel Dashboard avec AthletePhotoFill). Optionnels pour ne pas casser
  // le seed mock qui n'a pas ces champs.
  photoUrl?: string | null;
  firstName?: string;
  lastName?: string;
  /**
   * Projection serveur : false = identité masquée (Loi 25 ou tier FREE).
   * Quand false, `name` porte déjà « Identité réservée » et il faut le
   * passer aux AthletePhoto* pour qu'ils n'en dérivent pas d'initiales.
   * Optionnel : le seed mock ci-dessous ne le porte pas.
   */
  identityVisible?: boolean;
}

export const TRENDING_ATHLETES: TrendingAthlete[] = [
  { id: "r-001", rank: 1, name: "Marc-Antoine Tremblay", position: "QB", school: "É.S. Saint-Jean-Eudes", stars: 5, viewsThisWeek: 34, favoritedBy: 8 },
  { id: "p-002", rank: 2, name: "Olivier Nadeau", position: "QB", school: "É.S. De Mortagne", stars: 4, viewsThisWeek: 30, favoritedBy: 7 },
  { id: "p-005", rank: 3, name: "Jérémy Lavoie", position: "WR", school: "É.S. Saint-Jean-Eudes", stars: 4, viewsThisWeek: 28, favoritedBy: 6 },
  { id: "p-003", rank: 4, name: "Xavier Lapointe", position: "RB", school: "É.S. De Mortagne", stars: 3, viewsThisWeek: 25, favoritedBy: 5 },
  { id: "p-006", rank: 5, name: "Félix Gagnon-Roy", position: "LB", school: "É.S. Saint-Jean-Eudes", stars: 4, viewsThisWeek: 22, favoritedBy: 4 },
];

/* ── Activity Feed ───────────────────────────────────────────── */
export type RecruiterActivityType =
  | "reply"
  | "view"
  | "new_athlete"
  | "favorite"
  | "message"
  | "visit"
  | "badge"
  | "verified"
  | "video"
  | "report"
  | "signed";

export interface RecruiterActivityEvent {
  id: string;
  type: RecruiterActivityType;
  /** Plain text before the highlighted name */
  textBefore: string;
  /** Bold highlighted name */
  highlightName: string;
  /** Plain text after the highlighted name */
  textAfter: string;
  /** CTA link label */
  linkLabel: string;
  /** CTA link href */
  linkHref: string;
  /** ISO timestamp */
  timestamp: string;
}

export const ACTIVITY_FEED: RecruiterActivityEvent[] = [
  {
    id: "rev-1",
    type: "reply",
    textBefore: "Coach Bergeron a répondu à ton message concernant",
    highlightName: "Marc-Antoine Tremblay",
    textAfter: ".",
    linkLabel: "Voir la conversation",
    linkHref: "/recruteur/messages",
    timestamp: "2026-03-10T09:15:00",
  },
  {
    id: "rev-2",
    type: "favorite",
    textBefore: "",
    highlightName: "Jérémy Lavoie",
    textAfter: " a été ajouté aux favoris par 5 recruteurs cette semaine.",
    linkLabel: "Voir le profil",
    linkHref: "/recruteur/athletes/p-005",
    timestamp: "2026-03-10T08:30:00",
  },
  {
    id: "rev-3",
    type: "video",
    textBefore: "",
    highlightName: "Félix Gagnon-Roy",
    textAfter: " a ajouté une nouvelle vidéo highlights.",
    linkLabel: "Regarder la vidéo",
    linkHref: "/recruteur/athletes/p-006",
    timestamp: "2026-03-10T07:45:00",
  },
  {
    id: "rev-4",
    type: "badge",
    textBefore: "",
    highlightName: "Félix Gagnon-Roy",
    textAfter: " a reçu le badge Capitaine.",
    linkLabel: "Voir le profil",
    linkHref: "/recruteur/athletes/p-006",
    timestamp: "2026-03-09T16:00:00",
  },
  {
    id: "rev-5",
    type: "verified",
    textBefore: "",
    highlightName: "William Pelletier",
    textAfter: " est maintenant un profil vérifié.",
    linkLabel: "Voir le profil",
    linkHref: "/recruteur/athletes/p-007",
    timestamp: "2026-03-09T14:30:00",
  },
  {
    id: "rev-6",
    type: "report",
    textBefore: "Le rapport de dépistage de",
    highlightName: "Marc-Antoine Tremblay",
    textAfter: " a été mis à jour.",
    linkLabel: "Lire le rapport",
    linkHref: "/recruteur/athletes/r-001",
    timestamp: "2026-03-09T11:00:00",
  },
  {
    id: "rev-7",
    type: "new_athlete",
    textBefore: "",
    highlightName: "Gabriel Morin (LB)",
    textAfter: " a été ajouté à la plateforme.",
    linkLabel: "Voir le profil",
    linkHref: "/recruteur/athletes/p-008",
    timestamp: "2026-03-09T09:00:00",
  },
  {
    id: "rev-8",
    type: "signed",
    textBefore: "",
    highlightName: "Thomas Carrier-Brault",
    textAfter: " a signé sa lettre d'intention!",
    linkLabel: "Voir le profil",
    linkHref: "/recruteur/athletes/p-009",
    timestamp: "2026-03-07T15:00:00",
  },
  {
    id: "rev-9",
    type: "visit",
    textBefore: "Visite confirmée:",
    highlightName: "Xavier Lapointe",
    textAfter: ", 22 mars.",
    linkLabel: "Voir le profil",
    linkHref: "/recruteur/athletes/p-003",
    timestamp: "2026-03-06T14:00:00",
  },
  {
    id: "rev-10",
    type: "message",
    textBefore: "Message envoyé à Coach Tremblay à propos d'",
    highlightName: "Olivier Nadeau",
    textAfter: ".",
    linkLabel: "Voir la conversation",
    linkHref: "/recruteur/messages",
    timestamp: "2026-03-05T16:00:00",
  },
];
