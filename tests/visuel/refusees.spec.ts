import { expect, test } from "@playwright/test";
import { connecterLocal } from "./session";

// Propositions refusées (BP 2026-10-19) : refuser, revoir, « Proposer de nouveau » — compte LOCAL.
// ÉCRIT en base locale (une proposition passe REFUSEE puis PROPOSEE) : VISUEL_PARCOURS=1, puis remettre la ligne.
const COMPTE = process.env.VISUEL_RECRUTEUR ?? "e.recruteur@emulateur.local";

test("Mon processus — refuser, revoir les refusées, proposer de nouveau (écrit en local)", async ({ page, context, baseURL }) => {
  test.skip(!process.env.VISUEL_PARCOURS, "écrit en base locale : VISUEL_PARCOURS=1 pour le lancer");
  test.setTimeout(180_000);
  const versCloud: string[] = [];
  await page.route(/\.supabase\.co\//, (route) => { versCloud.push(route.request().url()); return route.abort(); });
  await page.setViewportSize({ width: 1440, height: 900 });
  await connecterLocal(context, baseURL!, COMPTE);
  await page.goto("/recruteur/pipeline", { waitUntil: "load" });
  await page.getByTestId("bandeau-rapprochements").getByRole("button").click({ timeout: 60_000 });
  await page.getByTestId("proposition").first().getByRole("button", { name: "Refuser" }).click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText("Refusé", { timeout: 15_000 });
  await page.getByRole("button", { name: "Fermer" }).last().click();
  // Plus rien à décider : le lien discret mène aux refusées.
  await page.getByTestId("lien-refusees").click({ timeout: 30_000 });
  await page.getByTestId("propositions-refusees").getByRole("button").first().click();
  await page.screenshot({ path: "test-results/visuel/processus-refusees-bureau.png" });
  await page.getByRole("button", { name: "Proposer de nouveau" }).first().click();
  await expect(page.getByRole("dialog").getByRole("status")).toContainText("de nouveau proposé", { timeout: 15_000 });
  await expect(page.getByTestId("proposition")).toHaveCount(1, { timeout: 30_000 });
  await page.screenshot({ path: "test-results/visuel/processus-reproposee-bureau.png" });
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});
