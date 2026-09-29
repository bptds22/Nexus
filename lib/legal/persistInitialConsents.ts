/* ═══════════════════════════════════════════════════════════════
   persistInitialConsents — iter 7.53 (Loi 25 dette signup)
                          → iter 7.50-a-bis (extension parental)

   Au signUp, l'utilisateur coche des consentements. DIAG 7.45 §B.3
   révèle qu'ils restent en state local et ne sont JAMAIS écrits en DB
   → trou de conformité Loi 25.

   Ce helper écrit dans users.privacy_preferences (JSONB, mêmes clés
   que /recruteur/parametres > Confidentialité — DIAG 7.38) :
     RGPD/Loi 25 user-level (7.53, desktop /auth):
     - consent_privacy_policy            : ISO timestamp ou null
     - consent_data_collection           : idem
     - consent_marketing                 : idem (optionnel)
     Parental (7.50-a-bis, signup mobile athlète) — OPTIONNELS, écrits
     uniquement si la clé est passée :
     - consent_parental_profile          : autorisation parentale
                                            création du profil athlète
     - consent_parental_visibility       : autorisation parentale
                                            visibilité recruteurs CÉGEP
     - consent_parental_partner_visibility : autorisation parentale
                                              partner_visibility (opt)

   Garde-fou anti-écrasement (COALESCE) : si la clé existe déjà, on ne
   la touche pas — protège un re-signup qui aurait des timestamps plus
   anciens valides (preuve légale du first consent). Vaut pour TOUTES
   les clés, anciennes comme nouvelles.

   Combo DIAG 7.45 §2 approuvé :
   - extraMetadata (auth.users.raw_user_meta_data) = traçabilité garantie
   - UPDATE app-side ici = queryabilité via privacy_preferences
   Si l'UPDATE échoue silencieusement (RLS edge case session-less),
   la trace reste dans raw_user_meta_data pour reconciliation future.

   ⚠️ Rétro-compatibilité : les appelants existants (qui ne passent que
   policy/data/marketing) continuent à fonctionner sans changement. Les
   clés parentales sont optionnelles — si non passées, aucune écriture.

   ⚠️ Loi 25 — la PII parent (parent_first_name, parent_email, etc.) NE
   VA PAS ici. users.privacy_preferences est user-level (consents) ; la
   PII parent appartient aux colonnes athletes.parent_* et passe par
   buildConsentMetadata() pour stash dans raw_user_meta_data jusqu'au
   submit de l'onboarding.
═══════════════════════════════════════════════════════════════ */

import { createClient } from "@/lib/supabase/client";

export interface InitialConsentFlags {
  /** politique de confidentialité + conditions */
  policy: boolean;
  /** avis collecte de données personnelles */
  data: boolean;
  /** marketing emails (optionnel — peut être false sans bloquer) */
  marketing: boolean;
  /** Iter 7.50-a-bis — autorisation parentale création profil athlète
      (mandatoire au signup mobile athlète, mineur). */
  parentalProfile?: boolean;
  /** Iter 7.50-a-bis — autorisation parentale visibilité recruteurs CÉGEP
      (mandatoire au signup mobile athlète, mineur). */
  parentalVisibility?: boolean;
  /** Iter 7.50-a-bis — autorisation parentale partner_visibility (optionnel).
      Libellé = partnerResponsibilityText() (lib/legal/partnerMediaCopy.ts),
      responsabilité partagée Nexus/partenaire. */
  parentalPartnerVisibility?: boolean;
}

/** Iter 7.50-a-bis — PII parent capturée au signup mobile, stashée dans
    auth.users.raw_user_meta_data via buildConsentMetadata(). Au submit
    de l'onboarding (création/update athletes row), ces champs sont
    re-lus et écrits dans les colonnes dédiées athletes.parent_*. */
export interface ParentPII {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  relationship?: string;
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

  // Iter 7.50-a-bis additive — clés parentales optionnelles. On ne
  // touche QUE si le flag est explicitement true ET la clé absente
  // (même COALESCE anti-écrasement que les 3 RGPD). Si parentalProfile
  // est undefined ou false, aucune écriture — rétro-compat parfaite.
  if (consents.parentalProfile && (existing.consent_parental_profile == null)) {
    next.consent_parental_profile = now;
    changed = true;
  }
  if (consents.parentalVisibility && (existing.consent_parental_visibility == null)) {
    next.consent_parental_visibility = now;
    changed = true;
  }
  if (consents.parentalPartnerVisibility && (existing.consent_parental_partner_visibility == null)) {
    next.consent_parental_partner_visibility = now;
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
 *
 * Iter 7.50-a-bis (additif, rétro-compatible) :
 * - Le 2e paramètre `parent` (optionnel) stash la PII parent dans
 *   raw_user_meta_data pour que l'onboarding submit la re-lise et
 *   l'écrive dans athletes.parent_* sans re-demander au user. Si
 *   `parent` n'est pas passé, aucun champ parent_* n'est ajouté à
 *   la metadata (rétro-compat avec /auth desktop).
 * - Les clés parentales (3 timestamps) sont ajoutées seulement si les
 *   flags correspondants existent sur `consents`. Les appelants
 *   existants (3 clés RGPD) reçoivent toujours le même objet à 3 clés.
 */
export function buildConsentMetadata(
  consents: InitialConsentFlags,
  parent?: ParentPII,
): Record<string, string | null> {
  const now = new Date().toISOString();
  const meta: Record<string, string | null> = {
    consent_privacy_policy: consents.policy ? now : null,
    consent_data_collection: consents.data ? now : null,
    consent_marketing: consents.marketing ? now : null,
  };

  // Clés parentales — ajoutées UNIQUEMENT si le flag est explicitement
  // passé (undefined = clé absente de la metadata, pas de trace nulle).
  if (consents.parentalProfile !== undefined) {
    meta.consent_parental_profile = consents.parentalProfile ? now : null;
  }
  if (consents.parentalVisibility !== undefined) {
    meta.consent_parental_visibility = consents.parentalVisibility ? now : null;
  }
  if (consents.parentalPartnerVisibility !== undefined) {
    meta.consent_parental_partner_visibility = consents.parentalPartnerVisibility ? now : null;
  }

  // PII parent — stashée dans raw_user_meta_data pour re-lecture au
  // submit onboarding. Chaque champ est ajouté seulement si défini ;
  // string vide → null pour cohérence avec les colonnes athletes.
  if (parent) {
    if (parent.firstName !== undefined) meta.parent_first_name = parent.firstName.trim() || null;
    if (parent.lastName !== undefined) meta.parent_last_name = parent.lastName.trim() || null;
    if (parent.email !== undefined) meta.parent_email = parent.email.trim() || null;
    if (parent.phone !== undefined) meta.parent_phone = parent.phone.trim() || null;
    if (parent.relationship !== undefined) meta.parent_relationship = parent.relationship || null;
  }

  return meta;
}
