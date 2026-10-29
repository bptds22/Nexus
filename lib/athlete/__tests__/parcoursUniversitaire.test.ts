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

test("« Quand l'université cogne » : 13 critères (Q7 + point 5), clés uniques, 6 automatiques, cote R manuelle", () => {
  assert.equal(CRITERES_UNIVERSITE_COGNE.length, 13);
  assert.equal(new Set(CRITERES_UNIVERSITE_COGNE.map((c) => c.cle)).size, 13);
  const autos = CRITERES_UNIVERSITE_COGNE.filter((c) => c.auto).map((c) => c.auto).sort();
  assert.deepEqual(autos, ["chiffres", "cibles", "echange", "programme", "verifie", "video"]);
  const coteR = CRITERES_UNIVERSITE_COGNE.find((c) => /cote R/.test(c.titre));
  assert.ok(coteR && !coteR.auto);
  // Les anciennes clés manuelles devenues automatiques ne sont plus relues (une coche d'avant ne compte pas).
  assert.ok(!CRITERES_UNIVERSITE_COGNE.some((c) => c.cle === "programme" || c.cle === "video"));
  for (const c of CRITERES_UNIVERSITE_COGNE) assert.doesNotMatch(c.titre + " " + c.detail, /recruteurs?(?! (collégia|universitaire))/, c.cle);
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
