// Refus côté coach — navigateur SANS interface (aucune photo d'écran du bureau).
// window.alert est intercepté : le texte EXACT que l'app lui passe est affiché
// dans un encadré ÉTIQUETÉ « reproduction », puis la page est capturée.
const { chromium } = require("C:/Users/bptds/Documents/Nexus/node_modules/playwright");
const fs = require("fs"), path = require("path");
const ICI = __dirname, BASE = "http://localhost:3007", FELIX = "d3a00000-0000-4000-8000-0000000c2012";
const SORTIE = path.join(ICI, "captures");

(async () => {
  const s = JSON.parse(fs.readFileSync(path.join(ICI, "session-coach.json"), "utf8"));
  const v = "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url");
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1300, height: 950 }, locale: "fr-CA", deviceScaleFactor: 2 });
  await ctx.addCookies(v.length <= 3180 ? [{ name: "sb-127-auth-token", value: v, url: BASE }]
    : [0, 1, 2].map((i) => ({ name: `sb-127-auth-token.${i}`, value: v.slice(i * 3180, (i + 1) * 3180), url: BASE })).filter((c) => c.value));
  await ctx.addInitScript(() => {
    window.alert = (msg) => {
      window.__alerte = String(msg);
      const box = document.createElement("div");
      box.setAttribute("data-alerte-reproduite", "");
      box.style.cssText = "position:fixed;top:24px;left:50%;transform:translateX(-50%);z-index:99999;width:520px;" +
        "background:#fff;color:#1f1f1f;border-radius:10px;box-shadow:0 10px 40px rgba(0,0,0,.55);padding:20px 22px;font:14px system-ui,sans-serif";
      box.innerHTML = '<div style="font-size:11px;color:#8a8a8a;margin-bottom:10px">localhost:3007 indique — <i>reproduction de la boîte window.alert(), texte exact</i></div>' +
        '<div style="white-space:pre-wrap;line-height:1.45"></div>' +
        '<div style="text-align:right;margin-top:16px"><span style="background:#0b57d0;color:#fff;border-radius:16px;padding:6px 18px">OK</span></div>';
      box.children[1].textContent = String(msg);
      document.body.appendChild(box);
    };
  });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/coach/athletes/${FELIX}/modifier`, { waitUntil: "networkidle", timeout: 300000 });
  await p.locator("button, [role=button], div").filter({ hasText: /^5$/ }).last().click();
  await p.waitForTimeout(1500);
  const tuile = p.locator("button[aria-pressed]").filter({ hasText: "Vitesse" }).first();
  await tuile.scrollIntoViewIfNeeded();
  if ((await tuile.getAttribute("aria-pressed")) !== "true") await tuile.click();
  await p.waitForTimeout(600);
  await p.getByRole("button", { name: /^Enregistrer$/ }).first().click();
  await p.waitForSelector("[data-alerte-reproduite]", { timeout: 60000 });
  await p.waitForTimeout(500);
  console.log("texte passé à window.alert :", await p.evaluate(() => window.__alerte));
  await p.screenshot({ path: path.join(SORTIE, "C2-coach-refus-message.png") });
  await b.close();
})().catch((e) => { console.error(e); process.exit(1); });
