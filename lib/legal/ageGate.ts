/* ═══════════════════════════════════════════════════════════════
   ageGate — isAdult partagé (Loi 25, seuil majorité Québec = 18 ans).

   Extrait de SignupMobile (iter age-gate §A) pour être partagé par
   l'interstitiel /consentements et le signup. Tout user < 18 ans
   déclenche le bloc parental requis.
═══════════════════════════════════════════════════════════════ */

/** Calcule si l'utilisateur est majeur (18 ans). Compare année + mois +
 *  jour (pas juste l'année). Retourne false si la string est vide, mal
 *  formée, ou la date future. ISO "YYYY-MM-DD". */
export function isAdult(birthdate: string, today: Date = new Date()): boolean {
  const age = computeAgeFromISO(birthdate, today);
  return age !== null && age >= 18;
}

/** Âge révolu depuis une ISO "YYYY-MM-DD", ou null si vide/mal formée.
 *  Parse par découpage de string (pas `new Date(iso)`, qui est UTC et
 *  décale le jour d'un cran en zone négative comme le Québec, UTC-5). */
function computeAgeFromISO(birthdate: string, today: Date = new Date()): number | null {
  if (!birthdate) return null;
  const [yStr, mStr, dStr] = birthdate.split("-");
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const d = parseInt(dStr, 10);
  if (!y || !m || !d) return null;
  let age = today.getFullYear() - y;
  // Anniversaire pas encore atteint cette année → retirer 1 an.
  const monthDiff = today.getMonth() + 1 - m;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d)) age -= 1;
  return age;
}

/** Seuil plancher du self-signup (Loi 25) : sous 14 ans, seul le titulaire
 *  de l'autorité parentale peut consentir → l'auto-inscription est refusée. */
export const MIN_SIGNUP_AGE = 14;

/** True si l'utilisateur a strictement moins de 14 ans (DOB connue). False
 *  pour une DOB vide/mal formée (le champ requis gère le cas vide). */
export function isUnder14(birthdate: string, today: Date = new Date()): boolean {
  const age = computeAgeFromISO(birthdate, today);
  return age !== null && age < MIN_SIGNUP_AGE;
}

/** ISO "YYYY-MM-DD" de la date de naissance la PLUS RÉCENTE respectant un âge
 *  minimum (aujourd'hui − minYears). À poser en `max` d'un input date pour
 *  interdire de choisir une DOB plus jeune que minYears. */
export function maxBirthdateForAge(minYears: number, today: Date = new Date()): string {
  return isoDate(today.getFullYear() - minYears, today.getMonth(), today.getDate());
}

/** ISO "YYYY-MM-DD" plancher de plausibilité (aujourd'hui − maxYears, def. 100).
 *  À poser en `min` d'un input date. */
export function minBirthdateForAge(maxYears = 100, today: Date = new Date()): string {
  return isoDate(today.getFullYear() - maxYears, today.getMonth(), today.getDate());
}

function isoDate(year: number, monthIdx: number, day: number): string {
  const mm = String(monthIdx + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}
