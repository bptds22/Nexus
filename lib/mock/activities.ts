import type { Activity } from "@/lib/types/activity";

/* ═══════════════════════════════════════════════════════════════
   MOCK ACTIVITIES — 25+ per portal, 7-day spread
   All timestamps relative to 2026-03-11T10:00:00

   Entity ID maps (consistent across all mock data):
   ── Coaches ──
   coach-001  Coach Bergeron      É.S. Saint-Jean-Eudes
   coach-002  Coach Tremblay      É.S. De Mortagne
   coach-003  Coach Lapointe      É.S. Roger-Comtois

   ── Recruiters ──
   rec-001    Pierre Dufour       CÉGEP Garneau
   rec-002    Sophie Bélanger     CÉGEP de Sherbrooke
   rec-003    Martin Lapointe     CÉGEP de Jonquière
   rec-004    Jean-François Morin CÉGEP de Trois-Rivières

   ── Schools ──
   sch-001    É.S. Saint-Jean-Eudes
   sch-002    É.S. De Mortagne
   sch-003    É.S. Roger-Comtois
   sch-004    É.S. de l'Odyssée
   sch-005    É.S. les Etchemins
   sch-006    É.S. de Rochebelle

   ── CÉGEPs ──
   ceg-001    CÉGEP Garneau
   ceg-002    CÉGEP de Sherbrooke
   ceg-003    CÉGEP du Vieux Montréal
   ceg-004    CÉGEP de Jonquière
   ceg-005    CÉGEP André-Laurendeau
   ceg-006    CÉGEP Limoilou
   ceg-007    CÉGEP de Sainte-Foy
   ceg-008    CÉGEP de Trois-Rivières
   ceg-009    CÉGEP Saint-Laurent
═══════════════════════════════════════════════════════════════ */

/* ── COACH ACTIVITIES (30) ────────────────────────────────── */

