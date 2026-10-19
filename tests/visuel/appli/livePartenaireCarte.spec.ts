import { expect, test } from "@playwright/test";
import { connecterLocalAppli } from "../session";

// Live du PARTENAIRE (BP 2026-10-19) : au tri, « Créer une carte » ouvre SA carte préremplie depuis le match,
// et les notes s'y lient. Compte LOCAL e.partenaire@emulateur.local. ÉCRIT (séance + carte « Live Test ») :
// VISUEL_PARCOURS=1, puis effacer. Captures : test-results/visuel/appli-live-partenaire-<étape>.png
const COMPTE = process.env.VISUEL_PARTENAIRE ?? "e.partenaire@emulateur.local";
const MATCH = process.env.VISUEL_MATCH ?? "d3a00000-0000-4000-8000-0000000b4002";

test("appli Live partenaire — créer une carte depuis le tri (écrit en local)", async ({ page, context }) => {
  test.skip(!process.env.VISUEL_PARCOURS, "écrit en base locale : VISUEL_PARCOURS=1 pour le lancer");
  test.setTimeout(180_000);
  const versCloud: string[] = [];
  await page.route(/\.supabase\.co\//, (route) => { versCloud.push(route.request().url()); return route.abort(); });
  await connecterLocalAppli(context, COMPTE);
  await page.goto(`/partenaire/depistage?match=${MATCH}&a=${encodeURIComponent("Marées du Littoral")}&b=${encodeURIComponent("Hérons des Battures")}`, { waitUntil: "load" });
  await page.getByRole("button", { name: "Marées du Littoral : chandail Noir" }).click({ timeout: 60_000 });
  await page.getByRole("button", { name: "Hérons des Battures : chandail Blanc" }).click();
  await page.getByRole("button", { name: "Commencer", exact: true }).click();
  await page.getByRole("button", { name: "+ Numéro" }).click();
  for (const c of "44") await page.getByRole("button", { name: c, exact: true }).click();
  await page.getByRole("button", { name: "OK", exact: true }).click();
  await page.getByLabel("Note sur ce joueur").fill("Grand receveur, mains sûres");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByTestId("game-on-note").getByRole("button", { name: "Fermer" }).click();
  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: "Terminer" }).click();
  await page.getByRole("button", { name: "Terminer et trier" }).click();
  await page.getByRole("button", { name: "Trier" }).first().click({ timeout: 30_000 });
  await page.getByRole("button", { name: "Créer une carte" }).click();
  // Préremplie : l'équipe et l'école du match.
  await expect(page.locator("#prospect-equipe")).not.toHaveValue("", { timeout: 15_000 });
  await page.locator("#prospect-prenom").fill("Live");
  await page.locator("#prospect-nom").fill("Test");
  await page.locator("[data-case-14-ans] input").check();
  await page.screenshot({ path: "test-results/visuel/appli-live-partenaire-carte.png" });
  await page.getByRole("button", { name: "Créer la carte" }).click();
  await expect(page.getByText("Tout est trié")).toBeVisible({ timeout: 30_000 });
  await page.screenshot({ path: "test-results/visuel/appli-live-partenaire-trie.png" });
  await page.getByTestId("retour-live").click();
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});
