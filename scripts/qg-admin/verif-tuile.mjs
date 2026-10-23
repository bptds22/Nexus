// QG admin — tuile « Comptes connectés » : le chiffre seul, sans écart ni
// période d'avant, avec « Comparaison à venir. ». Navigateur SANS INTERFACE, base LOCALE.
//   node verif-tuile.mjs <port> <capture.png>
import { chromium } from "playwright";
import { cookiesSession } from "./session-locale.mjs";

const [, , port, capture] = process.argv;
const admin = (await cookiesSession("admin@demo.local")).map((c) => ({ ...c, domain: "localhost", path: "/", httpOnly: false, secure: false, sameSite: "Lax" }));
const navigateur = await chromium.launch({ headless: true });
let echecs = 0;
for (const periode of ["jour", "semaine", "mois"]) {
  const ctx = await navigateur.newContext({ viewport: { width: 1366, height: 768 } });
  await ctx.addCookies(admin);
  const p = await ctx.newPage();
  for (let essai = 1; essai <= 8; essai++) {
    const api = p.waitForResponse((r) => r.url().includes("/api/admin/qg"), { timeout: 30000 }).catch(() => null);
    await p.goto(`http://localhost:${port}/admin/qg?onglet=croissance&periode=${periode}`, { waitUntil: "domcontentloaded" });
    const r = await api;
    if (r && r.status() === 200) break;
    await p.waitForTimeout(8000);
  }
  const tuile = p.locator("section", { has: p.locator("text=Comptes connectés") }).first();
  await tuile.waitFor({ timeout: 20000 });
  const texte = (await tuile.innerText()).replace(/\s+/g, " ").trim();
  const ok = texte.includes("Comparaison à venir.") && !/[▲▼＝]/.test(texte) && !texte.includes("%") && !/\bvs\b|hier|semaine dernière|mois dernier/i.test(texte.replace(/^Comptes connectés/, ""));
  if (!ok) echecs++;
  console.log(`${periode} : ${ok ? "OK" : "ÉCHEC"} — « ${texte} »`);
  if (periode === "mois" && capture) await tuile.screenshot({ path: capture });
  await ctx.close();
}
await navigateur.close();
process.exit(echecs ? 1 : 0);
