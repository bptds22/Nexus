import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { needsConsent } from "@/lib/auth/needsConsent";

/* ═══════════════════════════════════════════════════════════════
   GET /auth/callback — callback OAuth WEB (Google/Apple).

   Le flow OAuth standard (signInWithOAuth) redirige le navigateur vers le
   provider puis revient ici avec ?code=... On échange le code contre une
   session (cookies, via NOTRE client serveur @supabase/ssr), puis on
   redirige vers l'app.

   Route handler ⇒ web-only (le build mobile output:export l'exclut ; le
   device utilise le flow NATIF, pas ce callback).

   ⚠️ trailingSlash:true — l'URL de redirect (signInWithOAuth.redirectTo) ET
   l'allowlist "Redirect URLs" du dashboard Supabase doivent matcher
   exactement (https://nexussports.ca/auth/callback). On préserve les query
   params lors d'un éventuel ajout de slash.
═══════════════════════════════════════════════════════════════ */

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Gate consentements (BLOC 3B) — login OAuth web. Le route handler est
      // serveur → on ne peut pas appeler postLoginDispatch (router client) ;
      // on réplique UNIQUEMENT le check consent côté serveur. Fail-open : si
      // la query échoue / profil absent, on ne gate pas (redirect normal).
      const authUser = data?.user;
      if (authUser) {
        const { data: profile } = await supabase
          .from("users")
          .select("onboarding_complete, privacy_preferences")
          .eq("id", authUser.id)
          .maybeSingle();
        if (profile && profile.onboarding_complete !== true
            && needsConsent(profile.privacy_preferences, authUser.user_metadata)) {
          return NextResponse.redirect(`${origin}/consentements`);
        }
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("[auth/callback] exchangeCodeForSession error:", error.message);
  }

  return NextResponse.redirect(`${origin}/auth?error=oauth`);
}
