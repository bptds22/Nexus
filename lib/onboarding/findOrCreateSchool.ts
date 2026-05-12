import type { SupabaseClient } from "@supabase/supabase-js";
import type { SchoolType } from "@/lib/utils/orgLabel";

/* ═══════════════════════════════════════════════════════════════
   findOrCreateSchool — resolve a typed school/league name to an
   existing schools row (matching by lower(name) + type), or insert
   a new one if no match exists.

   Phase 6.2 replacement for findOrCreateLeague — the civil-league
   wizard step now stores leagues as schools rows with
   type='LIGUE_CIVILE' per the unified model from Phase 6.1.

   Match key: case-insensitive name + type. The DB unique index
   `schools_name_city_unique` (lower(name), coalesce(lower(city),''))
   prevents cross-city dupes but allows two schools with the same
   name in different cities; for civil leagues we typically pass
   city=null and rely on (lower(name), type) being practically
   unique within LIGUE_CIVILE.

   ILIKE caveat: case-insensitive exact-match relies on no `_`/`%`
   characters appearing in the input (those are SQL wildcards in
   ILIKE). League/school names in practice don't contain those.
═══════════════════════════════════════════════════════════════ */

export interface FindOrCreateSchoolResult {
  id: string;
  name: string;
  created: boolean;
}

export async function findOrCreateSchool(
  supabase: SupabaseClient,
  name: string,
  type: SchoolType,
  city: string | null = null,
  region: string | null = "Québec",
): Promise<FindOrCreateSchoolResult> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("School/league name is required");

  // 1. Try to find an existing row with case-insensitive exact name + type.
  const existing = await supabase
    .from("schools")
    .select("id, name")
    .ilike("name", trimmed)
    .eq("type", type)
    .maybeSingle();

  if (existing.data) {
    return {
      id: existing.data.id as string,
      name: existing.data.name as string,
      created: false,
    };
  }

  // 2. Insert. If the schools_name_city_unique index catches a race
  //    we fall through to step 3.
  const inserted = await supabase
    .from("schools")
    .insert({ name: trimmed, type, city, region })
    .select("id, name")
    .single();

  if (inserted.data) {
    return {
      id: inserted.data.id as string,
      name: inserted.data.name as string,
      created: true,
    };
  }

  // 3. INSERT failed — most likely a UNIQUE-violation race. Re-SELECT
  //    so the caller still gets a usable id.
  const retry = await supabase
    .from("schools")
    .select("id, name")
    .ilike("name", trimmed)
    .eq("type", type)
    .maybeSingle();

  if (retry.data) {
    return {
      id: retry.data.id as string,
      name: retry.data.name as string,
      created: false,
    };
  }

  const errMsg = inserted.error?.message ?? retry.error?.message ?? "unknown error";
  throw new Error(`findOrCreateSchool failed for "${trimmed}": ${errMsg}`);
}
