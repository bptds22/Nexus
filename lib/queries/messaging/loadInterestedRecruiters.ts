/* ═══════════════════════════════════════════════════════════════
   loadInterestedRecruiters — recruiters who favorited one of the
   caller-coach's athletes (via the list_interested_recruiters RPC,
   migration 20260723130000). Grouped by recruiter, each with the
   favorited athletes the coach may anchor a message on.

   Favoris-symmetric ONLY : no CÉGEP browsing. A coach can only open a
   RECRUTEUR_COACH toward a recruiter who favorited the anchor athlete.
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface InterestedAthlete { id: string; name: string; }
export interface InterestedRecruiter {
  recruiterId: string;
  name: string;
  photoUrl: string | null;
  cegep: string;
  athletes: InterestedAthlete[];
}

export async function loadInterestedRecruiters(
  supabase: SupabaseClient,
): Promise<InterestedRecruiter[]> {
  const { data, error } = await supabase.rpc("list_interested_recruiters");
  if (error || !data) return [];

  const map = new Map<string, InterestedRecruiter>();
  for (const row of data as Record<string, unknown>[]) {
    const rid = row.recruiter_id as string;
    if (!rid) continue;
    if (!map.has(rid)) {
      const rf = (row.recruiter_first as string) || "";
      const rl = (row.recruiter_last as string) || "";
      map.set(rid, {
        recruiterId: rid,
        name: `${rf} ${rl}`.trim() || "Recruteur",
        photoUrl: (row.recruiter_photo as string) || null,
        cegep: (row.cegep_name as string) || "",
        athletes: [],
      });
    }
    const aid = row.athlete_id as string;
    if (aid && !map.get(rid)!.athletes.some((a) => a.id === aid)) {
      const af = (row.athlete_first as string) || "";
      const al = (row.athlete_last as string) || "";
      map.get(rid)!.athletes.push({ id: aid, name: `${af} ${al}`.trim() || "Athlète" });
    }
  }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "fr"));
}
