/* A6 de la 1.4.5 — filtres « École / Club », « Équipe » et « Type » de Mon
   processus dans l'APPLI, branchés sur lib/pipeline/filterPipelineCards.ts
   comme le web (aucune copie de la logique). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  EMPTY_FILTERS, FACET_ECOLE, FACET_EQUIPE, facetOptions, filterPipelineCards, libelleFacette, typeCarteGrise,
} from "@/lib/pipeline/filterPipelineCards";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
const carte = { id: "x" };
const cartes = [
  { full_name: "A", school: "Saint-Jean-Eudes", position: "QB", carte },
  { full_name: "B", school: "Saint-Jean-Eudes", position: "WR" },
  { full_name: "C", school: "Collège de Lévis", position: "QB", carte },
];

test("libelleFacette : 0 → « Toutes… », 1 → la valeur, 2+ → « Libellé (n) »", () => {
  const opts = facetOptions(cartes, "school", EMPTY_FILTERS);
  assert.equal(libelleFacette(FACET_ECOLE, opts, []), "Toutes les écoles et clubs");
  assert.equal(libelleFacette(FACET_ECOLE, opts, ["Collège de Lévis"]), "Collège de Lévis");
  assert.equal(libelleFacette(FACET_ECOLE, opts, ["Collège de Lévis", "Saint-Jean-Eudes"]), "École / Club (2)");
  assert.equal(libelleFacette(FACET_EQUIPE, [], []), "Toutes les équipes");
});

test("typeCarteGrise : grisée si un seul type et rien de choisi", () => {
  assert.equal(typeCarteGrise(cartes, null), false);
  assert.equal(typeCarteGrise([cartes[0], cartes[2]], null), true);
  assert.equal(typeCarteGrise([cartes[0], cartes[2]], "prospects"), false); // un choix se retire toujours
  assert.equal(typeCarteGrise([], null), true);
});

test("Type dans extra : filtre et compteurs, comme le web", () => {
  const f = { ...EMPTY_FILTERS, school: ["Saint-Jean-Eudes"] };
  assert.deepEqual(filterPipelineCards(cartes, f, { type: "prospects" }).map((c) => c.full_name), ["A"]);
  const opts = facetOptions(cartes, "school", EMPTY_FILTERS, { type: "nexus" });
  assert.deepEqual(opts.map((o) => `${o.value}:${o.count}`), ["Saint-Jean-Eudes:1"]);
});

test("web : libellé et Type passent par les helpers partagés", () => {
  const src = lire("app/recruteur/pipeline/page.tsx");
  assert.match(src, /const label = libelleFacette\(def, options, selected\);/);
  assert.match(src, /const grise = typeCarteGrise\(cards, typeCarte\);/);
});

test("appli : École / Club, Équipe, Type dans le sheet, mêmes helpers que le web", () => {
  const src = lire("components/shared/RecruteurPipelineMobile.tsx");
  // L'état Type et un seul `extra` pour la liste, les compteurs, la pastille et la clé.
  assert.match(src, /const extra = useMemo<ExtraFilters>\(\(\) => \(\{ quick, type: typeCarte \}\), \[quick, typeCarte\]\);/);
  assert.doesNotMatch(src, /filterPipelineCards\([^)]*\{ quick \}\)/);
  assert.match(src, /activeFilterCount\(filters, extra\)/);
  assert.match(src, /\$\{typeCarte \?\? ""\}/);
  // Facettes : comptées avec extra, grisées (jamais cachées) par isFacetOffered.
  assert.match(src, /school: facetOptions\(cards, "school", filters, extra\)/);
  assert.match(src, /team: facetOptions\(cards, "team", filters, extra\)/);
  assert.match(src, /disabled=\{!ecoleOfferte\}/);
  assert.match(src, /disabled=\{!equipeOfferte\}/);
  // Choix multiples : décocher une école retire ses équipes ; « Tout cocher » sur l'équipe.
  assert.match(src, /nettoyerEquipes\(cards, f, toggleFacetValue\(f, "school", v\)\)/);
  assert.match(src, /basculerTout\(f, "team", listees\)/);
  assert.equal((src.match(/<MobileMultiPicker /g) ?? []).length, 2);
  // Type exclusif : un second tap retire ; grisé par la règle partagée ; Réinitialiser le vide.
  assert.match(src, /setTypeCarte\(\(cur\) => \(cur === t\.key \? null : t\.key\)\)/);
  assert.match(src, /const typeGrise = typeCarteGrise\(cards, typeCarte\);/);
  assert.match(src, /setTypeCarte\(\(\) => null\);/);
});

test("MobileMultiPicker : règle clavier (remonter ET plafonner), jamais de bottom inline", () => {
  const src = lire("components/mobile/MobileMultiPicker.tsx");
  assert.match(src, /useSheetKeyboardGeometry\("80vh"\)/);
  assert.match(src, /style=\{\{ \.\.\.kbdStyle,/);
  assert.doesNotMatch(src, /bottom:\s*0/);
});
