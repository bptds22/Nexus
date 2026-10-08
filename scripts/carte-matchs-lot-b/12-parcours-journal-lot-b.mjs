// Parcours navigateur — lot B, décisions BP du 2026-10-08 : « Autres matchs à ce
// terrain » et journal de l'unité (MATCH_AJOUTE / MATCH_RETIRE), base LOCALE.
//   SUPABASE_SERVICE_ROLE_KEY=… APP=http://localhost:3007 OUT=<captures> node 12-parcours-journal-lot-b.mjs
// Sessions RÉELLES (lien magique admin → /verify) : r3.collegue (Pro), r1.avec.cegep (admin cégep).
// Laisse la base comme il l'a trouvée (journal MATCH_* et matchs_ajoutes retirés à la fin).
import path from "node:path";
import { chromium } from "playwright";

const API = "http://127.0.0.1:54321";
const APP = process.env.APP ?? "http://localhost:3007";
const OUT = process.env.OUT ?? ".";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const svcH = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const net = (s) => s.replace(/\s+/g, " ").trim();

async function cookiesPour(email) {
  const g = await (await fetch(`${API}/auth/v1/admin/generate_link`, { method: "POST", headers: svcH, body: JSON.stringify({ type: "magiclink", email }) })).json();
  const s = await (await fetch(`${API}/auth/v1/verify`, { method: "POST", headers: svcH, body: JSON.stringify({ type: "magiclink", email, token: g.email_otp ?? g.properties?.email_otp }) })).json();
  if (!s.access_token) throw new Error(`session ${email} : ` + JSON.stringify(s).slice(0, 200));
  const v = "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url");
  const m = v.match(/.{1,3180}/g);
  return (m.length === 1 ? [{ name: "sb-127-auth-token", value: v }] : m.map((x, i) => ({ name: `sb-127-auth-token.${i}`, value: x })))
    .map((c) => ({ ...c, domain: "localhost", path: "/" }));
}
const nav = await chromium.launch();
async function page(email, width = 1440, height = 1000) {
  const ctx = await nav.newContext({ viewport: { width, height } });
  await ctx.addCookies(await cookiesPour(email));
  return ctx.newPage();
}
const journal = async () => (await (await fetch(`${API}/rest/v1/recruiter_activity_log?action_type=in.(MATCH_AJOUTE,MATCH_RETIRE)&select=action_type`, { headers: svcH })).json()).length;

const pro = await page("r3.collegue@preuve.local");
await pro.goto(`${APP}/recruteur/carte-matchs`, { waitUntil: "networkidle" });
await pro.getByTestId("date-debut").waitFor({ timeout: 90000 });
await pro.getByTestId("date-debut").fill("2026-10-10");
await pro.waitForTimeout(3000);
console.log(`départ : ${net(await pro.getByTestId("resume").innerText())} · journal MATCH_* = ${await journal()}`);

/* ── L. Autres matchs à ce terrain ── */
const TERRAIN = "École Polyvalente Saint-Joseph";
const duTerrain = pro.getByTestId("ligne-match").filter({ hasText: TERRAIN });
const nTerrain = await duTerrain.count();
const premier = duTerrain.first();
const titrePremier = await premier.locator(".lctitre b").innerText();
await premier.click();
await pro.getByTestId("panneau").waitFor();
await pro.waitForTimeout(1200);
const autres = pro.getByTestId("autre-match");
console.log(`L. « ${TERRAIN} » : ${nTerrain} matchs dans la liste · panneau sur « ${titrePremier} » · « Autres matchs à ce terrain » : ${await autres.count()} ligne(s)`);
for (const a of await autres.all()) console.log(`L.   ${net(await a.innerText())}`);
console.log(`L. le match ouvert est absent de la section : ${!(await pro.getByTestId("autres-matchs").innerText()).includes(titrePremier)}`);
await pro.screenshot({ path: path.join(OUT, "l-autres-matchs.png") });

const cible = autres.first();
const idCible = await cible.getAttribute("data-match");
const titreCible = await cible.locator(".lctitre b").innerText();
await cible.click();
await pro.waitForTimeout(1500);
console.log(`L. clic sur « ${titreCible} » → panneau « ${(await pro.getByTestId("panneau").innerText()).split("\n")[1]} » · ligne en évidence : ${await pro.locator(".cards .lc.sel .lctitre b").innerText()} · « ${titrePremier} » passe dans les autres : ${(await pro.getByTestId("autres-matchs").innerText()).includes(titrePremier)}`);

