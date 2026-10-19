import { expect, test } from "@playwright/test";
import { connecterLocalAppli } from "../session";

// Barre du bas personnalisable (BP 2026-10-19) — compte LOCAL e.recruteur@emulateur.local.
// ÉCRIT le choix dans les métadonnées du compte LOCAL, puis le remet « Par défaut ».
const COMPTE = process.env.VISUEL_RECRUTEUR ?? "e.recruteur@emulateur.local";

test("appli — personnaliser la barre : ajouter Recherche, puis revenir au défaut (écrit en local)", async ({ page, context }) => {
  test.skip(!process.env.VISUEL_PARCOURS, "écrit en base locale : VISUEL_PARCOURS=1 pour le lancer");
  test.setTimeout(180_000);
  const versCloud: string[] = [];
  await page.route(/\.supabase\.co\//, (route) => { versCloud.push(route.request().url()); return route.abort(); });
  await connecterLocalAppli(context, COMPTE);
  await page.goto("/recruteur/tableau-de-bord", { waitUntil: "load" });
  const nav = page.getByRole("navigation", { name: "Navigation principale" });
  await expect(nav).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Plus d'options" }).click();
  await page.getByRole("button", { name: "Personnaliser la barre" }).click();
  await expect(page.getByTestId("personnaliser-barre")).toBeVisible();
  // Défaut (BP 2026-10-19) : Recherche · Processus · En direct.
  await page.getByRole("button", { name: "Retirer Recherche" }).click();
  await page.locator('[data-onglet-possible="dashboard"]').click();
  await page.screenshot({ path: "test-results/visuel/appli-barre-perso-editeur.png" });
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(nav.getByRole("link", { name: /Accueil/ })).toBeVisible({ timeout: 15_000 });
  await expect(nav.getByRole("link", { name: /Recherche/ })).toHaveCount(0);
  await page.screenshot({ path: "test-results/visuel/appli-barre-perso-barre.png" });
  // Déplacer, pas enlever : Recherche est maintenant dans Plus, et Accueil n'y est plus.
  await page.getByRole("button", { name: "Plus d'options" }).click();
  await expect(page.getByRole("link", { name: "Recherche" }).last()).toBeVisible();
  await page.screenshot({ path: "test-results/visuel/appli-barre-perso-plus.png" });
  await page.getByRole("button", { name: "Personnaliser la barre" }).click();
  await page.getByRole("button", { name: "Par défaut" }).click();
  await expect(nav.getByRole("link", { name: /Recherche/ })).toBeVisible({ timeout: 15_000 });
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});

test("appli — personnaliser la barre du COACH : ajouter Équipes, puis revenir au défaut (écrit en local)", async ({ page, context }) => {
  test.skip(!process.env.VISUEL_PARCOURS, "écrit en base locale : VISUEL_PARCOURS=1 pour le lancer");
  test.setTimeout(180_000);
  await connecterLocalAppli(context, process.env.VISUEL_COACH ?? "e.coach@emulateur.local");
  await page.goto("/coach/tableau-de-bord", { waitUntil: "load" });
  const nav = page.getByRole("navigation", { name: "Navigation principale" });
  await expect(nav).toBeVisible({ timeout: 60_000 });
  await page.getByRole("button", { name: "Plus d'options" }).click();
  await page.getByRole("button", { name: "Personnaliser la barre" }).click();
  await page.getByRole("button", { name: "Retirer À traiter" }).click();
  await page.locator('[data-onglet-possible="equipes"]').click();
  await page.getByRole("button", { name: "Enregistrer" }).click();
  await expect(nav.getByRole("link", { name: /Équipes/ })).toBeVisible({ timeout: 15_000 });
  await page.screenshot({ path: "test-results/visuel/appli-barre-perso-coach.png" });
  await page.getByRole("button", { name: "Plus d'options" }).click();
  await page.getByRole("button", { name: "Personnaliser la barre" }).click();
  await page.getByRole("button", { name: "Par défaut" }).click();
  await expect(nav.getByRole("link", { name: /À traiter/ })).toBeVisible({ timeout: 15_000 });
});
