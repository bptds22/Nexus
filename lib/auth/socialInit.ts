/* ═══════════════════════════════════════════════════════════════
   socialInit — initialisation UNIQUE et idempotente du plugin
   @capgo/capacitor-social-login (étape 2).

   - Appelée au boot de l'app (composant SocialLoginInit) ET défensivement
     avant chaque login (helpers lib/auth/social.ts). Idempotente : une
     seule vraie initialisation (mémoïsée via initPromise) → pas de
     ré-init à chaque render/login.
   - NATIVE uniquement : sur le web on utilise le flow OAuth normal
     (supabase.auth.signInWithOAuth), pas le plugin natif.
   - Google `mode: "online"` + iOSClientId requis pour récupérer l'idToken
     côté iOS (le webClientId seul ne suffit pas en natif).
═══════════════════════════════════════════════════════════════ */

import { SocialLogin } from "@capgo/capacitor-social-login";
import { Capacitor } from "@capacitor/core";

const GOOGLE_WEB_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";
const GOOGLE_IOS_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";

let initPromise: Promise<void> | null = null;

export function initSocialLogin(): Promise<void> {
  // Web → no-op (flow OAuth normal, pas de plugin natif).
  if (!Capacitor.isNativePlatform()) return Promise.resolve();
  // Idempotent : réutilise l'init en cours/faite.
  if (initPromise) return initPromise;

  const isIOS = Capacitor.getPlatform() === "ios";
  initPromise = SocialLogin.initialize({
    google: {
      webClientId: GOOGLE_WEB_CLIENT_ID,
      ...(isIOS && GOOGLE_IOS_CLIENT_ID ? { iOSClientId: GOOGLE_IOS_CLIENT_ID } : {}),
      mode: "online", // pour obtenir l'idToken
    },
    apple: {}, // iOS : bundle ID automatique
  }).catch((e) => {
    initPromise = null; // échec → autorise un retry au prochain appel
    throw e;
  });

  return initPromise;
}
