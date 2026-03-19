/* ═══════════════════════════════════════════════════════════════
   RECRUITMENT STATUS CONFIG — Single source of truth
   2 AUTO statuses (gray) + 4 MANUAL statuses (red) + exit

   AUTO (gray #6B7280):
     IDENTIFIÉ  — auto on favorite
     CONTACTÉ   — auto on first message

   MANUAL (red #E63946):
     EN_DISCUSSION    — recruiter manually sets "actively pursuing"
     VISITE_PLANIFIÉE — manual
     ENGAGÉ           — manual
     LETTRE_SIGNÉE    — manual (end goal)

   EXIT:
     RETIRÉ — gray, from any status, final state

   Movement: forward-only EXCEPT en_discussion → contacté
   (re-engage a cold conversation). No other backward move.
═══════════════════════════════════════════════════════════════ */

/* ── Types ───────────────────────────────────────────────────── */

export type RecruitmentStatus =
  | "none"
  | "identifie"
  | "contacte"
  | "en_discussion"
  | "visite_planifiee"
  | "engage"
  | "lettre_signee"
  | "retire";

/** auto = gray, commitment = red, exit = gray */
export type RecruitmentPhase = "none" | "auto" | "commitment" | "exit";

export type RetireReason =
  | "engage_ailleurs"
  | "ne_correspond_pas"
  | "pas_de_reponse"
  | "athlete_pas_interesse"
  | "autre";

export interface RecruitmentStatusConfig {
  id: RecruitmentStatus;
  label: string;
  shortLabel: string;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  phase: RecruitmentPhase;
  autoTrigger: string | null;
  order: number;
  /** true for IDENTIFIÉ and CONTACTÉ — cannot be set manually */
  isAuto: boolean;
}

export interface RecruiterAthleteTracking {
  recruiterId: string;
  athleteId: string;
  status: RecruitmentStatus;
  statusChangedAt: string;
  favoritedAt?: string;
  firstContactedAt?: string;
  coachRepliedAt?: string;
  visitDate?: string;
  engagedAt?: string;
  letterSignedAt?: string;
  retiredAt?: string;
  retireReason?: RetireReason;
  previousStatus?: RecruitmentStatus;
  notes?: string;
}

/* ── Retire reasons (for dropdown) ───────────────────────────── */

export const RETIRE_REASONS: { value: RetireReason; label: string }[] = [
  { value: "engage_ailleurs", label: "Engagé ailleurs" },
  { value: "ne_correspond_pas", label: "Ne correspond pas à nos besoins" },
  { value: "pas_de_reponse", label: "Pas de réponse du coach" },
  { value: "athlete_pas_interesse", label: "L'athlète n'est pas intéressé" },
  { value: "autre", label: "Autre" },
];

/* ── Status config ───────────────────────────────────────────── */

