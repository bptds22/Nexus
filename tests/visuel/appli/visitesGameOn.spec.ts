import { expect, test } from "@playwright/test";
import { connecterLocalAppli } from "../session";

// Recruteur dans l'APPLI (compte LOCAL e.recruteur@emulateur.local) : Game On (menu « Plus ») et
// détails de visite (feuille du bas). Lecture seule. Captures : test-results/visuel/appli-recruteur-<écran>.png
const COMPTE = process.env.VISUEL_RECRUTEUR ?? "e.recruteur@emulateur.local";

async function ouvrir(page: import("@playwright/test").Page, context: import("@playwright/test").BrowserContext, chemin: string) {
  const versCloud: string[] = [];
  await page.route(/\.supabase\.co\//, (route) => { versCloud.push(route.request().url()); return route.abort(); });
  await connecterLocalAppli(context, COMPTE);
  await page.goto(chemin, { waitUntil: "load" });
  await page.waitForLoadState("networkidle").catch(() => {});
  // Première compilation du serveur de dev : attendre le contenu, pas l'écran d'attente.
  await page.locator("h1, h2").first().waitFor({ timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(800);
  return versCloud;
}

test("appli recruteur — Game On", async ({ page, context }) => {
  const versCloud = await ouvrir(page, context, "/recruteur/game-on");
  await page.getByRole("button", { name: /Autre match/ }).first().waitFor({ timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(3000); // écran de démarrage de l'appli, superposé quelques secondes
  await page.screenshot({ path: "test-results/visuel/appli-recruteur-game-on.png" });
  const autre = page.getByRole("button", { name: /Autre match/ }).first();
  if (await autre.isVisible().catch(() => false)) {
    await autre.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "test-results/visuel/appli-recruteur-game-on-autre-match.png" });
  }
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});

test("appli recruteur — calendrier, détails de visite", async ({ page, context }) => {
  const versCloud = await ouvrir(page, context, "/recruteur/calendrier");
  await page.screenshot({ path: "test-results/visuel/appli-recruteur-calendrier.png" });
  const bouton = page.getByRole("button", { name: /Détails/ }).first();
  if (await bouton.isVisible().catch(() => false)) {
    await bouton.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: "test-results/visuel/appli-recruteur-visite-details.png" });
  }
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});

test("appli recruteur — barre du bas et panneau Plus", async ({ page, context }) => {
  const versCloud = await ouvrir(page, context, "/recruteur/tableau-de-bord");
  await page.waitForTimeout(3000); // écran de démarrage de l'appli, superposé quelques secondes
  await page.screenshot({ path: "test-results/visuel/appli-recruteur-barre.png" });
  const plus = page.getByRole("button", { name: /Plus/ }).last();
  if (await plus.isVisible().catch(() => false)) {
    await plus.click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: "test-results/visuel/appli-recruteur-plus.png" });
  }
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});
