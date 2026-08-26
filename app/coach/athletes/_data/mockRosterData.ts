/* ─────────────────────────────────────────────────────────────────
   Mock Roster Data — Mes Athlètes
   15 athletes across 3 sports with verification metadata.
───────────────────────────────────────────────────────────────── */

import type { AthleteVerification } from "../../../../lib/types/models";
import type { DistinctionEntry } from "@/lib/config/badges";
import type { PastilleBadge } from "@/lib/queries/shared/athleteBadges";

export type CommitmentStatus = "aucun" | "en_discussion" | "visite_planifiee" | "lettre_signee" | "place";

export const COMMITMENT_CONFIG: Record<CommitmentStatus, { label: string; color: string; bg: string; borderColor: string }> = {
  aucun:            { label: "—",                color: "#4B5563", bg: "bg-transparent",        borderColor: "transparent" },
  en_discussion:    { label: "En discussion",    color: "#FFFFFF", bg: "bg-white/10",           borderColor: "rgba(255,255,255,0.30)" },
  visite_planifiee: { label: "Visite planifiée", color: "#E63946", bg: "bg-[#E63946]/15",       borderColor: "#E63946" },
  lettre_signee:    { label: "Lettre signée",    color: "#E63946", bg: "bg-[#E63946]/15",       borderColor: "#E63946" },
  place:            { label: "Placé",            color: "#22C55E", bg: "bg-[#22C55E]/15",       borderColor: "#22C55E" },
};

export interface CoachTeam {
  id: string;
  name: string;
  sport: string;
}

export const COACH_TEAMS: CoachTeam[] = [
  { id: "t-001", name: "Football Juvénile D1", sport: "Football" },
  { id: "t-002", name: "Football Cadet D2", sport: "Football" },
  { id: "t-003", name: "Soccer Juvénile D1", sport: "Soccer" },
  { id: "t-004", name: "Basketball Juvénile D1", sport: "Basketball" },
];

export interface RosterAthlete {
  id: string;
  photo?: string;
  firstName: string;
  lastName: string;
  position: string;
  gradYear: number;
  teamId: string;                   // links to CoachTeam.id
  profilePercent: number;           // 0–100
  isVerified: boolean;              // true if verified (auto or manual)
  lastValidation?: string | null;   // last_profile_validation (monthly revalidation)
  verification: AthleteVerification;
  views: number;
  favorites: number;
  missingFields?: string[];
  stars: number;
  commitmentStatus: CommitmentStatus;
  placedAt?: string;
  badgeIcons?: string[];            // emoji icons from leadership badges
  recruitment?: { status: string; label: string; count: number; isOverride: boolean }; // from pipeline table
  recruitmentStatus?: string;
  committedSchoolName?: string;
  openToOffers?: boolean | null;
  school?: string;
  region?: string;
  sport?: string;
  hasVideo?: boolean;
  /** VOIE 2 — soit des entrées héritées {badge, detail}, soit des pastilles
   *  {code, libelle, contexte} venues d'athlete_badges. Les deux formes
   *  coexistent le temps que les dernières surfaces basculent. */
  badges?: (DistinctionEntry | PastilleBadge)[];
  academicBadges?: string[];
  heightWeight?: string;
  gpa?: number;
  ouvertDemenager?: boolean;
  ouvertPrive?: boolean;
  ouvertAnglophone?: boolean;
  createdAt?: string;
  /** teams.gender de l'équipe de l'athlète ("Masculin" | "Féminin" | "Mixte"),
   *  lu via team_athletes. null = aucune équipe rattachée. Optionnel : les
   *  fixtures mock ci-dessous ne le portent pas. PAS athletes.genre. */
  teamGender?: string | null;
  /** Primary coach owning this athlete (NULL = unclaimed in the school pool). */
  coach_id?: string | null;
  /** Nom de l'évaluateur de la note affichée, SEULEMENT quand ce n'est pas le
   *  coach connecté (attribution « Évalué par … », ex. le directeur). Vide sinon. */
  evaluatedByName?: string;
}

/* ── Helper to build verification objects ───────────────────── */
function autoVerified(pct: number, date: string): AthleteVerification {
  return {
    isVerified: true,
    method: "auto",
    verifiedAt: date,
    verifiedBy: "system",
    verifiedByName: "Système",
    profilePercentAtVerification: pct,
    autoEligible: true,
    manualOverrideActive: false,
  };
}

function manualCoachVerified(pct: number, date: string, coachId: string, coachName: string): AthleteVerification {
  return {
    isVerified: true,
    method: "manual_coach",
    verifiedAt: date,
    verifiedBy: coachId,
    verifiedByName: coachName,
    profilePercentAtVerification: pct,
    autoEligible: pct >= 60,
    manualOverrideActive: pct < 60,
  };
}

function unverified(pct: number): AthleteVerification {
  return {
    isVerified: false,
    method: null,
    verifiedAt: null,
    verifiedBy: null,
    verifiedByName: null,
    profilePercentAtVerification: null,
    autoEligible: pct >= 60,
    manualOverrideActive: false,
  };
}

