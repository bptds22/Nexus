import { expect, test } from "@playwright/test";

// Page d'accueil publique : ouverture et capture. Lecture seule.
// Garde-fou : toute requête du navigateur vers un projet Supabase CLOUD est bloquée et fait échouer
// le test (le serveur, lui, reçoit la pile locale — voir playwright.config.ts).
test("accueil — capture", async ({ page }) => {
  const versCloud: string[] = [];
  await page.route(/\.supabase\.co\//, (route) => {
    versCloud.push(route.request().url());
    return route.abort();
  });

  const reponse = await page.goto("/", { waitUntil: "load" });
  expect(reponse?.status(), "statut HTTP de /").toBeLessThan(400);
  await page.waitForLoadState("networkidle").catch(() => {});

  await page.screenshot({ path: "test-results/visuel/accueil.png", fullPage: true });

  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});
