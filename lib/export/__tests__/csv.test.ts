/* ═══════════════════════════════════════════════════════════════
   csv — le format qu'Excel FR ouvre directement, et la neutralisation
   des formules (lot B, export du pipeline).
   ═══════════════════════════════════════════════════════════════ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { caseCsv, construireCsv, decimalFr } from "@/lib/export/csv";

test("BOM UTF-8, séparateur « ; », fin de ligne CRLF", () => {
  const csv = construireCsv(["Nom", "École"], [["Léa", "Polyvalente"]]);
  assert.equal(csv.charCodeAt(0), 0xfeff, "BOM en tête");
  assert.equal(csv, "﻿Nom;École\r\nLéa;Polyvalente\r\n");
});

test("cases vides, nombres", () => {
  assert.equal(caseCsv(null), "");
  assert.equal(caseCsv(undefined), "");
  assert.equal(caseCsv(175), "175");
  assert.equal(caseCsv(-3), "-3", "un nombre négatif n'est pas une formule");
});

test("guillemets, point-virgule et retour à la ligne entourés et doublés", () => {
  assert.equal(caseCsv(`6'1"`), `"6'1"""`);
  assert.equal(caseCsv("a;b"), `"a;b"`);
  assert.equal(caseCsv("ligne 1\nligne 2"), `"ligne 1\nligne 2"`);
});

test("injection de formule neutralisée par une apostrophe", () => {
  assert.equal(caseCsv("=HYPERLINK(\"x\")"), `"'=HYPERLINK(""x"")"`);
  assert.equal(caseCsv("+1 514"), "'+1 514");
  assert.equal(caseCsv("-> à revoir"), "'-> à revoir");
  assert.equal(caseCsv("@coach"), "'@coach");
  assert.equal(caseCsv("Rien à signaler"), "Rien à signaler");
});

test("décimal à la française", () => {
  assert.equal(decimalFr(4.5), "4,5");
  assert.equal(decimalFr(4), "4,0");
});
