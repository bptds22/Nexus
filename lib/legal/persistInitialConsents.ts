/* ═══════════════════════════════════════════════════════════════
   persistInitialConsents — iter 7.53 (Loi 25 dette signup)

   Au signUp, l'utilisateur coche 1-3 consentements (politique de
   confidentialité, avis collecte de données, marketing). DIAG 7.45
   §B.3 révèle qu'ils restent en state local et ne sont JAMAIS écrits
   en DB → trou de conformité Loi 25.

   Ce helper écrit dans users.privacy_preferences (JSONB, mêmes clés
   que /recruteur/parametres > Confidentialité — DIAG 7.38) :
     - consent_privacy_policy   : ISO timestamp ou laissé en place
     - consent_data_collection  : idem
     - consent_marketing        : idem (peut rester null)

   Garde-fou anti-écrasement (COALESCE) : si la clé existe déjà,
   on ne la touche pas — protège un re-signup qui aurait des
   timestamps plus anciens valides (preuve légale du first consent).

   Combo DIAG 7.45 §2 approuvé :
   - extraMetadata (auth.users.raw_user_meta_data) = traçabilité garantie
   - UPDATE app-side ici = queryabilité via privacy_preferences
   Si l'UPDATE échoue silencieusement (RLS edge case session-less),
   la trace reste dans raw_user_meta_data pour reconciliation future.
═══════════════════════════════════════════════════════════════ */

import { createClient } from "@/lib/supabase/client";

export interface InitialConsentFlags {
  /** politique de confidentialité + conditions */
  policy: boolean;
  /** avis collecte de données personnelles */
  data: boolean;
  /** marketing emails (optionnel — peut être false sans bloquer) */
  marketing: boolean;
}

export interface PersistResult {
  ok: boolean;
  /** raison de l'échec (read OR write) */
  error?: string;
  /** vrai si on a effectivement modifié au moins une clé (sinon row déjà à jour) */
  changed?: boolean;
}

/**
 * Tente d'écrire les 3 consents signup dans users.privacy_preferences.
 * Best-effort : un fail (RLS, network, row pas encore créée par le trigger)
 * n'est pas bloquant pour le UX du signup — la trace reste dans
 * raw_user_meta_data via extraMetadata.
 */
export async function persistInitialConsents(
  userId: string,
  consents: InitialConsentFlags,
): Promise<PersistResult> {
  if (!userId) return { ok: false, error: "userId manquant" };
  const supabase = createClient();
  const now = new Date().toISOString();

  // 1) Read existing privacy_preferences (la row a été créée par le trigger
  //    handle_new_auth_user juste avant ce call).
  const { data, error: readErr } = await supabase
    .from("users")
    .select("privacy_preferences")
    .eq("id", userId)
    .maybeSingle();

  if (readErr) {
    return { ok: false, error: `read: ${readErr.message}` };
  }

  const existing = (data?.privacy_preferences ?? {}) as Record<string, unknown>;

  // 2) COALESCE anti-écrasement : on ne pose que si la clé est ABSENTE
  //    ou null. Si l'utilisateur a déjà une date (re-signup, edge case),
  //    on garde la date plus ancienne (preuve légale du first consent).
  const next: Record<string, unknown> = { ...existing };
  let changed = false;

  if (consents.policy && (existing.consent_privacy_policy == null)) {
    next.consent_privacy_policy = now;
    changed = true;
  }
  if (consents.data && (existing.consent_data_collection == null)) {
    next.consent_data_collection = now;
    changed = true;
  }
  if (consents.marketing && (existing.consent_marketing == null)) {
    next.consent_marketing = now;
    changed = true;
  }

  if (!changed) {
    return { ok: true, changed: false };
  }

  // 3) Écriture
  const { error: writeErr } = await supabase
    .from("users")
    .update({ privacy_preferences: next })
    .eq("id", userId);

  if (writeErr) {
    return { ok: false, error: `write: ${writeErr.message}` };
  }

  return { ok: true, changed: true };
}

/**
 * Construit le sous-objet extraMetadata à passer à signUp() pour la
 * traçabilité auth.users.raw_user_meta_data. Toujours envoyé, même si
 * l'UPDATE app-side échoue → preuve Loi 25 préservée.
 */
export function buildConsentMetadata(consents: InitialConsentFlags): Record<string, string | null> {
  const now = new Date().toISOString();
  return {
    consent_privacy_policy: consents.policy ? now : null,
    consent_data_collection: consents.data ? now : null,
    consent_marketing: consents.marketing ? now : null,
  };
}
