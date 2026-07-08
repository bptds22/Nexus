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
  if (!birthdate) return false;
  const [yStr, mStr, dStr] = birthdate.split("-");
  const y = parseInt(yStr, 10);
  const m = parseInt(mStr, 10);
  const d = parseInt(dStr, 10);
  if (!y || !m || !d) return false;
  let age = today.getFullYear() - y;
  // Anniversaire pas encore atteint cette année → retirer 1 an.
  const monthDiff = today.getMonth() + 1 - m;
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d)) age -= 1;
  return age >= 18;
}
