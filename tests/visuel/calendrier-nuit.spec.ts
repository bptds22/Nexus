import { expect, test } from "@playwright/test";
import { connecterLocal } from "./session";

// Calendrier de recrutement, bureau (compte LOCAL) — nuit du 19 oct. : cartes de match compactes (source au
// dépli seulement), match déplié, Détails de visite avec « Google Agenda » / « Ajouter au calendrier ».
// Lecture seule. Captures : test-results/visuel/calendrier-nuit-<écran>-bureau.png
const COMPTE = process.env.VISUEL_RECRUTEUR ?? "e.recruteur@emulateur.local";

test("calendrier — cartes compactes, dépli, détails de visite — bureau", async ({ page, context, baseURL }) => {
  const versCloud: string[] = [];
  await page.route(/\.supabase\.co\//, (route) => { versCloud.push(route.request().url()); return route.abort(); });
  await connecterLocal(context, baseURL!, COMPTE);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/recruteur/calendrier", { waitUntil: "load" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: "test-results/visuel/calendrier-nuit-liste-bureau.png" });

  const carte = page.getByTestId("carte-match-calendrier").first();
  if (await carte.isVisible().catch(() => false)) {
    // Fermée : aucune ligne « Source : » sur la carte.
    const parent = carte.locator("xpath=..");
    expect(await parent.getByText(/^Source/).count(), "source affichée sur une carte fermée").toBe(0);
    await carte.click();
    await page.waitForTimeout(400);
    await parent.screenshot({ path: "test-results/visuel/calendrier-nuit-match-deplie-bureau.png" });
  }

  const details = page.getByTestId("bouton-details-visite").first();
  if (await details.isVisible().catch(() => false)) {
    await details.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "test-results/visuel/calendrier-nuit-details-visite-bureau.png" });
  }
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});
