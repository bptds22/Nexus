/* ─────────────────────────────────────────────────────────────────
   Mock data for Reassignment page
   CÉGEP Garneau — 4 recruiters, pipeline athletes, transfer history
───────────────────────────────────────────────────────────────── */

import type { RecruitmentStatus } from "@/lib/config/recruitmentStatuses";

export interface ReassignRecruiter {
  id: string;
  firstName: string;
  lastName: string;
  initials: string;
  sports: string[];
  athleteCount: number;
  status: "active" | "departing" | "inactive";
  departureDate?: string;
}

export interface ReassignAthlete {
  id: string;
  full_name: string;
  school: string;
  sport: string;
  position: string;
  pipeline_status: RecruitmentStatus;
  days_in_status: number;
  coach_rating: number;
  is_verified: boolean;
  recruiterId: string;
}

export interface TransferRecord {
  id: string;
  date: string;
  fromName: string;
  toName: string;
  athleteCount: number;
  sport: string;
  reason: string;
  performedBy: string;
}

/* ── Recruiters ──────────────────────────────────────────────── */

export const MOCK_RECRUITERS: ReassignRecruiter[] = [
  { id: "rec-01", firstName: "Marc-André", lastName: "Bergeron", initials: "MB", sports: ["Football"], athleteCount: 22, status: "active" },
  { id: "rec-02", firstName: "Sophie", lastName: "Lapointe", initials: "SL", sports: ["Hockey", "Basketball"], athleteCount: 18, status: "active" },
  { id: "rec-03", firstName: "Jean-François", lastName: "Simard", initials: "JS", sports: ["Football"], athleteCount: 14, status: "departing", departureDate: "2026-05-01" },
  { id: "rec-04", firstName: "Alexis", lastName: "Dufour", initials: "AD", sports: ["Soccer", "Volleyball"], athleteCount: 8, status: "active" },
];

/* ── Athletes per recruiter ──────────────────────────────────── */

