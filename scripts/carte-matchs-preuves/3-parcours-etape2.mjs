// Parcours navigateur — carte des matchs, lot A ÉTAPE 2 (écran final), base LOCALE.
//   SUPABASE_SERVICE_ROLE_KEY=… REF=http://localhost:3008 APP=http://localhost:3007 OUT=<captures> node 3-parcours-etape2.mjs
// Sessions RÉELLES (lien magique admin → /verify, aucun mot de passe touché) :
// Pro …003a (r3.collegue), gratuit r6.gratuit, athlète emma@demo.local (« Trouve ton cégep »).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { chromium } from "playwright";

const API = "http://127.0.0.1:54321";
const APP = process.env.APP ?? "http://localhost:3007";
const REF = process.env.REF ?? "http://localhost:3008";
const OUT = process.env.OUT ?? ".";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");
const net = (s) => s.replace(/\s+/g, " ").trim();

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
async function page(email, width = 1440, height = 1000) {
  const ctx = await nav.newContext({ viewport: { width, height }, acceptDownloads: true });
  await ctx.addCookies(await cookiesPour(email));
  return ctx.newPage();
}

/* ── A. Calendrier et « Trouve ton cégep » : même rendu avant (main) et après (branche) ── */
const pro = await page("r3.collegue@preuve.local");
async function texteCalendrier(base) {
  await pro.goto(`${base}/recruteur/calendrier`, { waitUntil: "networkidle" });
  await pro.waitForTimeout(2500);
  return net(await pro.locator("main").innerText());
}
const calAvant = await texteCalendrier(REF), calApres = await texteCalendrier(APP);
console.log(`A. Calendrier avant (main) : ${calAvant.length} car., md5 ${md5(calAvant)} | après (branche) : ${calApres.length} car., md5 ${md5(calApres)} | identiques : ${calAvant === calApres}`);

const ath = await page("emma@demo.local");
async function etatCegep(base, nom) {
  await ath.goto(`${base}/athlete/recherche`, { waitUntil: "networkidle" });
  await ath.locator(".cs .lc").first().waitFor({ timeout: 60000 });
  await ath.waitForTimeout(2000);
  const texte = net(await ath.locator(".cs").innerText());
  const topbar = await ath.locator(".cs .topbar").evaluate((e) => e.outerHTML);
  const liste = await ath.locator(".cs .list").evaluate((e) => e.outerHTML);
  const carte = await ath.locator(".cs .maparea > div").first().evaluate((e) => `${e.className}|${e.getAttribute("aria-label")}`);
  const marqueurs = await ath.locator(".leaflet-marker-icon").count();
  const css = await ath.locator(".cs > style").first().evaluate((e) => e.innerHTML);
  // Sélection : clic sur la 1re ligne → panneau d'aperçu ; survol d'un marqueur → aucun effet nouveau.
  await ath.locator(".cs .lc").first().click();
  await ath.waitForTimeout(1500);
  const apercu = net(await ath.locator(".cs .preview").innerText());
  if (marqueurs > 0) await ath.locator(".leaflet-marker-icon").first().dispatchEvent("mouseover");
  const popups = await ath.locator(".leaflet-popup").count();
  await ath.screenshot({ path: path.join(OUT, `a-trouve-ton-cegep-${nom}.png`) });
  return { texte, topbar, liste, carte, marqueurs, css, apercu, popups };
}
const cAvant = await etatCegep(REF, "avant-main"), cApres = await etatCegep(APP, "apres-branche");
for (const k of ["texte", "topbar", "liste", "css", "apercu"]) {
  console.log(`A. Trouve ton cégep · ${k} : avant ${cAvant[k].length} car. md5 ${md5(cAvant[k])} | après ${cApres[k].length} car. md5 ${md5(cApres[k])} | identiques : ${cAvant[k] === cApres[k]}`);
}
console.log(`A. Trouve ton cégep · conteneur carte : « ${cAvant.carte} » | « ${cApres.carte} » | marqueurs ${cAvant.marqueurs} | ${cApres.marqueurs} | bulles après survol ${cAvant.popups} | ${cApres.popups}`);

