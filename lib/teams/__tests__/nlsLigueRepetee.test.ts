/* NLS (BP 2026-10-18) : on vient de choisir le club « No Limits Showcases » ; la ligue du même nom
   ne se relit plus sous chaque équipe. On lit le nom de l'équipe, puis catégorie · division · genre. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

test("inscription web : la ligue qui répète le club est masquée, recherche ou pas", () => {
  const src = lire("app/onboarding/page.tsx");
  assert.ok(src.includes("{team.league && !nomEstCeluiDuClub(team.league, schoolName) && ("));
  assert.ok(!src.includes("!(rechercheEquipe && nomEstCeluiDuClub(team.league, schoolName))"));
});

test("Mon équipe : la ligue qui répète le club sort des détails (équipe actuelle et liste)", () => {
  const src = lire("components/athlete/MonEquipeSection.tsx");
  assert.ok(src.includes("ligue && !nomEstCeluiDuClub(ligue, club) ? ligue : null"));
  assert.ok(src.includes("league: ligueUtile((team.league as string) ?? null, one<{ name?: string }>(team.schools)?.name),"));
  assert.equal(src.split("{teamDetails({ ...t, league: ligueUtile(t.league, orgName) })}").length - 1, 2);
});
