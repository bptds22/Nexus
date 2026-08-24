/* Suite 2 — REGROUPEMENT 9 / 5, et invisibilité de la frontière fixe/variable.
   L'ancien découpage en 3 groupes classait les fentes selon leur libellé
   GENERIQUE : « Protection de passe » finissait sous « Caractère ». */

import test from "node:test";
import assert from "node:assert/strict";
import { traitGroups, traitList, TRAIT_COLUMNS, TRAIT_GROUP_SPEC,
         type TraitEntry } from "@/lib/evaluations/grilles";
import { SET, SET_HS } from "./fixtures.ts";

const G = () => traitGroups(SET, { positionId: "p-ol" });   // FB-LO

test("deux groupes, titres et tailles", () => {
  assert.equal(G().length, 2);
  assert.deepEqual(G().map((g) => g.title), ["Sur le terrain", "Caractère"]);
  assert.deepEqual(G().map((g) => g.traits.length), [9, 5]);
});

test("14 critères, sans trou ni doublon", () => {
  const cols = G().flatMap((g) => g.traits.map((t) => t.column));
  assert.equal(cols.length, 14);
  assert.equal(new Set(cols).size, 14);
  assert.ok(G().every((g) => g.traits.every(Boolean)));
});

test("ordre imposé — 4 physiques, PUIS les 5 fentes", () => {
  assert.deepEqual(G()[0].traits.slice(0, 4).map((t) => t.column),
    ["vitesse_explosivite", "force_puissance", "endurance_cardio", "agilite_coordination"]);
  assert.deepEqual(G()[0].traits.slice(4).map((t) => t.column), SET.slotColumns);
});

test("les fentes suivent evaluation_slots, pas une copie figée", () => {
  const inverse = { ...SET, slotColumns: [...SET.slotColumns].reverse() };
  assert.deepEqual(traitGroups(inverse, { positionId: "p-ol" })[0].traits.slice(4).map((t) => t.column),
    [...SET.slotColumns].reverse());
});

test("RÉGRESSION — « Protection de passe » n'est plus sous « Caractère »", () => {
  assert.ok(!G()[1].traits.some((t) => t.label === "Protection de passe"));
  assert.ok(G()[0].traits.some((t) => t.label === "Protection de passe"));
});

test("RÉGRESSION — « Jeu de pieds » est sous « Sur le terrain »", () => {
  assert.ok(G()[0].traits.some((t) => t.label === "Jeu de pieds"));
});

test("« Caractère » ne contient QUE des fixes", () => {
  assert.deepEqual(G()[1].traits.map((t) => t.column),
    ["leadership", "discipline", "coachabilite", "intelligence_jeu", "attitude_mentalite"]);
  assert.ok(!G()[1].traits.some((t) => SET.slotColumns.includes(t.column)));
});

test("INVISIBILITÉ — TraitEntry ne porte aucun champ de provenance", () => {
  // Un appelant ne doit pas POUVOIR distinguer une fixe d'une variable.
  const keys = Object.keys(G()[0].traits[0] as TraitEntry).sort();
  assert.deepEqual(keys, ["camel", "column", "definition", "label"]);
});

test("INVISIBILITÉ — aucun titre ne nomme la frontière", () => {
  assert.ok(!G().some((g) => /fixe|variable|grille|slot|fente/i.test(g.title)));
});

test("INVISIBILITÉ — le groupe de 9 mélange 4 fixes et 5 variables", () => {
  const t = G()[0].traits;
  assert.equal(t.filter((x) => SET.slotColumns.includes(x.column)).length, 5);
  assert.equal(t.filter((x) => !SET.slotColumns.includes(x.column)).length, 4);
});

test("INVISIBILITÉ — un athlète GENERIQUE rend la MÊME structure 9/5", () => {
  assert.deepEqual(traitGroups(SET, { positionId: null }).map((g) => g.traits.length), [9, 5]);
  assert.deepEqual(traitGroups(SET_HS, {}).map((g) => g.traits.length), [9, 5]);
});

test("ordre à plat == ordre groupé (une seule autorité)", () => {
  const plat = traitList(SET, { positionId: "p-ol" }).map((t) => t.column);
  const groupe = G().flatMap((g) => g.traits.map((t) => t.column));
  assert.deepEqual(plat, groupe);
});

test("TRAIT_COLUMNS est aligné sur ce même ordre", () => {
  assert.deepEqual([...TRAIT_COLUMNS], traitList(SET, { positionId: null }).map((t) => t.column));
});

test("un seul groupe porte les fentes", () => {
  assert.equal(TRAIT_GROUP_SPEC.filter((g) => g.slotsApres).length, 1);
});

test("aucune définition rendue tant que slot_*_definition est NULL", () => {
  assert.ok(G().every((g) => g.traits.every((t) => t.definition === null)));
});