export const ROSTER_ATHLETES: RosterAthlete[] = [
  // ── FOOTBALL — AUTO-VERIFIED (≥60%) ────────────────────────────
  { id: "r-001", firstName: "Marc-Antoine", lastName: "Tremblay", position: "QB", gradYear: 2026, teamId: "t-001", profilePercent: 100, isVerified: true, verification: autoVerified(100, "2025-09-15T10:00:00Z"), views: 34, favorites: 3, stars: 5, commitmentStatus: "en_discussion", badgeIcons: ["🏆", "⭐", "📊"] },
  { id: "r-002", firstName: "Jérémy", lastName: "Lavoie", position: "WR", gradYear: 2026, teamId: "t-001", profilePercent: 100, isVerified: true, verification: autoVerified(100, "2025-09-18T14:30:00Z"), views: 28, favorites: 2, stars: 4, commitmentStatus: "en_discussion" },
  { id: "r-003", firstName: "Félix", lastName: "Gagnon-Roy", position: "LB", gradYear: 2026, teamId: "t-001", profilePercent: 100, isVerified: true, verification: autoVerified(100, "2025-09-20T09:00:00Z"), views: 22, favorites: 1, stars: 4, commitmentStatus: "visite_planifiee", badgeIcons: ["🎯", "🔥"] },
  { id: "r-004", firstName: "Xavier", lastName: "Lapointe", position: "RB", gradYear: 2026, teamId: "t-001", profilePercent: 100, isVerified: true, verification: autoVerified(100, "2025-09-22T11:00:00Z"), views: 15, favorites: 1, stars: 4, commitmentStatus: "visite_planifiee" },
  { id: "r-005", firstName: "Alexis", lastName: "Bouchard", position: "RB", gradYear: 2027, teamId: "t-002", profilePercent: 100, isVerified: true, verification: autoVerified(100, "2025-10-01T08:00:00Z"), views: 18, favorites: 0, stars: 3, commitmentStatus: "aucun" },
  { id: "r-014", firstName: "Thomas", lastName: "Carrier-Brault", position: "TE", gradYear: 2026, teamId: "t-001", profilePercent: 100, isVerified: true, verification: autoVerified(100, "2025-09-25T16:00:00Z"), views: 0, favorites: 0, stars: 5, commitmentStatus: "place", placedAt: "CÉGEP Garneau" },
  { id: "r-015", firstName: "Olivier", lastName: "Nadeau", position: "QB", gradYear: 2026, teamId: "t-001", profilePercent: 100, isVerified: true, verification: autoVerified(100, "2025-09-28T13:00:00Z"), views: 0, favorites: 0, stars: 4, commitmentStatus: "lettre_signee", placedAt: "CÉGEP du Vieux Montréal" },

  // ── FOOTBALL — MANUALLY VERIFIED (below 60% but coach/director approved) ─
  { id: "r-010", firstName: "Étienne", lastName: "Fortin", position: "S", gradYear: 2027, teamId: "t-002", profilePercent: 45, isVerified: true, verification: manualCoachVerified(45, "2025-11-05T10:00:00Z", "coach-1", "Coach Bruno Lafleur"), views: 2, favorites: 0, missingFields: ["stats", "vidéo", "académique"], stars: 2, commitmentStatus: "aucun" },

  // ── FOOTBALL — NON VÉRIFIÉ ──────────────────────────────────
  { id: "r-011", firstName: "Noah", lastName: "Simard", position: "WR", gradYear: 2026, teamId: "t-001", profilePercent: 30, isVerified: false, verification: unverified(30), views: 0, favorites: 0, missingFields: ["stats", "vidéo", "académique"], stars: 1, commitmentStatus: "aucun" },
  { id: "r-012", firstName: "Zachary", lastName: "Ouellet", position: "K/P", gradYear: 2027, teamId: "t-002", profilePercent: 20, isVerified: false, verification: unverified(20), views: 0, favorites: 0, missingFields: ["stats", "vidéo", "académique", "mesures"], stars: 1, commitmentStatus: "aucun" },

  // ── SOCCER ──────────────────────────────────────────────────
  { id: "r-020", firstName: "Émile", lastName: "Tanguay", position: "MF", gradYear: 2026, teamId: "t-003", profilePercent: 92, isVerified: true, verification: autoVerified(92, "2025-10-10T09:30:00Z"), views: 19, favorites: 2, stars: 4, commitmentStatus: "en_discussion" },
  { id: "r-021", firstName: "Lucas", lastName: "Moreau", position: "GK", gradYear: 2027, teamId: "t-003", profilePercent: 78, isVerified: true, verification: autoVerified(78, "2025-10-12T14:00:00Z"), views: 11, favorites: 1, missingFields: ["vidéo"], stars: 3, commitmentStatus: "aucun" },
  { id: "r-022", firstName: "Raphaël", lastName: "Bergeron", position: "FW", gradYear: 2026, teamId: "t-003", profilePercent: 40, isVerified: false, verification: unverified(40), views: 0, favorites: 0, missingFields: ["stats", "vidéo", "académique"], stars: 2, commitmentStatus: "aucun" },

  // ── BASKETBALL ──────────────────────────────────────────────
  { id: "r-030", firstName: "Samuel", lastName: "Côté", position: "PG", gradYear: 2026, teamId: "t-004", profilePercent: 85, isVerified: true, verification: autoVerified(85, "2025-10-15T11:00:00Z"), views: 14, favorites: 1, stars: 4, commitmentStatus: "visite_planifiee" },
  { id: "r-031", firstName: "Mathis", lastName: "Dufresne", position: "SF", gradYear: 2027, teamId: "t-004", profilePercent: 55, isVerified: false, verification: unverified(55), views: 3, favorites: 0, missingFields: ["vidéo", "académique"], stars: 2, commitmentStatus: "aucun" },
];
