/* Suite — lib/config/schoolTypes.ts, filtre admin « Type d'établissement » (lot D-admin cégep).

   Lancement :
     node --experimental-strip-types \
       --import ./lib/evaluations/__tests__/register-alias.mjs \
       --test lib/config/__tests__/schoolTypes.test.ts
*/
import test from "node:test";
import assert from "node:assert/strict";
import {
  OPTIONS_FILTRE_TYPE_ETABLISSEMENT,
  TYPE_SANS_ETABLISSEMENT,
  correspondTypeEtablissement,
  lireFiltreTypeEtablissement,
} from "@/lib/config/schoolTypes";

test("les options couvrent les trois types en base, le cégep compris, plus « sans établissement »", () => {
  assert.deepEqual(
    OPTIONS_FILTRE_TYPE_ETABLISSEMENT.map((o) => o.value),
    ["", "SECONDAIRE", "CEGEP", "LIGUE_CIVILE", TYPE_SANS_ETABLISSEMENT],
  );
});

test("filtre inactif : tout passe, avec ou sans école", () => {
  for (const t of ["SECONDAIRE", "CEGEP", "LIGUE_CIVILE", null, undefined]) {
    assert.equal(correspondTypeEtablissement(t, ""), true);
  }
});

test("Cégep ne garde que les cégépiens", () => {
  assert.equal(correspondTypeEtablissement("CEGEP", "CEGEP"), true);
  assert.equal(correspondTypeEtablissement("SECONDAIRE", "CEGEP"), false);
  assert.equal(correspondTypeEtablissement(null, "CEGEP"), false);
});

test("Sans établissement ne garde que les lignes sans école", () => {
  assert.equal(correspondTypeEtablissement(null, TYPE_SANS_ETABLISSEMENT), true);
  assert.equal(correspondTypeEtablissement(undefined, TYPE_SANS_ETABLISSEMENT), true);
  assert.equal(correspondTypeEtablissement("", TYPE_SANS_ETABLISSEMENT), true);
  assert.equal(correspondTypeEtablissement("CEGEP", TYPE_SANS_ETABLISSEMENT), false);
});

test("une valeur d'URL inconnue désactive le filtre au lieu de vider la liste", () => {
  assert.equal(lireFiltreTypeEtablissement("CEGEP"), "CEGEP");
  assert.equal(lireFiltreTypeEtablissement("aucun"), "aucun");
  assert.equal(lireFiltreTypeEtablissement("UNIVERSITE"), "");
  assert.equal(lireFiltreTypeEtablissement("n'importe"), "");
  assert.equal(lireFiltreTypeEtablissement(null), "");
});
