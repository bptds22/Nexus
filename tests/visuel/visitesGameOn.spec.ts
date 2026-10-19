import { expect, test } from "@playwright/test";
import { connecterLocal } from "./session";

// Recruteur, bureau (compte LOCAL e.recruteur@emulateur.local) : détails de visite dans le calendrier,
// et Dépistage (ex-Game On : tableau de bord à quatre pastilles). Lecture seule ; toute requête navigateur vers Supabase cloud fait échouer le test.
// Captures : test-results/visuel/recruteur-<écran>-bureau.png
const COMPTE = process.env.VISUEL_RECRUTEUR ?? "e.recruteur@emulateur.local";

async function ouvrir(page: import("@playwright/test").Page, context: import("@playwright/test").BrowserContext, baseURL: string, chemin: string) {
  const versCloud: string[] = [];
  await page.route(/\.supabase\.co\//, (route) => { versCloud.push(route.request().url()); return route.abort(); });
  await connecterLocal(context, baseURL, COMPTE);
  await page.setViewportSize({ width: 1280, height: 860 });
  const reponse = await page.goto(chemin, { waitUntil: "load" });
  expect(reponse?.status(), `statut HTTP de ${chemin}`).toBeLessThan(400);
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(600);
  return versCloud;
}

test("recruteur calendrier — détails de visite — bureau", async ({ page, context, baseURL }) => {
  const versCloud = await ouvrir(page, context, baseURL!, "/recruteur/calendrier");
  await page.screenshot({ path: "test-results/visuel/recruteur-calendrier-bureau.png" });
  const bouton = page.getByRole("button", { name: /Détails/ }).first();
  if (await bouton.isVisible().catch(() => false)) {
    await bouton.click();
    await page.waitForTimeout(500);
    await page.screenshot({ path: "test-results/visuel/recruteur-visite-details-bureau.png" });
  }
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});

test("recruteur Dépistage — tableau de bord — bureau", async ({ page, context, baseURL }) => {
  const versCloud = await ouvrir(page, context, baseURL!, "/recruteur/game-on");
  await page.screenshot({ path: "test-results/visuel/recruteur-game-on-bureau.png" });
  for (const cle of ["en-cours", "du-jour", "a-trier", "unite"]) {
    const p = page.getByTestId(`pastille-${cle}`);
    if (await p.isVisible().catch(() => false)) {
      await p.click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `test-results/visuel/recruteur-depistage-${cle}-bureau.png` });
    }
  }
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});

test("recruteur — « Dépister ce match » sur un match du calendrier — bureau", async ({ page, context, baseURL }) => {
  const versCloud = await ouvrir(page, context, baseURL!, "/recruteur/calendrier");
  const match = page.getByTestId("heure-match").first();
  if (await match.isVisible().catch(() => false)) {
    await match.click();
    await page.waitForTimeout(400);
    await page.getByTestId("depister-ce-match").first().scrollIntoViewIfNeeded().catch(() => {});
    await page.screenshot({ path: "test-results/visuel/recruteur-calendrier-depister-bureau.png" });
  }
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});
