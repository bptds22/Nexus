import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/* ═══════════════════════════════════════════════════════════════
   Nexus middleware — minimal, single-purpose.

   Gates /partenaire/* routes (excluding the welcome screen
   itself) behind partner welcome-flow completion. A PARTNER
   user with NULL terms_accepted_at OR
   NULL password_reset_completed_at gets redirected to
   /partenaire/bienvenue. Once both flags are non-NULL, the
   gate is transparent and the partner reaches the requested
   page normally.

   Notes on scope (intentional):
   - Does NOT activate the dormant lib/supabase/middleware.ts
     updateSession() block. That file's role-routing rules have
     never run in production and turning them on would change
     behavior beyond this phase. Approach (b) per the welcome-
     flow spec — surgical, single-concern.
   - Does NOT touch /coach, /recruteur, /athlete, /admin,
     unauthenticated routes, or API endpoints. Those continue
     to be gated only by their layouts.
   - Uses createServerClient from @supabase/ssr with a cookie
     adapter — same pattern as lib/supabase/middleware.ts
     lines 12-32. The deprecated createMiddlewareClient from
     @supabase/auth-helpers-nextjs is NOT used (that package
     isn't installed here).

   Edge cases:
   - Unauthenticated user on /partenaire/* → middleware passes
     through; the partner layout's role guard will redirect
     them to /auth.
   - Authenticated non-PARTNER on /partenaire/* → middleware
     passes through; the partner layout will bounce them to
     their correct portal.
   - PARTNER with no media_partners row → middleware passes
     through (defense against redirect loops). The partner
     layout / page will surface the data inconsistency.
═══════════════════════════════════════════════════════════════ */

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Welcome screen itself must be reachable. Excluding here
  // (matcher patterns can't easily express negative matches).
  if (pathname === "/partenaire/bienvenue") {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    // Layout will redirect to /auth — no need to do it here.
    return supabaseResponse;
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();

  if (userRow?.role !== "PARTNER") {
    // Non-PARTNER on /partenaire/* — let the layout handle them.
    return supabaseResponse;
  }

  const { data: partner } = await supabase
    .from("media_partners")
    .select("terms_accepted_at, password_reset_completed_at")
    .eq("user_id", user.id)
    .single();

  if (!partner) {
    // No partner row for a PARTNER user — data inconsistency,
    // pass through so the page can surface it instead of looping.
    return supabaseResponse;
  }

  if (!partner.terms_accepted_at || !partner.password_reset_completed_at) {
    return NextResponse.redirect(
      new URL("/partenaire/bienvenue", request.url),
    );
  }

  return supabaseResponse;
}

export const config = {
  matcher: ["/partenaire/:path*"],
};