export const MOCK_REASSIGN_ATHLETES: ReassignAthlete[] = [
  // Jean-François Simard (rec-03) — 14 Football athletes
  { id: "ra-001", full_name: "Marc-Antoine Tremblay", school: "É.S. Saint-Jean-Eudes", sport: "Football", position: "QB", pipeline_status: "visite_planifiee", days_in_status: 1, coach_rating: 5, is_verified: true, recruiterId: "rec-03" },
  { id: "ra-002", full_name: "Xavier Lapointe", school: "É.S. De Mortagne", sport: "Football", position: "RB", pipeline_status: "visite_planifiee", days_in_status: 2, coach_rating: 3, is_verified: true, recruiterId: "rec-03" },
  { id: "ra-003", full_name: "Jérémy Lavoie", school: "É.S. Saint-Jean-Eudes", sport: "Football", position: "WR", pipeline_status: "en_discussion", days_in_status: 2, coach_rating: 4, is_verified: true, recruiterId: "rec-03" },
  { id: "ra-004", full_name: "Félix Gagnon-Roy", school: "É.S. Saint-Jean-Eudes", sport: "Football", position: "LB", pipeline_status: "en_discussion", days_in_status: 1, coach_rating: 4, is_verified: true, recruiterId: "rec-03" },
  { id: "ra-005", full_name: "Jacob Plante", school: "É.S. de Rochebelle", sport: "Football", position: "QB", pipeline_status: "en_discussion", days_in_status: 20, coach_rating: 3, is_verified: true, recruiterId: "rec-03" },
  { id: "ra-006", full_name: "William Pelletier", school: "É.S. les Etchemins", sport: "Football", position: "CB", pipeline_status: "contacte", days_in_status: 3, coach_rating: 4, is_verified: true, recruiterId: "rec-03" },
  { id: "ra-007", full_name: "Adam Rioux", school: "É.S. Saint-Jean-Eudes", sport: "Football", position: "TE", pipeline_status: "contacte", days_in_status: 16, coach_rating: 4, is_verified: true, recruiterId: "rec-03" },
  { id: "ra-008", full_name: "Mathis Dufresne", school: "É.S. de Rochebelle", sport: "Football", position: "LB", pipeline_status: "contacte", days_in_status: 1, coach_rating: 3, is_verified: true, recruiterId: "rec-03" },
  { id: "ra-009", full_name: "Alexis Bouchard", school: "É.S. Roger-Comtois", sport: "Football", position: "RB", pipeline_status: "identifie", days_in_status: 5, coach_rating: 3, is_verified: true, recruiterId: "rec-03" },
  { id: "ra-010", full_name: "Samuel Côté", school: "É.S. Roger-Comtois", sport: "Football", position: "OL", pipeline_status: "identifie", days_in_status: 2, coach_rating: 3, is_verified: true, recruiterId: "rec-03" },
  { id: "ra-011", full_name: "Raphaël Bergeron", school: "É.S. les Etchemins", sport: "Football", position: "DL", pipeline_status: "identifie", days_in_status: 3, coach_rating: 2, is_verified: false, recruiterId: "rec-03" },
  { id: "ra-012", full_name: "William Ouellet", school: "É.S. de Rochebelle", sport: "Football", position: "WR", pipeline_status: "identifie", days_in_status: 12, coach_rating: 3, is_verified: false, recruiterId: "rec-03" },
  { id: "ra-013", full_name: "Mathieu Bélanger", school: "É.S. de Rochebelle", sport: "Football", position: "CB", pipeline_status: "identifie", days_in_status: 32, coach_rating: 3, is_verified: true, recruiterId: "rec-03" },
  { id: "ra-014", full_name: "Zachary Thibault", school: "É.S. De Mortagne", sport: "Football", position: "K", pipeline_status: "identifie", days_in_status: 11, coach_rating: 3, is_verified: false, recruiterId: "rec-03" },

  // Marc-André Bergeron (rec-01) — sample of 22
  { id: "ra-020", full_name: "Olivier Nadeau", school: "É.S. De Mortagne", sport: "Football", position: "QB", pipeline_status: "engage", days_in_status: 5, coach_rating: 4, is_verified: true, recruiterId: "rec-01" },
  { id: "ra-021", full_name: "Thomas Carrier-Brault", school: "É.S. Saint-Jean-Eudes", sport: "Football", position: "TE", pipeline_status: "lettre_signee", days_in_status: 10, coach_rating: 4, is_verified: true, recruiterId: "rec-01" },
  { id: "ra-022", full_name: "Noah Tremblay", school: "É.S. De Mortagne", sport: "Football", position: "S", pipeline_status: "contacte", days_in_status: 9, coach_rating: 2, is_verified: false, recruiterId: "rec-01" },
  { id: "ra-023", full_name: "Émile Gagnon", school: "É.S. Joseph-F.-Perrault", sport: "Football", position: "MF", pipeline_status: "identifie", days_in_status: 18, coach_rating: 3, is_verified: true, recruiterId: "rec-01" },

  // Sophie Lapointe (rec-02) — sample of 18
  { id: "ra-030", full_name: "Philippe Lachance", school: "É.S. Mont-Saint-Sacrement", sport: "Hockey", position: "G", pipeline_status: "engage", days_in_status: 3, coach_rating: 4, is_verified: true, recruiterId: "rec-02" },
  { id: "ra-031", full_name: "Nathan Girard", school: "É.S. Mont-Saint-Sacrement", sport: "Hockey", position: "C", pipeline_status: "en_discussion", days_in_status: 10, coach_rating: 4, is_verified: true, recruiterId: "rec-02" },
  { id: "ra-032", full_name: "Benjamin Caron", school: "É.S. de la Seigneurie", sport: "Basketball", position: "PF", pipeline_status: "en_discussion", days_in_status: 6, coach_rating: 5, is_verified: true, recruiterId: "rec-02" },
  { id: "ra-033", full_name: "Loïc Pelletier", school: "É.S. Saint-Jean-Eudes", sport: "Basketball", position: "SG", pipeline_status: "identifie", days_in_status: 4, coach_rating: 4, is_verified: true, recruiterId: "rec-02" },

  // Alexis Dufour (rec-04) — sample of 8
  { id: "ra-040", full_name: "Félix-Antoine Roy", school: "É.S. Joseph-F.-Perrault", sport: "Soccer", position: "ST", pipeline_status: "contacte", days_in_status: 2, coach_rating: 3, is_verified: true, recruiterId: "rec-04" },
  { id: "ra-041", full_name: "Victor Dubois", school: "É.S. Roger-Comtois", sport: "Soccer", position: "GK", pipeline_status: "identifie", days_in_status: 15, coach_rating: 2, is_verified: false, recruiterId: "rec-04" },
];

/* ── Transfer History ─────────────────────────────────────────── */

export const MOCK_TRANSFER_HISTORY: TransferRecord[] = [
  { id: "th-01", date: "2026-01-15", fromName: "Marie Côté", toName: "Sophie Lapointe", athleteCount: 8, sport: "Hockey", reason: "Marie en congé maternité", performedBy: "Dir. sportif" },
  { id: "th-02", date: "2025-12-03", fromName: "Alexis Dufour", toName: "Marc-André Bergeron", athleteCount: 3, sport: "Football", reason: "Rééquilibrage début de saison", performedBy: "Dir. sportif" },
  { id: "th-03", date: "2025-09-18", fromName: "(Ancien recruteur)", toName: "Jean-François Simard", athleteCount: 14, sport: "Football", reason: "Nouveau recruteur assigné", performedBy: "Dir. sportif" },
];

/* ── Helpers ──────────────────────────────────────────────────── */

export function getAthletesByRecruiter(recruiterId: string): ReassignAthlete[] {
  return MOCK_REASSIGN_ATHLETES.filter((a) => a.recruiterId === recruiterId);
}

export function getWorkloadLevel(count: number): { label: string; color: string } {
  if (count > 25) return { label: "Surchargé", color: "#E63946" };
  if (count >= 15) return { label: "Chargé", color: "#EAB308" };
  return { label: "Disponible", color: "#22C55E" };
}
