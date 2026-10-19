import { expect, test } from "@playwright/test";
import { connecterLocalAppli } from "../session";

// Retiré sur la fiche, APPLI (BP 2026-10-18, nuit). Compte LOCAL e.recruteur@emulateur.local (Pro).
// ÉCRIT EN LOCAL (Docker seulement) puis RESTAURE : Changer le statut → Retirer (raison « Pas le niveau »),
// capture Retiré + détail et « Le remettre », remet à Identifié, puis remet le cœur (le retrait l'a enlevé).
// Restent en base locale : des lignes de journal d'activité.
// Captures : test-results/visuel/appli-retire-nuit-<écran>.png
const COMPTE = process.env.VISUEL_RECRUTEUR ?? "e.recruteur@emulateur.local";
const FICHE = process.env.VISUEL_FICHE_RETIRE ?? "47f8dced-6338-4727-bafe-75affac53067";
const cap = (n: string) => `test-results/visuel/appli-retire-nuit-${n}.png`;

async function ouvrirFiche(page: import("@playwright/test").Page) {
  await page.goto(`/recruteur/athletes/${FICHE}`, { waitUntil: "load" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(3500); // écran de démarrage de l'appli
}

test("appli fiche — Changer le statut à côté du statut, Retirer, Retiré + détail, Le remettre", async ({ page, context }) => {
  const versCloud: string[] = [];
  const erreurs: string[] = [];
  page.on("pageerror", (e) => erreurs.push(e.message));
  await page.route(/\.supabase\.co\//, (route) => { versCloud.push(route.request().url()); return route.abort(); });
  await connecterLocalAppli(context, COMPTE);
  await ouvrirFiche(page);
  await page.screenshot({ path: cap("statut-avant") });

  await page.getByTestId("changer-statut").first().click();
  await page.waitForTimeout(600);
  const section = page.getByTestId("section-retire").first();
  await section.getByRole("button", { name: "Retirer" }).click();
  await page.getByRole("radio", { name: /Pas le niveau/ }).click();
  await page.screenshot({ path: cap("feuille-retirer") });
  await page.getByRole("button", { name: "Confirmer le retrait" }).click();
  await page.waitForTimeout(1500);

  await ouvrirFiche(page);
  await expect(page.getByTestId("ligne-retrait").first()).toContainText("Pas le niveau");
  await page.screenshot({ path: cap("fiche-retire-detail") });

  await page.getByTestId("changer-statut").first().click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: cap("feuille-retire") });
  await page.getByRole("button", { name: "Le remettre" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: cap("le-remettre") });

  // Restauration : Identifié, puis le cœur (le retrait l'avait enlevé).
  await page.getByRole("button", { name: /Identifié/ }).first().click();
  await page.waitForTimeout(1500);
  await ouvrirFiche(page);
  const coeur = page.getByRole("button", { name: "Ajouter aux favoris" }).first();
  if (await coeur.isVisible().catch(() => false)) { await coeur.click(); await page.waitForTimeout(1500); }
  await page.screenshot({ path: cap("restaure") });

  expect(erreurs, "erreurs de page").toEqual([]);
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});
