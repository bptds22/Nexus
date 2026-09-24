/* ═══════════════════════════════════════════════════════════════
   csv — le format qu'Excel ouvre en colonnes et avec les accents quelle que
   soit la langue de Windows (UTF-16LE + BOM + tabulation, testé dans Excel
   16 le 2026-09-24), et la neutralisation des formules.
   ═══════════════════════════════════════════════════════════════ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { caseCsv, construireCsv, texteCsv, decimalFr } from "@/lib/export/csv";

const decoder = (o: Uint8Array) => new TextDecoder("utf-16le").decode(o.slice(2));

test("BOM UTF-16LE puis texte en UTF-16LE, tabulation, CRLF", () => {
  const o = construireCsv(["Nom", "École"], [["Léa", "Polyvalente"]]);
  assert.equal(o[0], 0xff);
  assert.equal(o[1], 0xfe);
  assert.equal(decoder(o), "Nom\tÉcole\r\nLéa\tPolyvalente\r\n");
});

test("pas de ligne « sep= » : elle fait ignorer l'encodage à Excel", () => {
  assert.ok(!texteCsv(["a"], [["b"]]).includes("sep="));
});

test("une note multiligne reste sur UNE ligne du fichier", () => {
  assert.equal(caseCsv("2026-09-12 — Vu à Lévis\n2026-09-22 — À revoir\r\n"), "2026-09-12 — Vu à Lévis · 2026-09-22 — À revoir · ");
  const texte = texteCsv(["Nom", "Note"], [["Léa", "ligne 1\nligne 2\nligne 3"]]);
  assert.equal(texte.split("\r\n").length, 3, "en-tête + 1 athlète + fin");
});

test("guillemets : case entourée, guillemets doublés (Excel affiche 6'0\")", () => {
  assert.equal(caseCsv(`6'0"`), `"6'0"""`);
  assert.equal(caseCsv("a\tb"), `"a\tb"`);
  assert.equal(caseCsv("point-virgule ; sans souci"), "point-virgule ; sans souci", "« ; » n'est plus un séparateur");
});

test("cases vides et nombres", () => {
  assert.equal(caseCsv(null), "");
  assert.equal(caseCsv(undefined), "");
  assert.equal(caseCsv(175), "175");
  assert.equal(caseCsv(-3), "-3", "un nombre négatif n'est pas une formule");
});

test("injection de formule neutralisée par une apostrophe", () => {
  assert.equal(caseCsv("=HYPERLINK(\"x\")"), `"'=HYPERLINK(""x"")"`);
  assert.equal(caseCsv("+1 514"), "'+1 514");
  assert.equal(caseCsv("@coach"), "'@coach");
  assert.equal(caseCsv("Rien à signaler"), "Rien à signaler");
});

test("décimal à la française", () => {
  assert.equal(decimalFr(4.5), "4,5");
});
