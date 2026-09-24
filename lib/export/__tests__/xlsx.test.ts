/* ═══════════════════════════════════════════════════════════════
   xlsx — le classeur de l'export du pipeline (lot B, 2026-09-24).
   Structure du zip, cases de texte jamais interprétées, dates en numéros
   de série, en-tête figé et filtré. La lecture dans le vrai Excel est
   vérifiée à part (automatisation COM, voir le commit).
   ═══════════════════════════════════════════════════════════════ */
import { test } from "node:test";
import assert from "node:assert/strict";
import JSZip from "jszip";
import { construireXlsx, feuilleXml, echapperXml, lettreColonne, serieExcel } from "@/lib/export/xlsx";

test("lettres de colonnes", () => {
  assert.equal(lettreColonne(0), "A");
  assert.equal(lettreColonne(12), "M");
  assert.equal(lettreColonne(25), "Z");
  assert.equal(lettreColonne(26), "AA");
});

test("numéro de série Excel (système 1900)", () => {
  assert.equal(serieExcel("1900-03-01"), 61);
  assert.equal(serieExcel("2026-09-26"), 46291);
  assert.ok(Math.abs(serieExcel("2026-09-29 10:00")! - (46294 + 10 / 24)) < 1e-9, "10 h = 10/24 de jour");
  assert.equal(serieExcel("pas une date"), null);
});

test("échappement XML et caractères de contrôle retirés", () => {
  assert.equal(echapperXml(`6'0" <b> & co\u0007`), `6'0&quot; &lt;b&gt; &amp; co`);
  assert.equal(echapperXml("ligne 1\nligne 2"), "ligne 1\nligne 2", "le retour à la ligne est gardé");
});

test("feuille : en-tête gras figé, filtre, texte EN LIGNE (jamais une formule)", () => {
  const xml = feuilleXml(
    [{ titre: "Nom", largeur: 20 }, { titre: "Note", largeur: 50 }],
    [[{ t: "texte", v: "=HYPERLINK(\"x\")" }, { t: "texte", v: "a\nb" }]],
  );
  assert.match(xml, /<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"\/>/);
  assert.match(xml, /<autoFilter ref="A1:B2"\/>/);
  assert.match(xml, /<c r="A1" s="1" t="inlineStr">/, "en-tête en style gras");
  assert.match(xml, /<c r="A2" s="2" t="inlineStr"><is><t xml:space="preserve">=HYPERLINK\(&quot;x&quot;\)<\/t><\/is><\/c>/,
    "une chaîne en ligne n'est jamais évaluée : pas de <f>, pas d'apostrophe");
  assert.ok(!xml.includes("<f>"));
  assert.match(xml, /<t xml:space="preserve">a\nb<\/t>/, "multiligne natif");
});

test("dates, nombres et cases vides", () => {
  const xml = feuilleXml(
    [{ titre: "Relance", largeur: 12 }, { titre: "Visite", largeur: 17 }, { titre: "Cote", largeur: 8 }, { titre: "Vide", largeur: 8 }],
    [[{ t: "date", v: "2026-09-26" }, { t: "date", v: "2026-09-29 10:00" }, { t: "nombre", v: 4.5, format: "0.0" }, null]],
  );
  assert.match(xml, /<c r="A2" s="3"><v>46291<\/v><\/c>/);
  assert.match(xml, /<c r="B2" s="4"><v>46294\.41666666/);
  assert.match(xml, /<c r="C2" s="5"><v>4.5<\/v><\/c>/);
  assert.ok(!xml.includes('r="D2"'), "case vide : aucune cellule écrite");
});

test("le zip contient les parties d'un classeur valide", async () => {
  const octets = await construireXlsx("Mon processus", [{ titre: "Nom", largeur: 20 }], [[{ t: "texte", v: "Léa" }]]);
  assert.equal(octets[0], 0x50);
  assert.equal(octets[1], 0x4b, "signature zip « PK »");
  const zip = await JSZip.loadAsync(octets);
  for (const partie of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml"]) {
    assert.ok(zip.file(partie), partie);
  }
  assert.match(await zip.file("xl/worksheets/sheet1.xml")!.async("string"), /Léa/);
});
