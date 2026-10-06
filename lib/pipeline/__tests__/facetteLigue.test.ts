/* Facette « Ligue » de la feuille Filtrer de l'app (recette 1.4.4) : elle
   filtre, se compte, et « Non renseigné » reste une valeur choisissable. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { filterPipelineCards, facetOptions, activeFilterCount, EMPTY_FILTERS, FACETS } from "@/lib/pipeline/filterPipelineCards";

const cartes = [
  { full_name: "A", ligue: "RSEQ", region: "Mauricie" },
  { full_name: "B", ligue: "RSEQ", region: "Lanaudière" },
  { full_name: "C", ligue: "LHEQ", region: "Lanaudière" },
  { full_name: "D", ligue: "", region: "" },
];

test("une ligue choisie filtre les cartes", () => {
  const noms = (l: string) => filterPipelineCards(cartes, { ...EMPTY_FILTERS, league: [l] }).map((c) => c.full_name);
  assert.deepEqual(noms("RSEQ"), ["A", "B"]);
  assert.deepEqual(noms("__NON_RENSEIGNE__"), ["D"]);
});

test("les options de ligue se comptent sur les autres filtres", () => {
  const opts = facetOptions(cartes, "league", { ...EMPTY_FILTERS, region: ["Lanaudière"] });
  assert.deepEqual(opts.map((o) => `${o.label} (${o.count})`), ["LHEQ (1)", "RSEQ (1)"]);
});

test("la ligue compte pour un filtre actif, et reste hors de la barre web", () => {
  assert.equal(activeFilterCount({ ...EMPTY_FILTERS, league: ["RSEQ"] }), 1);
  assert.equal(FACETS.some((f) => f.key === "league"), false);
});
