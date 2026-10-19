import { expect, test } from "@playwright/test";
import { connecterLocalAppli } from "../session";

// Dépistage — « peut-être le même joueur » (BP 2026-10-19) : un athlète Nexus du match ET une carte de l'unité
// au même numéro. Prérequis LOCAL : la carte « Maxime Fournier » (Marées du Littoral) porte le #17, comme
// l'athlète Maxime F. ÉCRIT une séance : VISUEL_PARCOURS=1, puis effacer. Ne fusionne PAS (« Pas le même »).
const COMPTE = process.env.VISUEL_RECRUTEUR ?? "e.recruteur@emulateur.local";
const MATCH = process.env.VISUEL_MATCH ?? "d3a00000-0000-4000-8000-0000000b4002";

test("appli Dépistage — même joueur : carte et profil Nexus au même numéro (écrit en local)", async ({ page, context }) => {
  test.skip(!process.env.VISUEL_PARCOURS, "écrit en base locale : VISUEL_PARCOURS=1 pour le lancer");
  test.setTimeout(180_000);
  const versCloud: string[] = [];
  await page.route(/\.supabase\.co\//, (route) => { versCloud.push(route.request().url()); return route.abort(); });
  await connecterLocalAppli(context, COMPTE);
  await page.goto(`/recruteur/game-on?match=${MATCH}&a=${encodeURIComponent("Marées du Littoral")}&b=${encodeURIComponent("Hérons des Battures")}`, { waitUntil: "load" });
  await page.getByRole("button", { name: "Marées du Littoral : chandail Noir" }).click({ timeout: 60_000 });
  await page.getByRole("button", { name: "Hérons des Battures : chandail Blanc" }).click();
  await page.getByRole("button", { name: "Commencer", exact: true }).click();
  await page.getByTestId("pastille-connue").filter({ hasText: "#17" }).click({ timeout: 20_000 });
  await expect(page.getByTestId("meme-joueur")).toContainText("Maxime Fournier", { timeout: 20_000 });
  await expect(page.getByTestId("actions-athlete-connu")).toContainText("Voir le profil");
  await page.getByTestId("meme-joueur").getByRole("button", { name: "Fusionner" }).click();
  await page.screenshot({ path: "test-results/visuel/appli-depistage-meme-joueur.png" });
  await page.getByTestId("meme-joueur").getByRole("button", { name: "Pas le même" }).click();
  await expect(page.getByTestId("meme-joueur")).toHaveCount(0);
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});
