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

          // Session posée → routage selon rôle/contexte (même dispatch que le natif).
          const { data } = await supabase.auth.getSession();
          if (data.session?.user) {
            await postLoginDispatch(supabase, data.session.user, router);
          }
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
