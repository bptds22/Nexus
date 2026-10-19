import { expect, test } from "@playwright/test";
import { connecterLocalAppli } from "../session";

// Partenaire dans l'APPLI (1.4.5, « natif, pas web ») : chaque écran, compte LOCAL
// e.partenaire@emulateur.local. Lecture seule. Captures : test-results/visuel/appli-partenaire-<écran>.png
const COMPTE = process.env.VISUEL_PARTENAIRE ?? "e.partenaire@emulateur.local";
const FICHE = process.env.VISUEL_FICHE ?? "d3a00000-0000-4000-8000-0000000b2012";
const ECRANS: [string, string][] = [
  ["accueil", "/partenaire"],
  ["recherche", "/partenaire/athletes"],
  ["evaluations", "/partenaire/mes-athletes"],
  ["mes-athletes", "/partenaire/mes-athletes?vue=attente"],
  ["fiche", `/partenaire/athletes/${FICHE}`],
  ["classements", "/partenaire/classements"],
  ["newsroom", "/partenaire/newsroom"],
  ["tendances", "/partenaire/tendances"],
  ["telechargements", "/partenaire/telechargements"],
  ["profil", "/partenaire/profil"],
];

for (const [nom, chemin] of ECRANS) {
  test(`appli partenaire — ${nom}`, async ({ page, context }) => {
    const versCloud: string[] = [];
    await page.route(/\.supabase\.co\//, (route) => { versCloud.push(route.request().url()); return route.abort(); });
    await connecterLocalAppli(context, COMPTE);
    await page.goto(chemin, { waitUntil: "load" });
    await page.waitForLoadState("networkidle").catch(() => {});
    // Première compilation du serveur de dev : attendre le titre de l'écran, pas l'écran d'attente.
    await page.locator("h1").first().waitFor({ timeout: 30_000 }).catch(() => {});
    await page.waitForTimeout(600);
    await page.screenshot({ path: `test-results/visuel/appli-partenaire-${nom}.png` });
    expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
  });
}
