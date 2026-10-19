import { expect, test, type Page } from "@playwright/test";
import { connecterLocal } from "./session";

// Plantage du 2026-10-18 (iPhone, recruteur ET partenaire) : fiche d'un athlète → retour → Recherche →
// « Application error ». Cause : cache TanStack réhydraté depuis sessionStorage, Map des badges/cotes
// partenaires devenue {} (lib/queries/persistance.ts). Ce test fait EXACTEMENT le parcours, 20 fois, en
// rechargeant la fiche comme l'appli (route dynamique = rechargement). Échoue sur toute pageerror, sur
// « Application error » et sur l'écran du filet (EcranErreur). Comptes LOCAUX, lecture seule.
// Captures : test-results/visuel/plante-<persona>-<n>.png
const TOURS = Number(process.env.VISUEL_TOURS ?? 20);
const PERSONAS = [
  { nom: "recruteur", compte: process.env.VISUEL_RECRUTEUR ?? "e.recruteur@emulateur.local", recherche: "/recruteur/recherche", fiche: `/recruteur/athletes/${process.env.VISUEL_FICHE_RECRUTEUR ?? "47f8dced-6338-4727-bafe-75affac53067"}` },
  { nom: "partenaire", compte: process.env.VISUEL_PARTENAIRE ?? "e.partenaire@emulateur.local", recherche: "/partenaire/athletes", fiche: `/partenaire/athletes/${process.env.VISUEL_FICHE ?? "d3a00000-0000-4000-8000-0000000b2012"}` },
];
const PLANTAGE = /Application error|client-side exception|Oups, cet écran a planté/;

async function attendre(page: Page, ms: number) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
}

for (const p of PERSONAS) {
  test(`${p.nom} — fiche → retour → Recherche, ${TOURS} fois, sans plantage`, async ({ page, context, baseURL }) => {
    test.setTimeout(60_000 + TOURS * 20_000);
    const erreurs: string[] = [];
    page.on("pageerror", (e) => erreurs.push(e.message));
    const versCloud: string[] = [];
    await page.route(/\.supabase\.co\//, (route) => { versCloud.push(route.request().url()); return route.abort(); });
    await connecterLocal(context, baseURL!, p.compte);
    await page.goto(p.recherche, { waitUntil: "load" });
    await attendre(page, 1500); // les cartes se déclarent visibles → paquets de badges/cotes en cache
    for (let i = 1; i <= TOURS; i += 1) {
      await page.goto(p.fiche, { waitUntil: "load" }); // rechargement complet : le cache est réhydraté
      await attendre(page, 1200);
      await page.goBack({ waitUntil: "load" });
      await attendre(page, 1200);
      const texte = await page.locator("body").innerText().catch(() => "");
      if (PLANTAGE.test(texte) || erreurs.length) {
        await page.screenshot({ path: `test-results/visuel/plante-${p.nom}-${i}.png` });
      }
      expect(texte, `tour ${i} : écran de plantage`).not.toMatch(PLANTAGE);
      expect(erreurs, `tour ${i} : erreurs de page`).toEqual([]);
    }
    await page.screenshot({ path: `test-results/visuel/plante-${p.nom}-ok.png` });
    expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
  });
}
