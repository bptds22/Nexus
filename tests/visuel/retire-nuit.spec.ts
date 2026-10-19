import { expect, test } from "@playwright/test";
import { connecterLocal } from "./session";

// Retiré sur la fiche, bureau (BP 2026-10-18, nuit). Compte LOCAL e.recruteur@emulateur.local (Pro).
// ÉCRIT EN LOCAL (Docker seulement) puis RESTAURE : retire l'athlète par le cœur (raison « Erreur »),
// capture la fiche Retiré + détail et « Le remettre à l'étape », puis remet le cœur — ce qui le sort de
// Retiré (Identifié). Restent en base locale : des lignes de journal d'activité (sans effet visible).
// Captures : test-results/visuel/retire-nuit-<écran>-bureau.png
const COMPTE = process.env.VISUEL_RECRUTEUR ?? "e.recruteur@emulateur.local";
const FICHE = process.env.VISUEL_FICHE_RETIRE ?? "47f8dced-6338-4727-bafe-75affac53067";
const cap = (n: string) => `test-results/visuel/retire-nuit-${n}-bureau.png`;

test("fiche — retirer par le cœur après défilement, Retiré + détail, Le remettre, cœur remis — bureau", async ({ page, context, baseURL }) => {
  const versCloud: string[] = [];
  const erreurs: string[] = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  await page.route(/\.supabase\.co\//, (route) => { versCloud.push(route.request().url()); return route.abort(); });
  await connecterLocal(context, baseURL!, COMPTE);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`/recruteur/athletes/${FICHE}`, { waitUntil: "load" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);
  await page.screenshot({ path: cap("statut-avant") });

  // Cœur retiré APRÈS avoir défilé en bas : la fenêtre doit rester à l'écran.
  await page.mouse.wheel(0, 4000);
  await page.waitForTimeout(500);
  const coeur = page.locator('button[title*="etirer"]:visible').first();
  await coeur.evaluate((b) => (b as HTMLButtonElement).click());
  const fenetre = page.getByTestId("fenetre-retrait-favori");
  await expect(fenetre).toBeVisible();
  await expect(fenetre).toBeInViewport();
  await fenetre.getByRole("radio", { name: /Erreur/ }).click();
  await fenetre.locator("textarea").fill("Capture de nuit — à restaurer");
  await page.screenshot({ path: cap("fenetre-apres-defilement") });
  await fenetre.getByRole("button", { name: /^Retirer/ }).click();
  await page.waitForTimeout(1500);

  await page.goto(`/recruteur/athletes/${FICHE}`, { waitUntil: "load" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);
  await expect(page.getByText("Retiré", { exact: true }).first()).toBeVisible();
  await expect(page.getByTestId("ligne-retrait").first()).toContainText("Erreur / pas scouté");
  await page.screenshot({ path: cap("fiche-retire-detail") });

  await page.getByTestId("changer-statut").first().click();
  await page.waitForTimeout(400);
  await expect(page.getByText("Le remettre à l'étape")).toBeVisible();
  await page.screenshot({ path: cap("le-remettre") });
  await page.keyboard.press("Escape");
  await page.mouse.click(5, 5);

  // Restauration : remettre le cœur le sort de Retiré (Identifié).
  await page.locator('button[title="Ajouter aux favoris"]:visible').first().evaluate((b) => (b as HTMLButtonElement).click());
  await page.waitForTimeout(1500);
  await page.goto(`/recruteur/athletes/${FICHE}`, { waitUntil: "load" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);
  await expect(page.getByText("Identifié", { exact: false }).first()).toBeVisible();
  await page.screenshot({ path: cap("restaure") });

  expect(erreurs, "erreurs de page").toEqual([]);
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});
