import { expect, test } from "@playwright/test";
import { connecterLocalAppli } from "../session";

// Processus recruteur dans l'APPLI (compte LOCAL e.recruteur@emulateur.local) : onglet « Retiré » avec
// la raison. Lecture seule. Captures : test-results/visuel/appli-recruteur-retire-<écran>.png
const COMPTE = process.env.VISUEL_RECRUTEUR ?? "e.recruteur@emulateur.local";

test("appli recruteur — processus, onglet Retiré", async ({ page, context }) => {
  const versCloud: string[] = [];
  await page.route(/\.supabase\.co\//, (route) => { versCloud.push(route.request().url()); return route.abort(); });
  await connecterLocalAppli(context, COMPTE);
  await page.goto("/recruteur/pipeline", { waitUntil: "load" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(3500); // écran de démarrage de l'appli
  await page.screenshot({ path: "test-results/visuel/appli-recruteur-retire-processus.png" });
  const onglet = page.getByRole("button", { name: /Retiré/ }).first();
  if (await onglet.isVisible().catch(() => false)) {
    await onglet.click();
    await page.waitForTimeout(700);
    await page.screenshot({ path: "test-results/visuel/appli-recruteur-retire-onglet.png" });
  }
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});
