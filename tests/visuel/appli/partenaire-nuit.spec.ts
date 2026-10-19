import { expect, test } from "@playwright/test";
import { connecterLocalAppli } from "../session";

// Revue partenaire de BP (2026-10-18, section 6), APPLI, compte LOCAL e.partenaire@emulateur.local.
// Lecture seule. Captures : test-results/visuel/appli-partenaire-nuit-<écran>.png
const COMPTE = process.env.VISUEL_PARTENAIRE ?? "e.partenaire@emulateur.local";
const ECRANS: [string, string][] = [
  ["accueil", "/partenaire"],
  ["mes-athletes-attente", "/partenaire/mes-athletes?vue=attente"],
  ["mes-athletes-propositions", "/partenaire/mes-athletes?vue=attente&filtre=propositions"],
  ["mes-athletes-evaluations", "/partenaire/mes-athletes?vue=evaluations"],
  ["newsroom", "/partenaire/newsroom"],
  ["tendances", "/partenaire/tendances"],
  ["classements", "/partenaire/classements"],
  ["telechargements", "/partenaire/telechargements"],
];

async function ouvrir(page: import("@playwright/test").Page, context: import("@playwright/test").BrowserContext, chemin: string) {
  const versCloud: string[] = [];
  await page.route(/\.supabase\.co\//, (route) => { versCloud.push(route.request().url()); return route.abort(); });
  await connecterLocalAppli(context, COMPTE);
  await page.goto(chemin, { waitUntil: "load" });
  await page.waitForLoadState("networkidle").catch(() => {});
  // Écran d'accueil animé de l'appli, puis première compilation du serveur de dev.
  await page.waitForTimeout(3000);
  return versCloud;
}

for (const [nom, chemin] of ECRANS) {
  test(`appli partenaire nuit — ${nom}`, async ({ page, context }) => {
    const versCloud = await ouvrir(page, context, chemin);
    await page.screenshot({ path: `test-results/visuel/appli-partenaire-nuit-${nom}.png` });
    expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
  });
}

test("appli partenaire nuit — accueil défilé en bas (rien sous la barre d'onglets)", async ({ page, context }) => {
  const versCloud = await ouvrir(page, context, "/partenaire");
  await page.locator("[data-portail-partenaire-mobile]").evaluate((m) => m.scrollTo(0, m.scrollHeight));
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/visuel/appli-partenaire-nuit-accueil-bas.png" });
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});

test("appli partenaire nuit — Tendances, panneau Filtres", async ({ page, context }) => {
  const versCloud = await ouvrir(page, context, "/partenaire/tendances");
  await page.locator("[data-bouton-filtres]").click();
  await expect(page.locator("[data-panneau-filtres]")).toBeVisible();
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/visuel/appli-partenaire-nuit-tendances-filtres.png" });
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});

test("appli partenaire nuit — Téléchargements, aperçu de la carte", async ({ page, context }) => {
  const versCloud = await ouvrir(page, context, "/partenaire/telechargements");
  const ligne = page.locator("[data-ligne-telechargement]").first();
  if (await ligne.count() === 0) test.skip(true, "aucun téléchargement dans la base locale");
  await ligne.click();
  await expect(page.locator("[data-apercu-carte]")).toBeVisible();
  await page.locator("[data-image-carte]").waitFor({ timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: "test-results/visuel/appli-partenaire-nuit-apercu-carte.png" });
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});