export const COACH_ACTIVITIES: Activity[] = [
  /* ── Aujourd'hui (11 mars) ─────────────────────────────── */
  {
    id: "ca-001", type: "message_received", portal: "coach",
    timestamp: "2026-03-11T09:15:00", isRead: false,
    athleteId: "ath-101", athleteName: "Marc-Antoine Tremblay", athletePosition: "QB",
    recruiterId: "rec-001", recruiterName: "Pierre Dufour",
    cegepId: "ceg-001", cegepName: "CÉGEP Garneau",
    ctaLabel: "Voir la conversation", ctaRoute: "/coach/demandes",
  },
  {
    id: "ca-002", type: "athlete_favorited", portal: "coach",
    timestamp: "2026-03-11T08:30:00", isRead: false,
    athleteId: "ath-102", athleteName: "Jérémy Lavoie", athletePosition: "WR",
    ctaLabel: "Voir le profil", ctaRoute: "/coach/athletes/ath-102",
  },
  {
    id: "ca-003", type: "video_added", portal: "coach",
    timestamp: "2026-03-11T07:45:00", isRead: false,
    athleteId: "ath-103", athleteName: "Félix Gagnon-Roy", athletePosition: "LB",
    ctaLabel: "Regarder la vidéo", ctaRoute: "/coach/athletes/ath-103",
  },
  {
    id: "ca-004", type: "profile_viewed", portal: "coach",
    timestamp: "2026-03-11T06:20:00", isRead: true,
    athleteId: "ath-105", athleteName: "Samuel Côté", athletePosition: "OL",
    cegepId: "ceg-002", cegepName: "CÉGEP de Sherbrooke",
    ctaLabel: "Voir le profil", ctaRoute: "/coach/athletes/ath-105",
  },

  /* ── Hier (10 mars) ────────────────────────────────────── */
  {
    id: "ca-005", type: "badge_earned", portal: "coach",
    timestamp: "2026-03-10T16:00:00", isRead: false,
    athleteId: "ath-103", athleteName: "Félix Gagnon-Roy", athletePosition: "LB",
    badgeName: "Capitaine",
    ctaLabel: "Voir le profil", ctaRoute: "/coach/athletes/ath-103",
  },
  {
    id: "ca-006", type: "profile_verified", portal: "coach",
    timestamp: "2026-03-10T14:30:00", isRead: true,
    athleteId: "ath-106", athleteName: "William Pelletier", athletePosition: "OL",
    ctaLabel: "Voir le profil", ctaRoute: "/coach/athletes/ath-106",
  },
  {
    id: "ca-007", type: "scouting_report", portal: "coach",
    timestamp: "2026-03-10T11:00:00", isRead: true,
    athleteId: "ath-101", athleteName: "Marc-Antoine Tremblay", athletePosition: "QB",
    ctaLabel: "Lire le rapport", ctaRoute: "/coach/athletes/ath-101",
  },
  {
    id: "ca-008", type: "athlete_added", portal: "coach",
    timestamp: "2026-03-10T09:00:00", isRead: true,
    athleteId: "ath-107", athleteName: "Gabriel Morin", athletePosition: "LB",
    ctaLabel: "Voir le profil", ctaRoute: "/coach/athletes/ath-107",
  },
  {
    id: "ca-009", type: "message_received", portal: "coach",
    timestamp: "2026-03-10T08:15:00", isRead: true,
    athleteId: "ath-104", athleteName: "Alexis Bouchard", athletePosition: "RB",
    recruiterId: "rec-002", recruiterName: "Sophie Bélanger",
    cegepId: "ceg-002", cegepName: "CÉGEP de Sherbrooke",
    ctaLabel: "Voir la conversation", ctaRoute: "/coach/demandes",
  },
  {
    id: "ca-010", type: "profile_viewed", portal: "coach",
    timestamp: "2026-03-10T07:30:00", isRead: true,
    athleteId: "ath-102", athleteName: "Jérémy Lavoie", athletePosition: "WR",
    cegepId: "ceg-003", cegepName: "CÉGEP du Vieux Montréal",
    ctaLabel: "Voir le profil", ctaRoute: "/coach/athletes/ath-102",
  },

  /* ── Cette semaine (9 mars — lundi) ────────────────────── */
  {
    id: "ca-011", type: "letter_of_intent", portal: "coach",
    timestamp: "2026-03-09T15:00:00", isRead: true,
    athleteId: "ath-108", athleteName: "Thomas Carrier-Brault", athletePosition: "DL",
    isHighlighted: true,
    ctaLabel: "Voir le profil", ctaRoute: "/coach/athletes/ath-108",
  },
  {
    id: "ca-012", type: "athlete_favorited", portal: "coach",
    timestamp: "2026-03-09T12:00:00", isRead: true,
    athleteId: "ath-101", athleteName: "Marc-Antoine Tremblay", athletePosition: "QB",
    ctaLabel: "Voir le profil", ctaRoute: "/coach/athletes/ath-101",
  },
  {
    id: "ca-013", type: "profile_incomplete", portal: "coach",
    timestamp: "2026-03-09T10:00:00", isRead: true,
    athleteId: "ath-110", athleteName: "Raphaël Bergeron", athletePosition: "DL",
    profileCompleteness: 45,
    ctaLabel: "Compléter le profil", ctaRoute: "/coach/athletes/ath-110/modifier",
  },
  {
    id: "ca-014", type: "message_received", portal: "coach",
    timestamp: "2026-03-09T08:30:00", isRead: true,
    athleteId: "ath-103", athleteName: "Félix Gagnon-Roy", athletePosition: "LB",
    recruiterId: "rec-003", recruiterName: "Martin Lapointe",
    cegepId: "ceg-004", cegepName: "CÉGEP de Jonquière",
    ctaLabel: "Voir la conversation", ctaRoute: "/coach/demandes",
  },
  {
    id: "ca-015", type: "profile_viewed", portal: "coach",
    timestamp: "2026-03-08T18:00:00", isRead: true,
    athleteId: "ath-104", athleteName: "Alexis Bouchard", athletePosition: "RB",
    cegepId: "ceg-005", cegepName: "CÉGEP André-Laurendeau",
    ctaLabel: "Voir le profil", ctaRoute: "/coach/athletes/ath-104",
  },
  {
    id: "ca-016", type: "video_added", portal: "coach",
    timestamp: "2026-03-08T14:00:00", isRead: true,
    athleteId: "ath-101", athleteName: "Marc-Antoine Tremblay", athletePosition: "QB",
    ctaLabel: "Regarder la vidéo", ctaRoute: "/coach/athletes/ath-101",
  },
  {
    id: "ca-017", type: "badge_earned", portal: "coach",
    timestamp: "2026-03-08T10:00:00", isRead: true,
    athleteId: "ath-102", athleteName: "Jérémy Lavoie", athletePosition: "WR",
    badgeName: "Étoile provinciale",
    ctaLabel: "Voir le profil", ctaRoute: "/coach/athletes/ath-102",
  },

  /* ── La semaine dernière (2–5 mars) ────────────────────── */
  {
    id: "ca-018", type: "profile_verified", portal: "coach",
    timestamp: "2026-03-05T16:00:00", isRead: true,
    athleteId: "ath-105", athleteName: "Samuel Côté", athletePosition: "OL",
    ctaLabel: "Voir le profil", ctaRoute: "/coach/athletes/ath-105",
  },
  {
    id: "ca-019", type: "message_received", portal: "coach",
    timestamp: "2026-03-05T11:00:00", isRead: true,
    athleteId: "ath-105", athleteName: "Samuel Côté", athletePosition: "OL",
    recruiterId: "rec-003", recruiterName: "Martin Lapointe",
    cegepId: "ceg-004", cegepName: "CÉGEP de Jonquière",
    ctaLabel: "Voir la conversation", ctaRoute: "/coach/demandes",
  },
  {
    id: "ca-020", type: "athlete_favorited", portal: "coach",
    timestamp: "2026-03-04T14:00:00", isRead: true,
    athleteId: "ath-104", athleteName: "Alexis Bouchard", athletePosition: "RB",
    ctaLabel: "Voir le profil", ctaRoute: "/coach/athletes/ath-104",
  },
  {
    id: "ca-021", type: "profile_viewed", portal: "coach",
    timestamp: "2026-03-04T09:30:00", isRead: true,
    athleteId: "ath-103", athleteName: "Félix Gagnon-Roy", athletePosition: "LB",
    cegepId: "ceg-006", cegepName: "CÉGEP Limoilou",
    ctaLabel: "Voir le profil", ctaRoute: "/coach/athletes/ath-103",
  },
  {
    id: "ca-022", type: "scouting_report", portal: "coach",
    timestamp: "2026-03-03T15:00:00", isRead: true,
    athleteId: "ath-102", athleteName: "Jérémy Lavoie", athletePosition: "WR",
    ctaLabel: "Lire le rapport", ctaRoute: "/coach/athletes/ath-102",
  },
  {
    id: "ca-023", type: "profile_incomplete", portal: "coach",
    timestamp: "2026-03-03T10:00:00", isRead: true,
    athleteId: "ath-112", athleteName: "Noah Simard", athletePosition: "S",
    profileCompleteness: 62,
    ctaLabel: "Compléter le profil", ctaRoute: "/coach/athletes/ath-112/modifier",
  },
  {
    id: "ca-024", type: "athlete_added", portal: "coach",
    timestamp: "2026-03-02T14:00:00", isRead: true,
    athleteId: "ath-114", athleteName: "Émile Tanguay", athletePosition: "CB",
    ctaLabel: "Voir le profil", ctaRoute: "/coach/athletes/ath-114",
  },
  {
    id: "ca-025", type: "message_received", portal: "coach",
    timestamp: "2026-03-02T09:00:00", isRead: true,
    athleteId: "ath-101", athleteName: "Marc-Antoine Tremblay", athletePosition: "QB",
    recruiterId: "rec-004", recruiterName: "Jean-François Morin",
    cegepId: "ceg-008", cegepName: "CÉGEP de Trois-Rivières",
    ctaLabel: "Voir la conversation", ctaRoute: "/coach/demandes",
  },

  /* ── Ce mois-ci (28 fév — 1 mars) ─────────────────────── */
  {
    id: "ca-026", type: "letter_of_intent", portal: "coach",
    timestamp: "2026-03-01T14:00:00", isRead: true,
    athleteId: "ath-109", athleteName: "Olivier Nadeau", athletePosition: "QB",
    isHighlighted: true,
    ctaLabel: "Voir le profil", ctaRoute: "/coach/athletes/ath-109",
  },
  {
    id: "ca-027", type: "profile_viewed", portal: "coach",
    timestamp: "2026-02-28T16:00:00", isRead: true,
    athleteId: "ath-105", athleteName: "Samuel Côté", athletePosition: "OL",
    cegepId: "ceg-007", cegepName: "CÉGEP de Sainte-Foy",
    ctaLabel: "Voir le profil", ctaRoute: "/coach/athletes/ath-105",
  },
  {
    id: "ca-028", type: "athlete_favorited", portal: "coach",
    timestamp: "2026-02-28T10:00:00", isRead: true,
    athleteId: "ath-102", athleteName: "Jérémy Lavoie", athletePosition: "WR",
    ctaLabel: "Voir le profil", ctaRoute: "/coach/athletes/ath-102",
  },
  {
    id: "ca-029", type: "video_added", portal: "coach",
    timestamp: "2026-02-27T14:00:00", isRead: true,
    athleteId: "ath-105", athleteName: "Samuel Côté", athletePosition: "OL",
    ctaLabel: "Regarder la vidéo", ctaRoute: "/coach/athletes/ath-105",
  },
  {
    id: "ca-030", type: "badge_earned", portal: "coach",
    timestamp: "2026-02-26T11:00:00", isRead: true,
    athleteId: "ath-101", athleteName: "Marc-Antoine Tremblay", athletePosition: "QB",
    badgeName: "Étoile provinciale",
    ctaLabel: "Voir le profil", ctaRoute: "/coach/athletes/ath-101",
  },
];

