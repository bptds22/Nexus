import { expect, test } from "@playwright/test";
import { connecterLocal } from "./session";

// Portail partenaire (compte LOCAL e.partenaire@emulateur.local) : chaque page, en bureau et en
// téléphone, capturée dans test-results/visuel/partenaire-<page>-<format>.png. Lecture seule ; toute
// requête du navigateur vers un projet Supabase CLOUD fait échouer le test.
const COMPTE = process.env.VISUEL_PARTENAIRE ?? "e.partenaire@emulateur.local";
const PAGES: [string, string][] = [
  ["prospects", "/partenaire/prospects"],
  ["evaluations", "/partenaire/mes-athletes"],
];
const FORMATS = [
  { nom: "bureau", viewport: { width: 1280, height: 860 } },
  { nom: "telephone", viewport: { width: 390, height: 844 } },
];

for (const [nom, chemin] of PAGES) {
  for (const f of FORMATS) {
    test(`partenaire ${nom} — ${f.nom}`, async ({ page, context, baseURL }) => {
      const versCloud: string[] = [];
      await page.route(/\.supabase\.co\//, (route) => { versCloud.push(route.request().url()); return route.abort(); });
      await connecterLocal(context, baseURL!, COMPTE);
      await page.setViewportSize(f.viewport);
      const reponse = await page.goto(chemin, { waitUntil: "load" });
      expect(reponse?.status(), `statut HTTP de ${chemin}`).toBeLessThan(400);
      await page.waitForLoadState("networkidle").catch(() => {});
      expect(new URL(page.url()).pathname, "pas renvoyé vers la connexion").toBe(chemin);
      await page.screenshot({ path: `test-results/visuel/partenaire-${nom}-${f.nom}.png`, fullPage: false });
      expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
    });
  }
}
