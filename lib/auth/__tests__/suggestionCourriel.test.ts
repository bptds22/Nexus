/* suggestionCourriel — D1 (2026-10-15) : proposer la correction d'un domaine mal écrit. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { suggestionCourriel } from "@/lib/auth/suggestionCourriel";

test("terminaison fautive sur un domaine connu (les deux cas de prod)", () => {
  assert.equal(suggestionCourriel("jeune@gmail.con"), "jeune@gmail.com");
  assert.equal(suggestionCourriel("jeune@icloud.con"), "jeune@icloud.com");
  assert.equal(suggestionCourriel("jeune@hotmail.con"), "jeune@hotmail.com");
  assert.equal(suggestionCourriel("jeune@outlook.cmo"), "jeune@outlook.com");
  assert.equal(suggestionCourriel("jeune@gmail.co"), "jeune@gmail.com");
});

test("domaine connu mal tapé", () => {
  assert.equal(suggestionCourriel("jeune@gmial.com"), "jeune@gmail.com");
  assert.equal(suggestionCourriel("jeune@gmai.com"), "jeune@gmail.com");
  assert.equal(suggestionCourriel("jeune@hotmial.com"), "jeune@hotmail.com");
  assert.equal(suggestionCourriel("jeune@outlok.com"), "jeune@outlook.com");
  assert.equal(suggestionCourriel("jeune@videotron.cq"), "jeune@videotron.ca");
  assert.equal(suggestionCourriel("Jean.Tremblay@GMIAL.COM"), "Jean.Tremblay@gmail.com");
});

test("faute de terminaison ET de domaine", () => {
  assert.equal(suggestionCourriel("jeune@gmial.con"), "jeune@gmail.com");
});

test("adresses valides : aucune suggestion", () => {
  for (const ok of [
    "jeune@gmail.com", "jeune@hotmail.ca", "jeune@mail.com", "jeune@me.com", "jeune@live.ca",
    "jeune@csdm.qc.ca", "prof@cegepgarneau.ca", "x@privaterelay.appleid.com", "a@nexussports.ca",
    "jeune@videotron.ca", "jeune@gmx.com",
  ]) {
    assert.equal(suggestionCourriel(ok), null, ok);
  }
});

test("saisie incomplète : rien", () => {
  for (const s of ["", "jeune", "jeune@", "@gmail.con", "jeune@gmail", "jeune@gm ail.com"]) {
    assert.equal(suggestionCourriel(s), null, s);
  }
});