/* ── RECRUITER ACTIVITIES (30) ────────────────────────────── */

export const RECRUITER_ACTIVITIES: Activity[] = [
  /* ── Aujourd'hui (11 mars) ─────────────────────────────── */
  {
    id: "ra-001", type: "message_received", portal: "recruiter",
    timestamp: "2026-03-11T09:15:00", isRead: false,
    athleteId: "r-001", athleteName: "Marc-Antoine Tremblay", athletePosition: "QB",
    coachId: "coach-001", coachName: "Coach Bergeron",
    schoolId: "sch-001", schoolName: "É.S. Saint-Jean-Eudes",
    ctaLabel: "Voir la conversation", ctaRoute: "/recruteur/messages",
  },
  {
    id: "ra-002", type: "athlete_favorited", portal: "recruiter",
    timestamp: "2026-03-11T08:30:00", isRead: false,
    athleteId: "p-005", athleteName: "Jérémy Lavoie", athletePosition: "WR",
    ctaLabel: "Voir le profil", ctaRoute: "/recruteur/athletes/p-005",
  },
  {
    id: "ra-003", type: "video_added", portal: "recruiter",
    timestamp: "2026-03-11T07:45:00", isRead: false,
    athleteId: "p-006", athleteName: "Félix Gagnon-Roy", athletePosition: "LB",
    ctaLabel: "Regarder la vidéo", ctaRoute: "/recruteur/athletes/p-006",
  },
  {
    id: "ra-004", type: "new_athlete_in_sport", portal: "recruiter",
    timestamp: "2026-03-11T06:00:00", isRead: false,
    athleteId: "p-020", athleteName: "Mathieu Plante", athletePosition: "DB",
    schoolId: "sch-004", schoolName: "É.S. de l'Odyssée", sportName: "Football",
    ctaLabel: "Voir le profil", ctaRoute: "/recruteur/athletes/p-020",
  },

  /* ── Hier (10 mars) ────────────────────────────────────── */
  {
    id: "ra-005", type: "badge_earned", portal: "recruiter",
    timestamp: "2026-03-10T16:00:00", isRead: false,
    athleteId: "p-006", athleteName: "Félix Gagnon-Roy", athletePosition: "LB",
    badgeName: "Capitaine",
    ctaLabel: "Voir le profil", ctaRoute: "/recruteur/athletes/p-006",
  },
  {
    id: "ra-006", type: "profile_verified", portal: "recruiter",
    timestamp: "2026-03-10T14:30:00", isRead: true,
    athleteId: "p-007", athleteName: "William Pelletier", athletePosition: "CB",
    ctaLabel: "Voir le profil", ctaRoute: "/recruteur/athletes/p-007",
  },
  {
    id: "ra-007", type: "scouting_report", portal: "recruiter",
    timestamp: "2026-03-10T11:00:00", isRead: true,
    athleteId: "r-001", athleteName: "Marc-Antoine Tremblay", athletePosition: "QB",
    ctaLabel: "Lire le rapport", ctaRoute: "/recruteur/athletes/r-001",
  },
  {
    id: "ra-008", type: "athlete_added", portal: "recruiter",
    timestamp: "2026-03-10T09:00:00", isRead: true,
    athleteId: "p-015", athleteName: "Gabriel Morin", athletePosition: "LB",
    schoolId: "sch-001", schoolName: "É.S. Saint-Jean-Eudes",
    ctaLabel: "Voir le profil", ctaRoute: "/recruteur/athletes/p-015",
  },
  {
    id: "ra-009", type: "coach_response", portal: "recruiter",
    timestamp: "2026-03-10T08:00:00", isRead: true,
    athleteId: "p-003", athleteName: "Xavier Lapointe", athletePosition: "RB",
    coachId: "coach-002", coachName: "Coach Tremblay",
    ctaLabel: "Voir la conversation", ctaRoute: "/recruteur/messages",
  },
  {
    id: "ra-010", type: "favorite_stats_updated", portal: "recruiter",
    timestamp: "2026-03-10T07:00:00", isRead: true,
    athleteId: "p-005", athleteName: "Jérémy Lavoie", athletePosition: "WR",
    ctaLabel: "Voir les stats", ctaRoute: "/recruteur/athletes/p-005",
  },

  /* ── Cette semaine (9 mars — lundi) ────────────────────── */
  {
    id: "ra-011", type: "letter_of_intent", portal: "recruiter",
    timestamp: "2026-03-09T15:00:00", isRead: true,
    athleteId: "p-001", athleteName: "Thomas Carrier-Brault", athletePosition: "TE",
    cegepId: "ceg-007", cegepName: "CÉGEP de Sainte-Foy",
    isHighlighted: true,
    ctaLabel: "Voir le profil", ctaRoute: "/recruteur/athletes/p-001",
  },
  {
    id: "ra-012", type: "favorite_profile_updated", portal: "recruiter",
    timestamp: "2026-03-09T12:00:00", isRead: true,
    athleteId: "p-002", athleteName: "Olivier Nadeau", athletePosition: "QB",
    ctaLabel: "Voir le profil", ctaRoute: "/recruteur/athletes/p-002",
  },
  {
    id: "ra-013", type: "message_received", portal: "recruiter",
    timestamp: "2026-03-09T10:00:00", isRead: true,
    athleteId: "p-006", athleteName: "Félix Gagnon-Roy", athletePosition: "LB",
    coachId: "coach-001", coachName: "Coach Bergeron",
    schoolId: "sch-001", schoolName: "É.S. Saint-Jean-Eudes",
    ctaLabel: "Voir la conversation", ctaRoute: "/recruteur/messages",
  },
  {
    id: "ra-014", type: "profile_viewed", portal: "recruiter",
    timestamp: "2026-03-08T16:00:00", isRead: true,
    athleteId: "r-001", athleteName: "Marc-Antoine Tremblay", athletePosition: "QB",
    ctaLabel: "Voir le profil", ctaRoute: "/recruteur/athletes/r-001",
  },
  {
    id: "ra-015", type: "video_added", portal: "recruiter",
    timestamp: "2026-03-08T12:00:00", isRead: true,
    athleteId: "p-003", athleteName: "Xavier Lapointe", athletePosition: "RB",
    ctaLabel: "Regarder la vidéo", ctaRoute: "/recruteur/athletes/p-003",
  },
  {
    id: "ra-016", type: "athlete_favorited", portal: "recruiter",
    timestamp: "2026-03-08T09:00:00", isRead: true,
    athleteId: "p-008", athleteName: "Mathis Dufresne", athletePosition: "LB",
    ctaLabel: "Voir le profil", ctaRoute: "/recruteur/athletes/p-008",
  },
  {
    id: "ra-017", type: "new_athlete_in_sport", portal: "recruiter",
    timestamp: "2026-03-07T15:00:00", isRead: true,
    athleteId: "p-010", athleteName: "Raphaël Bergeron", athletePosition: "DL",
    schoolId: "sch-005", schoolName: "É.S. les Etchemins", sportName: "Football",
    ctaLabel: "Voir le profil", ctaRoute: "/recruteur/athletes/p-010",
  },

  /* ── La semaine dernière (2–5 mars) ────────────────────── */
  {
    id: "ra-018", type: "coach_response", portal: "recruiter",
    timestamp: "2026-03-05T16:00:00", isRead: true,
    athleteId: "p-005", athleteName: "Jérémy Lavoie", athletePosition: "WR",
    coachId: "coach-001", coachName: "Coach Bergeron",
    ctaLabel: "Voir la conversation", ctaRoute: "/recruteur/messages",
  },
  {
    id: "ra-019", type: "profile_verified", portal: "recruiter",
    timestamp: "2026-03-05T10:00:00", isRead: true,
    athleteId: "p-008", athleteName: "Mathis Dufresne", athletePosition: "LB",
    ctaLabel: "Voir le profil", ctaRoute: "/recruteur/athletes/p-008",
  },
  {
    id: "ra-020", type: "scouting_report", portal: "recruiter",
    timestamp: "2026-03-04T14:00:00", isRead: true,
    athleteId: "p-002", athleteName: "Olivier Nadeau", athletePosition: "QB",
    ctaLabel: "Lire le rapport", ctaRoute: "/recruteur/athletes/p-002",
  },
  {
    id: "ra-021", type: "message_received", portal: "recruiter",
    timestamp: "2026-03-04T09:00:00", isRead: true,
    athleteId: "p-011", athleteName: "Samuel Côté", athletePosition: "K",
    coachId: "coach-003", coachName: "Coach Lapointe",
    schoolId: "sch-003", schoolName: "É.S. Roger-Comtois",
    ctaLabel: "Voir la conversation", ctaRoute: "/recruteur/messages",
  },
  {
    id: "ra-022", type: "badge_earned", portal: "recruiter",
    timestamp: "2026-03-03T15:00:00", isRead: true,
    athleteId: "p-005", athleteName: "Jérémy Lavoie", athletePosition: "WR",
    badgeName: "Étoile provinciale",
    ctaLabel: "Voir le profil", ctaRoute: "/recruteur/athletes/p-005",
  },
  {
    id: "ra-023", type: "favorite_profile_updated", portal: "recruiter",
    timestamp: "2026-03-03T11:00:00", isRead: true,
    athleteId: "p-003", athleteName: "Xavier Lapointe", athletePosition: "RB",
    ctaLabel: "Voir le profil", ctaRoute: "/recruteur/athletes/p-003",
  },
  {
    id: "ra-024", type: "profile_viewed", portal: "recruiter",
    timestamp: "2026-03-02T16:00:00", isRead: true,
    athleteId: "p-006", athleteName: "Félix Gagnon-Roy", athletePosition: "LB",
    ctaLabel: "Voir le profil", ctaRoute: "/recruteur/athletes/p-006",
  },
  {
    id: "ra-025", type: "favorite_stats_updated", portal: "recruiter",
    timestamp: "2026-03-02T10:00:00", isRead: true,
    athleteId: "r-001", athleteName: "Marc-Antoine Tremblay", athletePosition: "QB",
    ctaLabel: "Voir les stats", ctaRoute: "/recruteur/athletes/r-001",
  },

  /* ── Ce mois-ci (28 fév — 1 mars) ─────────────────────── */
  {
    id: "ra-026", type: "letter_of_intent", portal: "recruiter",
    timestamp: "2026-03-01T14:00:00", isRead: true,
    athleteId: "p-002", athleteName: "Olivier Nadeau", athletePosition: "QB",
    cegepId: "ceg-002", cegepName: "CÉGEP de Sherbrooke",
    isHighlighted: true,
    ctaLabel: "Voir le profil", ctaRoute: "/recruteur/athletes/p-002",
  },
  {
    id: "ra-027", type: "video_added", portal: "recruiter",
    timestamp: "2026-02-28T14:00:00", isRead: true,
    athleteId: "p-011", athleteName: "Samuel Côté", athletePosition: "K",
    ctaLabel: "Regarder la vidéo", ctaRoute: "/recruteur/athletes/p-011",
  },
  {
    id: "ra-028", type: "athlete_favorited", portal: "recruiter",
    timestamp: "2026-02-28T09:00:00", isRead: true,
    athleteId: "p-009", athleteName: "Alexis Bouchard", athletePosition: "RB",
    ctaLabel: "Voir le profil", ctaRoute: "/recruteur/athletes/p-009",
  },
  {
    id: "ra-029", type: "new_athlete_in_sport", portal: "recruiter",
    timestamp: "2026-02-27T11:00:00", isRead: true,
    athleteId: "p-013", athleteName: "Étienne Fortin", athletePosition: "S",
    schoolId: "sch-006", schoolName: "É.S. de Rochebelle", sportName: "Football",
    ctaLabel: "Voir le profil", ctaRoute: "/recruteur/athletes/p-013",
  },
  {
    id: "ra-030", type: "coach_response", portal: "recruiter",
    timestamp: "2026-02-26T15:00:00", isRead: true,
    athleteId: "r-001", athleteName: "Marc-Antoine Tremblay", athletePosition: "QB",
    coachId: "coach-001", coachName: "Coach Bergeron",
    ctaLabel: "Voir la conversation", ctaRoute: "/recruteur/messages",
  },
];
