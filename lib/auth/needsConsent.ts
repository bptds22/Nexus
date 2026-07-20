/* ═══════════════════════════════════════════════════════════════
   needsConsent — logique UNIQUE du gate /consentements (BLOC 3B)

   Le consentement Loi 25 est considéré PRÉSENT si l'une OU l'autre de
   ces sources porte `consent_privacy_policy` non-null :
     - users.privacy_preferences  (écrit par persistInitialConsents)
     - auth user_metadata          (écrit par updateUser au submit)

   Le double signal est un hardening anti-boucle : même si l'UPDATE
   app-side de privacy_preferences échoue, la trace fiable dans
   raw_user_meta_data suffit → pas de re-redirection vers /consentements.

   ⚠️ Le gate combine TOUJOURS needsConsent() AVEC !onboarding_complete
   côté appelant — un compte déjà onboardé ne voit JAMAIS l'interstitiel
   (ne pas aspirer les comptes legacy sans consent).

   Params en `unknown` : utilisable côté client (postLoginDispatch, pages)
   comme serveur (auth/callback) sans cast au point d'appel.
═══════════════════════════════════════════════════════════════ */

function consentTimestamp(bag: unknown): unknown {
  if (bag && typeof bag === "object") {
    return (bag as Record<string, unknown>)["consent_privacy_policy"];
  }
  return null;
}

/** true si AUCUNE des deux sources ne porte consent_privacy_policy. */
export function needsConsent(privacyPreferences: unknown, userMetadata: unknown): boolean {
  return consentTimestamp(privacyPreferences) == null
      && consentTimestamp(userMetadata) == null;
}
