// Parcours navigateur — carte des matchs (lot A), base LOCALE.
//   SUPABASE_SERVICE_ROLE_KEY=… REF=http://localhost:3008 APP=http://localhost:3007 OUT=<captures> node 2-parcours.mjs
// Sessions RÉELLES (lien magique admin → /verify, aucun mot de passe touché) :
// Pro …003a (r3.collegue) et gratuit r6.gratuit.
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "playwright";

const API = "http://127.0.0.1:54321";
const APP = process.env.APP ?? "http://localhost:3007";
const REF = process.env.REF ?? "http://localhost:3008";
const OUT = process.env.OUT ?? ".";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function cookiesPour(email) {
  const h = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
  const g = await (await fetch(`${API}/auth/v1/admin/generate_link`, { method: "POST", headers: h, body: JSON.stringify({ type: "magiclink", email }) })).json();
  const s = await (await fetch(`${API}/auth/v1/verify`, { method: "POST", headers: h, body: JSON.stringify({ type: "magiclink", email, token: g.email_otp ?? g.properties?.email_otp }) })).json();
  if (!s.access_token) throw new Error(`session ${email} : ` + JSON.stringify(s).slice(0, 200));
  const v = "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url");
  const m = v.match(/.{1,3180}/g);
  return (m.length === 1 ? [{ name: "sb-127-auth-token", value: v }] : m.map((x, i) => ({ name: `sb-127-auth-token.${i}`, value: x })))
    .map((c) => ({ ...c, domain: "localhost", path: "/" }));
}

const nav = await chromium.launch();
async function page(email) {
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 1100 } });
  await ctx.addCookies(await cookiesPour(email));
  return ctx.newPage();
}
const pro = await page("r3.collegue@preuve.local");

/* ── A. Le Calendrier : même rendu avant (main, REF) et après (branche, APP) ── */
async function texteCalendrier(base) {
  await pro.goto(`${base}/recruteur/calendrier`, { waitUntil: "networkidle" });
  await pro.waitForTimeout(2500);
  const t = await pro.locator("main").innerText();
  return t.replace(/\s+/g, " ").trim();
}
const avant = await texteCalendrier(REF);
await pro.screenshot({ path: path.join(OUT, "a-calendrier-avant-main.png") });
const apres = await texteCalendrier(APP);
await pro.screenshot({ path: path.join(OUT, "a-calendrier-apres-branche.png") });
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");
console.log(`A. Calendrier avant (main) : ${avant.length} car., md5 ${md5(avant)}`);
console.log(`A. Calendrier après (branche) : ${apres.length} car., md5 ${md5(apres)}`);
console.log(`A. identiques : ${avant === apres}`);
console.log(`A. extrait : ${apres.slice(0, 260)}…`);

/* ── B. Carte : journée chargée (10 octobre) ── */
async function journee(date) {
  await pro.goto(`${APP}/recruteur/carte-matchs`, { waitUntil: "networkidle" });
  await pro.getByTestId("date-carte").fill(date);
  await pro.waitForTimeout(2500);
}
await journee("2026-10-10");
console.log("B. résumé :", await pro.getByTestId("resume-journee").innerText());
console.log("B. filtres :", (await pro.getByTestId("filtres-carte").innerText()).replace(/\s+/g, " "));
const lignes = await pro.getByTestId("ligne-match").allInnerTexts();
lignes.forEach((l, i) => console.log(`B. ligne ${i + 1} : ${l.replace(/\s+/g, " ")}`));
console.log("B. marqueurs sur la carte :", await pro.locator(".leaflet-marker-icon").count());
await pro.screenshot({ path: path.join(OUT, "b-journee-chargee.png") });
// Survol d'une ligne → marqueur en survol ; clic → détail du terrain.
await pro.getByTestId("ligne-match").first().hover();
console.log("B. marqueur en survol :", await pro.locator(".leaflet-marker-icon.hov, .leaflet-marker-icon .hov, .pin-cible-wrap.hov").count());
await pro.getByTestId("ligne-match").first().locator("button").click();
await pro.getByTestId("detail-terrain").waitFor();
await pro.waitForTimeout(1200);
console.log("B. détail :", (await pro.getByTestId("detail-terrain").innerText()).replace(/\s+/g, " "));
const liens = await pro.getByTestId("detail-terrain").locator("a").evaluateAll((as) => as.map((a) => `${a.textContent} → ${a.getAttribute("href")?.slice(0, 120)} [${a.getAttribute("target")}]`));
liens.forEach((l) => console.log("B. lien :", l));
console.log("B. marqueur sélectionné :", await pro.locator(".pin-cible-wrap.sel").count());
await pro.screenshot({ path: path.join(OUT, "b-detail-terrain.png") });
// Clic sur un marqueur → sélection d'un autre terrain.
await pro.locator(".leaflet-marker-icon:not(.sel)").first().dispatchEvent("click");
await pro.waitForTimeout(800);
console.log("B. clic marqueur → détail :", (await pro.getByTestId("detail-terrain").locator("h2").innerText()));
// Filtre catégorie (plusieurs valeurs ce jour-là).
await pro.getByLabel("Catégorie").selectOption({ label: "Cadet" });
await pro.waitForTimeout(600);
console.log("B. filtre Cadet → résumé :", await pro.getByTestId("resume-journee").innerText());

/* ── C. Journée sans match ── */
await journee("2026-10-13");
console.log("C. résumé :", await pro.getByTestId("resume-journee").innerText(), "|", await pro.getByTestId("aucun-match").innerText());
console.log("C. filtres :", (await pro.getByTestId("filtres-carte").innerText()).replace(/\s+/g, " "));
console.log("C. selects désactivés :", await pro.locator("[data-testid=filtres-carte] select:disabled").count(), "sur", await pro.locator("[data-testid=filtres-carte] select").count());
await pro.screenshot({ path: path.join(OUT, "c-journee-vide.png") });

/* ── D. Match au terrain non précisé (civil, sans coordonnées) ── */
await journee("2026-11-07");
console.log("D. résumé :", await pro.getByTestId("resume-journee").innerText());
console.log("D. ligne :", (await pro.getByTestId("ligne-match").first().innerText()).replace(/\s+/g, " "));
console.log("D. marqueurs :", await pro.locator(".leaflet-marker-icon").count(), "| bouton de la ligne désactivé :", await pro.getByTestId("ligne-match").first().locator("button").isDisabled());
await pro.screenshot({ path: path.join(OUT, "d-lieu-non-precise.png") });

/* ── E. Menu ── */
const menu = await pro.locator("aside a, nav a").evaluateAll((as) => as.map((a) => a.textContent?.trim()).filter(Boolean));
const i = menu.findIndex((t) => /^Calendrier/.test(t));
console.log("E. menu autour du Calendrier :", menu.slice(Math.max(0, i), i + 3).join(" | "));

/* ── F. Compte gratuit : le mur ── */
const gratuit = await page("r6.gratuit@preuve.local");
const requetesGames = [];
gratuit.on("request", (r) => { if (/\/rest\/v1\/(games|recruiter_pipeline|team_athletes)/.test(r.url())) requetesGames.push(r.url()); });
await gratuit.goto(`${APP}/recruteur/carte-matchs`, { waitUntil: "networkidle" });
await gratuit.waitForTimeout(2000);
console.log("F. gratuit :", (await gratuit.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 300));
console.log("F. carte montée ?", await gratuit.getByTestId("carte-matchs").count() > 0, "| requêtes games/pipeline/team_athletes :", requetesGames.length);
await gratuit.screenshot({ path: path.join(OUT, "f-mur-gratuit.png") });

await nav.close();
