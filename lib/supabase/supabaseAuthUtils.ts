/* ═══════════════════════════════════════════════════════════════
   supabaseAuthUtils — login natif Google/Apple (device) échangé avec
   Supabase Auth via signInWithIdToken.

   Adapté du helper OFFICIEL Capgo (example-app/src/supabaseAuthUtils.ts) :
   https://capgo.app/docs/plugins/social-login/supabase/google/general/
   https://supabase.com/docs/guides/auth/social-login/auth-apple

   Adaptations Nexus :
   - réutilise NOTRE client Supabase singleton (lib/supabase/client.ts),
     PAS un 2e client ;
   - les client IDs viennent d'env vars (NEXT_PUBLIC_*), pas des
     placeholders de l'exemple.

   ⚠️ La crypto du nonce (rawNonce pour Supabase, nonceDigest SHA-256
   hex pour le provider) et le retry sur cache iOS sont gardés VERBATIM
   du helper Capgo — ne pas hand-coder.

   Périmètre : flow NATIF (device). Le web utilise le flow OAuth normal
   (supabase.auth.signInWithOAuth) — branché côté UI, pas ici.
═══════════════════════════════════════════════════════════════ */

import {
  SocialLogin,
  type GoogleLoginOptions,
  type GoogleLoginResponseOnline,
  type AppleProviderResponse,
} from "@capgo/capacitor-social-login";
import { createClient } from "@/lib/supabase/client";

/* ── Client IDs (Google Cloud) — pour la validation d'audience du JWT.
   L'init du plugin (avec ces IDs) est centralisée dans lib/auth/socialInit. ── */
const GOOGLE_WEB_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
const GOOGLE_IOS_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";

export interface SocialAuthResult {
  success: boolean;
  error?: string;
  user?: unknown;
  /** Apple ne renvoie nom/email qu'au TOUT 1er login → remonté pour persistance. */
  appleProfile?: { givenName: string | null; familyName: string | null; email: string | null };
}

/* ── Nonce (VERBATIM Capgo — ne pas modifier la crypto) ─────────── */

/** Nonce URL-safe aléatoire. */
function getUrlSafeNonce(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 hex d'une string. */
async function sha256Hash(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Paire de nonces : rawNonce (→ Supabase) et nonceDigest (→ Google).
 * Supabase re-hashe rawNonce et compare au nonceDigest présent dans l'ID token.
 */
async function getNonce(): Promise<{ rawNonce: string; nonceDigest: string }> {
  const rawNonce = getUrlSafeNonce();
  const nonceDigest = await sha256Hash(rawNonce);
  return { rawNonce, nonceDigest };
}

/** Décode le payload d'un JWT (sanity check uniquement). */
function decodeJWT(token: string): Record<string, unknown> | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    return JSON.parse(jsonPayload) as Record<string, unknown>;
  } catch (error) {
    console.error("Error decoding JWT:", error);
    return null;
  }
}

const VALID_GOOGLE_CLIENT_IDS = [GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID].filter(Boolean);

/** Sanity check : audience ∈ client IDs valides + nonce == nonceDigest. */
function validateJWTToken(idToken: string, expectedNonceDigest: string): { valid: boolean; error?: string } {
  const decoded = decodeJWT(idToken);
  if (!decoded) return { valid: false, error: "Failed to decode JWT token" };

  const audience = decoded.aud as string | undefined;
  if (!audience || !VALID_GOOGLE_CLIENT_IDS.includes(audience)) {
    return { valid: false, error: `Invalid audience. Got ${audience}` };
  }
  const tokenNonce = decoded.nonce as string | undefined;
  if (tokenNonce && tokenNonce !== expectedNonceDigest) {
    return { valid: false, error: `Nonce mismatch` };
  }
  return { valid: true };
}

/* ── Google (natif device) ──────────────────────────────────────
   @param retry — si false et sanity check KO → logout + 1 retry (cache iOS). */
export async function authenticateWithGoogleSupabase(retry: boolean = false): Promise<SocialAuthResult> {
  try {
    const { rawNonce, nonceDigest } = await getNonce();

    // Init du plugin centralisée (lib/auth/socialInit) — pas de ré-init ici.
    const response = await SocialLogin.login({
      provider: "google",
      options: {
        scopes: ["email", "profile"],
        nonce: nonceDigest, // nonce HASHÉ (SHA-256 hex) → Google
      } as GoogleLoginOptions,
    });

    if (response.result.responseType !== "online") {
      return { success: false, error: "Offline mode not supported. Please use online mode." };
    }
    const googleResponse = response.result as GoogleLoginResponseOnline;
    if (!googleResponse.idToken) {
      return { success: false, error: "Failed to get Google ID token" };
    }

    // Sanity check (audience + nonce). KO + pas encore retry → logout + retry 1×.
    const validation = validateJWTToken(googleResponse.idToken, nonceDigest);
    if (!validation.valid) {
      console.warn("JWT validation failed:", validation.error);
      if (!retry) {
        try { await SocialLogin.logout({ provider: "google" }); } catch (e) { console.error("logout error:", e); }
        return authenticateWithGoogleSupabase(true);
      }
      return { success: false, error: validation.error || "JWT validation failed" };
    }

    const decoded = decodeJWT(googleResponse.idToken);
    const signInOptions: { provider: "google"; token: string; nonce?: string } = {
      provider: "google",
      token: googleResponse.idToken,
    };
    // Si l'ID token porte un nonce → passer le rawNonce (non-hashé) à Supabase.
    if (decoded?.nonce) signInOptions.nonce = rawNonce;

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithIdToken(signInOptions);
    if (error) throw error;
    return { success: true, user: data.user };
  } catch (error) {
    console.error("Google authentication error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Google authentication failed" };
  }
}

/* ── Apple (natif iOS ; Android via OAuth redirect optionnel) ──── */
export async function authenticateWithAppleSupabase(): Promise<SocialAuthResult> {
  try {
    // Init du plugin centralisée (lib/auth/socialInit) — pas de ré-init ici.
    const response = await SocialLogin.login({ provider: "apple", options: {} });
    const appleResponse = response.result as AppleProviderResponse;
    if (!appleResponse.idToken) {
      return { success: false, error: "Failed to get Apple ID token" };
    }

    const supabase = createClient();
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: appleResponse.idToken,
    });
    if (error) throw error;
    // profile (givenName/familyName/email) présent UNIQUEMENT au 1er login Apple.
    return { success: true, user: data.user, appleProfile: appleResponse.profile };
  } catch (error) {
    console.error("Apple authentication error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Apple authentication failed" };
  }
}
