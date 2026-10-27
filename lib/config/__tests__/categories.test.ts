/* Suite — lib/config/categories.ts (liste canonique unique, lot B4 cégep) et libellés de promotion.

   Lancement :
     node --experimental-strip-types \
       --import ./lib/evaluations/__tests__/register-alias.mjs \
       --test lib/config/__tests__/categories.test.ts */

import test from "node:test";
import assert from "node:assert/strict";
import {
  CATEGORIES_CANONIQUES, categoriesTriees, comparerCategories, correspondCategorie, libelleCategorie, variantesCategorie,
} from "@/lib/config/categories";
import { libelleOptionPromotion, libellePromotion, porteePromotion } from "@/lib/config/gradYears";

test("liste canonique : groupes dans l'ordre secondaire, civil, soccer civil, Ouvert, Collégial", () => {
  const rang = (c: string) => CATEGORIES_CANONIQUES.indexOf(c);
  assert.ok(rang("Atome") < rang("Juvénile"));
  assert.ok(rang("Juvénile") < rang("M18"));
  assert.ok(rang("M18") < rang("Moustique AAA"));
  assert.ok(rang("Moustique AAA") < rang("Junior Majeur"));
  assert.ok(rang("Junior Majeur") < rang("U9"));
  assert.ok(rang("U21") < rang("Senior"));
  assert.ok(rang("Senior") < rang("Ouvert"));
  assert.equal(CATEGORIES_CANONIQUES.at(-1), "Collégial");
  assert.equal(new Set(CATEGORIES_CANONIQUES).size, CATEGORIES_CANONIQUES.length, "aucun doublon");
});

test("aucun regroupement : Midget, Midget AAA, M18 AAA et M18 restent distincts", () => {
  const l = categoriesTriees(["Midget", "Midget AAA", "M18 AAA", "M18"]);
  assert.equal(l.length, 4);
});

test("variantes d'écriture : casse, accents, espaces ; « cegep » → Collégial", () => {
  assert.equal(libelleCategorie("cegep"), "Collégial");
  assert.equal(libelleCategorie("CÉGEP"), "Collégial");
  assert.equal(libelleCategorie("  juvenile "), "Juvénile");
  assert.equal(libelleCategorie("pee-wee aaa"), "Pee-Wee AAA");
  assert.equal(libelleCategorie(""), null);
  assert.equal(libelleCategorie(null), null);
  assert.deepEqual(variantesCategorie("Collégial"), ["Collégial", "cegep"]);
  assert.deepEqual(variantesCategorie("Juvénile"), ["Juvénile"]);
  assert.equal(correspondCategorie("cegep", "Collégial"), true);
  assert.equal(correspondCategorie("Cadet", ""), true);
});

test("valeur inconnue : gardée telle quelle, rangée après les connues", () => {
  assert.deepEqual(categoriesTriees(["Primaire 6", "Collégial", "Benjamin", "Novice"]), ["Benjamin", "Collégial", "Novice", "Primaire 6"]);
  assert.ok(comparerCategories("Collégial", "Novice") < 0);
});

test("promotion : « DEC AAAA » pour un cégep d'ancrage, sinon « Secondaire AAAA », jamais l'année seule", () => {
  assert.equal(libellePromotion(2027, "CEGEP"), "DEC 2027");
  assert.equal(libellePromotion(2027, "SECONDAIRE"), "Secondaire 2027");
  assert.equal(libellePromotion("2028", "LIGUE_CIVILE"), "Secondaire 2028");
  assert.equal(libellePromotion(2028, null), "Secondaire 2028");
  assert.equal(libellePromotion(null, "CEGEP"), null);
  assert.equal(libellePromotion(0, "SECONDAIRE"), null);
  assert.equal(libelleOptionPromotion(2027, porteePromotion("collegial", true)), "DEC 2027");
  assert.equal(libelleOptionPromotion(2027, porteePromotion("scolaire", true)), "Secondaire 2027");
  assert.equal(libelleOptionPromotion(2027, porteePromotion("", true)), "Secondaire ou DEC 2027");
  assert.equal(libelleOptionPromotion(2027, porteePromotion("", false)), "Secondaire 2027");
});