// Un match sans autre match au même terrain : pas de section.
const terrainsListe = await pro.getByTestId("ligne-match").evaluateAll((ls) => ls.map((l) => l.getAttribute("data-terrain")).filter(Boolean));
const unique = terrainsListe.find((t) => terrainsListe.filter((x) => x === t).length === 1);
const seul = pro.locator(`[data-testid=ligne-match][data-terrain="${unique}"]`);
const titreSeul = await seul.locator(".lctitre b").innerText();
await seul.click();
await pro.waitForTimeout(1200);
console.log(`L. « ${titreSeul} » (seul à son terrain dans les résultats) : section présente : ${await pro.getByTestId("autres-matchs").count() > 0}`);

/* ── M. « + » depuis la section → journal ── */
const premierLigne = pro.locator(`[data-testid=ligne-match]`).filter({ hasText: TERRAIN }).first();
await premierLigne.click();
await pro.waitForTimeout(1200);
const bouton = pro.locator(`[data-testid=autre-match][data-match="${idCible}"]`).getByTestId("bouton-calendrier");
const etatAvant = await bouton.getAttribute("data-etat");
await bouton.click();
await pro.waitForTimeout(2500);
console.log(`M. « + » dans la section : ${etatAvant} → ${await bouton.getAttribute("data-etat")} · ligne de la liste : ${await pro.locator(`[data-testid=ligne-match][data-match="${idCible}"]`).getByTestId("bouton-calendrier").getAttribute("data-etat")} · journal MATCH_* = ${await journal()}`);

await pro.goto(`${APP}/recruteur/tableau-de-bord`, { waitUntil: "networkidle" });
await pro.waitForTimeout(3500);
const fil = net(await pro.locator("main").innerText());
const i = fil.indexOf("Match ajouté");
console.log(`M. tableau de bord de r3 : ${i >= 0 ? `« ${fil.slice(i, i + 110)} »` : "ABSENT"}`);
await pro.goto(`${APP}/recruteur/activites`, { waitUntil: "networkidle" });
await pro.waitForTimeout(3500);
const act = net(await pro.locator("main").innerText());
const k = act.indexOf("Match ajouté");
console.log(`M. Activités de r3 : ${k >= 0 ? `« ${act.slice(k, k + 120)} »` : "ABSENT"} · filtre « Calendrier » : ${await pro.getByRole("button", { name: "Calendrier", exact: true }).count()}`);
await pro.screenshot({ path: path.join(OUT, "m-activites.png") });

const admin = await page("r1.avec.cegep@preuve.local");
await admin.goto(`${APP}/recruteur/tableau-de-bord`, { waitUntil: "networkidle" });
await admin.waitForTimeout(4000);
const filAdmin = net(await admin.locator("main").innerText());
const j = filAdmin.indexOf("Match ajouté");
console.log(`M. tableau de bord de r1 (admin cégep, même unité) : ${j >= 0 ? `« ${filAdmin.slice(j, j + 110)} »` : "ABSENT"}`);
await admin.screenshot({ path: path.join(OUT, "m-fil-unite-admin.png") });

/* ── N. « ✓ » retire → MATCH_RETIRE ── */
await pro.goto(`${APP}/recruteur/carte-matchs`, { waitUntil: "networkidle" });
await pro.getByTestId("date-debut").waitFor({ timeout: 60000 });
await pro.getByTestId("date-debut").fill("2026-10-10");
await pro.waitForTimeout(3000);
await pro.locator(`[data-testid=ligne-match][data-match="${idCible}"]`).getByTestId("bouton-calendrier").click();
await pro.waitForTimeout(2500);
console.log(`N. « ✓ » → ${await pro.locator(`[data-testid=ligne-match][data-match="${idCible}"]`).getByTestId("bouton-calendrier").getAttribute("data-etat")} · journal MATCH_* = ${await journal()}`);
await pro.goto(`${APP}/recruteur/tableau-de-bord`, { waitUntil: "networkidle" });
await pro.waitForTimeout(3500);
const fil2 = net(await pro.locator("main").innerText());
const r = fil2.indexOf("Match retiré");
console.log(`N. tableau de bord de r3 : ${r >= 0 ? `« ${fil2.slice(r, r + 110)} »` : "ABSENT"}`);

await nav.close();
await fetch(`${API}/rest/v1/recruiter_activity_log?action_type=in.(MATCH_AJOUTE,MATCH_RETIRE)`, { method: "DELETE", headers: svcH });
await fetch(`${API}/rest/v1/matchs_ajoutes?id=not.is.null`, { method: "DELETE", headers: svcH });
console.log(`fin : journal MATCH_* = ${await journal()}`);
