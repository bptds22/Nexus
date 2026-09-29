import { test } from "node:test";
import assert from "node:assert/strict";
import { filtrerOptions, trierOptions } from "@/lib/demo/rechercheListe";

const cegeps = [
  { id: "1", nom: "Cégep de Sherbrooke" },
  { id: "2", nom: "Autre" },
  { id: "3", nom: "Campus Notre-Dame-de-Foy" },
  { id: "4", nom: "Cégep André-Laurendeau" },
  { id: "5", nom: "Collège Édouard-Montpetit" },
  { id: "6", nom: "Cégep de l'Outaouais" },
];

test("tri alphabétique à la française, « Autre » en dernier", () => {
  assert.deepEqual(trierOptions(cegeps).map((o) => o.id), ["3", "4", "6", "1", "5", "2"]);
});

test("recherche insensible aux accents et à la casse", () => {
  assert.deepEqual(filtrerOptions(cegeps, "EDOUARD").map((o) => o.id), ["5", "2"]);
  assert.deepEqual(filtrerOptions(cegeps, "cegep").map((o) => o.id), ["4", "6", "1", "2"]);
  assert.deepEqual(filtrerOptions(cegeps, "sherbrooke cégep").map((o) => o.id), ["1", "2"]);
});

test("« Autre » reste proposé quoi qu'on tape ; vide → toute la liste", () => {
  assert.deepEqual(filtrerOptions(cegeps, "zzz").map((o) => o.id), ["2"]);
  assert.equal(filtrerOptions(cegeps, "  ").length, cegeps.length);
});
