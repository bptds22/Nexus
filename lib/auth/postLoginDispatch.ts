/* ═══════════════════════════════════════════════════════════════
   postLoginDispatch — iter 7.46

   Logique partagée post-authentication : query du profil, vérif
   DESACTIVE, dispatch par rôle. Extraite de handleLogin desktop
   (app/auth/page.tsx:191-235) pour être réutilisée par LoginMobile
   sans duplication. Comportement EXACTEMENT identique → desktop
   intact, mobile cohérent.

   Séquence (canon DIAG 7.45 §A.3) :
     1. Query users.role, onboarding_complete, status
     2. status === DESACTIVE et role !== SUPER_ADMIN → signOut +
        /compte-desactive (AVANT tout dispatch — sécurité)
     3. !onboarding_complete → /onboarding
     4. Dispatch par rôle (COACH/RECRUTEUR/ATHLETE/ADMIN/PARTNER)
     5. Fallback inconnu → /onboarding
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { useRouter } from "next/navigation";

type Router = ReturnType<typeof useRouter>;

export type DispatchOutcome =
  | { kind: "deactivated" }
  | { kind: "onboarding" }
  | { kind: "portal"; role: string }
  | { kind: "fallback" }
  | { kind: "no-profile" };

/**
 * Effectue le dispatch post-login. Appelle router.push/replace pour rediriger.
 * Retourne un descripteur de la décision prise (pratique pour logs/test).
 *
 * NOTE : appelle supabase.auth.signOut() AVANT le redirect /compte-desactive.
 * Ce signOut est canonique et ne doit pas être dupliqué côté caller.
 */
export async function postLoginDispatch(
  supabase: SupabaseClient,
  user: User,
  router: Router,
): Promise<DispatchOutcome> {
  // 1) Query du profil
  const { data: profile } = await supabase
    .from("users")
    .select("role, onboarding_complete, status")
    .eq("id", user.id)
    .single();

  // 2) Compte désactivé (SUPER_ADMIN exempt — peut toujours intervenir)
  if (profile?.status === "DESACTIVE" && profile?.role !== "SUPER_ADMIN") {
    await supabase.auth.signOut();
    router.replace("/compte-desactive");
    return { kind: "deactivated" };
  }

  // Rôle : profil DB en priorité, fallback metadata auth (utile si le trigger
  // a lagué — improbable mais déjà géré côté desktop).
  const role = (profile?.role as string) || (user.user_metadata?.role as string);
  const onboardingComplete = profile?.onboarding_complete;

  // 3) Si profil existe explicitement et onboarding pas fini → onboarding
  //    par rôle (couvre aussi le cas profil chargé sans
  //    onboarding_complete posé).
  //    Iter 7.50-a-bis — fix DIAG 7.50-a3 §6 : avant ce sprint, ATHLETE
  //    avec onboarding_complete=false était routé sur /onboarding (le
  //    wizard COACH/RECRUTEUR 3619 LOC) qui n'a pas de branche athlète
  //    et tombait sur le fallback "coach" → cassé. Maintenant routé
  //    explicitement vers /athlete/onboarding pour atteindre
  //    AthleteOnboardingMobile (en Capacitor) ou la wizard desktop
  //    /athlete/onboarding. COACH / RECRUTEUR / ADMIN / PARTNER restent
  //    sur /onboarding — comportement actuel préservé.
  if (profile && !onboardingComplete) {
    if (role === "ATHLETE") router.push("/athlete/onboarding");
    else router.push("/onboarding");
    return { kind: "onboarding" };
  }

  // 4) Dispatch par rôle (canon desktop /auth/page.tsx:220-232)
  switch (role) {
    case "COACH":
      router.push("/coach");
      return { kind: "portal", role };
    case "RECRUTEUR":
      router.push("/recruteur");
      return { kind: "portal", role };
    case "ATHLETE":
      router.push("/athlete");
      return { kind: "portal", role };
    case "ADMIN":
      router.push("/admin");
      return { kind: "portal", role };
    case "PARTNER":
      router.push("/partenaire");
      return { kind: "portal", role };
    default:
      // 5) Inconnu / pas de profil ni metadata → /onboarding fallback
      router.push("/onboarding");
      return profile ? { kind: "fallback" } : { kind: "no-profile" };
  }
}
