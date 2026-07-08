/* ═══════════════════════════════════════════════════════════════
   postLoginDispatch — iter 7.46 (refactor item 3.5)

   Logique partagée post-authentication : query du profil, vérif
   DESACTIVE, dispatch par rôle. Extraite de handleLogin desktop pour
   être réutilisée par LoginMobile sans duplication.

   Item 3.5 — la DÉCISION de routing est désormais dans la util pure
   computeDispatchDestination (partagée avec le callback OAuth server-side).
   Ici on garde UNIQUEMENT les side-effects : query profil, signOut du
   compte désactivé, et le router.push/replace. Comportement observable
   strictement identique.
═══════════════════════════════════════════════════════════════ */

import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { useRouter } from "next/navigation";
import {
  computeDispatchDestination,
  type DispatchProfile,
} from "@/lib/auth/computeDispatchDestination";

type Router = ReturnType<typeof useRouter>;

export type DispatchOutcome =
  | { kind: "deactivated" }
  | { kind: "consent" }
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
  // 1) Query du profil.
  const { data: profile } = await supabase
    .from("users")
    .select("role, onboarding_complete, status, privacy_preferences")
    .eq("id", user.id)
    .single();

  // 2) Décision de routing (pure, source unique).
  const dest = computeDispatchDestination(
    (profile as DispatchProfile) ?? null,
    user.user_metadata as Record<string, unknown> | undefined,
  );

  // 3) Compte désactivé : signOut AVANT le redirect (canonique). router.replace.
  if (dest.reason === "deactivated") {
    await supabase.auth.signOut();
    router.replace(dest.path);
    return { kind: "deactivated" };
  }

  // 4) Tous les autres cas : router.push vers la destination calculée.
  router.push(dest.path);
  switch (dest.reason) {
    case "consent": return { kind: "consent" };
    case "onboarding": return { kind: "onboarding" };
    case "portal": return { kind: "portal", role: dest.role ?? "" };
    case "no-profile": return { kind: "no-profile" };
    case "fallback":
    default: return { kind: "fallback" };
  }
}
