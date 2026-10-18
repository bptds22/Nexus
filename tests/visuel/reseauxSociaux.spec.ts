import { expect, test } from "@playwright/test";
import { connecterLocal } from "./session";

// Réseaux sociaux (comptes LOCAUX) : saisie dans le profil de l'athlète, rangée de logos sur la fiche
// recruteur. Lecture seule. Captures : test-results/visuel/reseaux-<écran>-bureau.png
const ATHLETE = process.env.VISUEL_ATHLETE ?? "e.athlete.existant@emulateur.local";
const RECRUTEUR = process.env.VISUEL_RECRUTEUR ?? "e.recruteur@emulateur.local";
const FICHE = process.env.VISUEL_FICHE_RESEAUX ?? "47f8dced-6338-4727-bafe-75affac53067";

async function ouvrir(page: import("@playwright/test").Page, context: import("@playwright/test").BrowserContext, baseURL: string, compte: string, chemin: string) {
  const versCloud: string[] = [];
  await page.route(/\.supabase\.co\//, (route) => { versCloud.push(route.request().url()); return route.abort(); });
  await connecterLocal(context, baseURL, compte);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(chemin, { waitUntil: "load" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1000);
  return versCloud;
}

test("athlète — profil, bloc Réseaux sociaux — bureau", async ({ page, context, baseURL }) => {
  const versCloud = await ouvrir(page, context, baseURL!, ATHLETE, "/athlete/profil");
  const bloc = page.getByText("Réseaux sociaux", { exact: false }).first();
  await bloc.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/visuel/reseaux-profil-athlete-bureau.png" });
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});

test("recruteur — fiche athlète, rangée Réseaux sociaux — bureau", async ({ page, context, baseURL }) => {
  const versCloud = await ouvrir(page, context, baseURL!, RECRUTEUR, `/recruteur/athletes/${FICHE}`);
  const bloc = page.getByText("Réseaux sociaux", { exact: false }).first();
  await bloc.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/visuel/reseaux-fiche-recruteur-bureau.png" });
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});
