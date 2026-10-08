// Parcours navigateur — carte des matchs, LOT B (moteur de recherche + calendrier), base LOCALE.
//   SUPABASE_SERVICE_ROLE_KEY=… REF=http://localhost:3008 APP=http://localhost:3007 OUT=<captures> node 10-parcours-lot-b.mjs
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

/* ── B. Ouverture : aujourd'hui, sport de l'unité ── */
const appels = [];
pro.on("request", (r) => { if (r.url().includes("/rpc/matchs_recherche")) appels.push(JSON.parse(r.postData() ?? "{}")); });
await pro.goto(`${APP}/recruteur/carte-matchs`, { waitUntil: "networkidle" });
await pro.getByTestId("date-debut").waitFor({ timeout: 60000 });
await pro.waitForTimeout(2500);
console.log(`B. ouverture : date = ${await pro.getByTestId("date-debut").inputValue()} · « au » = « ${await pro.getByTestId("date-fin").inputValue()} » · en-tête « ${net(await pro.locator(".brand").innerText())} »`);
console.log(`B. filtres : ${net(await pro.getByTestId("filtres-carte").innerText())} · grisés : ${await pro.locator("[data-testid=filtres-carte] .fbtn.off").count()}`);
console.log(`B. 1er appel : ${JSON.stringify(appels[0])}`);
console.log(`B. résumé : ${net(await pro.getByTestId("resume").innerText())}`);
await pro.screenshot({ path: path.join(OUT, "b-ouverture.png") });

const fixerDate = async (debut, fin = "") => {
  await pro.getByTestId("date-debut").fill(debut);
  await pro.getByTestId("date-fin").fill(fin);
  await pro.waitForTimeout(2500);
};
const lignes = async () => (await pro.getByTestId("ligne-match").all()).length;

/* ── C. 10 octobre ; changement de sport ── */
await fixerDate("2026-10-10");
console.log(`C. 10 oct., Football : ${net(await pro.getByTestId("resume").innerText())} · jours : ${(await pro.getByTestId("jour").allInnerTexts()).join(" | ")}`);
const l1 = (await pro.getByTestId("ligne-match").first().innerText()).split("\n").map((x) => x.trim()).filter(Boolean);
console.log(`C. 1re ligne : ${l1.join(" · ")}`);
await pro.locator("[data-testid=filtres-carte] .fbtn").filter({ hasText: "Sport" }).locator(".lbl").click();
await pro.locator(".dd label").filter({ hasText: /^Basketball$/ }).click();
await pro.waitForTimeout(2500);
console.log(`C. sport → Basketball : ${net(await pro.getByTestId("resume").innerText())} · dernier appel p_sport = ${appels.at(-1)?.p_sport}`);
await pro.locator(".dd label").filter({ hasText: /^Football$/ }).click();
await pro.mouse.click(5, 5);
await pro.waitForTimeout(2500);
console.log(`C. retour Football : ${net(await pro.getByTestId("resume").innerText())}`);

/* ── D. Recherche d'une équipe ── */
await pro.getByTestId("recherche-texte").fill("laval");
await pro.waitForTimeout(2500);
console.log(`D. texte « laval » : ${net(await pro.getByTestId("resume").innerText())} → ${(await pro.locator("[data-testid=ligne-match] .lctitre b").allInnerTexts()).join(" | ")}`);
await pro.getByTestId("recherche-texte").fill("");
await pro.waitForTimeout(2000);

/* ── E. Plage de 2 jours ; plage trop longue ── */
await fixerDate("2026-10-10", "2026-10-11");
console.log(`E. 10 → 11 oct. : ${net(await pro.getByTestId("resume").innerText())} · jours : ${(await pro.getByTestId("jour").allInnerTexts()).join(" | ")}`);
const nAppels = appels.length;
await fixerDate("2026-10-10", "2026-10-17");
console.log(`E. 10 → 17 oct. (8 jours) : « ${net(await pro.getByTestId("resume").innerText())} » · lignes ${await lignes()} · appels envoyés : ${appels.length - nAppels}`);
await fixerDate("2026-10-10");

/* ── F. Points ; étoile ; lieu civil et lieu faux ── */
console.log(`F. points : ${await pro.locator(".leaflet-marker-icon").count()} · avec étoile (cible) : ${await pro.locator(".leaflet-marker-icon.pin-cible").count()}`);
const civil = pro.getByTestId("ligne-match").filter({ hasText: "Cougars Cmatchs" });
const faux = pro.getByTestId("ligne-match").filter({ hasText: "Zéro A Cmatchs" });
console.log(`F. civil : ${net(await civil.innerText())} · a un point : ${(await civil.getAttribute("data-terrain")) !== null}`);
console.log(`F. coordonnées 0,0 : ${net(await faux.innerText())} · a un point : ${(await faux.getAttribute("data-terrain")) !== null}`);
await pro.screenshot({ path: path.join(OUT, "f-points-etoile.png") });

