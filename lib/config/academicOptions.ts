/* ═══════════════════════════════════════════════════════════════
   Shared academic option lists.

   One source of truth for the athlete-side academic chip surfaces
   (athlete onboarding step 2, athlete profile edit, mobile editor
   AcademiqueStep). Keeping these constants here prevents drift —
   adding a new "Mention" must propagate everywhere automatically.

   Conventions :
     - String literals are stored in the JSONB columns verbatim
       (matieres_fortes / mentions_academiques / regions_cegep_preferees).
       Changing one of these strings is a DATA migration, not a UI tweak.
     - PROGRAMME_TYPE_OPTIONS drives the Programme visé picker ;
       the stored shape in programme_cegep_vise mirrors onboarding's
       assembly logic (see usage in AthleteEditWizardMobile.tsx).
═══════════════════════════════════════════════════════════════ */

export const SUBJECTS: readonly string[] = [
  "Éducation physique", "Mathématiques", "Sciences", "Français",
  "Anglais", "Histoire", "Arts", "Informatique",
] as const;

export const HONORS: readonly string[] = [
  "Tableau d'honneur",
  "Bourse sportive",
  "Étudiant-athlète de l'année",
  "Mention du directeur",
] as const;

export const CEGEP_REGIONS: readonly string[] = [
  "Montréal", "Québec", "Laurentides", "Lanaudière",
  "Montérégie", "Outaouais", "Estrie", "Sherbrooke",
] as const;

/** Programme CÉGEP visé — picker option values.
 *  Stored in programme_cegep_vise as a 1-element array containing
 *  either "DEC général" or "Technique — <detail>" / "Programme technique".
 *  See AthleteEditWizardMobile.tsx (mobile assembly) and
 *  app/athlete/onboarding/page.tsx (onboarding assembly) for the
 *  shared serialization helper. */
export const PROGRAMME_TYPE_OPTIONS: readonly { value: string; label: string }[] = [
  { value: "dec_general", label: "DEC général" },
  { value: "technique",   label: "Programme technique" },
] as const;

/** Encode a (type, optional technique-detail) pair into the array
 *  shape stored in athletes.programme_cegep_vise. Mirrors the inline
 *  IIFE in onboarding/page.tsx around line 825 — extracted so the
 *  mobile editor + onboarding cannot drift. */
export function programmeCegepArray(type: string, detail: string): string[] {
  if (type === "dec_general") return ["DEC général"];
  if (type === "technique" && detail.trim()) return [`Technique — ${detail.trim()}`];
  if (type === "technique") return ["Programme technique"];
  return [];
}

/** Decode a stored programme_cegep_vise array back into (type, detail)
 *  for seeding the mobile editor's picker + input. */
export function programmeCegepDecode(arr: string[] | null | undefined): { type: string; detail: string } {
  if (!arr || arr.length === 0) return { type: "", detail: "" };
  const v = arr[0];
  if (v === "DEC général") return { type: "dec_general", detail: "" };
  if (v === "Programme technique") return { type: "technique", detail: "" };
  if (v.startsWith("Technique — ")) return { type: "technique", detail: v.slice("Technique — ".length) };
  return { type: "", detail: "" };
}
