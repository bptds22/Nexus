// Badges NLS + GP — parcours navigateur, pile LOCALE seulement (refuse toute autre URL).
//   APP=http://localhost:3110 node docs/badges-nls-gp/parcours-local.mjs
// bpdesfosses (partenaire « Nexus ») ouvre le profil de test « Alex Démo-Partenaire », coche
// « NLS · Top 10 » et « GP · MVP » dans « Évaluer » → « Mes badges », enregistre, et la fiche
// montre les deux. Captures dans docs/badges-nls-gp/preuves/. À la fin, les 2 poses sont
// retirées par la même voie que le bouton « Retirer le badge » : la pile reste propre pour BP.
// Session réelle par lien magique admin (aucun mot de passe touché).
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const req = createRequire(path.resolve("package.json"));
const { createClient } = req("@supabase/supabase-js");
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
  .filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const API = env.NEXT_PUBLIC_SUPABASE_URL;
if (API !== "http://127.0.0.1:56321") throw new Error(`pas la pile locale NexusBadges : ${API}`);
const APP = process.env.APP ?? "http://localhost:3110";
if (!/^http:\/\/localhost/.test(APP)) throw new Error("APP pas local");
const OUT = "docs/badges-nls-gp/preuves";
const SUFFIXE = process.env.SUFFIXE ?? ""; // ex. « -gp-v2 » : ne pas écraser les captures précédentes
const ATHLETE = "47f8dced-6338-4727-bafe-75affac53067"; // Alex Démo-Partenaire (fictif)
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

async function session(email) {
  const h = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
  const g = await (await fetch(`${API}/auth/v1/admin/generate_link`, { method: "POST", headers: h, body: JSON.stringify({ type: "magiclink", email }) })).json();
  const s = await (await fetch(`${API}/auth/v1/verify`, { method: "POST", headers: h, body: JSON.stringify({ type: "magiclink", email, token: g.email_otp ?? g.properties?.email_otp }) })).json();
  if (!s.access_token) throw new Error(`session ${email} : ` + JSON.stringify(s).slice(0, 200));
  return s;
}
function cookies(s) {
  const v = "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url");
  const m = v.match(/.{1,3180}/g);
  return (m.length === 1 ? [{ name: "sb-127-auth-token", value: v }] : m.map((x, i) => ({ name: `sb-127-auth-token.${i}`, value: x })))
    .map((c) => ({ ...c, domain: "localhost", path: "/" }));
}

const nav = await chromium.launch();
const s = await session("bpdesfosses@gmail.com");
const ctx = await nav.newContext({ viewport: { width: 1440, height: 1000 } });
await ctx.addCookies(cookies(s));
const page = await ctx.newPage();
const client = createClient(API, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${s.access_token}` } },
});

try {
  await page.goto(`${APP}/partenaire/athletes/${ATHLETE}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.locator("[data-evaluation-partenaire]").first().click();
  const bloc = page.locator("[data-badges-evaluation]");
  await bloc.waitFor({ timeout: 30000 });
  const choix = await bloc.getByRole("button").allInnerTexts();
  console.log("choix « Mes badges » :", choix.map((t) => t.trim()).join(" | "));
  await bloc.getByRole("button", { name: "NLS · Top 10" }).click();
  await bloc.getByRole("button", { name: "GP · MVP" }).click();
  await page.screenshot({ path: path.join(OUT, `1-choix-mes-badges${SUFFIXE}.png`) });
  await page.getByRole("button", { name: "Enregistrer les badges" }).click();

  const vignettes = page.locator("[data-badge-partenaire]");
  await vignettes.nth(1).waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500); // images chargées
  const titres = await vignettes.evaluateAll((els) => els.map((e) => e.textContent?.trim()));
  console.log("vignettes sur la fiche :", titres.join(" | "));
  await vignettes.first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, `2-fiche-nls-et-gp${SUFFIXE}.png`) });

  const lus = await client.rpc("badges_partenaires_athlete", { p_athlete_id: ATHLETE });
  if (lus.error) throw lus.error;
  console.log("lecture serveur (bpdesfosses) :", lus.data.map((b) => `${b.libelle} [${b.organisation}]`).join(" | "));
} finally {
  // Remise en état : les poses de ce parcours, retirées comme le ferait « Retirer le badge ».
  const lus = await client.rpc("badges_partenaires_athlete", { p_athlete_id: ATHLETE });
  for (const b of lus.data ?? []) {
    if (b.est_le_mien && /^(NLS|GP) · /.test(b.libelle)) {
      const r = await client.rpc("retirer_badge_partenaire", { p_attribution_id: b.id });
      console.log(`retrait ${b.libelle} :`, r.error ? r.error.message : "ok");
    }
  }
  await nav.close();
}
