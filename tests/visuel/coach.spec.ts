import { expect, test } from "@playwright/test";
import { connecterLocal } from "./session";

// C4 (1.4.5) — page d'équipe du coach (web), compte LOCAL e.coach@emulateur.local, ASSISTANT de
// l'équipe locale « Érables de Lévis » : pas d'ajout d'entraîneur, rôles et informations en lecture.
const COMPTE = process.env.VISUEL_COACH ?? "e.coach@emulateur.local";
const EQUIPE = process.env.VISUEL_EQUIPE ?? "d3a00000-0000-4000-8000-0000000c1001";

test("coach équipe (assistant) — bureau", async ({ page, context, baseURL }) => {
  const versCloud: string[] = [];
  await page.route(/\.supabase\.co\//, (route) => { versCloud.push(route.request().url()); return route.abort(); });
  await connecterLocal(context, baseURL!, COMPTE);
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto(`/coach/equipes/${EQUIPE}`, { waitUntil: "load" });
  await page.waitForLoadState("networkidle").catch(() => {});
  await expect(page.locator("[data-infos-lecture]")).toBeVisible();
  await page.screenshot({ path: "test-results/visuel/coach-equipe-assistant-bureau.png", fullPage: true });
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});
