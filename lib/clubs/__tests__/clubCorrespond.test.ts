/* Suite — lib/clubs/clubCorrespond.ts (recherche de club des inscriptions, bug NLS).

   Lancement :
     node --experimental-strip-types \
       --import ./lib/evaluations/__tests__/register-alias.mjs \
       --test "lib/clubs/__tests__/clubCorrespond.test.ts"
*/

import test from "node:test";
import assert from "node:assert/strict";
import { clubCorrespond, filtrerClubs, peutCreerClub, siglesClub } from "@/lib/clubs/clubCorrespond";

const NLS = { name: "No Limits Showcases", city: "Montréal" };
const CLUBS = [
  { name: "AAA Basketball Laval", city: "Laval" },
  NLS,
  { name: "Club de soccer de Laval", city: "Laval" },
  { name: "Séminaire Saint-François", city: "Saint-Augustin-de-Desmaures" },
];

test("« nls », « no limits », « showcases » trouvent No Limits Showcases", () => {
  for (const q of ["nls", "NLS", "no limits", "showcases", "Showcases", "  no   LIMITS "]) {
    assert.equal(clubCorrespond(NLS, q), true, q);
    assert.deepEqual(filtrerClubs(CLUBS, q).map((c) => c.name), ["No Limits Showcases"], q);
  }
});

test("un club par son nom et par sa ville, accents et casse ignorés", () => {
  assert.deepEqual(filtrerClubs(CLUBS, "seminaire saint-francois").map((c) => c.name), ["Séminaire Saint-François"]);
  assert.deepEqual(filtrerClubs(CLUBS, "augustin").map((c) => c.name), ["Séminaire Saint-François"]);
  assert.deepEqual(filtrerClubs(CLUBS, "montreal").map((c) => c.name), ["No Limits Showcases"]);
  assert.deepEqual(filtrerClubs(CLUBS, "soccer laval").map((c) => c.name), ["Club de soccer de Laval"]);
});

test("sigle : tapé en entier, avec ou sans les petits mots ; combinable avec la ville", () => {
  assert.deepEqual(siglesClub("Club de soccer de Laval"), ["cdsdl", "csl"]);
  assert.equal(clubCorrespond(CLUBS[2], "csl"), true);
  assert.equal(clubCorrespond(CLUBS[2], "cdsdl"), true);
  assert.equal(clubCorrespond(NLS, "nl"), false);
  assert.equal(clubCorrespond(NLS, "nls montreal"), true);
  assert.equal(clubCorrespond(NLS, "nls laval"), false);
  assert.equal(clubCorrespond(NLS, "n.l.s."), true);
});

test("recherche vide : tous les clubs ; aucun sigle d'une lettre", () => {
  assert.equal(filtrerClubs(CLUBS, "  ").length, CLUBS.length);
  assert.deepEqual(siglesClub("Wildcats"), []);
});

test("création de club : jamais si un club correspond (sigle compris), seulement après une recherche sans résultat", () => {
  assert.equal(peutCreerClub("nls", CLUBS), false);
  assert.equal(peutCreerClub("no limits", CLUBS), false);
  assert.equal(peutCreerClub("", CLUBS), false);
  assert.equal(peutCreerClub("   ", []), false);
  assert.equal(peutCreerClub("Patriotes de Boucherville", CLUBS), true);
});

test("mobile coach civil : « + Créer un nouveau club » suit la même règle que le web", () => {
  // CoachOnboardingMobileCivil : footer du sheet = peutCreerClub(clubSearch, clubs).
  assert.equal(peutCreerClub("", CLUBS), false, "sheet ouvert, rien tapé");
  assert.equal(peutCreerClub("nls", CLUBS), false, "sigle d'un club connu");
  assert.equal(peutCreerClub("laval", CLUBS), false, "ville d'un club connu");
  assert.equal(peutCreerClub("zzz club inexistant", CLUBS), true, "recherche sans résultat");
});
