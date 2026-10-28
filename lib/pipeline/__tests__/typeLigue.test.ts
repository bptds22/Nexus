/* Type de ligue (lot E5, retour BP 2026-10-28, B5) : Secondaire, Collégial ou Civil, dérivé de schools.type —
   facette, filtre et tri du pipeline, pour les recruteurs collégial et universitaire. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  typeLigueDe, filterPipelineCards, facetOptions, EMPTY_FILTERS, FACET_TYPE_LIGUE, FACETS,
} from "@/lib/pipeline/filterPipelineCards";
import { valeurTri } from "@/lib/pipeline/triTableau";

const cartes = [
  { full_name: "A", school_type: "SECONDAIRE" },
  { full_name: "B", school_type: "CEGEP" },
  { full_name: "C", school_type: "LIGUE_CIVILE" },
  { full_name: "D", school_type: "SECONDAIRE" },
  { full_name: "E", school_type: null },
];
const noms = (r: { full_name?: string }[]) => r.map((c) => c.full_name);

test("typeLigueDe : trois types, vide sinon", () => {
  assert.equal(typeLigueDe("SECONDAIRE"), "Secondaire");
  assert.equal(typeLigueDe("CEGEP"), "Collégial");
  assert.equal(typeLigueDe("LIGUE_CIVILE"), "Civil");
  assert.equal(typeLigueDe("UNIVERSITE"), "");
  assert.equal(typeLigueDe(null), "");
});

test("facette Type de ligue : options et compteurs, Non renseigné en fin ; hors de FACETS", () => {
  assert.equal(FACET_TYPE_LIGUE.key, "type_ligue");
  assert.ok(!FACETS.some((f) => f.key === "type_ligue"));
  const opts = facetOptions(cartes, "type_ligue", EMPTY_FILTERS);
  assert.deepEqual(opts.map((o) => `${o.label} (${o.count})`), ["Civil (1)", "Collégial (1)", "Secondaire (2)", "Non renseigné (1)"]);
});

test("filtre Type de ligue : OU dans la facette", () => {
  assert.deepEqual(noms(filterPipelineCards(cartes, { ...EMPTY_FILTERS, type_ligue: ["Collégial", "Civil"] })), ["B", "C"]);
  assert.deepEqual(noms(filterPipelineCards(cartes, { ...EMPTY_FILTERS, type_ligue: ["Secondaire"] })), ["A", "D"]);
});

test("tri du tableau et colonne d'export", () => {
  assert.equal(valeurTri("type_ligue", { school_type: "CEGEP" }), "Collégial");
  assert.equal(valeurTri("type_ligue", { school_type: null }), null);
  const page = readFileSync(join(process.cwd(), "app/recruteur/pipeline/page.tsx"), "utf8");
  assert.match(page, /\{ cle: "type_ligue", libelle: "Type de ligue", bloc: "identification" \}/);
  assert.match(page, /case "type_ligue": return texte\(typeLigueDe\(card\.school_type\)\);/);
  assert.match(page, /def=\{FACET_TYPE_LIGUE\}/);
});

test("Ajouter un prospect : Collégial réservé au recruteur universitaire", () => {
  const m = readFileSync(join(process.cwd(), "components/recruteur/cartes/CreerCarteModal.tsx"), "utf8");
  assert.match(m, /const genres: Genre\[\] = universitaire \? \["SECONDAIRE", "COLLEGIAL", "CIVIL"\] : \["SECONDAIRE", "CIVIL"\];/);
  assert.match(m, /SECONDAIRE: \["SECONDAIRE"\], COLLEGIAL: \["CEGEP"\], CIVIL: \["LIGUE_CIVILE"\]/);
});
