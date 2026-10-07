/* Recherche d'école de la feuille de filtres de l'app (recette 1.4.4) :
   mots, sans accents ni casse, traits d'union lus comme des espaces. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { filterPipelineCards, activeFilterCount, EMPTY_FILTERS } from "@/lib/pipeline/filterPipelineCards";

const cartes = [
  { full_name: "A", school: "École secondaire Saint-Jean-Eudes" },
  { full_name: "B", school: "Académie les Estacades" },
  { full_name: "C", school: "" },
];

test("chaque mot doit figurer, accents et traits d'union ignorés", () => {
  const noms = (q: string) => filterPipelineCards(cartes, EMPTY_FILTERS, { school: q }).map((c) => c.full_name);
  assert.deepEqual(noms("jean eudes"), ["A"]);
  assert.deepEqual(noms("SAINT-JEAN"), ["A"]);
  assert.deepEqual(noms("academie"), ["B"]);
  assert.deepEqual(noms("academie eudes"), []);
  assert.deepEqual(noms("  "), ["A", "B", "C"]);
});

test("la recherche d'école compte pour un filtre actif", () => {
  assert.equal(activeFilterCount(EMPTY_FILTERS, { school: "eudes" }), 1);
  assert.equal(activeFilterCount(EMPTY_FILTERS, { school: " " }), 0);
});
