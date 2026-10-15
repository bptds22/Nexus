/* Facette École / Club (remise dans la barre web, BP 2026-10-15) et pastille
   « Type » (Prospects / Sur Nexus). La pilule web lit FACET_ECOLE ; FACETS,
   lui, ne change pas. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filterPipelineCards, facetOptions, filtrerOptionsFacette, activeFilterCount, isFacetOffered,
  EMPTY_FILTERS, FACETS, FACET_ECOLE, TYPES_CARTE, estDuType,
} from "@/lib/pipeline/filterPipelineCards";

const carte = { id: "x" }; // présence = carte prospect (estCarte)
const cartes = [
  { full_name: "A", school: "Saint-Jean-Eudes", school_type: "SECONDAIRE", position: "QB", carte },
  { full_name: "B", school: "Saint-Jean-Eudes", school_type: "SECONDAIRE", position: "WR" },
  { full_name: "C", school: "Collège de Lévis", school_type: "SECONDAIRE", position: "QB", carte },
  { full_name: "D", school: "Grizzlis de Boucherville", school_type: "LIGUE_CIVILE", position: "OL", carte },
  { full_name: "E", school: "", position: "OL" },
];
const noms = (r: { full_name?: string }[]) => r.map((c) => c.full_name);

test("FACETS est inchangé : l'école reste hors de la liste partagée", () => {
  assert.deepEqual(FACETS.map((f) => f.key), ["sport", "position", "graduation_year", "region"]);
  assert.equal(FACET_ECOLE.key, "school");
  assert.equal(FACET_ECOLE.label, "École / Club");
});

test("école — options triées par nom, compteurs, « · ligue » pour le club civil, Non renseigné en fin", () => {
  const opts = facetOptions(cartes, "school", EMPTY_FILTERS);
  assert.deepEqual(opts.map((o) => `${o.label} (${o.count})`), [
    "Collège de Lévis (1)", "Grizzlis de Boucherville · ligue (1)", "Saint-Jean-Eudes (2)", "Non renseigné (1)",
  ]);
});

test("école — OU dans la facette, ET avec les autres ; compteurs sur les AUTRES facettes", () => {
  const f = { ...EMPTY_FILTERS, school: ["Saint-Jean-Eudes", "Collège de Lévis"] };
  assert.deepEqual(noms(filterPipelineCards(cartes, f)), ["A", "B", "C"]);
  assert.deepEqual(noms(filterPipelineCards(cartes, { ...f, position: ["QB"] })), ["A", "C"]);
  // Compteurs d'école avec position = QB : Saint-Jean-Eudes tombe à 1, les cochées restent même à 0.
  const opts = facetOptions(cartes, "school", { ...EMPTY_FILTERS, position: ["QB"] });
  assert.deepEqual(opts.map((o) => `${o.label} (${o.count})`), ["Collège de Lévis (1)", "Saint-Jean-Eudes (1)"]);
});

test("menu — recherche accents et casse ignorés, par mots, sur le libellé affiché", () => {
  const opts = facetOptions(cartes, "school", EMPTY_FILTERS);
  const lib = (q: string, sel: string[] = []) => filtrerOptionsFacette(opts, q, sel).map((o) => o.label);
  assert.deepEqual(lib("LEVIS"), ["Collège de Lévis"]);
  assert.deepEqual(lib("saint jean"), ["Saint-Jean-Eudes"]);
  assert.deepEqual(lib("st-jean"), []); // « st » n'est pas « saint » : pas de synonymes
  assert.deepEqual(lib("ligue"), ["Grizzlis de Boucherville · ligue"]);
  assert.equal(lib("").length, 4);
  assert.equal(lib("   ").length, 4);
  // Une valeur cochée reste visible quoi qu'on tape.
  assert.deepEqual(lib("levis", ["Saint-Jean-Eudes"]), ["Collège de Lévis", "Saint-Jean-Eudes"]);
});

test("pilule école — offerte dès 2 valeurs, sinon grisée (jamais cachée : décision de la page)", () => {
  assert.equal(isFacetOffered(cartes, "school", EMPTY_FILTERS), true);
  assert.equal(isFacetOffered([cartes[0], cartes[1]], "school", EMPTY_FILTERS), false);
});

test("Type — Prospects / Sur Nexus exclusifs, aucune sélection = tout", () => {
  assert.deepEqual(TYPES_CARTE.map((t) => t.key), ["prospects", "nexus"]);
  assert.deepEqual(noms(filterPipelineCards(cartes, EMPTY_FILTERS, { type: "prospects" })), ["A", "C", "D"]);
  assert.deepEqual(noms(filterPipelineCards(cartes, EMPTY_FILTERS, { type: "nexus" })), ["B", "E"]);
  assert.equal(filterPipelineCards(cartes, EMPTY_FILTERS, { type: null }).length, 5);
  assert.equal(estDuType(cartes[0], "prospects"), true);
  assert.equal(estDuType(cartes[1], "prospects"), false);
});

test("Type — entre dans les compteurs des facettes et dans le compte des filtres actifs", () => {
  const opts = facetOptions(cartes, "school", EMPTY_FILTERS, { type: "prospects" });
  assert.deepEqual(opts.map((o) => `${o.label} (${o.count})`), [
    "Collège de Lévis (1)", "Grizzlis de Boucherville · ligue (1)", "Saint-Jean-Eudes (1)",
  ]);
  assert.equal(activeFilterCount(EMPTY_FILTERS, { type: "nexus" }), 1);
  assert.equal(activeFilterCount({ ...EMPTY_FILTERS, school: ["Saint-Jean-Eudes"] }, { type: "nexus" }), 2);
});
