// QG admin — session d'un compte LOCAL pour les preuves headless, sans toucher
// à son mot de passe : lien magique (clé de service locale) → session → cookie
// @supabase/ssr. Refuse toute adresse qui n'est pas 127.0.0.1 (jamais la prod).
//
//   import { cookiesSession } from "./session-locale.mjs";
//   const cookies = await cookiesSession("admin@demo.local");  // [{ name, value }]
import { readFileSync } from "node:fs";

function lireEnv(fichier) {
  const env = {};
  for (const ligne of readFileSync(fichier, "utf8").split(/\r?\n/)) {
    const m = ligne.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^"|"$/g, "");
  }
  return env;
}

export const ENV = lireEnv(new URL("../../.env.local", import.meta.url));
const URL_SB = ENV.NEXT_PUBLIC_SUPABASE_URL;
if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(URL_SB ?? "")) {
  throw new Error(`session-locale : adresse non locale refusée (${URL_SB})`);
}

export async function cookiesSession(email) {
  const cle = ENV.SUPABASE_SERVICE_ROLE_KEY;
  const lien = await fetch(`${URL_SB}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: { apikey: cle, Authorization: `Bearer ${cle}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", email }),
  }).then((r) => r.json());
  const hash = lien.hashed_token ?? lien.properties?.hashed_token;
  if (!hash) throw new Error(`generate_link : ${JSON.stringify(lien).slice(0, 200)}`);
  const session = await fetch(`${URL_SB}/auth/v1/verify`, {
    method: "POST",
    headers: { apikey: ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", token_hash: hash }),
  }).then((r) => r.json());
  if (!session.access_token) throw new Error(`verify : ${JSON.stringify(session).slice(0, 200)}`);

  // Format @supabase/ssr : « base64- » + base64url(JSON), découpé en morceaux de 3180.
  const nom = `sb-${new URL(URL_SB).hostname.split(".")[0]}-auth-token`;
  const valeur = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  if (valeur.length <= 3180) return [{ name: nom, value: valeur }];
  const morceaux = [];
  for (let i = 0; i * 3180 < valeur.length; i++) morceaux.push({ name: `${nom}.${i}`, value: valeur.slice(i * 3180, (i + 1) * 3180) });
  return morceaux;
}

export const enTete = (cookies) => cookies.map((c) => `${c.name}=${c.value}`).join("; ");
