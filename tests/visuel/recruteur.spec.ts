import { expect, test } from "@playwright/test";
import { connecterLocal } from "./session";

// Portail recruteur (compte LOCAL e.recruteur@emulateur.local), bureau : C2 (1.4.5) — aucun compte de
// joueurs. Lecture seule ; toute requête navigateur vers Supabase cloud fait échouer le test.
const COMPTE = process.env.VISUEL_RECRUTEUR ?? "e.recruteur@emulateur.local";
const PAGES: [string, string][] = [
  ["tableau-de-bord", "/recruteur/tableau-de-bord"],
  ["processus", "/recruteur/pipeline"],
  ["recherche", "/recruteur/recherche"],
  ["favoris", "/recruteur/favoris"],
  ["listes", "/recruteur/listes"],
];

for (const [nom, chemin] of PAGES) {
  test(`recruteur ${nom} — bureau`, async ({ page, context, baseURL }) => {
    const versCloud: string[] = [];
    await page.route(/\.supabase\.co\//, (route) => { versCloud.push(route.request().url()); return route.abort(); });
    await connecterLocal(context, baseURL!, COMPTE);
    await page.setViewportSize({ width: 1280, height: 860 });
    const reponse = await page.goto(chemin, { waitUntil: "load" });
    expect(reponse?.status(), `statut HTTP de ${chemin}`).toBeLessThan(400);
    await page.waitForLoadState("networkidle").catch(() => {});
    expect(new URL(page.url()).pathname, "pas renvoyé vers la connexion").toBe(chemin);
    await page.screenshot({ path: `test-results/visuel/recruteur-${nom}-bureau.png` });
    expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
  });
}
