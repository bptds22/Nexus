// QG admin, lot 1 — captures et accès, navigateur Playwright SANS INTERFACE
// (jamais l'écran du poste de BP), base LOCALE.
//   node captures.mjs <port> <dossier de sortie>
import { writeFileSync } from "node:fs";
import { chromium } from "playwright";
import { cookiesSession, ENV } from "./session-locale.mjs";

const [, , port, sortie] = process.argv;
const base = `http://localhost:${port}`;
const journal = [];
const note = (l) => { journal.push(l); console.log(l); };

const pourNavigateur = (cookies) => cookies.map((c) => ({ ...c, domain: "localhost", path: "/", httpOnly: false, secure: false, sameSite: "Lax" }));
const admin = pourNavigateur(await cookiesSession("admin@demo.local"));
const coachs = await fetch(`${ENV.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users?role=eq.COACH&select=email&order=created_at.asc&limit=1`, {
  headers: { apikey: ENV.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${ENV.SUPABASE_SERVICE_ROLE_KEY}` },
}).then((r) => r.json());
const coach = pourNavigateur(await cookiesSession(coachs[0].email));

const navigateur = await chromium.launch({ headless: true });

// La pile Docker locale (Kong → PostgREST) coupe parfois des connexions sous la
// charge d'un chargement complet : on recharge, au plus 8 fois, jusqu'à un 200.
async function ouvrir(p, chemin) {
  for (let essai = 1; essai <= 8; essai++) {
    const api = p.waitForResponse((r) => r.url().includes("/api/admin/qg"), { timeout: 30000 }).catch(() => null);
    await p.goto(`${base}${chemin}`, { waitUntil: "domcontentloaded" });
    const r = await api;
    if (r && r.status() === 200) return;
    note(`  (essai ${essai} : /api/admin/qg → ${r ? r.status() : "sans réponse"}, on recharge)`);
    await p.waitForTimeout(8000);
  }
  throw new Error(`${chemin} : pas de 200 après 8 essais`);
}

async function page(cookies, largeur, hauteur) {
  const ctx = await navigateur.newContext({ viewport: { width: largeur, height: hauteur }, deviceScaleFactor: 1 });
  if (cookies) await ctx.addCookies(cookies);
  const p = await ctx.newPage();
  const reponses = [];
  p.on("response", (r) => {
    const u = new URL(r.url());
    // Appels de données seulement : les préchargements de pages du menu (/admin/…) sont omis.
    if (r.request().resourceType() === "document" || /^\/(api|rest|auth)\//.test(u.pathname)) reponses.push(`${r.request().resourceType()} ${r.status()} ${u.pathname}`);
  });
  return { ctx, p, reponses };
}

const vues = [
  ["aujourdhui", "jour"],
  ["croissance", "mois"],
  ["recruteurs", "semaine"],
];
for (const [largeur, hauteur] of [[3440, 1440], [1366, 768]]) {
  for (const [onglet, periode] of vues) {
    const { ctx, p, reponses } = await page(admin, largeur, hauteur);
    await ouvrir(p, `/admin/qg?onglet=${onglet}&periode=${periode}`);
    await p.waitForSelector("[role=tabpanel]", { timeout: 20000 });
    await p.waitForTimeout(1500); // animations des graphiques
    const mesures = await p.evaluate(() => ({
      largeurDoc: document.documentElement.scrollWidth, largeurFenetre: window.innerWidth,
      hauteurDoc: document.documentElement.scrollHeight,
      onglet: document.querySelector("[role=tab][aria-selected=true]")?.textContent,
      periode: document.querySelector("[role=radio][aria-checked=true]")?.textContent,
    }));
    const fichier = `qg-${onglet}-${periode}-${largeur}x${hauteur}.png`;
    await p.screenshot({ path: `${sortie}/${fichier}`, fullPage: true });
    note(`admin ${largeur}x${hauteur} ${onglet}/${periode} : ${fichier} — onglet « ${mesures.onglet} », période « ${mesures.periode} », ` +
      `largeur page ${mesures.largeurDoc} pour ${mesures.largeurFenetre} (${mesures.largeurDoc > mesures.largeurFenetre ? "DÉFILEMENT HORIZONTAL" : "aucun défilement horizontal"}), hauteur ${mesures.hauteurDoc}`);
    note(`  réponses : ${reponses.join(" | ")}`);
    await ctx.close();
  }
}

// Infobulle : survol d'une barre du graphique d'inscriptions (Croissance, mois).
{
  const { ctx, p } = await page(admin, 1366, 768);
  await ouvrir(p, "/admin/qg?onglet=croissance&periode=mois");
  await p.waitForSelector(".recharts-bar-rectangle", { timeout: 20000 });
  await p.waitForTimeout(1200);
  const barres = await p.$$(".recharts-bar-rectangle");
  // recharts suit le mouvement de la souris sur la zone du graphique : on la déplace par étapes.
  const boite = await barres[barres.length - 1].boundingBox();
  await p.mouse.move(boite.x + boite.width / 2, boite.y + boite.height / 2, { steps: 8 });
  await p.waitForTimeout(600);
  const infobulle = await p.$$eval(".recharts-tooltip-wrapper", (els) => els.map((e) => e.textContent?.trim()).filter(Boolean).join(" | "));
  await p.screenshot({ path: `${sortie}/qg-infobulle-1366x768.png`, fullPage: false });
  note(`infobulle (survol d'une barre, Croissance/mois) : « ${infobulle?.trim()} »`);
  // Bascule de période au clic : semaine.
  await p.click("[role=radio]:has-text('Semaine')");
  await p.waitForResponse((r) => r.url().includes("/api/admin/qg?periode=semaine"));
  await p.waitForTimeout(800);
  note(`bascule au clic → ${await p.textContent("[role=radio][aria-checked=true]")}, adresse ${new URL(p.url()).search}`);
  await ctx.close();
}

// Plein écran (Fullscreen API) : le QG seul, sans le menu.
{
  const { ctx, p } = await page(admin, 3440, 1440);
  await ouvrir(p, "/admin/qg?onglet=aujourdhui&periode=jour");
  await p.waitForSelector("[role=tabpanel]");
  await p.click("button:has-text('Plein écran')");
  await p.waitForTimeout(800);
  const plein = await p.evaluate(() => ({ actif: !!document.fullscreenElement, menu: !!document.fullscreenElement?.querySelector("aside, nav[aria-label='Navigation admin']") }));
  await p.screenshot({ path: `${sortie}/qg-plein-ecran-3440x1440.png` });
  note(`plein écran : document.fullscreenElement ${plein.actif ? "posé" : "ABSENT"}, bouton « ${await p.textContent("button:has-text('plein écran')")} »`);
  await ctx.close();
}

// Écran mural : la tuile consentements v2 en 4 cases.
{
  const { ctx, p } = await page(admin, 1920, 1080);
  await p.goto(`${base}/admin/ecran`, { waitUntil: "domcontentloaded" });
  await p.waitForSelector("text=Consentements partenaires v2", { timeout: 20000 });
  await p.waitForTimeout(800);
  await p.screenshot({ path: `${sortie}/ecran-1920x1080.png` });
  note(`écran mural 1920x1080 : ecran-1920x1080.png — « Jamais demandé » présent : ${await p.isVisible("text=Jamais demandé")}, « Sans réponse » présent : ${await p.isVisible("text=Sans réponse")}`);
  await ctx.close();
}

// Accès : coach et anonyme.
for (const [qui, cookies] of [["coach", coach], ["anonyme", null]]) {
  const { ctx, p } = await page(cookies, 1366, 768);
  await p.goto(`${base}/admin/qg`, { waitUntil: "domcontentloaded" });
  await p.waitForTimeout(2500);
  note(`${qui} : /admin/qg → aboutit à ${new URL(p.url()).pathname}`);
  await ctx.close();
}

await navigateur.close();
writeFileSync(`${sortie}/acces-journal.txt`, journal.join("\n") + "\n");
