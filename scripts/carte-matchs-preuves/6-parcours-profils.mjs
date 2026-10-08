// Parcours navigateur — carte des matchs, lot A+ « profils Nexus dans ce match », base LOCALE.
//   SUPABASE_SERVICE_ROLE_KEY=… REF=http://localhost:3008 APP=http://localhost:3007 OUT=<captures> node 6-parcours-profils.mjs
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
  fs.writeFileSync(path.join(OUT, `a-${k}-avant.txt`), cAvant[k]); fs.writeFileSync(path.join(OUT, `a-${k}-apres.txt`), cApres[k]);
  console.log(`A. Trouve ton cégep · ${k} : avant ${cAvant[k].length} car. md5 ${md5(cAvant[k])} | après ${cApres[k].length} car. md5 ${md5(cApres[k])} | identiques : ${cAvant[k] === cApres[k]}`);
}
console.log(`A. Trouve ton cégep · conteneur carte : « ${cAvant.carte} » | « ${cApres.carte} » | marqueurs ${cAvant.marqueurs} | ${cApres.marqueurs} | bulles après survol ${cAvant.popups} | ${cApres.popups}`);

/* ── B. Profils Nexus, 10 octobre ── */
const appels = [];
pro.on("request", (r) => { if (r.url().includes("/rpc/matchs_profils_nexus")) appels.push(r.postData()); });
await pro.goto(`${APP}/recruteur/carte-matchs`, { waitUntil: "networkidle" });
await pro.getByTestId("date-carte").waitFor({ timeout: 60000 });
const avantJour = appels.length;
await pro.getByTestId("date-carte").fill("2026-10-10");
await pro.waitForTimeout(3000);
console.log(`B. appels RPC pour la journée : ${appels.length - avantJour} · p_games envoyés : ${JSON.parse(appels.at(-1) ?? "{}").p_games?.length}`);
for (const l of await pro.getByTestId("ligne-match").all()) {
  const titre = await l.locator(".lctitre b").innerText();
  const p = l.getByTestId("pastille-profils");
  console.log(`B. ${titre.padEnd(48)} → ${(await p.count()) ? await p.innerText() : "(aucune pastille)"}`);
}
await pro.screenshot({ path: path.join(OUT, "b-pastilles.png") });
const n0 = appels.length;
await pro.locator("[data-testid=filtres-carte] .fbtn").filter({ hasText: "Catégorie" }).locator(".lbl").click();
await pro.locator(".dd label").filter({ hasText: "Cadet" }).click();
await pro.waitForTimeout(1500);
console.log(`B. filtre Cadet → ${await pro.getByTestId("ligne-match").count()} lignes · nouveaux appels RPC : ${appels.length - n0}`);
await pro.locator(".dd .ddclear").click();
await pro.mouse.click(5, 5);
await pro.waitForTimeout(800);

/* ── C. Bulle : liste des profils, suivis d'abord, liens ── */
await pro.getByTestId("ligne-match").filter({ hasText: "15 h 30" }).click();
await pro.getByTestId("liste-profils").first().waitFor();
await pro.waitForTimeout(1500);
const bm = pro.getByTestId("bulle-match").first();
console.log("C. 1er match de la bulle :", (await bm.innerText()).split("\n").slice(0, 2).join(" · "));
for (const r of await bm.getByTestId("profil-nexus").all()) {
  const lien = r.locator("a");
  console.log(`C. profil : ${net(await r.innerText())} | lien ${await lien.getAttribute("href")} | suivi ${await r.locator(".b.need").count() > 0}`);
}
const autres = await pro.getByTestId("bulle-match").evaluateAll((els) => els.slice(1).map((e) => `${e.innerText.split("\n")[0]} : ${e.querySelector("[data-testid=liste-profils]") ? "liste" : "aucune liste"}`));
console.log("C. autres matchs du terrain :", autres.join(" | "));
console.log("C. texte interdit dans la bulle (Mineur / Desactive) :", /Mineur|Desactive/.test(await pro.getByTestId("bulle").innerText()));
await pro.screenshot({ path: path.join(OUT, "c-bulle-profils.png") });
const premier = bm.getByTestId("profil-nexus").first().locator("a");
const href = await premier.getAttribute("href");
await premier.click();
await pro.waitForURL(`**${href}`, { timeout: 60000 });
await pro.waitForTimeout(3000);
console.log(`C. clic sur le lien → ${new URL(pro.url()).pathname} · la fiche affiche « Majeur Cprofils » : ${/majeur\s+cprofils/i.test(await pro.locator("main").innerText())}`);
await pro.screenshot({ path: path.join(OUT, "c-fiche-profil.png") });

/* ── D. Lévis : seul un mineur sans consentement → aucune pastille, aucune liste ── */
await pro.goto(`${APP}/recruteur/carte-matchs`, { waitUntil: "networkidle" });
await pro.getByTestId("date-carte").fill("2026-10-10");
await pro.waitForTimeout(2500);
const levis = pro.getByTestId("ligne-match").filter({ hasText: "Lévis" });
console.log("D. ligne Lévis :", net(await levis.innerText()), "| pastille :", await levis.getByTestId("pastille-profils").count());
await levis.click();
await pro.getByTestId("bulle").waitFor();
await pro.waitForTimeout(1200);
console.log("D. bulle Lévis :", net(await pro.getByTestId("bulle").innerText()), "| liste profils :", await pro.getByTestId("liste-profils").count());

/* ── E. Compte gratuit : le mur, aucun appel RPC ── */
const gratuit = await page("r6.gratuit@preuve.local");
const appelsGratuit = [];
gratuit.on("request", (r) => { if (/\/rest\/v1\/(rpc\/matchs_profils_nexus|games|team_athletes)/.test(r.url())) appelsGratuit.push(r.url()); });
await gratuit.goto(`${APP}/recruteur/carte-matchs`, { waitUntil: "networkidle" });
await gratuit.waitForTimeout(2000);
console.log("E. gratuit :", net(await gratuit.locator("main").innerText()).slice(0, 120), "| appels RPC/données :", appelsGratuit.length);

await nav.close();
