import { expect, test } from "@playwright/test";
import { connecterLocal } from "./session";

// Revue partenaire de BP (2026-10-18, section 6), WEB, compte LOCAL e.partenaire@emulateur.local.
// Lecture seule (l'aperçu de carte ne touche ni Enregistrer ni Partager : rien n'est journalisé).
// Captures : test-results/visuel/partenaire-nuit-<écran>-<format>.png
const COMPTE = process.env.VISUEL_PARTENAIRE ?? "e.partenaire@emulateur.local";
const FORMATS = [
  { nom: "bureau", viewport: { width: 1280, height: 860 } },
  { nom: "telephone", viewport: { width: 390, height: 844 } },
];
const ECRANS: [string, string][] = [
  ["accueil", "/partenaire"],
  ["mes-athletes-attente", "/partenaire/mes-athletes?vue=attente"],
  ["mes-athletes-evaluations", "/partenaire/mes-athletes?vue=evaluations"],
  ["newsroom", "/partenaire/newsroom"],
  ["tendances", "/partenaire/tendances"],
  ["classements", "/partenaire/classements"],
  ["telechargements", "/partenaire/telechargements"],
];

async function ouvrir(page: import("@playwright/test").Page, context: import("@playwright/test").BrowserContext, baseURL: string, viewport: { width: number; height: number }, chemin: string) {
  const versCloud: string[] = [];
  await page.route(/\.supabase\.co\//, (route) => { versCloud.push(route.request().url()); return route.abort(); });
  await connecterLocal(context, baseURL, COMPTE);
  await page.setViewportSize(viewport);
  await page.goto(chemin, { waitUntil: "load" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(800);
  return versCloud;
}

for (const [nom, chemin] of ECRANS) {
  for (const f of FORMATS) {
    test(`partenaire nuit ${nom} — ${f.nom}`, async ({ page, context, baseURL }) => {
      const versCloud = await ouvrir(page, context, baseURL!, f.viewport, chemin);
      await page.screenshot({ path: `test-results/visuel/partenaire-nuit-${nom}-${f.nom}.png`, fullPage: true });
      expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
    });
  }
}

test("partenaire nuit — /partenaire/prospects redirige vers « En attente »", async ({ page, context, baseURL }) => {
  const versCloud = await ouvrir(page, context, baseURL!, FORMATS[0].viewport, "/partenaire/prospects");
  await page.waitForURL(/\/partenaire\/mes-athletes\?vue=attente/, { timeout: 15_000 });
  await expect(page.locator('[data-pastille="attente"]')).toHaveAttribute("aria-selected", "true");
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});

test("partenaire nuit — Newsroom, panneau Filtres ouvert (bureau)", async ({ page, context, baseURL }) => {
  const versCloud = await ouvrir(page, context, baseURL!, FORMATS[0].viewport, "/partenaire/newsroom");
  await page.locator("[data-bouton-filtres]").click();
  await expect(page.locator("[data-panneau-filtres]")).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/visuel/partenaire-nuit-newsroom-filtres-bureau.png" });
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});

test("partenaire nuit — Téléchargements, aperçu de la carte (téléphone)", async ({ page, context, baseURL }) => {
  const versCloud = await ouvrir(page, context, baseURL!, FORMATS[1].viewport, "/partenaire/telechargements");
  const ligne = page.locator("[data-ligne-telechargement]").first();
  if (await ligne.count() === 0) test.skip(true, "aucun téléchargement dans la base locale");
  await ligne.click();
  await expect(page.locator("[data-apercu-carte]")).toBeVisible();
  await page.locator("[data-image-carte], [data-apercu-carte] p").first().waitFor({ timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: "test-results/visuel/partenaire-nuit-apercu-carte-telephone.png" });
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});
