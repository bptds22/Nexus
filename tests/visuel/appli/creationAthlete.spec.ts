import { expect, test } from "@playwright/test";
import { connecterLocalAppli } from "../session";

// C1 (1.4.5) — création d'athlète par le coach, dans l'APPLI (build Capacitor servi au navigateur).
// Compte LOCAL e.coach@emulateur.local. Lecture seule : rien n'est créé (on ne confirme jamais).
const COMPTE = process.env.VISUEL_COACH ?? "e.coach@emulateur.local";

test("coach — création d'athlète : étape 1, puis puce « 4 » sans rien remplir", async ({ page, context }) => {
  const versCloud: string[] = [];
  await page.route(/\.supabase\.co\//, (route) => { versCloud.push(route.request().url()); return route.abort(); });
  await connecterLocalAppli(context, COMPTE);
  await page.goto("/coach/athletes/create", { waitUntil: "load" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.getByRole("button", { name: /^1\./ }).waitFor();
  await page.screenshot({ path: "test-results/visuel/appli-creation-athlete-etape1.png" });

  // Aller plus loin sans rien remplir : retour à l'étape 1, signalée.
  await page.getByRole("button", { name: /^4\./ }).click();
  await expect(page.locator("[data-champs-manquants]")).toBeVisible();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/visuel/appli-creation-athlete-manquants.png" });
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});
