/* ═══════════════════════════════════════════════════════════════
   detecterCegep — « Mon école n'est pas listée » → cégep ?
   ═══════════════════════════════════════════════════════════════ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ressembleACegep, normaliserNomEcole } from "@/lib/athlete/detecterCegep";

const CEGEPS = [
  "Cégep Garneau",
  "Cégep de Sherbrooke",
  "Collège Ahuntsic",
  "Dawson College",
  "Cégep de Sainte-Foy",
  "Campus Notre-Dame-de-Foy",
];

test("normalise accents, casse et ponctuation", () => {
  assert.equal(normaliserNomEcole("  Cégep  Sainte-Foy, Québec "), "cegep sainte foy quebec");
});

test("un mot collégial suffit", () => {
  for (const t of ["Cégep Garneau, Québec", "cegep de jonquiere", "CÉGEP", "Collégial international", "je suis au DEC en sciences"]) {
    assert.equal(ressembleACegep(t, CEGEPS), true, t);
  }
});

test("« Collège » + nom de cégep connu passe", () => {
  assert.equal(ressembleACegep("Collège Ahuntsic", CEGEPS), true);
  assert.equal(ressembleACegep("dawson college", CEGEPS), true);
  assert.equal(ressembleACegep("Campus Notre-Dame-de-Foy", CEGEPS), true);
});

test("« Collège » d'une école secondaire privée ne passe pas", () => {
  for (const t of ["Collège Notre-Dame", "Collège Jean-Eudes", "College Saint-Bernard"]) {
    assert.equal(ressembleACegep(t, CEGEPS), false, t);
  }
});

test("une ville seule ne fait pas un cégep", () => {
  assert.equal(ressembleACegep("Polyvalente de Sherbrooke", CEGEPS), false);
  assert.equal(ressembleACegep("École secondaire Sainte-Foy", CEGEPS), false);
});

test("vide, test, sans liste de noms", () => {
  assert.equal(ressembleACegep("", CEGEPS), false);
  assert.equal(ressembleACegep("Test onboarding", CEGEPS), false);
  assert.equal(ressembleACegep("Collège Ahuntsic"), false);
  assert.equal(ressembleACegep("Cégep Ahuntsic"), true);
});

test("un mot qui CONTIENT dec n'est pas le DEC", () => {
  assert.equal(ressembleACegep("École Decelles", CEGEPS), false);
});
