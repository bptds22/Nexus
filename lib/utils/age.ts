/* ═══════════════════════════════════════════════════════════════
   Age helpers — single source of truth for age computation
   from `athletes.date_naissance`.

   Used by:
     - /athlete/parametres (partner opt-in toggle, parental
       consent gating for minors)
     - /partenaire/* (eligibility-related UI hints)

   The DB-side equivalent for RLS lives in the
   is_partner_eligible_athlete() helper (Phase 2 migration
   20260429030000) which computes the same minor check via
   EXTRACT(YEAR FROM AGE(date_naissance)). Keep these in sync.
═══════════════════════════════════════════════════════════════ */

/** Compute current age from an ISO date string, or null if no DOB. */
export function computeAge(dateNaissance: string | null | undefined): number | null {
  if (!dateNaissance) return null;
  const dob = new Date(dateNaissance);
  if (Number.isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
  return age;
}

/** True when the athlete is under 18 (and DOB is known). False for unknown DOB. */
export function isMinor(dateNaissance: string | null | undefined): boolean {
  const age = computeAge(dateNaissance);
  return age !== null && age < 18;
}
