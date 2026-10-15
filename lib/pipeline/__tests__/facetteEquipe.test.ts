/* Facette « Équipe » de Mon processus (web, BP 2026-10-15) : liée à École /
   Club par les compteurs, « toutes par défaut », Tout cocher / décocher,
   nettoyage quand on décoche une école, « Sans équipe », libellés sans doublon. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filterPipelineCards, facetOptions, filtrerOptionsFacette, nettoyerEquipes, basculerTout, activeFilterCount,
  isFacetOffered, toggleFacetValue, EMPTY_FILTERS, FACETS, FACET_EQUIPE,
} from "@/lib/pipeline/filterPipelineCards";

const juvLevis = { id: "t-juv-levis", name: "Collège de Lévis", age_group: "Juvénile", division: "D2", gender: "Masculin", season: "2026-2027", school_name: "Collège de Lévis" };
const cadLevis = { id: "t-cad-levis", name: "Collège de Lévis", age_group: "Cadet", division: "D3", gender: "Masculin", season: "2026-2027", school_name: "Collège de Lévis" };
const juvSje = { id: "t-juv-sje", name: "Saint-Jean-Eudes", age_group: "Juvénile", division: "D2", gender: "Masculin", season: "2026-2027", school_name: "Saint-Jean-Eudes" };
const grizzlis = { id: "t-grizz", name: "Grizzlis", age_group: "Midget AAA", division: "D1", gender: "Masculin", season: "2026-2027", school_name: "Grizzlis de Boucherville" };

const cartes = [
  { full_name: "A", school: "Collège de Lévis", equipe: juvLevis },
  { full_name: "B", school: "Collège de Lévis", equipe: cadLevis },
  { full_name: "C", school: "Saint-Jean-Eudes", equipe: juvSje },
  { full_name: "D", school: "Grizzlis de Boucherville", school_type: "LIGUE_CIVILE", equipe: grizzlis },
  { full_name: "E", school: "Collège de Lévis", equipe: null },
];
const noms = (r: { full_name?: string }[]) => r.map((c) => c.full_name);
const lib = (o: { label: string; count: number }[]) => o.map((x) => `${x.label} (${x.count})`);

test("FACETS inchangé ; Équipe vient de FACET_EQUIPE, « Toutes les équipes » par défaut", () => {
  assert.deepEqual(FACETS.map((f) => f.key), ["sport", "position", "graduation_year", "region"]);
  assert.equal(FACET_EQUIPE.key, "team");
  assert.equal(FACET_EQUIPE.allLabel, "Toutes les équipes");
});

test("sans école cochée : toutes les équipes, préfixées de l'école (plusieurs écoles), Sans équipe en fin", () => {
  assert.deepEqual(lib(facetOptions(cartes, "team", EMPTY_FILTERS)), [
    "Collège de Lévis : Cadet · D3 · Masculin (1)",
    "Collège de Lévis : Juvénile · D2 · Masculin (1)",
    "Grizzlis de Boucherville : Grizzlis — Midget AAA · D1 · Masculin (1)",
    "Saint-Jean-Eudes : Juvénile · D2 · Masculin (1)",
    "Sans équipe (1)",
  ]);
});

test("une école cochée : seulement ses équipes, sans préfixe ; aucune équipe cochée = toutes ses cartes", () => {
  const f = { ...EMPTY_FILTERS, school: ["Collège de Lévis"] };
  assert.deepEqual(lib(facetOptions(cartes, "team", f)), [
    "Cadet · D3 · Masculin (1)", "Juvénile · D2 · Masculin (1)", "Sans équipe (1)",
  ]);
  assert.deepEqual(noms(filterPipelineCards(cartes, f)), ["A", "B", "E"]);
});

test("une équipe cochée filtre, OU dans la facette, ET avec l'école ; compte dans les filtres actifs", () => {
  const une = { ...EMPTY_FILTERS, school: ["Collège de Lévis"], team: ["t-juv-levis"] };
  assert.deepEqual(noms(filterPipelineCards(cartes, une)), ["A"]);
  assert.deepEqual(noms(filterPipelineCards(cartes, { ...une, team: ["t-juv-levis", "t-cad-levis"] })), ["A", "B"]);
  assert.deepEqual(noms(filterPipelineCards(cartes, { ...EMPTY_FILTERS, team: ["__NON_RENSEIGNE__"] })), ["E"]);
  assert.equal(activeFilterCount(une), 2);
});

test("Tout cocher puis Tout décocher, sur les équipes listées seulement", () => {
  const f = { ...EMPTY_FILTERS, school: ["Collège de Lévis"] };
  const listees = facetOptions(cartes, "team", f).map((o) => o.value);
  const coche = basculerTout(f, "team", listees);
  assert.deepEqual([...coche.team].sort(), [...listees].sort());
  assert.deepEqual(basculerTout(coche, "team", listees).team, []);
  // Une seule déjà cochée : « Tout cocher » ajoute les autres sans doublon.
  const partiel = basculerTout({ ...f, team: ["t-juv-levis"] }, "team", listees);
  assert.equal(partiel.team.length, listees.length);
});

test("décocher une école retire ses équipes cochées (pas de filtre fantôme)", () => {
  const f = { ...EMPTY_FILTERS, school: ["Collège de Lévis", "Saint-Jean-Eudes"], team: ["t-juv-levis", "t-juv-sje"] };
  const apres = nettoyerEquipes(cartes, f, toggleFacetValue(f, "school", "Collège de Lévis"));
  assert.deepEqual(apres.school, ["Saint-Jean-Eudes"]);
  assert.deepEqual(apres.team, ["t-juv-sje"]);
  // Décocher la DERNIÈRE école cochée retire aussi ses équipes (cas relevé aux captures).
  const seule = { ...EMPTY_FILTERS, school: ["Collège de Lévis"], team: ["t-juv-levis"] };
  const fin = nettoyerEquipes(cartes, seule, toggleFacetValue(seule, "school", "Collège de Lévis"));
  assert.deepEqual(fin.school, []);
  assert.deepEqual(fin.team, []);
  assert.equal(filterPipelineCards(cartes, fin).length, cartes.length);
  // Cocher une école ne retire rien ; une équipe cochée sans école cochée reste (rien n'a été décoché).
  const libre = { ...EMPTY_FILTERS, team: ["t-juv-levis"] };
  assert.deepEqual(nettoyerEquipes(cartes, libre, toggleFacetValue(libre, "school", "Saint-Jean-Eudes")).team, ["t-juv-levis"]);
});

test("recherche dans le menu Équipe : accents et casse ignorés, sur le libellé affiché", () => {
  const opts = facetOptions(cartes, "team", EMPTY_FILTERS);
  assert.deepEqual(filtrerOptionsFacette(opts, "LEVIS cadet").map((o) => o.label), ["Collège de Lévis : Cadet · D3 · Masculin"]);
  assert.deepEqual(filtrerOptionsFacette(opts, "sans").map((o) => o.label), ["Sans équipe"]);
});

test("doublon exact entre deux saisons : la saison s'ajoute ; grisé si une seule option", () => {
  const ancienne = { ...juvSje, id: "t-juv-sje-2526", season: "2025-2026" };
  const deux = [{ full_name: "X", school: "Saint-Jean-Eudes", equipe: juvSje }, { full_name: "Y", school: "Saint-Jean-Eudes", equipe: ancienne }];
  assert.deepEqual(lib(facetOptions(deux, "team", EMPTY_FILTERS)), [
    "Juvénile · D2 · Masculin (2025-2026) (1)", "Juvénile · D2 · Masculin (2026-2027) (1)",
  ]);
  assert.equal(isFacetOffered([deux[0]], "team", EMPTY_FILTERS), false);
  assert.equal(isFacetOffered(deux, "team", EMPTY_FILTERS), true);
});
