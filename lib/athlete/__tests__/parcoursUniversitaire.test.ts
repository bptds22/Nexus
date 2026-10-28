/* Parcours universitaire du cégépien (lot E6) : la règle unique, les 8 critères, et le branchement des pages. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parcoursUniversitaireActif, CRITERES_UNIVERSITE_COGNE } from "@/lib/athlete/parcoursUniversitaire";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

test("règle : fiche cégep ET interrupteur universitaire ON", () => {
  assert.equal(parcoursUniversitaireActif("CEGEP", true), true);
  assert.equal(parcoursUniversitaireActif("CEGEP", false), false);
  assert.equal(parcoursUniversitaireActif("SECONDAIRE", true), false);
  assert.equal(parcoursUniversitaireActif(null, true), false);
});

test("« Quand l'université cogne » : les 8 critères validés (Q7), clés uniques", () => {
  assert.equal(CRITERES_UNIVERSITE_COGNE.length, 8);
  assert.equal(new Set(CRITERES_UNIVERSITE_COGNE.map((c) => c.cle)).size, 8);
  assert.ok(CRITERES_UNIVERSITE_COGNE.some((c) => /cote R/.test(c.titre)));
});

test("pages branchées sur la règle unique", () => {
  for (const p of ["components/cegep-search/CegepSearch.tsx", "app/athlete/mon-parcours/page.tsx", "app/athlete/visibilite/page.tsx",
                   "app/athlete/layout.tsx", "app/athlete/parametres/page.tsx"]) {
    assert.match(lire(p), /parcoursUniversitaire/, p);
  }
  const r = lire("components/cegep-search/CegepSearch.tsx");
  assert.match(r, /Trouve ton université/);
  assert.match(r, /loadSearchData\(supabase, universitaire \? \{ universites: true \}/);
  assert.match(lire("app/athlete/mon-parcours/page.tsx"), /Quand l'université cogne/);
  assert.match(lire("app/athlete/visibilite/page.tsx"), /Quelles universités consultent ton profil/);
});
