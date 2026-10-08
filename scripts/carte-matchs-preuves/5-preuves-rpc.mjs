// Preuves par rôle de matchs_profils_nexus (lot A+), base LOCALE, VRAIS JWT
// (HS256, secret local) contre PostgREST — comme l'écran.
//   SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… node 5-preuves-rpc.mjs
import crypto from "node:crypto";

const API = "http://127.0.0.1:54321";
const SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";
const ANON = process.env.SUPABASE_ANON_KEY, SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (sub) => {
  const now = Math.floor(Date.now() / 1000);
  const h = b64({ alg: "HS256", typ: "JWT" }), p = b64({ sub, role: "authenticated", aud: "authenticated", iat: now, exp: now + 3600 });
  return `${h}.${p}.${crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url")}`;
};
const ROLES = {
  "recruteur Pro (r3)": "22222222-0000-0000-0000-00000000003a",
  "recruteur gratuit (r6)": "a6000000-0000-0000-0000-0000000000b6",
  "coach (c1)": "22222222-0000-0000-0000-00000000000c",
  "athlète (emma)": "ffffffff-0000-0000-0000-000000000005",
};
const MATCH_1530 = "3f927293-e070-457a-b489-b320878a0f6c";   // Laval Cad vs Saint-Joseph — fixtures Cprofils
const MATCH_0930 = "7f74ad65-7785-47bd-8482-e60628d54c1b";   // Laval Ben — aucune fiche
const MATCH_LEVIS = process.argv[2];                          // Lévis — mineur masqué suivi

async function appel(jeton, games) {
  const r = await fetch(`${API}/rest/v1/rpc/matchs_profils_nexus`, {
    method: "POST",
    headers: { apikey: ANON, ...(jeton ? { Authorization: `Bearer ${jeton}` } : {}), "Content-Type": "application/json" },
    body: JSON.stringify({ p_games: games }),
  });
  const t = await r.text();
  let corps; try { corps = JSON.parse(t); } catch { corps = t; }
  return { status: r.status, corps };
}
const resume = ({ status, corps }) => Array.isArray(corps)
  ? `HTTP ${status} · ${corps.length} ligne(s)`
  : `HTTP ${status} · code ${corps?.code} · ${corps?.message}`;

const jeux = [MATCH_1530, MATCH_0930, MATCH_LEVIS].filter(Boolean);
for (const [role, sub] of Object.entries(ROLES)) {
  const r = await appel(jwt(sub), jeux);
  console.log(`${role.padEnd(24)} → ${resume(r)}`);
  if (Array.isArray(r.corps)) {
    console.log(`   colonnes : ${Object.keys(r.corps[0] ?? {}).join(", ")}`);
    for (const l of r.corps) console.log(`   ${l.game_id.slice(0, 8)} | ${l.cote.padEnd(8)} | ${l.prenom} ${l.nom} | ${l.position ?? "—"} | ${l.promotion ?? "—"}`);
  }
}
console.log(`anon (sans JWT)          → ${resume(await appel(null, jeux))}`);
const trop = Array.from({ length: 501 }, () => crypto.randomUUID());
console.log(`Pro, 501 matchs          → ${resume(await appel(jwt(ROLES["recruteur Pro (r3)"]), trop))}`);
const pile = Array.from({ length: 500 }, () => crypto.randomUUID());
console.log(`Pro, 500 matchs          → ${resume(await appel(jwt(ROLES["recruteur Pro (r3)"]), pile))}`);
console.log(`Pro, tableau vide        → ${resume(await appel(jwt(ROLES["recruteur Pro (r3)"]), []))}`);

// Le MÊME mineur, consentement donné → présent ; puis retour à l'état d'origine.
const svc = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const MINEUR = "77770000-0000-0000-0000-0000000000e1";
const poser = (v) => fetch(`${API}/rest/v1/athletes?id=eq.${MINEUR}`, { method: "PATCH", headers: svc, body: JSON.stringify({ consentement_parental: v }) });
const present = async () => (await appel(jwt(ROLES["recruteur Pro (r3)"]), [MATCH_1530])).corps.some((l) => l.athlete_id === MINEUR);
console.log(`Mineur (15 ans) sans consentement → présent ? ${await present()}`);
console.log(`  pose consentement_parental = true : HTTP ${(await poser(true)).status}`);
console.log(`Mineur (15 ans) avec consentement → présent ? ${await present()}`);
console.log(`  remet consentement_parental = false : HTTP ${(await poser(false)).status}`);
console.log(`Mineur (15 ans) sans consentement → présent ? ${await present()}`);
