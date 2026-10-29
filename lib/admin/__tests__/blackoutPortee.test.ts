import { test } from "node:test";
import assert from "node:assert/strict";
import { describeBlackout, porteeDe, PORTEES } from "@/app/admin/blackouts/_components/describeBlackout";

const base = { sport_id: null, promo_min: null, promo_max: null, date_debut: "2026-08-01", date_fin: "2026-11-10", actif: true };

test("black-out : sans portée (avant la migration), la période vise tous les athlètes", () => {
  assert.equal(porteeDe(base), "tous");
  assert.equal(describeBlackout(base, null),
    "Du 1er août au 10 novembre 2026, les recruteurs collégiaux et universitaires ne peuvent pas écrire à tous les athlètes, toutes disciplines.");
});

test("black-out : la phrase suit le niveau de l'athlète", () => {
  assert.equal(describeBlackout({ ...base, portee: "secondaire" }, "Football"),
    "Du 1er août au 10 novembre 2026, les recruteurs collégiaux et universitaires ne peuvent pas écrire aux athlètes du secondaire en football, toutes promotions.");
  assert.equal(describeBlackout({ ...base, portee: "cegep", promo_min: 2027, promo_max: 2027 }, null),
    "Du 1er août au 10 novembre 2026, les recruteurs universitaires ne peuvent pas écrire aux cégépiens de promotion 2027, toutes disciplines.");
});

test("black-out : trois portées, jamais « recruteur » seul", () => {
  assert.deepEqual(PORTEES.map((p) => p.valeur), ["secondaire", "cegep", "tous"]);
  for (const p of PORTEES) assert.doesNotMatch(p.libelle, /\brecruteurs?\b(?! (collégia|universitaire))/i);
});
