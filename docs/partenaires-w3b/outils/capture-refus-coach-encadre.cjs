// Refus côté coach, APRÈS correction : l'encadré dans la page (plus d'alert()).
// Navigateur SANS interface uniquement — jamais de capture de l'écran de BP.
// window.alert est espionné : s'il était encore appelé, le script échoue.
//
// Prérequis : serveur local sur la base Docker (jamais .env.local = prod),
// Félix admissible et « Vitesse » posé par un partenaire, session coach locale
// dans session-coach.json à côté du script.
// Usage : node capture-refus-coach-encadre.cjs <dossier-session> <fichier-png>
const { chromium } = require("C:/Users/bptds/Documents/Nexus/node_modules/playwright");
const fs = require("fs"), path = require("path");
const BASE = "http://localhost:3007", FELIX = "d3a00000-0000-4000-8000-0000000c2012";
const [dossier, sortie] = process.argv.slice(2);

(async () => {
  const s = JSON.parse(fs.readFileSync(path.join(dossier, "session-coach.json"), "utf8"));
  const v = "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url");
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1300, height: 950 }, locale: "fr-CA", deviceScaleFactor: 2 });
  await ctx.addCookies(v.length <= 3180 ? [{ name: "sb-127-auth-token", value: v, url: BASE }]
    : [0, 1, 2].map((i) => ({ name: `sb-127-auth-token.${i}`, value: v.slice(i * 3180, (i + 1) * 3180), url: BASE })).filter((c) => c.value));
  await ctx.addInitScript(() => { window.alert = (m) => { window.__alerte = String(m); }; });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/coach/athletes/${FELIX}/modifier`, { waitUntil: "networkidle", timeout: 300000 });
  await p.locator("button, [role=button], div").filter({ hasText: /^5$/ }).last().click();
  await p.waitForTimeout(1500);
  const tuile = p.locator("button[aria-pressed]").filter({ hasText: "Vitesse" }).first();
  await tuile.scrollIntoViewIfNeeded();
  if ((await tuile.getAttribute("aria-pressed")) !== "true") await tuile.click();
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: /^Enregistrer$/ }).first().click();
  const encadre = p.locator("[data-erreur-sauvegarde]");
  await encadre.waitFor({ timeout: 60000 });
  await p.waitForTimeout(900); // défilement doux jusqu'à l'encadré
  const texte = (await encadre.innerText()).trim();
  const alerte = await p.evaluate(() => window.__alerte ?? null);
  console.log("encadré :", texte);
  console.log("alert() appelé :", alerte ?? "non");
  if (alerte) throw new Error("alert() encore appelé");
  if (texte.includes("NEXUS") || texte.includes("Erreur lors de la sauvegarde")) throw new Error("message brut affiché");
  await p.screenshot({ path: sortie }); // la fenêtre, défilée sur l'encadré
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
