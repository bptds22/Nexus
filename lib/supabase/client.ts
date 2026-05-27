import { createClient as createSbClient, type SupabaseClient } from '@supabase/supabase-js';

// Singleton — multiple createClient() calls return the same instance so auth
// state is shared across components without warnings about multiple GoTrueClient
// instances. Auth persists to localStorage on web AND inside the Capacitor
// WKWebView/WebView (Capacitor exposes window.localStorage).
let client: SupabaseClient | null = null;

export function createClient(): SupabaseClient {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  client = createSbClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  });

  return client;
}