/* ── B. Journée chargée (10 octobre), écran large ── */
async function journee(p, date) {
  await p.goto(`${APP}/recruteur/carte-matchs`, { waitUntil: "networkidle" });
  await p.getByTestId("date-carte").waitFor({ timeout: 60000 });
  await p.getByTestId("date-carte").fill(date);
  await p.waitForTimeout(2500);
}
await journee(pro, "2026-10-10");
console.log("B. résumé :", net(await pro.getByTestId("resume-journee").innerText()));
console.log("B. filtres :", net(await pro.getByTestId("filtres-carte").innerText()), "| grisés :", await pro.locator("[data-testid=filtres-carte] .fbtn.off").count(), "sur", await pro.locator("[data-testid=filtres-carte] .fbtn").count());
for (const [i, l] of (await pro.getByTestId("ligne-match").allInnerTexts()).entries()) console.log(`B. ligne ${i + 1} : ${net(l)}`);
console.log("B. marqueurs :", await pro.locator(".leaflet-marker-icon").count());
await pro.screenshot({ path: path.join(OUT, "b-journee.png") });

const ecart = async () => {
  const r = await pro.locator(".leaflet-marker-icon").evaluateAll((els) => els.map((e) => e.getBoundingClientRect()).map((b) => [b.x, b.y]));
  return r.length > 1 ? Math.round(Math.hypot(r[0][0] - r[1][0], r[0][1] - r[1][1])) : null;
};

// B1. Clic sur une ligne (15 h 30, Collège Laval) → zoom + bulle, ce match en tête.
const ecartAvant = await ecart();
const ligneLaval = pro.getByTestId("ligne-match").filter({ hasText: "15 h 30" });
await ligneLaval.click();
await pro.getByTestId("bulle").waitFor();
await pro.waitForTimeout(1800);
console.log(`B1. clic ligne 15 h 30 → écart entre 2 marqueurs : ${ecartAvant}px → ${await ecart()}px (zoom)`);
console.log("B1. bulle :", net(await pro.getByTestId("bulle").innerText()));
console.log("B1. ordre des matchs dans la bulle :", (await pro.getByTestId("bulle-match").allInnerTexts()).map((t) => t.split("\n")[0]).join(" | "));
const bulleDansCadre = await pro.evaluate(() => {
  const b = document.querySelector(".leaflet-popup")?.getBoundingClientRect();
  const c = document.querySelector("[data-testid=carte]")?.getBoundingClientRect();
  return !!b && !!c && b.top >= c.top && b.bottom <= c.bottom && b.left >= c.left && b.right <= c.right;
});
console.log("B1. bulle entièrement dans la carte :", bulleDansCadre, "| marqueur sélectionné :", await pro.locator(".leaflet-marker-icon.sel").count(), "| lignes mises en évidence :", await pro.locator(".lc.sel").count());
for (const l of await pro.getByTestId("bulle").locator("a").evaluateAll((as) => as.map((a) => `${a.textContent} → ${a.getAttribute("href")?.slice(0, 150)} [${a.getAttribute("target")}]`))) console.log("B1. lien :", l);
await pro.screenshot({ path: path.join(OUT, "b1-clic-ligne-bulle.png") });

// B2. Match sans heure (même terrain) → .ics journée entière.
const sansHeure = pro.getByTestId("bulle-match").filter({ hasText: "Heure à confirmer" });
const [dl] = await Promise.all([pro.waitForEvent("download"), sansHeure.getByRole("button", { name: ".ics" }).click()]);
const ics = fs.readFileSync(await dl.path(), "utf8");
fs.writeFileSync(path.join(OUT, "b2-match-sans-heure.ics"), ics);
console.log(`B2. .ics téléchargé (${dl.suggestedFilename()}) :`);
console.log(ics.split("\r\n").filter((l) => /^(DTSTART|DTEND|SUMMARY|LOCATION)/.test(l)).map((l) => "    " + l).join("\n"));
console.log("B2. Google :", await sansHeure.getByRole("link", { name: "Google" }).getAttribute("href"));
console.log("B2. Outlook :", (await sansHeure.getByRole("link", { name: "Outlook" }).getAttribute("href")).slice(0, 170));

// B3. Clic sur un point → bulle de CE terrain + ses lignes mises en évidence dans la liste.
const titres = [];
for (let i = 0; i < await pro.locator(".leaflet-marker-icon").count(); i++) {
  await pro.locator(".leaflet-marker-icon").nth(i).dispatchEvent("click");
  await pro.waitForTimeout(1500);
  const t = (await pro.getByTestId("bulle").innerText()).split("\n")[0];
  const sel = await pro.locator(".lc.sel").evaluateAll((els) => els.map((e) => e.innerText.split("\n")[0] + " @ " + e.innerText.split("\n")[1]));
  titres.push(t);
  console.log(`B3. clic point ${i + 1} → bulle « ${t} » (${await pro.getByTestId("bulle-match").count()} match(s)) | lignes en évidence : ${sel.join(" ; ")}`);
  if (/Lévis/i.test(t)) {
    console.log("B3. Loi 25 — bulle Lévis :", net(await pro.getByTestId("bulle").innerText()));
    await pro.screenshot({ path: path.join(OUT, "b3-clic-point-levis.png") });
  }
}
// B4. Survol d'un point → événement onHover (classe hov posée par la page).
await pro.keyboard.press("Escape");
await pro.locator(".leaflet-popup-close-button").click().catch(() => {});
await pro.locator(".leaflet-marker-icon:not(.sel)").first().dispatchEvent("mouseover");
await pro.waitForTimeout(300);
console.log("B4. survol d'un point → marqueurs en survol :", await pro.locator(".leaflet-marker-icon.hov").count());