export const RECRUITMENT_STATUSES: RecruitmentStatusConfig[] = [
  {
    id: "none",
    label: "",
    shortLabel: "",
    color: "#6B7280",
    bgColor: "transparent",
    borderColor: "transparent",
    icon: "",
    phase: "none",
    autoTrigger: null,
    order: 0,
    isAuto: false,
  },

  /* ── AUTO (gray) ── triggered by user actions ─────────────── */
  {
    id: "identifie",
    label: "Identifié",
    shortLabel: "Identifié",
    color: "#6B7280",
    bgColor: "rgba(107,114,128,0.12)",
    borderColor: "rgba(107,114,128,0.40)",
    icon: "eye",
    phase: "auto",
    autoTrigger: "Auto: quand le recruteur ajoute en favori",
    order: 1,
    isAuto: true,
  },
  {
    id: "contacte",
    label: "Contacté",
    shortLabel: "Contacté",
    color: "#6B7280",
    bgColor: "rgba(107,114,128,0.12)",
    borderColor: "rgba(107,114,128,0.40)",
    icon: "send",
    phase: "auto",
    autoTrigger: "Auto: premier message envoyé au coach",
    order: 2,
    isAuto: true,
  },

  /* ── MANUAL (red) ── recruiter decision ───────────────────── */
  {
    id: "en_discussion",
    label: "En discussion",
    shortLabel: "Discussion",
    color: "#E63946",
    bgColor: "rgba(230,57,70,0.12)",
    borderColor: "#E63946",
    icon: "message-circle",
    phase: "commitment",
    autoTrigger: null,
    order: 3,
    isAuto: false,
  },
  {
    id: "visite_planifiee",
    label: "Visite planifiée",
    shortLabel: "Visite",
    color: "#E63946",
    bgColor: "rgba(230,57,70,0.12)",
    borderColor: "#E63946",
    icon: "calendar",
    phase: "commitment",
    autoTrigger: null,
    order: 4,
    isAuto: false,
  },
  {
    id: "engage",
    label: "Engagé",
    shortLabel: "Engagé",
    color: "#E63946",
    bgColor: "rgba(230,57,70,0.12)",
    borderColor: "#E63946",
    icon: "handshake",
    phase: "commitment",
    autoTrigger: null,
    order: 5,
    isAuto: false,
  },
  {
    id: "lettre_signee",
    label: "Lettre d'intention signée",
    shortLabel: "Lettre signée",
    color: "#E63946",
    bgColor: "rgba(230,57,70,0.12)",
    borderColor: "#E63946",
    icon: "pen-tool",
    phase: "commitment",
    autoTrigger: null,
    order: 6,
    isAuto: false,
  },

  /* ── EXIT (gray) ──────────────────────────────────────────── */
  {
    id: "retire",
    label: "Retiré",
    shortLabel: "Retiré",
    color: "#6B7280",
    bgColor: "rgba(55,65,81,0.15)",
    borderColor: "#374151",
    icon: "x-circle",
    phase: "exit",
    autoTrigger: null,
    order: 7,
    isAuto: false,
  },
];

/* ── Helpers ─────────────────────────────────────────────────── */

const STATUS_MAP = new Map(RECRUITMENT_STATUSES.map((s) => [s.id, s]));

export function getStatusConfig(status: RecruitmentStatus): RecruitmentStatusConfig {
  return STATUS_MAP.get(status) || RECRUITMENT_STATUSES[0];
}

/**
 * Valid transitions from a given status.
 * Forward to any later status is allowed.
 * ONLY backward exception: en_discussion → contacté.
 * Retire can be reached from any non-terminal status.
 */
export function getValidTransitions(current: RecruitmentStatus): RecruitmentStatus[] {
  switch (current) {
    case "none":             return ["identifie"];
    case "identifie":        return ["contacte", "en_discussion", "visite_planifiee", "engage", "lettre_signee", "retire"];
    case "contacte":         return ["en_discussion", "visite_planifiee", "engage", "lettre_signee", "retire"];
    case "en_discussion":    return ["contacte", "visite_planifiee", "engage", "lettre_signee", "retire"]; // contacte = backward exception
    case "visite_planifiee": return ["engage", "lettre_signee", "retire"];
    case "engage":           return ["lettre_signee", "retire"];
    case "lettre_signee":    return ["retire"];
    case "retire":           return [];
    default:                 return [];
  }
}

/** Check if a drop/move from one status to another is valid */
export function isValidMove(from: RecruitmentStatus, to: RecruitmentStatus): boolean {
  if (from === to) return false;
  return getValidTransitions(from).includes(to);
}

/** Check if a move is the special backward exception (en_discussion → contacté) */
export function isBackwardException(from: RecruitmentStatus, to: RecruitmentStatus): boolean {
  return from === "en_discussion" && to === "contacte";
}

/** Check if a status is a terminal state (no outgoing moves except retire) */
export function isTerminalStatus(status: RecruitmentStatus): boolean {
  return status === "lettre_signee" || status === "retire";
}

export function needsAutoMessage(current: RecruitmentStatus, hasExistingThread: boolean): boolean {
  return current === "identifie" && !hasExistingThread;
}

export function getPhaseLabel(phase: RecruitmentPhase): string {
  switch (phase) {
    case "auto":        return "Automatique";
    case "commitment":  return "Engagement";
    case "exit":        return "Retirés";
    default:            return "";
  }
}
