import { expect, test } from "@playwright/test";

// C5 (1.4.5) — inscription athlète (page publique /auth), téléphone : le choix « visibilité partenaires »
// est obligatoire (Oui / Non, sans défaut). Rien n'est soumis : aucun compte créé.
test("inscription athlète — choix partenaires obligatoire", async ({ page }) => {
  const versCloud: string[] = [];
  await page.route(/\.supabase\.co\//, (route) => { versCloud.push(route.request().url()); return route.abort(); });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/auth?mode=signup", { waitUntil: "load" });
  await page.getByRole("button", { name: /^Athlète/ }).click();

  await page.locator('input[type="email"]').fill("visuel.c5@exemple.local");
  await page.locator('input[type="password"]').nth(0).fill("motdepasse123");
  await page.locator('input[type="password"]').nth(1).fill("motdepasse123");
  await page.getByRole("button", { name: "Continuer", exact: true }).click();

  await page.locator('input[type="text"]').nth(0).fill("Léa");
  await page.locator('input[type="text"]').nth(1).fill("Roy");
  await page.locator('input[type="date"]').fill("2008-05-01");

  // Le choix Oui / Non, sans défaut ; « Non » est un choix valable.
  const oui = page.locator("[data-choix-partenaires-oui]");
  await oui.scrollIntoViewIfNeeded();
  await expect(page.locator('[data-choix-partenaires="null"]')).toBeVisible();
  await page.screenshot({ path: "test-results/visuel/inscription-choix-partenaires.png" });
  await page.locator("[data-choix-partenaires-non]").click();
  await expect(page.locator('[data-choix-partenaires="false"]')).toBeVisible();
  expect(versCloud, "requêtes vers Supabase cloud").toEqual([]);
});
