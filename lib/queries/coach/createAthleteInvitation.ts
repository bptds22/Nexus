/* ═══════════════════════════════════════════════════════════════
   #48 — Helper partagé : génère (ou réutilise) le lien de claim athlète.

   Appelle la RPC create_athlete_invitation (gardes coach-propriétaire +
   orphelin côté DB ; réutilise un PENDING valide) et construit l'URL
   ${APP_URL}/claim?token=…. Consommé par la fiche athlète coach
   (app/coach/athletes/[id]/PageClient) ET l'écran de confirmation
   post-création (app/coach/athletes/create) — un seul point de vérité
   pour l'appel RPC, le mapping d'erreurs et la construction du lien.
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface AthleteInvitationLinkResult {
  /** Lien complet /claim?token=… prêt à partager (repli « copier le lien »). */
  link?: string;
  /** Message FR prêt à afficher (toast/inline) si la RPC a échoué. */
  error?: string;
  /** true quand un email a été fourni + RPC OK → le trigger a enfilé l'envoi. */
  sent?: boolean;
}

export async function createAthleteInvitationLink(
  supabase: SupabaseClient,
  athleteId: string,
  /** Si fourni : pose athlete_invitations.email → le trigger envoie l'invitation
   *  par courriel (Resend). Absent = flux copy-link inchangé. */
  email?: string,
): Promise<AthleteInvitationLinkResult> {
  const { data, error } = await supabase.rpc("create_athlete_invitation", {
    p_athlete_id: athleteId,
    ...(email ? { p_email: email } : {}),
  });

  if (error || !data) {
    const msg = error?.message || "";
    let userMsg = "Impossible de générer le lien. Réessaie.";
    // ATHLETE_UNDER_14 : zéro PII — ne révèle NI l'âge NI la DOB (Loi 25).
    if (msg.includes("ATHLETE_UNDER_14")) userMsg = "Cet athlète ne peut pas être invité.";
    else if (msg.includes("NOT_OWNER")) userMsg = "Tu n'es pas le coach propriétaire de cet athlète.";
    else if (msg.includes("ALREADY_CLAIMED")) userMsg = "Cet athlète a déjà un compte — aucune invitation nécessaire.";
    else if (msg.includes("NOT_AUTHENTICATED")) userMsg = "Session expirée — reconnecte-toi.";
    else if (msg.includes("ATHLETE_NOT_FOUND")) userMsg = "Athlète introuvable.";
    if (error) console.error("[create_athlete_invitation]", error);
    return { error: userMsg };
  }

  const token = data as string;
  const base = process.env.NEXT_PUBLIC_APP_URL
    || (typeof window !== "undefined" ? window.location.origin : "");
  return { link: `${base}/claim?token=${token}`, sent: !!email };
}
