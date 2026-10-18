import type { BrowserContext } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { createServerClient } from "@supabase/ssr";
import { ANON_LOCALE, SERVICE_LOCALE, SUPABASE_LOCAL_URL } from "./local";

/* Session d'un compte de la pile LOCALE, sans mot de passe : lien magique généré par l'API admin
   locale (clé de démo), vérifié aussitôt, puis posé en cookies au format de @supabase/ssr — les
   mêmes que l'appli écrit à la connexion. Écriture : une session GoTrue dans la base Docker,
   rien d'autre. Jamais la prod : SUPABASE_LOCAL_URL est vérifiée locale par la config. */
export async function connecterLocal(context: BrowserContext, baseURL: string, email: string): Promise<void> {
  const admin = createClient(SUPABASE_LOCAL_URL, SERVICE_LOCALE, { auth: { persistSession: false } });
  const { data: lien, error: e1 } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (e1 || !lien.properties?.hashed_token) throw new Error(`lien magique local : ${e1?.message ?? "sans jeton"}`);

  const anon = createClient(SUPABASE_LOCAL_URL, ANON_LOCALE, { auth: { persistSession: false } });
  const { data: v, error: e2 } = await anon.auth.verifyOtp({ token_hash: lien.properties.hashed_token, type: "magiclink" });
  if (e2 || !v.session) throw new Error(`vérification locale : ${e2?.message ?? "sans session"}`);

  const ecrits: { name: string; value: string }[] = [];
  const ssr = createServerClient(SUPABASE_LOCAL_URL, ANON_LOCALE, {
    cookies: {
      getAll: () => ecrits,
      setAll: (c) => { for (const x of c) { const i = ecrits.findIndex((y) => y.name === x.name); if (i >= 0) ecrits.splice(i, 1); if (x.value) ecrits.push({ name: x.name, value: x.value }); } },
    },
  });
  const { error: e3 } = await ssr.auth.setSession({ access_token: v.session.access_token, refresh_token: v.session.refresh_token });
  if (e3) throw new Error(`session locale : ${e3.message}`);

  const url = new URL(baseURL);
  await context.addCookies(ecrits.map((c) => ({ name: c.name, value: c.value, domain: url.hostname, path: "/", sameSite: "Lax" as const })));
}
