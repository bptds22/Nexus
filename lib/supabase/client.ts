import { createClient as createSbClient, type SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

// Singleton — multiple createClient() calls return the same instance so auth
// state is shared across components without warnings about multiple GoTrueClient
// instances.
//
// Storage branches on the build target:
// - WEB (IS_CAPACITOR=false): createBrowserClient (@supabase/ssr) persists the
//   session to COOKIES so server route handlers (/api/*) and server.ts read the
//   same session. localStorage-only storage silently broke server-side auth.
// - MOBILE (IS_CAPACITOR=true): @supabase/supabase-js + window.localStorage,
//   byte-for-byte the prior path — Capacitor WebView exposes window.localStorage
//   and the static-export mobile build has no server side to read cookies.
let client: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  if (IS_CAPACITOR) {
    // MOBILE — byte-for-byte the current path (do not alter)
    client = createSbClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      },
    });
  } else {
    // WEB — cookie storage so /api routes read the session
    client = createBrowserClient(url, anonKey) as SupabaseClient;
  }

  return client;
}
