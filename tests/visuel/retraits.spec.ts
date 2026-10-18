import { expect, test } from "@playwright/test";
import { connecterLocal } from "./session";

// Processus recruteur, bureau (compte LOCAL e.recruteur@emulateur.local) : colonne « Retiré » avec la
// raison, et la fenêtre « Pourquoi ? ». Lecture seule (la fenêtre est fermée sans retirer).
// Captures : test-results/visuel/recruteur-retire-<écran>-bureau.png
const COMPTE = process.env.VISUEL_RECRUTEUR ?? "e.recruteur@emulateur.local";

test("recruteur processus — colonne Retiré — bureau", async ({ page, context, baseURL }) => {
  const versCloud: string[] = [];
  await page.route(/\.supabase\.co\//, (route) => { versCloud.push(route.request().url()); return route.abort(); });
  await connecterLocal(context, baseURL!, COMPTE);
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto("/recruteur/pipeline", { waitUntil: "load" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1200);
  const colonne = page.getByText("Retiré", { exact: true }).last();
  await colonne.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/visuel/recruteur-retire-kanban-bureau.png" });
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});
