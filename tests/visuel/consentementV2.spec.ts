import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { connecterLocal } from "./session";

// Consentement partenaires v2 (vidéos + réseaux) — carte plein écran à l'ouverture, web.
// Compte LOCAL ; les deux RPC v2 sont INTERCEPTÉES (réponses de la base reproduites telles quelles) :
// aucune écriture, la base locale n'a pas à porter la migration. Captures : test-results/visuel/consentement-v2-*.png
const ATHLETE = process.env.VISUEL_ATHLETE ?? "e.athlete.existant@emulateur.local";

type Etat = { statut: "V1" | "AUCUN"; peut_seul: boolean };

async function preparer(page: Page, context: BrowserContext, baseURL: string, etat: Etat, largeur: number, hauteur: number) {
  const versCloud: string[] = [];
  const reponses: string[] = [];
  await page.route(/\.supabase\.co\//, (route) => { versCloud.push(route.request().url()); return route.abort(); });
  let aAfficher = true;
  await page.route(/\/rest\/v1\/rpc\/consentement_partenaire_v2_etat/, (route) => route.fulfill({
    status: 200, contentType: "application/json",
    body: JSON.stringify({ ok: true, a_afficher: aAfficher, statut: etat.statut, refuse: false, demande_parent: false, plus_tard_nb: 0, peut_seul: etat.peut_seul }),
  }));
  await page.route(/\/rest\/v1\/rpc\/consentement_partenaire_v2_repondre/, async (route) => {
    const corps = route.request().postDataJSON() as { p_reponse: string; p_policy_version: string };
    reponses.push(`${corps.p_reponse}@${corps.p_policy_version}`);
    aAfficher = false;
    const etatBase = corps.p_reponse === "OUI" ? (etat.peut_seul ? "ACCEPTEE" : "DEMANDE_PARENT")
      : corps.p_reponse === "NON" ? "REFUSEE" : "PLUS_TARD";
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, etat: etatBase }) });
  });
  await connecterLocal(context, baseURL, ATHLETE);
  await page.setViewportSize({ width: largeur, height: hauteur });
  return { versCloud, reponses };
}

test("v2 — carte à l'ouverture, accord v1, bureau ; Oui → merci", async ({ page, context, baseURL }) => {
  const { versCloud, reponses } = await preparer(page, context, baseURL!, { statut: "V1", peut_seul: true }, 1280, 900);
  await page.goto("/athlete", { waitUntil: "load" });
  const carte = page.locator("[data-consentement-v2]");
  await expect(carte).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-consentement-v2-oui]")).toHaveText("Oui, je partage");
  await expect(page.locator("[data-consentement-v2-non]")).toHaveText("Non");
  await expect(page.locator("[data-consentement-v2-plus-tard]")).toHaveText("Plus tard");
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/visuel/consentement-v2-v1-bureau.png" });
  await page.locator("[data-consentement-v2-oui]").click();
  await expect(page.locator("[data-consentement-v2-merci]")).toBeVisible();
  await page.screenshot({ path: "test-results/visuel/consentement-v2-oui-merci-bureau.png" });
  await page.locator("[data-consentement-v2-fermer]").click();
  await expect(carte).toHaveCount(0);
  expect(reponses).toEqual(["OUI@2026-10-v2"]);
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});

test("v2 — carte, aucun accord, téléphone (web) ; Plus tard ferme", async ({ page, context, baseURL }) => {
  const { versCloud, reponses } = await preparer(page, context, baseURL!, { statut: "AUCUN", peut_seul: true }, 390, 844);
  await page.goto("/athlete", { waitUntil: "load" });
  await expect(page.locator("[data-consentement-v2]")).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/visuel/consentement-v2-aucun-telephone.png" });
  await page.screenshot({ path: "test-results/visuel/consentement-v2-aucun-telephone-pleine.png", fullPage: true });
  await page.locator("[data-consentement-v2-plus-tard]").click();
  await expect(page.locator("[data-consentement-v2]")).toHaveCount(0);
  expect(reponses).toEqual(["PLUS_TARD@2026-10-v2"]);
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});

test("v2 — moins de 14 ans : la mention du parent, Oui → demande au parent", async ({ page, context, baseURL }) => {
  const { versCloud } = await preparer(page, context, baseURL!, { statut: "AUCUN", peut_seul: false }, 1280, 900);
  await page.goto("/athlete", { waitUntil: "load" });
  await expect(page.getByText("Tu as moins de 14 ans")).toBeVisible({ timeout: 30_000 });
  await page.locator("[data-consentement-v2-oui]").click();
  await expect(page.locator("[data-consentement-v2-merci]")).toContainText("ton parent");
  await page.screenshot({ path: "test-results/visuel/consentement-v2-parent-bureau.png" });
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});