/* ── C. Journée vide ── */
await journee(pro, "2026-10-13");
console.log("C. résumé :", net(await pro.getByTestId("resume-journee").innerText()), "|", net(await pro.getByTestId("aucun-match").innerText()));
console.log("C. filtres grisés :", await pro.locator("[data-testid=filtres-carte] .fbtn.off").count(), "sur", await pro.locator("[data-testid=filtres-carte] .fbtn").count());
await pro.screenshot({ path: path.join(OUT, "c-journee-vide.png") });

/* ── D. Lieu non précisé ── */
await journee(pro, "2026-11-07");
console.log("D. résumé :", net(await pro.getByTestId("resume-journee").innerText()));
console.log("D. ligne :", net(await pro.getByTestId("ligne-match").first().innerText()));
await pro.getByTestId("ligne-match").first().click();
await pro.waitForTimeout(800);
console.log("D. marqueurs :", await pro.locator(".leaflet-marker-icon").count(), "| bulle après clic :", await pro.getByTestId("bulle").count(), "| aria-disabled :", await pro.getByTestId("ligne-match").first().getAttribute("aria-disabled"));
await pro.screenshot({ path: path.join(OUT, "d-lieu-non-precise.png") });

/* ── E. Menu ── */
const menu = await pro.locator("aside a, nav a").evaluateAll((as) => as.map((a) => a.textContent?.trim()).filter(Boolean));
const i = menu.findIndex((t) => /^Calendrier/.test(t));
console.log("E. menu autour du Calendrier :", menu.slice(Math.max(0, i), i + 3).join(" | "));

/* ── F. Fenêtre étroite : bascule liste ↔ carte ── */
const etroit = await page("r3.collegue@preuve.local", 800, 900);
await journee(etroit, "2026-10-10");
const visible = async (sel) => etroit.locator(sel).first().isVisible();
console.log(`F. 800 px, départ : liste ${await visible("[data-testid=liste-matchs]")} · carte ${await visible("[data-testid=carte]")} · bouton « ${net(await etroit.getByTestId("bascule-vue").innerText())} »`);
await etroit.screenshot({ path: path.join(OUT, "f1-etroit-liste.png") });
await etroit.getByTestId("bascule-vue").click();
await etroit.waitForTimeout(1500);
console.log(`F. après bascule : liste ${await visible("[data-testid=liste-matchs]")} · carte ${await visible("[data-testid=carte]")} · marqueurs ${await etroit.locator(".leaflet-marker-icon").count()} · bouton « ${net(await etroit.getByTestId("bascule-vue").innerText())} »`);
await etroit.screenshot({ path: path.join(OUT, "f2-etroit-carte.png") });
await etroit.getByTestId("bascule-vue").click();
await etroit.waitForTimeout(500);
await etroit.getByTestId("ligne-match").filter({ hasText: "13 h" }).first().click();
await etroit.getByTestId("bulle").waitFor();
await etroit.waitForTimeout(1800);
console.log(`F. clic ligne en vue liste → vue carte ${await visible("[data-testid=carte]")} · bulle « ${(await etroit.getByTestId("bulle").innerText()).split("\n")[0]} »`);
await etroit.screenshot({ path: path.join(OUT, "f3-etroit-clic-ligne.png") });

/* ── G. Compte gratuit : le mur ── */
const gratuit = await page("r6.gratuit@preuve.local");
const requetes = [];
gratuit.on("request", (r) => { if (/\/rest\/v1\/(games|recruiter_pipeline|team_athletes)/.test(r.url())) requetes.push(r.url()); });
await gratuit.goto(`${APP}/recruteur/carte-matchs`, { waitUntil: "networkidle" });
await gratuit.waitForTimeout(2000);
console.log("G. gratuit :", net(await gratuit.locator("main").innerText()).slice(0, 240));
console.log("G. carte montée ?", await gratuit.getByTestId("carte-matchs").count() > 0, "| requêtes games/pipeline/team_athletes :", requetes.length);
await gratuit.screenshot({ path: path.join(OUT, "g-mur-gratuit.png") });

await nav.close();
