// Captures W3b — serveur local :3007 (worktree, base Docker).
const { chromium } = require("C:/Users/bptds/Documents/Nexus/node_modules/playwright");
const fs = require("fs");
const path = require("path");
const ICI = __dirname;
const SORTIE = path.join(ICI, "captures");
fs.mkdirSync(SORTIE, { recursive: true });
const BASE = "http://localhost:3007";
const FELIX = "d3a00000-0000-4000-8000-0000000c2012";

function cookies(fichier) {
  const s = JSON.parse(fs.readFileSync(path.join(ICI, fichier), "utf8"));
  const v = "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url");
  const m = [];
  for (let i = 0; i < v.length; i += 3180) m.push(v.slice(i, i + 3180));
  return m.length === 1 ? [{ name: "sb-127-auth-token", value: v, url: BASE }]
    : m.map((x, i) => ({ name: `sb-127-auth-token.${i}`, value: x, url: BASE }));
}

async function reflet(p) {
  // Le reflet = le ::after de .nx-badge : masque et animation, lus dans le style CALCULÉ.
  return p.$$eval("[data-badge-partenaire] .nx-badge", (els) => els.map((el) => {
    const a = getComputedStyle(el, "::after");
    return {
      classes: el.className,
      masque: (a.webkitMaskImage || a.maskImage || "").slice(0, 120),
      animation: a.animationName,
      duree: a.animationDuration,
    };
  }));
}

(async () => {
  const b = await chromium.launch();
  const erreurs = [];

  // ── Recruteur : la rangée Distinctions de Félix ──
  let ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: "fr-CA", deviceScaleFactor: 2 });
  await ctx.addCookies(cookies("session-rec.json"));
  let p = await ctx.newPage();
  p.on("pageerror", (e) => erreurs.push("rec: " + e));
  await p.goto(`${BASE}/recruteur/athletes/${FELIX}`, { waitUntil: "networkidle", timeout: 300000 });
  await p.waitForSelector("[data-badge-partenaire]", { timeout: 60000 });
  await p.waitForTimeout(1500);
  const rangee = p.locator("[data-badge-partenaire]").first().locator("xpath=..");
  await rangee.scrollIntoViewIfNeeded();
  await p.waitForTimeout(800);
  const boite = await rangee.boundingBox();
  const zone = { x: Math.max(0, boite.x - 40), y: Math.max(0, boite.y - 70), width: Math.min(1440, boite.width + 80), height: boite.height + 110 };
  await p.screenshot({ path: path.join(SORTIE, "1-recruteur-distinctions.png"), clip: zone });
  // série : le cycle du reflet dure 6 s, décalé par badge
  for (let i = 0; i < 24; i++) {
    await p.screenshot({ path: path.join(SORTIE, `reflet-${String(i).padStart(2, "0")}.png`), clip: zone });
    await p.waitForTimeout(250);
  }
  console.log("reflet (recruteur) :", JSON.stringify(await reflet(p), null, 1));
  console.log("textes :", JSON.stringify(await p.$$eval("[data-badge-partenaire]", (els) => els.map((e) => e.innerText.replace(/\s+/g, " ").trim()))));
  await p.screenshot({ path: path.join(SORTIE, "2-recruteur-fiche.png"), fullPage: false });
  await ctx.close();

  // ── Partenaire : sa fiche, et le choix des badges Nexus ──
  ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: "fr-CA", deviceScaleFactor: 2 });
  await ctx.addCookies(cookies("session-part.json"));
  p = await ctx.newPage();
  p.on("pageerror", (e) => erreurs.push("part: " + e));
  await p.goto(`${BASE}/partenaire/athletes/${FELIX}`, { waitUntil: "networkidle", timeout: 300000 });
  await p.waitForTimeout(2000);
  const bouton = p.locator("[data-attribuer-badge-nexus]");
  if (await bouton.count()) {
    await bouton.click();
    await p.waitForTimeout(800);
    await bouton.scrollIntoViewIfNeeded();
    const bb = await bouton.boundingBox();
    await p.screenshot({ path: path.join(SORTIE, "3-partenaire-choix-badges-nexus.png"),
      clip: { x: Math.max(0, bb.x - 360), y: Math.max(0, bb.y - 20), width: 760, height: 460 } });
    console.log("choix Nexus :", JSON.stringify(await p.$$eval("[data-attribuer-badge-nexus] + div button", (els) => els.map((e) => e.innerText.replace(/\s+/g, " ").trim()))));
  } else {
    console.log("bouton « Attribuer un badge Nexus » ABSENT sur la fiche partenaire");
    await p.screenshot({ path: path.join(SORTIE, "3-partenaire-fiche.png") });
  }
  await ctx.close();

  console.log("erreurs page :", erreurs.length ? erreurs : "aucune");
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
