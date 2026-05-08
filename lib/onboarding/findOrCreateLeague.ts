import { createClient } from "@/lib/supabase/client";

/* ═══════════════════════════════════════════════════════════════
   findOrCreateLeague — resolve a typed league name to an existing
   row's id, or insert a new one if no match exists.
   Used by the civil-coach onboarding step (5.4g-iv) when the user's
   chosen league name doesn't match any suggestion from the
   TeamCreateForm autocomplete.

   Race protection: the migration at
   20260507010000_unique_leagues_identity.sql adds a UNIQUE INDEX on
   (LOWER(name), sport_id, level), so two simultaneous INSERTs of
   the same normalized name are guaranteed to produce exactly one
   row. The second INSERT fails with a unique-violation; we catch
   it, re-SELECT to fetch the winning row's id, and return it as
   `created: false`.

   ILIKE caveat: case-insensitive exact-match relies on no `_`/`%`
   characters appearing in the input (those are SQL wildcards in
   ILIKE). League names with literal underscores or percent signs
   would mis-match, but in practice civil league names don't contain
   those. If that ever becomes an issue, switch to
   `.eq("name", input)` after upstream normalization OR call a
   server-side RPC that uses `lower(name) = lower($input)`.
═══════════════════════════════════════════════════════════════ */

export interface FindOrCreateLeagueInput {
  name: string;
  sportId: string;
  level?: string;
}

export interface FindOrCreateLeagueResult {
  id: string;
  name: string;
  created: boolean;
}

export async function findOrCreateLeague({
  name,
  sportId,
  level = "Civil",
}: FindOrCreateLeagueInput): Promise<FindOrCreateLeagueResult> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("League name is required");
  if (!sportId) throw new Error("sportId is required");

  const supabase = createClient();

  // 1. Try to find an existing row with case-insensitive exact match.
  const existing = await supabase
    .from("leagues")
    .select("id, name")
    .ilike("name", trimmed)
    .eq("sport_id", sportId)
    .eq("level", level)
    .maybeSingle();

  if (existing.data) {
    return { id: existing.data.id as string, name: existing.data.name as string, created: false };
  }

  // 2. Insert. If the UNIQUE index catches a race-condition twin
  //    that landed milliseconds before us, fall through to step 3.
  const inserted = await supabase
    .from("leagues")
    .insert({ name: trimmed, sport_id: sportId, level })
    .select("id, name")
    .single();

  if (inserted.data) {
    return { id: inserted.data.id as string, name: inserted.data.name as string, created: true };
  }

  // 3. INSERT failed — most likely a UNIQUE-violation race. Re-SELECT
  //    so the caller still gets a usable id rather than an opaque error.
  const retry = await supabase
    .from("leagues")
    .select("id, name")
    .ilike("name", trimmed)
    .eq("sport_id", sportId)
    .eq("level", level)
    .maybeSingle();

  if (retry.data) {
    return { id: retry.data.id as string, name: retry.data.name as string, created: false };
  }

  const errMsg = inserted.error?.message ?? retry.error?.message ?? "unknown error";
  throw new Error(`findOrCreateLeague failed for "${trimmed}": ${errMsg}`);
}
