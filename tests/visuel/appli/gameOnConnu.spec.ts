import { expect, test } from "@playwright/test";
import { connecterLocalAppli } from "../session";

// Dépistage — joueur DÉJÀ CONNU (BP 2026-10-19) sur le compte LOCAL e.recruteur@emulateur.local.
// Prérequis (base LOCALE) : une carte « Marc Tremblay » #16 de l'équipe Marées du Littoral avec une note
// d'avant. ÉCRIT une séance de test : lancer à la demande (VISUEL_PARCOURS=1), puis tout effacer.
// Captures : test-results/visuel/appli-game-on-connu-<étape>.png
const COMPTE = process.env.VISUEL_RECRUTEUR ?? "e.recruteur@emulateur.local";
const MATCH = process.env.VISUEL_MATCH ?? "d3a00000-0000-4000-8000-0000000b4002";

test("appli Dépistage — joueur déjà connu (écrit en local)", async ({ page, context }) => {
  test.skip(!process.env.VISUEL_PARCOURS, "écrit en base locale : VISUEL_PARCOURS=1 pour le lancer");
  test.setTimeout(180_000);
  const versCloud: string[] = [];
  await page.route(/\.supabase\.co\//, (route) => { versCloud.push(route.request().url()); return route.abort(); });
  await connecterLocalAppli(context, COMPTE);
  await page.goto(`/recruteur/game-on?match=${MATCH}&a=${encodeURIComponent("Marées du Littoral")}&b=${encodeURIComponent("Hérons des Battures")}`, { waitUntil: "load" });
  await page.getByRole("button", { name: "Marées du Littoral : chandail Noir" }).click({ timeout: 60_000 });
  await page.getByRole("button", { name: "Hérons des Battures : chandail Blanc" }).click();
  await page.getByRole("button", { name: "Commencer", exact: true }).click();

  // Dès le début : le joueur connu est déjà là, en pastille pointillée.
  await expect(page.getByTestId("pastille-connue").first()).toContainText("Marc T.", { timeout: 20_000 });
  await page.screenshot({ path: "test-results/visuel/appli-game-on-connu-depart.png" });
  await page.getByTestId("pastille-connue").first().click();
  await expect(page.getByLabel("Prénom du joueur").or(page.getByTestId("fiche-joueur-crayon"))).toContainText("Marc");
  // La fiche le reconnaît et montre ses notes d'avant, au-dessus de « Ce match ».
  await expect(page.getByTestId("fiche-joueur-connu")).toContainText("Marc Tremblay", { timeout: 20_000 });
  await expect(page.getByTestId("fiche-joueur-avant")).toContainText("gros bras");
  await page.getByLabel("Note sur ce joueur").fill("Encore un gros bras, meilleure lecture ce soir");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "test-results/visuel/appli-game-on-connu-fiche.png" });
  await page.getByTestId("game-on-note").getByRole("button", { name: "Fermer" }).click();
  await expect(page.getByRole("button", { name: /#16/ }).first()).toContainText("Marc T.");
  await page.screenshot({ path: "test-results/visuel/appli-game-on-connu-pastille.png" });

  // Un numéro inconnu : rien de reconnu.
  await page.getByRole("button", { name: "+ Numéro" }).click();
  for (const c of "4") await page.getByRole("button", { name: c, exact: true }).click();
  await page.getByRole("button", { name: "OK", exact: true }).click();
  await expect(page.getByTestId("fiche-joueur-connu")).toHaveCount(0);
  await page.getByLabel("Note sur ce joueur").fill("Petit mais rapide");
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await page.getByTestId("game-on-note").getByRole("button", { name: "Fermer" }).click();

  await page.waitForTimeout(2000);
  await page.getByRole("button", { name: "Terminer" }).click();
  await page.getByRole("button", { name: "Terminer et trier" }).click();
  await expect(page.getByTestId("tri-reconnus")).toContainText("Marc Tremblay", { timeout: 30_000 });
  await page.screenshot({ path: "test-results/visuel/appli-game-on-connu-trier.png" });
  await expect(page.getByRole("button", { name: "Ajouter à leur fiche" })).toBeEnabled({ timeout: 30_000 });
  await page.getByRole("button", { name: "Ajouter à leur fiche" }).click();
  await expect(page.getByTestId("tri-reconnus")).toHaveCount(0, { timeout: 20_000 });
  await page.screenshot({ path: "test-results/visuel/appli-game-on-connu-trie.png" });
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});
