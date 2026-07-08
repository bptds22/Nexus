import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSbClient } from "@supabase/supabase-js";
import {
  computeDispatchDestination,
  type DispatchProfile,
} from "@/lib/auth/computeDispatchDestination";

/* ═══════════════════════════════════════════════════════════════
   GET /auth/callback — callback OAuth WEB (Google/Apple).

   Le flow OAuth standard (signInWithOAuth) redirige le navigateur vers le
   provider puis revient ici avec ?code=... On échange le code contre une
   session (cookies, via NOTRE client serveur @supabase/ssr), puis on
   redirige vers l'app.

   Item 3 — override role/context post-OAuth : le trigger handle_new_auth_user
   défaut role=ATHLETE (l'OAuth ne peut pas passer raw_user_meta_data.role).
   Le flow web unifié connaît le rôle (picker écran 0) et le transmet via
   redirectTo=?role=X&context=Y. Ici on l'applique — via un client service_role
   car la RLS `users update own` (WITH CHECK user_privileged_cols_unchanged)
   interdit à l'utilisateur de changer son propre role/context. Gardes
   anti-escalade en cascade (voir maybeApplySignupRole).

   Route handler ⇒ web-only (le build mobile output:export l'exclut ; le
   device utilise le flow NATIF signInWithIdToken, pas ce callback).

   ⚠️ trailingSlash:true — l'URL de redirect (signInWithOAuth.redirectTo) ET
   l'allowlist "Redirect URLs" du dashboard Supabase doivent matcher
   (https://nexussports.ca/auth/callback + query params autorisés).
═══════════════════════════════════════════════════════════════ */

const VALID_ROLES = ["ATHLETE", "COACH", "RECRUTEUR"] as const;
type ValidRole = (typeof VALID_ROLES)[number];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const authUser = data?.user;
      if (authUser) {
        // Lecture unique du profil (override + dispatch). `status` requis pour
        // le cas DESACTIVE de computeDispatchDestination.
        const { data: profile } = await supabase
          .from("users")
          .select("role, context, onboarding_complete, status, privacy_preferences")
          .eq("id", authUser.id)
          .maybeSingle();

        // ── Override role/context post-OAuth (item 3, service_role + gardes) ──
        //    Retourne ce qui a été réellement appliqué (ou null).
        const applied = await maybeApplySignupRole(authUser, profile, searchParams);

        // ── Dispatch server-side (item 3.5) — même décision que postLoginDispatch
        //    via la util pure. Remplace l'ancien redirect "/" (qui ignorait rôle
        //    + onboarding). Le profil effectif prend le rôle POST-override. Le
        //    gate consentements (/consentements) est porté par la util. ──
        const effectiveProfile: DispatchProfile | null = profile
          ? {
              role: applied?.role ?? profile.role,
              onboarding_complete: profile.onboarding_complete,
              status: profile.status,
              privacy_preferences: profile.privacy_preferences,
            }
          : null;
        const dest = computeDispatchDestination(
          effectiveProfile,
          authUser.user_metadata as Record<string, unknown> | undefined,
        );
        // Compte désactivé : signOut server-side AVANT le redirect (canonique).
        if (dest.reason === "deactivated") await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}${dest.path}`);
      }
      return NextResponse.redirect(`${origin}/`);
    }
    console.error("[auth/callback] exchangeCodeForSession error:", error.message);
  }

  return NextResponse.redirect(`${origin}/auth?error=oauth`);
}

/**
 * Applique role/context (?role&context) au user, sous gardes strictes.
 * Retourne le { role, context } RÉELLEMENT appliqué, ou null si une garde
 * échoue / no-op (le flow OAuth continue quoi qu'il arrive). Le caller merge
 * le retour dans le profil pour dispatcher sur le rôle post-override.
 */
async function maybeApplySignupRole(
  authUser: { id: string; identities?: { provider: string }[] },
  profile: { role: string | null; onboarding_complete: boolean | null } | null,
  searchParams: URLSearchParams,
): Promise<{ role: ValidRole; context: string | null } | null> {
  // Garde 2 — OAuth signup uniquement : skip si l'identité est email/password
  // (ce user a déjà le bon role via l'arg de signUp, aucun override à faire).
  const providers = (authUser.identities ?? []).map((i) => i.provider);
  if (providers.length > 0 && providers.every((p) => p === "email")) return null;

  // Garde 3 — onboarding déjà complété = user existant (login OAuth de retour) :
  // ne jamais toucher le role (anti-escalade via URL forgée).
  if (profile?.onboarding_complete === true) return null;

  // Garde 4 — role param whitelisté (rejette ADMIN/PARTNER/valeurs arbitraires).
  const roleParam = searchParams.get("role");
  if (!roleParam || !VALID_ROLES.includes(roleParam as ValidRole)) return null;
  const role = roleParam as ValidRole;

  // Garde 5 — context validé + cohérent avec le role :
  //   COACH     → context ∈ {scolaire, ligue_civile} (choix picker école/civil)
  //   RECRUTEUR → collegial (dérivé, pas de choix utilisateur)
  //   ATHLETE   → context ignoré ici (choisi à l'écran 2 / onboarding)
  //   toute autre combinaison → context non appliqué (role reste posé).
  let context: string | null = null;
  const c = searchParams.get("context");
  if (role === "COACH" && (c === "scolaire" || c === "ligue_civile")) {
    context = c;
  } else if (role === "RECRUTEUR") {
    context = "collegial";
  }

  // No-op si déjà à jour (role identique et pas de context à poser).
  if (profile?.role === role && !context) return null;

  // service_role (bypass RLS) — même pattern que app/api/admin/partners/create.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error("[auth/callback] Missing service-role env vars — role override skipped");
    return null;
  }
  const sbAdmin = createSbClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const patch: { role: ValidRole; context?: string } = { role };
  if (context) patch.context = context;

  const { error } = await sbAdmin.from("users").update(patch).eq("id", authUser.id);
  if (error) {
    console.error("[auth/callback] role override failed:", error.message);
    return null;
  }
  // Audit trail (trace des overrides post-OAuth — debugging).
  console.log(`[auth/callback] role override: user=${authUser.id} role=${role}${context ? ` context=${context}` : ""}`);
  return { role, context };
}
