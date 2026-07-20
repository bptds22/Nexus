/* ═══════════════════════════════════════════════════════════════
   social — API publique de login social NATIF (device).

   signInWithGoogle() / signInWithApple() :
   1. garantissent l'init du plugin (initSocialLogin, idempotent) ;
   2. délèguent au helper Capgo adapté (nonce + retry iOS + signInWithIdToken
      sur NOTRE client Supabase) ;
   3. après succès, font UN SEUL check de session via getSession()
      (pas de ping-pong getUser/getSession).

   Le web utilise le flow OAuth normal (supabase.auth.signInWithOAuth),
   branché côté UI — pas ici.
═══════════════════════════════════════════════════════════════ */

import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { initSocialLogin } from "@/lib/auth/socialInit";
import {
  authenticateWithGoogleSupabase,
  authenticateWithAppleSupabase,
  type SocialAuthResult,
} from "@/lib/supabase/supabaseAuthUtils";

export interface SocialSignInResult {
  success: boolean;
  error?: string;
  session?: Session | null;
}

/** Après le signInWithIdToken (fait dans le helper), un seul getSession(). */
async function finalize(r: SocialAuthResult): Promise<SocialSignInResult> {
  if (!r.success) return { success: false, error: r.error };
  const { data } = await createClient().auth.getSession();
  return { success: true, session: data.session };
}

export async function signInWithGoogle(): Promise<SocialSignInResult> {
  await initSocialLogin();
  return finalize(await authenticateWithGoogleSupabase());
}

/**
 * Apple ne renvoie givenName/familyName/email qu'au TOUT 1er login → on persiste
 * immédiatement dans public.users si absent. Le trigger handle_new_user crée la
 * ligne au signup auth (mais sans le nom Apple), donc en pratique c'est un
 * complément des champs vides ; INSERT seulement si la ligne n'existe pas.
 * maybeSingle (0 ligne = cas valide), JAMAIS single. Best-effort : un échec ne
 * bloque pas le login.
 */
async function persistAppleProfileOnce(
  userId: string,
  profile: { givenName: string | null; familyName: string | null; email: string | null },
): Promise<void> {
  try {
    const supabase = createClient();
    const { data: existing } = await supabase
      .from("users")
      .select("id, first_name, last_name, email")
      .eq("id", userId)
      .maybeSingle();

    const patch: { first_name?: string; last_name?: string; email?: string } = {};
    if (profile.givenName && !existing?.first_name) patch.first_name = profile.givenName;
    if (profile.familyName && !existing?.last_name) patch.last_name = profile.familyName;
    if (profile.email && !existing?.email) patch.email = profile.email;
    if (Object.keys(patch).length === 0) return;

    if (existing) {
      await supabase.from("users").update(patch).eq("id", userId);
    } else {
      await supabase.from("users").insert({ id: userId, ...patch });
    }
  } catch (e) {
    console.error("[social] persist Apple profile failed:", e);
  }
}

export async function signInWithApple(): Promise<SocialSignInResult> {
  await initSocialLogin();
  const r = await authenticateWithAppleSupabase();
  const result = await finalize(r);
  // Capture 1er login : persister nom/email Apple tant qu'on les a.
  if (result.success && result.session?.user && r.appleProfile) {
    await persistAppleProfileOnce(result.session.user.id, r.appleProfile);
  }
  return result;
}
