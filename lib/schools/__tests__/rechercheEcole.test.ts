/* Suite — lib/schools/rechercheEcole.ts (recherche d'école / de cégep, lot C1, retour de test BP).

   Lancement :
     node --experimental-strip-types \
       --import ./lib/evaluations/__tests__/register-alias.mjs \
       --test "lib/schools/__tests__/rechercheEcole.test.ts"
*/

import test from "node:test";
import assert from "node:assert/strict";
import { motsRecherche, rechercherEcoles } from "@/lib/schools/rechercheEcole";

const ECOLES = [
  { name: "Académie Lafontaine", city: "Saint-Jérôme" },
  { name: "Cégep de Jonquière", city: "Jonquière" },
  { name: "Cégep de Saint-Félicien", city: "Saint-Félicien" },
  { name: "Cégep de Saint-Jérôme", city: "Saint-Jérôme" },
  { name: "Cégep de Sainte-Foy", city: "Québec" },
  { name: "Cégep Garneau", city: "Québec" },
  { name: "Collège St-Jean-Vianney", city: "Montréal" },
  { name: "École secondaire de Rochebelle", city: "Québec" },
  { name: "École secondaire Jean-Jacques-Bertrand", city: "Farnham" },
  { name: "École d'éducation internationale", city: "McMasterville" },
];
const noms = (q: string) => rechercherEcoles(ECOLES, q).map((e) => e.name);

test("mots : accents, majuscules, St / Ste, tirets, apostrophes et petits mots", () => {
  assert.deepEqual(motsRecherche("Cégep de Saint-Jérôme"), ["cegep", "saint", "jerome"]);
  assert.deepEqual(motsRecherche("st-j"), ["saint", "j"]);
  assert.deepEqual(motsRecherche("St. J"), ["saint", "j"]);
  assert.deepEqual(motsRecherche("ste-foy"), ["sainte", "foy"]);
  assert.deepEqual(motsRecherche("École d’éducation"), ["ecole", "education"]);
});

test("« st-j » et « st j » trouvent le Cégep de Saint-Jérôme ET le Collège St-Jean-Vianney", () => {
  for (const q of ["st-j", "st j", "ST-J"]) {
    assert.ok(noms(q).includes("Cégep de Saint-Jérôme"), q);
    assert.ok(noms(q).includes("Collège St-Jean-Vianney"), q);
  }
});

test("« st jerome » : les écoles de Saint-Jérôme, le cégep d'abord (par le nom, avant la ville)", () => {
  assert.deepEqual(noms("st jerome"), ["Cégep de Saint-Jérôme", "Académie Lafontaine"]);
});

test("« cegep st » : les cégeps « Saint-… », et seulement eux", () => {
  assert.deepEqual(noms("cegep st"), ["Cégep de Saint-Félicien", "Cégep de Saint-Jérôme", "Cégep de Sainte-Foy"]);
});

test("mot par mot, dans n'importe quel ordre", () => {
  for (const q of ["cegep jerome", "jerome cegep", "cegep st jerome", "Cégep de St-Jérôme", "saint jerome cegep"]) {
    assert.deepEqual(noms(q), ["Cégep de Saint-Jérôme"], q);
  }
});

test("« ste-foy » et « jonquiere »", () => {
  assert.deepEqual(noms("ste-foy"), ["Cégep de Sainte-Foy"]);
  assert.deepEqual(noms("jonquiere"), ["Cégep de Jonquière"]);
});

test("un mot de 4 lettres et plus se trouve aussi au milieu d'un mot ; saisie vide → tout", () => {
  assert.deepEqual(noms("chebelle"), ["École secondaire de Rochebelle"]);
  assert.deepEqual(noms("jacques"), ["École secondaire Jean-Jacques-Bertrand"]);
  assert.equal(noms("").length, ECOLES.length);
  assert.equal(noms(" de ").length, ECOLES.length);
  assert.deepEqual(noms("xyz"), []);
});
