/* ─────────────────────────────────────────────────────────────────
   Mock Pipeline Data — 14 athletes across all 8 statuses
   Recruiter: Pierre Dufour, CÉGEP Garneau
───────────────────────────────────────────────────────────────── */

import type { RecruitmentStatus, RetireReason, RecruiterAthleteTracking } from "@/lib/config/recruitmentStatuses";

export interface PipelineAthlete {
  id: string;
  firstName: string;
  lastName: string;
  position: string;
  sport: string;
  school: string;
  region: string;
  graduationYear: number;
  niveau: "Sec. 4" | "Sec. 5";
  isVerified: boolean;
  badges: { icon: string; label: string }[];
  hasVideo: boolean;
  coachName: string;
  coachLastName: string;
  stars: number; // 0–5 coach rating
  /** Tracking data for this recruiter */
  tracking: RecruiterAthleteTracking;
}

export const MOCK_PIPELINE: PipelineAthlete[] = [
  // ── LETTRE D'INTENTION SIGNÉE (1) ──
  {
    id: "p-001",
    firstName: "Thomas", lastName: "Carrier-Brault",
    position: "TE", sport: "Football",
    school: "É.S. Saint-Jean-Eudes", region: "Québec",
    graduationYear: 2026, niveau: "Sec. 5",
    isVerified: true,
    badges: [{ icon: "captain", label: "Capitaine" }],
    hasVideo: true,
    coachName: "Marc", coachLastName: "Bergeron",
    stars: 4,
    tracking: {
      recruiterId: "rec_001", athleteId: "p-001",
      status: "lettre_signee",
      statusChangedAt: "2026-02-28T14:30:00",
      favoritedAt: "2026-01-15T09:00:00",
      firstContactedAt: "2026-01-20T10:00:00",
      coachRepliedAt: "2026-01-21T08:30:00",
      visitDate: "2026-02-10",
      engagedAt: "2026-02-15T11:00:00",
      letterSignedAt: "2026-02-28T14:30:00",
    },
  },

  // ── ENGAGÉ (1) ──
  {
    id: "p-002",
    firstName: "Olivier", lastName: "Nadeau",
    position: "QB", sport: "Football",
    school: "É.S. De Mortagne", region: "Montérégie",
    graduationYear: 2026, niveau: "Sec. 5",
    isVerified: true,
    badges: [{ icon: "allstar", label: "Étoile provinciale" }],
    hasVideo: true,
    coachName: "Jean", coachLastName: "Tremblay",
    stars: 4,
    tracking: {
      recruiterId: "rec_001", athleteId: "p-002",
      status: "engage",
      statusChangedAt: "2026-03-05T16:00:00",
      favoritedAt: "2026-01-22T10:00:00",
      firstContactedAt: "2026-01-25T14:00:00",
      coachRepliedAt: "2026-01-26T09:00:00",
      visitDate: "2026-02-20",
      engagedAt: "2026-03-05T16:00:00",
    },
  },

  // ── VISITE PLANIFIÉE (2) ──
  {
    id: "p-003",
    firstName: "Xavier", lastName: "Lapointe",
    position: "RB", sport: "Football",
    school: "É.S. De Mortagne", region: "Montérégie",
    graduationYear: 2026, niveau: "Sec. 5",
    isVerified: true,
    badges: [{ icon: "trending", label: "Progression marquée" }],
    hasVideo: true,
    coachName: "Jean", coachLastName: "Tremblay",
    stars: 3,
    tracking: {
      recruiterId: "rec_001", athleteId: "p-003",
      status: "visite_planifiee",
      statusChangedAt: "2026-03-08T11:00:00",
      favoritedAt: "2026-02-10T09:00:00",
      firstContactedAt: "2026-02-15T10:00:00",
      coachRepliedAt: "2026-02-16T14:00:00",
      visitDate: "2026-03-22",
    },
  },
  {
    id: "r-001",
    firstName: "Marc-Antoine", lastName: "Tremblay",
    position: "QB", sport: "Football",
    school: "É.S. Saint-Jean-Eudes", region: "Québec",
    graduationYear: 2026, niveau: "Sec. 5",
    isVerified: true,
    badges: [{ icon: "captain", label: "Capitaine" }, { icon: "allstar", label: "Étoile provinciale" }],
    hasVideo: true,
    coachName: "Marc", coachLastName: "Bergeron",
    stars: 5,
    tracking: {
      recruiterId: "rec_001", athleteId: "r-001",
      status: "visite_planifiee",
      statusChangedAt: "2026-03-09T09:00:00",
      favoritedAt: "2026-01-15T09:00:00",
      firstContactedAt: "2026-02-01T10:00:00",
      coachRepliedAt: "2026-02-02T11:00:00",
      visitDate: "2026-03-25",
    },
  },

  // ── EN DISCUSSION (2) ──
  {
    id: "p-005",
    firstName: "Jérémy", lastName: "Lavoie",
    position: "WR", sport: "Football",
    school: "É.S. Saint-Jean-Eudes", region: "Québec",
    graduationYear: 2026, niveau: "Sec. 5",
    isVerified: true,
    badges: [{ icon: "trending", label: "Meilleur joueur offensif" }],
    hasVideo: true,
    coachName: "Marc", coachLastName: "Bergeron",
    stars: 4,
    tracking: {
      recruiterId: "rec_001", athleteId: "p-005",
      status: "en_discussion",
      statusChangedAt: "2026-03-08T14:00:00",
      favoritedAt: "2026-02-15T09:00:00",
      firstContactedAt: "2026-02-20T10:00:00",
      coachRepliedAt: "2026-03-08T14:00:00",
    },
  },
  {
    id: "p-006",
    firstName: "Félix", lastName: "Gagnon-Roy",
    position: "LB", sport: "Football",
    school: "É.S. Saint-Jean-Eudes", region: "Québec",
    graduationYear: 2026, niveau: "Sec. 5",
    isVerified: true,
    badges: [{ icon: "target", label: "Meilleur joueur d'équipe" }],
    hasVideo: true,
    coachName: "Marc", coachLastName: "Bergeron",
    stars: 4,
    tracking: {
      recruiterId: "rec_001", athleteId: "p-006",
      status: "en_discussion",
      statusChangedAt: "2026-03-09T16:00:00",
      favoritedAt: "2026-02-18T10:00:00",
      firstContactedAt: "2026-03-01T11:00:00",
      coachRepliedAt: "2026-03-09T16:00:00",
    },
  },

  // ── CONTACTÉ (2) ──
  {
    id: "p-007",
    firstName: "William", lastName: "Pelletier",
    position: "CB", sport: "Football",
    school: "É.S. les Etchemins", region: "Québec",
    graduationYear: 2026, niveau: "Sec. 5",
    isVerified: true,
    badges: [{ icon: "allstar", label: "Étoile provinciale" }],
    hasVideo: true,
    coachName: "Luc", coachLastName: "Gagnon",
    stars: 4,
    tracking: {
      recruiterId: "rec_001", athleteId: "p-007",
      status: "contacte",
      statusChangedAt: "2026-03-07T10:00:00",
      favoritedAt: "2026-03-01T09:00:00",
      firstContactedAt: "2026-03-07T10:00:00",
    },
  },
  {
    id: "p-008",
    firstName: "Mathis", lastName: "Dufresne",
    position: "LB", sport: "Football",
    school: "É.S. de Rochebelle", region: "Québec",
    graduationYear: 2027, niveau: "Sec. 4",
    isVerified: true,
    badges: [],
    hasVideo: true,
    coachName: "Simon", coachLastName: "Roy",
    stars: 3,
    tracking: {
      recruiterId: "rec_001", athleteId: "p-008",
      status: "contacte",
      statusChangedAt: "2026-03-09T14:00:00",
      favoritedAt: "2026-03-05T10:00:00",
      firstContactedAt: "2026-03-09T14:00:00",
    },
  },

  // ── IDENTIFIÉ (3) ──
  {
    id: "p-009",
    firstName: "Alexis", lastName: "Bouchard",
    position: "RB", sport: "Football",
    school: "É.S. Roger-Comtois", region: "Québec",
    graduationYear: 2027, niveau: "Sec. 4",
    isVerified: true,
    badges: [],
    hasVideo: true,
    coachName: "Éric", coachLastName: "Lapointe",
    stars: 3,
    tracking: {
      recruiterId: "rec_001", athleteId: "p-009",
      status: "identifie",
      statusChangedAt: "2026-03-03T09:00:00",
      favoritedAt: "2026-03-03T09:00:00",
    },
  },
  {
    id: "p-010",
    firstName: "Raphaël", lastName: "Bergeron",
    position: "DL", sport: "Football",
    school: "É.S. les Etchemins", region: "Québec",
    graduationYear: 2027, niveau: "Sec. 4",
    isVerified: true,
    badges: [],
    hasVideo: false,
    coachName: "Luc", coachLastName: "Gagnon",
    stars: 2,
    tracking: {
      recruiterId: "rec_001", athleteId: "p-010",
      status: "identifie",
      statusChangedAt: "2026-03-07T15:00:00",
      favoritedAt: "2026-03-07T15:00:00",
    },
  },
  {
    id: "p-011",
    firstName: "Samuel", lastName: "Côté",
    position: "OL", sport: "Football",
    school: "É.S. Roger-Comtois", region: "Québec",
    graduationYear: 2026, niveau: "Sec. 5",
    isVerified: true,
    badges: [{ icon: "captain", label: "Capitaine" }],
    hasVideo: false,
    coachName: "Éric", coachLastName: "Lapointe",
    stars: 3,
    tracking: {
      recruiterId: "rec_001", athleteId: "p-011",
      status: "identifie",
      statusChangedAt: "2026-03-08T11:00:00",
      favoritedAt: "2026-03-08T11:00:00",
    },
  },

  // ── RETIRÉ (1) ──
  {
    id: "p-012",
    firstName: "Noah", lastName: "Simard",
    position: "WR", sport: "Football",
    school: "É.S. De Mortagne", region: "Montérégie",
    graduationYear: 2026, niveau: "Sec. 5",
    isVerified: true,
    badges: [],
    hasVideo: true,
    coachName: "Jean", coachLastName: "Tremblay",
    stars: 3,
    tracking: {
      recruiterId: "rec_001", athleteId: "p-012",
      status: "retire",
      statusChangedAt: "2026-03-06T10:00:00",
      favoritedAt: "2026-01-20T09:00:00",
      firstContactedAt: "2026-02-01T10:00:00",
      coachRepliedAt: "2026-02-03T11:00:00",
      retiredAt: "2026-03-06T10:00:00",
      retireReason: "engage_ailleurs" as RetireReason,
      previousStatus: "en_discussion" as RecruitmentStatus,
      notes: "Engagé au CÉGEP du Vieux Montréal",
    },
  },

  // ── NONE (2) — not in favorites, only in search ──
  {
    id: "p-013",
    firstName: "Étienne", lastName: "Fortin",
    position: "S", sport: "Football",
    school: "É.S. de Rochebelle", region: "Québec",
    graduationYear: 2027, niveau: "Sec. 4",
    isVerified: true,
    badges: [],
    hasVideo: false,
    coachName: "Simon", coachLastName: "Roy",
    stars: 2,
    tracking: {
      recruiterId: "rec_001", athleteId: "p-013",
      status: "none",
      statusChangedAt: "",
    },
  },
  {
    id: "p-014",
    firstName: "Émile", lastName: "Tanguay",
    position: "CB", sport: "Football",
    school: "É.S. Roger-Comtois", region: "Québec",
    graduationYear: 2027, niveau: "Sec. 4",
    isVerified: true,
    badges: [],
    hasVideo: false,
    coachName: "Éric", coachLastName: "Lapointe",
    stars: 2,
    tracking: {
      recruiterId: "rec_001", athleteId: "p-014",
      status: "none",
      statusChangedAt: "",
    },
  },
];

/* ── Helpers ─────────────────────────────────────────────────── */

/** Get all pipeline athletes (excluding "none") */
export function getPipelineAthletes(): PipelineAthlete[] {
  return MOCK_PIPELINE.filter((a) => a.tracking.status !== "none");
}

/** Get athletes by status */
export function getAthletesByStatus(status: RecruitmentStatus): PipelineAthlete[] {
  return MOCK_PIPELINE.filter((a) => a.tracking.status === status);
}

/** Get tracking for a specific athlete (returns "none" tracking if not found) */
export function getAthleteTracking(athleteId: string): RecruiterAthleteTracking | undefined {
  const a = MOCK_PIPELINE.find((p) => p.id === athleteId);
  if (!a || a.tracking.status === "none") return undefined;
  return a.tracking;
}

/** Pipeline summary counts */
export function getPipelineCounts(): Record<RecruitmentStatus, number> {
  const counts: Record<RecruitmentStatus, number> = {
    none: 0, identifie: 0, contacte: 0, en_discussion: 0,
    visite_planifiee: 0, engage: 0, lettre_signee: 0, retire: 0,
  };
  for (const a of MOCK_PIPELINE) {
    counts[a.tracking.status]++;
  }
  return counts;
}
