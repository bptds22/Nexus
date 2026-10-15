// Largeur des pages de l'espace athlète sur mobile web (390 px) — base LOCALE, headless.
//   cd C:\tmp\nexus-w4bc ; APP=http://localhost:3011 node docs/partenaires-w4bc/outils/largeur-pages-athlete.mjs avant|apres
// Mesure document.scrollWidth sur plusieurs pages (le correctif est dans le layout : il
// touche toutes les pages) et photographie /athlete/notifications.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const req = createRequire(path.resolve("package.json"));
const { chromium } = req("playwright");
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
  .filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const API = env.NEXT_PUBLIC_SUPABASE_URL;
if (!/^http:\/\/127\.0\.0\.1/.test(API)) throw new Error("pas local : " + API);
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const APP = process.env.APP ?? "http://localhost:3011";
const ETIQUETTE = process.argv[2] ?? "avant";
const OUT = path.resolve("docs/partenaires-w4bc/captures");

const h = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const email = "mathis.demo@exemple.test";
const g = await (await fetch(`${API}/auth/v1/admin/generate_link`, { method: "POST", headers: h, body: JSON.stringify({ type: "magiclink", email }) })).json();
const s = await (await fetch(`${API}/auth/v1/verify`, { method: "POST", headers: h, body: JSON.stringify({ type: "magiclink", email, token: g.email_otp ?? g.properties?.email_otp }) })).json();
const v = "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url");
const m = v.match(/.{1,3180}/g);

const nav = await chromium.launch(); // headless
const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "fr-CA" });
await ctx.addCookies((m.length === 1 ? [{ name: "sb-127-auth-token", value: v }] : m.map((x, i) => ({ name: `sb-127-auth-token.${i}`, value: x })))
  .map((c) => ({ ...c, domain: "localhost", path: "/" })));
const page = await ctx.newPage();
const lignes = [];
for (const route of ["/athlete/notifications", "/athlete/dashboard", "/athlete/profil", "/athlete/parametres", "/athlete/cartes-partenaires", "/athlete/ambassadeur"]) {
  await page.goto(`${APP}${route}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  const r = await page.evaluate(() => ({ ecran: document.documentElement.clientWidth, page: document.documentElement.scrollWidth }));
  lignes.push(`${ETIQUETTE} ${route} : ${r.page} px pour ${r.ecran} px${r.page > r.ecran ? "  ← DÉBORDE" : ""}`);
  if (route === "/athlete/notifications") {
    await page.screenshot({ path: path.join(OUT, `22-${ETIQUETTE}-notifications-mobile.png`) });
  }
}
await nav.close();
console.log(lignes.join("\n"));
fs.appendFileSync(path.resolve("docs/partenaires-w4bc/largeur-pages-athlete.txt"), lignes.join("\n") + "\n");
