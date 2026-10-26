/* Suite — lib/teams/eligibiliteEquipe.ts (filtre âge / saison du sélecteur d'équipes, lot 7 civil).

   Lancement :
     node --experimental-strip-types \
       --import ./lib/evaluations/__tests__/register-alias.mjs \
       --test "lib/teams/__tests__/eligibiliteEquipe.test.ts"
*/

import test from "node:test";
import assert from "node:assert/strict";
import { trancheCategorie, ageRevolu, equipeProposable } from "@/lib/teams/eligibiliteEquipe";

test("tranche : catégories soccer, basket, hockey", () => {
  for (const c of ["U14", "U15", "U16", "U17", "U18", "U-17", "M15", "M18 AAA", "Benjamin", "Cadet", "Juvénile",
                   "Atome", "Moustique AAA", "Pee-Wee AAA", "Bantam AAA", "Midget AAA"]) {
    assert.equal(trancheCategorie(c), "-18", c);
  }
  for (const c of ["Senior", "U19", "U21", "Junior", "Junior Majeur", "Collégial"]) {
    assert.equal(trancheCategorie(c), "18+", c);
  }
});

test("tranche : inconnue ou vide → null (on ne cache rien faute de savoir)", () => {
  for (const c of [null, undefined, "", "Autre", "Ouvert", "cegep"]) assert.equal(trancheCategorie(c), null, String(c));
});

test("âge révolu, anniversaire compris", () => {
  const ref = new Date(2026, 9, 26); // 26 octobre 2026
  assert.equal(ageRevolu("2008-10-26", ref), 18);
  assert.equal(ageRevolu("2008-10-27", ref), 17);
  assert.equal(ageRevolu("2012-01-01", ref), 14);
  assert.equal(ageRevolu(null, ref), null);
  assert.equal(ageRevolu("pas une date", ref), null);
});

test("mineur : moins de 18 ans seulement ; adulte : 18 ans et plus seulement", () => {
  const s = "2026-2027";
  assert.equal(equipeProposable({ age_group: "U16", season: s }, 15, s), true);
  assert.equal(equipeProposable({ age_group: "Senior", season: s }, 15, s), false);
  assert.equal(equipeProposable({ age_group: "U21", season: s }, 17, s), false);
  assert.equal(equipeProposable({ age_group: "Senior", season: s }, 19, s), true);
  assert.equal(equipeProposable({ age_group: "U18", season: s }, 18, s), false);
  assert.equal(equipeProposable({ age_group: "Juvénile", season: s }, 18, s), false);
});

test("âge inconnu ou catégorie inconnue : rien n'est filtré sur l'âge", () => {
  const s = "2026-2027";
  assert.equal(equipeProposable({ age_group: "Senior", season: s }, null, s), true);
  assert.equal(equipeProposable({ age_group: "Autre", season: s }, 15, s), true);
});

test("saison : passée cachée, en cours et à venir proposées, absente proposée", () => {
  const s = "2026-2027";
  assert.equal(equipeProposable({ age_group: "U15", season: "2025-2026" }, 14, s), false);
  assert.equal(equipeProposable({ age_group: "U15", season: "2026-2027" }, 14, s), true);
  assert.equal(equipeProposable({ age_group: "U15", season: "2027-2028" }, 14, s), true);
  assert.equal(equipeProposable({ age_group: "U15", season: null }, 14, s), true);
});
