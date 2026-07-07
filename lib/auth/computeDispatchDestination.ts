/* ═══════════════════════════════════════════════════════════════
   computeDispatchDestination — routing post-auth, PUR (zéro side-effect).

   Source unique de la décision « où envoyer l'utilisateur après auth »,
   partagée entre :
     - postLoginDispatch (client, email/pw + login) → fait le router.push
     - app/auth/callback/route.ts (server, OAuth) → fait NextResponse.redirect

   NE fait AUCUN appel réseau / signOut / navigation : prend le profil déjà
   chargé + les user_metadata, retourne { path, reason }. Les side-effects
   (query, signOut du compte désactivé, redirect) restent chez l'appelant.

   Logique reprise VERBATIM de postLoginDispatch (iter 7.46 / 7.50-a-bis) :
     1. DESACTIVE (hors SUPER_ADMIN) → /compte-desactive
     2. consent Loi 25 manquant + onboarding non fini → /consentements
     3. onboarding non fini → /athlete/onboarding (athlète) | /onboarding
     4. dispatch par rôle → /coach /recruteur /athlete /admin /partenaire
     5. inconnu / pas de profil → /onboarding (fallback)
═══════════════════════════════════════════════════════════════ */

import { needsConsent } from "@/lib/auth/needsConsent";

export interface DispatchProfile {
  role: string | null;
  onboarding_complete: boolean | null;
  status: string | null;
  privacy_preferences: unknown;
}

export type DispatchReason =
  | "deactivated"
  | "consent"
  | "onboarding"
  | "portal"
  | "fallback"
  | "no-profile";

export interface DispatchDestination {
  /** Chemin de redirection (toujours un path relatif, ex. "/athlete/onboarding"). */
  path: string;
  reason: DispatchReason;
  /** Présent quand reason === "portal". */
  role?: string;
}

export function computeDispatchDestination(
  profile: DispatchProfile | null,
  userMetadata: Record<string, unknown> | undefined,
): DispatchDestination {
  // 1) Compte désactivé (SUPER_ADMIN exempt). Le signOut est fait par l'appelant.
  if (profile?.status === "DESACTIVE" && profile?.role !== "SUPER_ADMIN") {
    return { path: "/compte-desactive", reason: "deactivated" };
  }

  // Rôle : profil DB en priorité, fallback metadata auth (trigger lagué).
  const role = (profile?.role as string) || (userMetadata?.role as string);
  const onboardingComplete = profile?.onboarding_complete;

  // 2) Consentements Loi 25 manquants + onboarding non fini → interstitiel.
  //    JAMAIS pour un compte déjà onboardé (protège les comptes legacy).
  if (profile && !onboardingComplete && needsConsent(profile.privacy_preferences, userMetadata)) {
    return { path: "/consentements", reason: "consent" };
  }

  // 3) Onboarding non fini → wizard par rôle.
  if (profile && !onboardingComplete) {
    return {
      path: role === "ATHLETE" ? "/athlete/onboarding" : "/onboarding",
      reason: "onboarding",
    };
  }

  // 4) Dispatch par rôle.
  switch (role) {
    case "COACH": return { path: "/coach", reason: "portal", role };
    case "RECRUTEUR": return { path: "/recruteur", reason: "portal", role };
    case "ATHLETE": return { path: "/athlete", reason: "portal", role };
    case "ADMIN": return { path: "/admin", reason: "portal", role };
    case "PARTNER": return { path: "/partenaire", reason: "portal", role };
    // 5) Inconnu / pas de profil → /onboarding fallback.
    default: return { path: "/onboarding", reason: profile ? "fallback" : "no-profile" };
  }
}
