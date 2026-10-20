import { expect, test } from "@playwright/test";
import { connecterLocalAppli } from "../session";

// Consentement partenaires v2 dans l'APPLI : carte plein écran à l'ouverture (au-dessus de la barre
// d'onglets), page ouverte par le push, bloc des paramètres. Compte LOCAL ; RPC v2 INTERCEPTÉES,
// aucune écriture. Captures : test-results/visuel/appli-consentement-v2-*.png
const ATHLETE = process.env.VISUEL_ATHLETE ?? "e.athlete.existant@emulateur.local";

function etatV2(statut: "V1" | "AUCUN" | "V2", aAfficher: boolean) {
  return JSON.stringify({ ok: true, a_afficher: aAfficher, statut, refuse: false, demande_parent: false, plus_tard_nb: 0, peut_seul: true });
}

test("appli — carte v2 à l'ouverture (accord v1), puis Non", async ({ page, context }) => {
  const versCloud: string[] = [];
  const reponses: string[] = [];
  await page.route(/\.supabase\.co\//, (route) => { versCloud.push(route.request().url()); return route.abort(); });
  let ouverte = true;
  await page.route(/\/rest\/v1\/rpc\/consentement_partenaire_v2_etat/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: etatV2("V1", ouverte) }));
  await page.route(/\/rest\/v1\/rpc\/consentement_partenaire_v2_repondre/, (route) => {
    const c = route.request().postDataJSON() as { p_reponse: string; p_policy_version: string };
    reponses.push(`${c.p_reponse}@${c.p_policy_version}`);
    ouverte = false;
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, etat: "REFUSEE" }) });
  });
  await connecterLocalAppli(context, ATHLETE);
  // Écran de démarrage déjà joué (comme après une première navigation) : la capture montre la page.
  await context.addInitScript(() => { window.sessionStorage.setItem("nx-splash-played", "1"); });
  await page.goto("/athlete", { waitUntil: "load" });
  await expect(page.locator("[data-consentement-v2]")).toBeVisible({ timeout: 30_000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/visuel/appli-consentement-v2-carte.png" });
  await page.locator("[data-consentement-v2]").locator(".overflow-y-auto").evaluate((el) => { el.scrollTop = el.scrollHeight; });
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/visuel/appli-consentement-v2-carte-bas.png" });
  await page.locator("[data-consentement-v2-non]").click();
  await expect(page.locator("[data-consentement-v2-merci]")).toContainText("On ne te le redemandera pas");
  await page.screenshot({ path: "test-results/visuel/appli-consentement-v2-non.png" });
  expect(reponses).toEqual(["NON@2026-10-v2"]);
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});

test("appli — page du push : la carte sans « Plus tard »", async ({ page, context }) => {
  const versCloud: string[] = [];
  await page.route(/\.supabase\.co\//, (route) => { versCloud.push(route.request().url()); return route.abort(); });
  await page.route(/\/rest\/v1\/rpc\/consentement_partenaire_v2_etat/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: etatV2("V1", false) }));
  await connecterLocalAppli(context, ATHLETE);
  // Écran de démarrage déjà joué (comme après une première navigation) : la capture montre la page.
  await context.addInitScript(() => { window.sessionStorage.setItem("nx-splash-played", "1"); });
  await page.goto("/athlete/consentement-partenaires", { waitUntil: "load" });
  await expect(page.locator("[data-consentement-v2]")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-consentement-v2-plus-tard]")).toHaveCount(0);
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/visuel/appli-consentement-v2-page-push.png" });
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});

test("appli — paramètres : accord v1, « Partager aussi mes vidéos et mes réseaux »", async ({ page, context }) => {
  const versCloud: string[] = [];
  await page.route(/\.supabase\.co\//, (route) => { versCloud.push(route.request().url()); return route.abort(); });
  await page.route(/\/rest\/v1\/rpc\/consentement_partenaire_v2_etat/, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: etatV2("V1", false) }));
  await connecterLocalAppli(context, ATHLETE);
  // Écran de démarrage déjà joué (comme après une première navigation) : la capture montre la page.
  await context.addInitScript(() => { window.sessionStorage.setItem("nx-splash-played", "1"); });
  await page.goto("/athlete/parametres", { waitUntil: "load" });
  const bloc = page.locator("[data-consentement-v2-parametres]");
  await bloc.waitFor({ timeout: 30_000 }).catch(() => {});
  if (await bloc.count()) await bloc.scrollIntoViewIfNeeded();
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/visuel/appli-consentement-v2-parametres.png" });
  await expect(page.locator("[data-consentement-v2-etendre]")).toBeVisible();
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});
