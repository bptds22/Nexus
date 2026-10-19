import { expect, test } from "@playwright/test";
import { connecterLocalAppli } from "../session";

// Dépistage du PARTENAIRE (BP 2026-10-19) sur le compte LOCAL e.partenaire@emulateur.local.
// Prérequis (base LOCALE, migration 20261019140000 appliquée) : une carte partenaire « Marc Partenaire » #16
// de l'équipe Marées du Littoral. ÉCRIT une séance : lancer à la demande (VISUEL_PARCOURS=1), puis effacer.
// Captures : test-results/visuel/appli-depistage-partenaire-<étape>.png
const COMPTE = process.env.VISUEL_PARTENAIRE ?? "e.partenaire@emulateur.local";
const MATCH = process.env.VISUEL_MATCH ?? "d3a00000-0000-4000-8000-0000000b4002";

test("appli Dépistage partenaire — sa carte reconnue, notes liées à sa carte (écrit en local)", async ({ page, context }) => {
  test.skip(!process.env.VISUEL_PARCOURS, "écrit en base locale : VISUEL_PARCOURS=1 pour le lancer");
  test.setTimeout(180_000);
  const versCloud: string[] = [];
  await page.route(/\.supabase\.co\//, (route) => { versCloud.push(route.request().url()); return route.abort(); });
  await connecterLocalAppli(context, COMPTE);
  await page.goto(`/partenaire/depistage?match=${MATCH}&a=${encodeURIComponent("Marées du Littoral")}&b=${encodeURIComponent("Hérons des Battures")}`, { waitUntil: "load" });
  await page.getByRole("button", { name: "Marées du Littoral : chandail Noir" }).click({ timeout: 60_000 });
  await page.getByRole("button", { name: "Hérons des Battures : chandail Blanc" }).click();
  await page.getByRole("button", { name: "Commencer", exact: true }).click();

  await expect(page.getByTestId("pastille-connue").first()).toContainText("Marc P.", { timeout: 20_000 });
  await page.screenshot({ path: "test-results/visuel/appli-depistage-partenaire-depart.png" });
  await page.getByTestId("pastille-connue").first().click();
  await expect(page.getByTestId("fiche-joueur-avant")).toContainText("Ta carte en attente");
  await page.getByLabel("Note sur ce joueur").fill("Bon bras, à suivre");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "test-results/visuel/appli-depistage-partenaire-fiche.png" });
  await page.getByTestId("game-on-note").getByRole("button", { name: "Fermer" }).click();

  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: "Terminer" }).click();
  await page.getByRole("button", { name: "Terminer et trier" }).click();
  await expect(page.getByTestId("tri-reconnus")).toContainText("Marc Partenaire", { timeout: 30_000 });
  await page.screenshot({ path: "test-results/visuel/appli-depistage-partenaire-trier.png" });
  await expect(page.getByRole("button", { name: "Ajouter à leur fiche" })).toBeEnabled({ timeout: 30_000 });
  await page.getByRole("button", { name: "Ajouter à leur fiche" }).click();
  await expect(page.getByTestId("tri-reconnus")).toHaveCount(0, { timeout: 20_000 });

  // Mes athlètes : la carte porte ses notes de dépistage.
  await page.goto("/partenaire/mes-athletes", { waitUntil: "load" });
  await page.getByRole("tab", { name: "En attente" }).click({ timeout: 30_000 });
  const notes = page.locator('[data-notes-depistage="bbbb0000-0000-4000-8000-00000000d016"]');
  await expect(notes).toBeVisible({ timeout: 30_000 });
  await notes.getByRole("button").click();
  await expect(notes).toContainText("Bon bras, à suivre", { timeout: 15_000 });
  await notes.scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/visuel/appli-depistage-partenaire-carte.png" });
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});
