/* ─────────────────────────────────────────────────────────────────
   Monthly re-validation helpers.
   - isValidationDue: athlete is verified AND last_profile_validation
     predates the 1st of the current month.
   - isValidationExpired: DUE and we're past the 15th — at this point
     the verified badge is considered deactivated.
───────────────────────────────────────────────────────────────── */

interface Pair {
  verified: boolean | null | undefined;
  last_profile_validation: string | Date | null | undefined;
}

function firstOfCurrentMonth(ref: Date = new Date()): Date {
  const d = new Date(ref.getFullYear(), ref.getMonth(), 1, 0, 0, 0, 0);
  return d;
}

function toDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isValidationDue(athlete: Pair, now: Date = new Date()): boolean {
  if (!athlete?.verified) return false;
  const last = toDate(athlete.last_profile_validation);
  if (!last) return true;
  return last.getTime() < firstOfCurrentMonth(now).getTime();
}

export function isValidationExpired(athlete: Pair, now: Date = new Date()): boolean {
  if (!isValidationDue(athlete, now)) return false;
  return now.getDate() > 15;
}

/** Returns the grace-period end date (the 15th of the current month). */
export function validationDeadline(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), 15, 23, 59, 59, 999);
}

/** Formats the deadline date as "15 avril" etc. */
export function formatDeadlineFr(now: Date = new Date()): string {
  const d = validationDeadline(now);
  const months = [
    "janvier", "février", "mars", "avril", "mai", "juin",
    "juillet", "août", "septembre", "octobre", "novembre", "décembre",
  ];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

/** "YYYY-MM" for the current month — used as metadata dedupe key. */
export function currentMonthKey(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}
