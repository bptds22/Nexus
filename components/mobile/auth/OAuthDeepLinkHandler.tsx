"use client";

/* ═══════════════════════════════════════════════════════════════
   OAuthDeepLinkHandler — capte le RETOUR du flow web OAuth sur ANDROID.

   Contexte : sur Android le SDK natif (Apple/Google) n'est pas câblé
   (pas de Services ID Apple, pas de client OAuth Android / SHA-1). On
   passe donc par `supabase.auth.signInWithOAuth` (providers gérés côté
   Supabase, comme le web) qui, après consentement, redirige vers le
   scheme custom `ca.nexussports.app://auth/callback`. C'est CE composant
   qui reçoit ce deep-link (via App.appUrlOpen), échange le retour contre
   une session, puis dispatche vers la bonne destination.

   ⚠️ ANDROID uniquement — jamais enregistré sur iOS (flow natif intact)
   ni sur web. Il ne réagit QU'aux URLs préfixées CALLBACK_PREFIX : tout
   autre deep-link éventuel est ignoré (pas d'avalage).

   Dual-branch (client Supabase mobile volontairement NON altéré, sans
   flowType explicite) :
   - retour PKCE  (`?code=…`)         → exchangeCodeForSession(code)
   - retour implicite (`#access_token`) → setSession({access, refresh})
   → fonctionne quel que soit le flowType effectif du client.
═══════════════════════════════════════════════════════════════ */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { postLoginDispatch } from "@/lib/auth/postLoginDispatch";
import { needsSignupRole, claimSignupRole, readSignupRole } from "@/lib/auth/claimSignupRole";

const CALLBACK_PREFIX = "ca.nexussports.app://auth/callback";

export function OAuthDeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    let remove: (() => void) | undefined;

    (async () => {
      const { Capacitor } = await import("@capacitor/core");
      // Android uniquement — iOS garde son flow natif, web n'en a pas besoin.
      if (Capacitor.getPlatform() !== "android") return;

      const { App } = await import("@capacitor/app");
      const handle = await App.addListener("appUrlOpen", async ({ url }) => {
        // Ne traiter QUE notre callback OAuth ; ignorer tout autre deep-link.
        if (!url || !url.startsWith(CALLBACK_PREFIX)) return;

        try {
          // Fermer le Custom Tab resté ouvert derrière la redirection.
          const { Browser } = await import("@capacitor/browser");
          try { await Browser.close(); } catch { /* déjà fermé */ }

          const supabase = createClient();

          // PKCE (?code=) vs implicite (#access_token=) — sans supposer le flowType.
          const query = url.split("?")[1]?.split("#")[0] ?? "";
          const code = new URLSearchParams(query).get("code");

          if (code) {
            const { error } = await supabase.auth.exchangeCodeForSession(code);
            if (error) throw error;
          } else {
            const hash = url.split("#")[1] ?? "";
            const hp = new URLSearchParams(hash);
            const access_token = hp.get("access_token");
            const refresh_token = hp.get("refresh_token");
            if (!access_token || !refresh_token) {
              throw new Error("Retour OAuth sans jetons ni code.");
            }
            const { error } = await supabase.auth.setSession({ access_token, refresh_token });
            if (error) throw error;
          }

          // Session posée. AVANT de dispatcher : le compte a-t-il encore un rôle
          // à réclamer ? Le signup OAuth ne peut pas écrire raw_user_meta_data →
          // le trigger handle_new_auth_user défaute à ATHLETE, et /auth/callback
          // (qui corrige ça sur web) est exclu du build output:'export'. Sans
          // cette étape, tout nouveau compte Android partirait en ATHLETE.
          // L'autorité est la DB (needs_signup_role), jamais une heuristique client.
          const { data } = await supabase.auth.getSession();
          if (!data.session?.user) return;

          if (await needsSignupRole(supabase)) {
            // Rôle déposé par SocialButtonsMobile avant l'ouverture du Custom Tab
            // (il ne survit pas à l'aller-retour autrement). Lecture unique.
            const stashed = readSignupRole();

            if (!stashed) {
              // Welcome / Login, ou stash perdu/expiré → interstitiel.
              // PAS de défaut ATHLETE.
              router.replace("/inscription/role");
              return;
            }

            const claimed = await claimSignupRole(supabase, stashed.role, stashed.context);
            if (!claimed.ok) {
              // Échec de la RPC → on ne dispatche PAS sur un rôle faux.
              router.replace("/inscription/role");
              return;
            }
          }

          // Rôle correct en DB → routage selon rôle/contexte (même dispatch que le natif).
          await postLoginDispatch(supabase, data.session.user, router);
        } catch (e) {
          console.error("[OAuthDeepLink] échec du retour OAuth:", e);
        }
      });

      remove = () => { handle.remove(); };
    })();

    return () => { remove?.(); };
  }, [router]);

  return null;
}
