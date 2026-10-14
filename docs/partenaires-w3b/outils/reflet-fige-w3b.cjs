const { chromium } = require("C:/Users/bptds/Documents/Nexus/node_modules/playwright");
const fs = require("fs"), path = require("path");
const ICI = __dirname, BASE = "http://localhost:3007", FELIX = "d3a00000-0000-4000-8000-0000000c2012";
const s = JSON.parse(fs.readFileSync(path.join(ICI, "session-rec.json"), "utf8"));
const v = "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 }, locale: "fr-CA", deviceScaleFactor: 2 });
  await ctx.addCookies(v.length <= 3180 ? [{ name: "sb-127-auth-token", value: v, url: BASE }]
    : [0, 1, 2].map((i) => ({ name: `sb-127-auth-token.${i}`, value: v.slice(i * 3180, (i + 1) * 3180), url: BASE })).filter((c) => c.value));
  const p = await ctx.newPage();
  await p.goto(`${BASE}/recruteur/athletes/${FELIX}`, { waitUntil: "networkidle", timeout: 300000 });
  await p.waitForSelector("[data-badge-partenaire] .nx-badge");
  const rangee = p.locator("[data-badge-partenaire]").first().locator("xpath=..");
  await rangee.scrollIntoViewIfNeeded();
  await p.waitForTimeout(1500);
  const bx = await rangee.boundingBox();
  const zone = { x: Math.max(0, bx.x - 40), y: Math.max(0, bx.y - 30), width: 560, height: bx.height + 60 };
  // Figer chaque reflet (::after des .nx-badge de la rangée) à une fraction du balayage.
  for (const [nom, t] of [["avant", 0], ["milieu", 600], ["fin", 950]]) {
    const n = await p.evaluate((t) => {
      const anims = document.getAnimations().filter((a) => a.effect && a.effect.pseudoElement === "::after"
        && a.effect.target && a.effect.target.closest("[data-badge-partenaire]"));
      anims.forEach((a) => { a.pause(); a.currentTime = t + (a.effect.getTiming().delay || 0); });
      return anims.map((a) => a.animationName);
    }, t);
    await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(ICI, "captures", `4-reflet-${nom}.png`), clip: zone });
    console.log(nom, t, "ms →", n.join(", "));
  }
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
