import { expect, test } from "@playwright/test";
import { connecterLocalAppli } from "../session";

// Dépistage (ex-Game On) dans l'APPLI : parcours complet (fiche du joueur : bloc qui se vide, ajout daté, crayon) sur le compte LOCAL e.recruteur@emulateur.local.
// ÉCRIT sur la base LOCALE (une séance de test « Cougars vs Titans ») : lancer seulement à la demande
// (VISUEL_PARCOURS=1), puis effacer la séance. Captures : test-results/visuel/appli-game-on-<étape>.png
const COMPTE = process.env.VISUEL_RECRUTEUR ?? "e.recruteur@emulateur.local";

test("appli Game On — parcours (écrit en local)", async ({ page, context }) => {
  test.skip(!process.env.VISUEL_PARCOURS, "écrit en base locale : VISUEL_PARCOURS=1 pour le lancer");
  const versCloud: string[] = [];
  await page.route(/\.supabase\.co\//, (route) => { versCloud.push(route.request().url()); return route.abort(); });
  await connecterLocalAppli(context, COMPTE);
  await page.goto("/recruteur/game-on", { waitUntil: "load" });
  await page.getByRole("button", { name: /Autre match/ }).first().waitFor({ timeout: 30_000 });
  await page.getByRole("button", { name: /Autre match/ }).first().click();
  await page.getByPlaceholder("Ex. Cougars").fill("Cougars");
  await page.getByPlaceholder("Ex. Titans").fill("Titans");
  await page.getByRole("button", { name: "Commencer le match" }).click();
  // Couleur des chandails, demandée à chaque match.
  await page.getByRole("button", { name: "Cougars : chandail Noir" }).click();
  await page.getByRole("button", { name: "Titans : chandail Blanc" }).click();
  await page.screenshot({ path: "test-results/visuel/appli-game-on-couleurs.png" });
  await page.getByRole("button", { name: "Commencer", exact: true }).click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: "test-results/visuel/appli-game-on-match.png" });

  for (const [numero, texte] of [["16", "Très bon bras"], ["1", "Rapide en transition"], ["16", "Bonne lecture du jeu"]]) {
    const pastille = page.getByRole("button", { name: new RegExp(`^#?${numero}\\b`) }).first();
    if (numero === "16" && await pastille.isVisible().catch(() => false)) {
      await pastille.click();
    } else {
      await page.getByRole("button", { name: "+ Numéro" }).click();
      for (const c of numero) await page.getByRole("button", { name: c, exact: true }).click();
      if (numero === "16") await page.screenshot({ path: "test-results/visuel/appli-game-on-pave.png" });
      await page.getByRole("button", { name: "OK", exact: true }).click();
    }
    await page.getByLabel("Note sur ce joueur").fill(texte);
    if (texte === "Bonne lecture du jeu") { await page.screenshot({ path: "test-results/visuel/appli-game-on-note.png" }); }
    await page.getByRole("button", { name: "Enregistrer" }).click();
    await page.waitForTimeout(400);
    // La fiche reste ouverte, le bloc est vide, la note est dans l'historique.
    await expect(page.getByLabel("Note sur ce joueur")).toHaveValue("");
    if (texte === "Bonne lecture du jeu") {
      // Toucher MA note la recharge : Enregistrer y ajoute une ligne datée.
      await page.getByRole("button", { name: /Ajouter à ta note de/ }).first().click();
      await page.getByLabel("Note sur ce joueur").fill("Bon sur les longues passes");
      await page.screenshot({ path: "test-results/visuel/appli-game-on-ajout.png" });
      await page.getByRole("button", { name: "Ajouter à cette note" }).click();
      await page.waitForTimeout(400);
      // Le crayon : le prénom du joueur.
      await page.getByRole("button", { name: "Modifier le prénom" }).click();
      await page.getByLabel("Prénom du joueur").fill("Jean");
      await page.getByRole("button", { name: "OK", exact: true }).click();
      await page.waitForTimeout(300);
      await page.screenshot({ path: "test-results/visuel/appli-game-on-fiche.png" });
    }
    await page.getByTestId("game-on-note").getByRole("button", { name: "Fermer" }).click();
    await page.waitForTimeout(300);
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: "test-results/visuel/appli-game-on-notes.png" });
  await page.getByRole("button", { name: "Titans" }).first().click();
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/visuel/appli-game-on-notes-titans.png" });
  await page.getByRole("button", { name: "Cougars" }).first().click();

  await page.getByRole("button", { name: "Terminer" }).click();
  await page.getByRole("button", { name: "Terminer et trier" }).click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "test-results/visuel/appli-game-on-trier.png" });
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});
