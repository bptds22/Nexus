import { expect, test } from "@playwright/test";
import { connecterLocalAppli } from "../session";

// Calendrier de recrutement dans l'APPLI (compte LOCAL) — nuit du 19 oct. : cartes de match compactes, match
// déplié (source avec les joueurs), Détails de visite avec les deux boutons d'agenda.
// Lecture seule. Captures : test-results/visuel/appli-calendrier-nuit-<écran>.png
const COMPTE = process.env.VISUEL_RECRUTEUR ?? "e.recruteur@emulateur.local";

test("appli — calendrier compact, dépli, détails de visite", async ({ page, context }) => {
  const versCloud: string[] = [];
  await page.route(/\.supabase\.co\//, (route) => { versCloud.push(route.request().url()); return route.abort(); });
  await connecterLocalAppli(context, COMPTE);
  await page.goto("/recruteur/calendrier", { waitUntil: "load" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.locator("h1, h2").first().waitFor({ timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(3000); // écran de démarrage de l'appli
  await page.screenshot({ path: "test-results/visuel/appli-calendrier-nuit-liste.png" });

  const carte = page.getByTestId("carte-match-calendrier").first();
  if (await carte.isVisible().catch(() => false)) {
    await carte.click();
    await page.waitForTimeout(400);
    await carte.locator("xpath=..").screenshot({ path: "test-results/visuel/appli-calendrier-nuit-match-deplie.png" });
  }

  const details = page.getByTestId("bouton-details-visite").first();
  if (await details.isVisible().catch(() => false)) {
    await details.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: "test-results/visuel/appli-calendrier-nuit-details-visite.png" });
  }
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});
