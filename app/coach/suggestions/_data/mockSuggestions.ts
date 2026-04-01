/* ─────────────────────────────────────────────────────────────────
   Coach Suggestions Queue — Athlete profile change requests
   Types only — data loaded from Supabase
───────────────────────────────────────────────────────────────── */

export interface CoachSuggestion {
  id: string;
  athlete_id: string;
  athlete_name: string;
  athlete_sport: string;
  athlete_verified: boolean;
  field: string;
  current_value: string | null;
  proposed_value: string;
  message: string | null;
  status: "pending" | "approved" | "rejected";
  submitted_at: string;
  reviewed_at?: string;
  rejection_reason?: string;
}

/** Map DB status to local status */
export function mapDbStatus(s: string): CoachSuggestion["status"] {
  const lower = s?.toLowerCase();
  if (lower === "pending") return "pending";
  if (lower === "acknowledged" || lower === "approved") return "approved";
  if (lower === "reverted" || lower === "rejected") return "rejected";
  return "pending";
}
