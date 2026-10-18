/* ═══════════════════════════════════════════════════════════════
   Période de non-contact (blackout_periods, /admin/blackouts) — lecture
   côté client pour le TEXTO DU RECRUTEUR (P5, décision BP 1.4.5).

   Le texto part de l'appareil du recruteur (sms:) : Nexus ne peut pas le
   bloquer au serveur. Le bouton se grise avec la date de fin, lue par
   non_contact_carte(sport, promotion) — la règle de get_active_blackout.
   Le partenaire n'est PAS visé (migration 20261017140000).
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";

const MOIS_FR = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

/** « 26 octobre 2026 ». */
export function dateLongueFr(iso: string): string {
  const [a, m, j] = iso.slice(0, 10).split("-").map(Number);
  return `${j} ${MOIS_FR[m - 1]} ${a}`;
}

export function texteNonContact(fin: string): string {
  return `Période de non-contact jusqu'au ${dateLongueFr(fin)}`;
}

/** La fin (AAAA-MM-JJ) de la période active pour ce sport et cette promotion, ou null.
 *  Promotion inconnue : toute période du sport compte. Lecture en échec : null
 *  (le bouton reste offert, comme get_active_blackout côté fiche). */
export async function lireNonContact(
  supabase: SupabaseClient,
  sportId: string,
  promotion: number | null,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("non_contact_carte", { p_sport: sportId, p_promo: promotion });
  if (error) return null;
  return (data as { date_fin: string }[] | null)?.[0]?.date_fin ?? null;
}