/* ── G. Panneau : match suivi (✓ fixe) avec profils ── */
const suivi = pro.locator("[data-testid=ligne-match]").filter({ has: pro.locator("[data-etat=SUIVI]") }).first();
await suivi.click();
await pro.getByTestId("panneau").waitFor();
await pro.getByTestId("profil-nexus").first().waitFor({ timeout: 15000 });
await pro.waitForTimeout(1500);
console.log(`G. panneau : ${net(await pro.getByTestId("panneau").innerText())}`);
for (const r of await pro.getByTestId("profil-nexus").all()) {
  console.log(`G. profil : ${net(await r.innerText())} → ${await r.locator("a").getAttribute("href")}`);
}
console.log(`G. bouton de la ligne : ${await suivi.getByTestId("bouton-calendrier").innerText()} (${await suivi.getByTestId("bouton-calendrier").getAttribute("data-etat")}, désactivé : ${await suivi.getByTestId("bouton-calendrier").isDisabled()}) · bouton du panneau désactivé : ${await pro.getByTestId("panneau-calendrier").isDisabled()}`);
console.log(`G. texte interdit (mineur sans consentement) : ${/Mineur Cprofils/.test(await pro.getByTestId("panneau").innerText())}`);
await pro.screenshot({ path: path.join(OUT, "g-panneau-profils.png") });
await pro.locator(".preview .close").click();

/* ── H. Clic sur un point → même panneau ── */
await pro.locator(".leaflet-marker-icon").first().dispatchEvent("click");
await pro.waitForTimeout(1500);
console.log(`H. clic sur un point → panneau « ${(await pro.getByTestId("panneau").innerText()).split("\n")[0]} » · ligne en évidence : ${await pro.locator(".lc.sel .lctitre b").innerText()}`);
await pro.locator(".preview .close").click();

/* ── I. + → ✓ → au Calendrier avec 0 cible → ✓ retire ── */
const libre = pro.locator("[data-testid=ligne-match]").filter({ has: pro.locator("[data-etat=LIBRE]") }).filter({ hasText: "Collège" }).first();
const idLibre = await libre.getAttribute("data-match");
const titreLibre = await libre.locator(".lctitre b").innerText();
await libre.getByTestId("bouton-calendrier").click();
await pro.waitForTimeout(2500);
const apres = pro.locator(`[data-match="${idLibre}"]`);
console.log(`I. « ${titreLibre} » : + → ${await apres.getByTestId("bouton-calendrier").innerText()} (${await apres.getByTestId("bouton-calendrier").getAttribute("data-etat")})`);
await pro.goto(`${APP}/recruteur/calendrier`, { waitUntil: "networkidle" });
await pro.waitForTimeout(3000);
const cal = await pro.locator("main").innerText();
const [dom, vis] = titreLibre.split(" vs ");
const bloc = cal.split(/\n/).map((x) => x.trim()).filter(Boolean);
const i = bloc.findIndex((x) => x.includes(dom) && x.includes(vis)) >= 0 ? bloc.findIndex((x) => x.includes(dom) && x.includes(vis)) : bloc.findIndex((x) => x.includes(dom));
console.log(`I. Calendrier : le match apparaît : ${i >= 0} · voisinage : ${bloc.slice(Math.max(0, i - 2), i + 8).join(" ¦ ")}`);
await pro.screenshot({ path: path.join(OUT, "i-calendrier-match-ajoute.png"), fullPage: true });
await pro.goto(`${APP}/recruteur/carte-matchs`, { waitUntil: "networkidle" });
await pro.getByTestId("date-debut").waitFor();
await fixerDate("2026-10-10");
await pro.locator(`[data-match="${idLibre}"]`).getByTestId("bouton-calendrier").click();
await pro.waitForTimeout(2500);
console.log(`I. ✓ → ${await pro.locator(`[data-match="${idLibre}"]`).getByTestId("bouton-calendrier").innerText()} (${await pro.locator(`[data-match="${idLibre}"]`).getByTestId("bouton-calendrier").getAttribute("data-etat")})`);
const calApresRetrait = net(await (async () => { await pro.goto(`${APP}/recruteur/calendrier`, { waitUntil: "networkidle" }); await pro.waitForTimeout(3000); return pro.locator("main").innerText(); })());
console.log(`I. Calendrier après retrait : identique au départ : ${calApresRetrait === calApres} (md5 ${md5(calApresRetrait)})`);

/* ── J. Fenêtre étroite ── */
const etroit = await page("r3.collegue@preuve.local", 800, 900);
await etroit.goto(`${APP}/recruteur/carte-matchs`, { waitUntil: "networkidle" });
await etroit.getByTestId("date-debut").fill("2026-10-10");
await etroit.waitForTimeout(3000);
const vis2 = async (sel) => etroit.locator(sel).first().isVisible();
console.log(`J. 800 px : liste ${await vis2("[data-testid=liste-matchs]")} · carte ${await vis2("[data-testid=carte]")} · bouton « ${net(await etroit.getByTestId("bascule-vue").innerText())} »`);
await etroit.getByTestId("ligne-match").first().click();
await etroit.waitForTimeout(1800);
console.log(`J. clic ligne → carte ${await vis2("[data-testid=carte]")} · panneau ${await vis2("[data-testid=panneau]")}`);
await etroit.screenshot({ path: path.join(OUT, "j-etroit.png") });

/* ── K. Compte gratuit : le mur ── */
const gratuit = await page("r6.gratuit@preuve.local");
const appelsGratuit = [];
gratuit.on("request", (r) => { if (/\/rest\/v1\/(rpc\/matchs_recherche|rpc\/matchs_profils_nexus|matchs_ajoutes|games)/.test(r.url())) appelsGratuit.push(r.url()); });
await gratuit.goto(`${APP}/recruteur/carte-matchs`, { waitUntil: "networkidle" });
await gratuit.waitForTimeout(2000);
console.log(`K. gratuit : ${net(await gratuit.locator("main").innerText()).slice(0, 110)} | carte montée : ${await gratuit.getByTestId("carte-matchs").count() > 0} | appels : ${appelsGratuit.length}`);

await nav.close();
