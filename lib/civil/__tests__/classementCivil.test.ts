import { test } from "node:test";
import assert from "node:assert/strict";
import { classerGroupeCivil, ageCivil, nomGroupe } from "@/lib/civil/classementCivil";

const c = (l: string, cat: string, div: string | null) => classerGroupeCivil(l, cat, div);

test("les exemples de BP (2026-10-09), mot pour mot", () => {
  assert.deepEqual(c("LFMM", "Pee-Wee", "Pee-Wee AAA — Division 1 Sud"), { categorie: "Pee-Wee AAA", division: "D1", zone: "Sud" });
  assert.deepEqual(c("LFMM", "Moustique", "Moustique AAA — Division 1 Nord"), { categorie: "Moustique AAA", division: "D1", zone: "Nord" });
  assert.deepEqual(c("LFMM", "Midget", "Midget — Division 2"), { categorie: "Midget", division: "D2", zone: "" });
  assert.deepEqual(c("LFMM", "Atome", "Atome Nord"), { categorie: "Atome", division: "", zone: "Nord" });
  assert.deepEqual(c("QBFL", "Bantam", "AAA"), { categorie: "Bantam AAA", division: "", zone: "" });
  assert.deepEqual(c("QMFL", "Midget", "AAA"), { categorie: "Midget AAA", division: "", zone: "" });
  assert.deepEqual(c("QMJFL", "Junior", "Majeur"), { categorie: "Junior Majeur", division: "", zone: "" });
});

test("LFMM : les libellés SOURCE donnent les mêmes groupes que les libellés importés", () => {
  assert.deepEqual(c("LFMM", "ATOME", "ATOME SUD"), { categorie: "Atome", division: "", zone: "Sud" });
  assert.deepEqual(c("LFMM", "BANTAM AAA", "BANTAM - DIVISION 1"), { categorie: "Bantam", division: "D1", zone: "" });
  assert.deepEqual(c("LFMM", "BANTAM AAA", "BANTAM - DIVISION 2"), c("LFMM", "Bantam", "Bantam — Division 2"));
  assert.deepEqual(c("LFMM", "MIDGET AAA", "MIDGET - DIVISION 1"), { categorie: "Midget", division: "D1", zone: "" });
  assert.deepEqual(c("LFMM", "MOUSTIQUE", "MOUSTIQUE AAA - DIVISION 1 SUD"), { categorie: "Moustique AAA", division: "D1", zone: "Sud" });
  assert.deepEqual(c("LFMM", "PEE-WEE", "PEE-WEE AAA - DIVISION 1 NORD"), { categorie: "Pee-Wee AAA", division: "D1", zone: "Nord" });
  assert.deepEqual(c("LFMM", "Midget", "Division 2"), { categorie: "Midget", division: "D2", zone: "" }); // saisie coach
});

test("LeagueSuite : le calibre de la ligue entre dans la catégorie (libellés source)", () => {
  assert.deepEqual(c("QBFL", "Bantam AAA", "QBFL"), { categorie: "Bantam AAA", division: "", zone: "" });
  assert.deepEqual(c("QMFL", "Midget AAA", "QMFL"), { categorie: "Midget AAA", division: "", zone: "" });
  assert.deepEqual(c("QMJFL", "Junior Major", "QMJFL"), { categorie: "Junior Majeur", division: "", zone: "" });
});

test("division : D1…D4 seulement, jamais un calibre", () => {
  for (const [l, cat, div] of [
    ["LFMM", "ATOME", "ATOME NORD"], ["LFMM", "PEE-WEE", "PEE-WEE AAA - DIVISION 1 SUD"],
    ["QBFL", "Bantam AAA", "QBFL"], ["QMJFL", "Junior Major", "QMJFL"], ["LFMM", "MIDGET AAA", "MIDGET - DIVISION 2"],
  ] as const) {
    assert.match(c(l, cat, div).division, /^(D[1-4])?$/);
  }
});

test("un libellé inconnu ARRÊTE le générateur au lieu de deviner", () => {
  assert.throws(() => c("LFMM", "FLAG 10M", "DIVISION SUD-CENTRE"), /catégorie inconnue/);
  assert.throws(() => c("LFMM", "ATOME", "ATOME CONFÉRENCE ROUGE"), /division illisible/);
  assert.throws(() => c("LFMM", "BANTAM", "BANTAM - DIVISION 5"), /division illisible/);
  assert.throws(() => c("LFQ9", "MIDGET", "AAA"), /ligue inconnue/);
  assert.throws(() => ageCivil("Juvénile"), /catégorie inconnue/); // RSEQ : jamais par ce classeur
});

test("nomGroupe : la zone suit la division, ou la catégorie sans division", () => {
  assert.equal(nomGroupe({ categorie: "Pee-Wee AAA", division: "D1", zone: "Sud" }), "Pee-Wee AAA · Division 1 · Sud");
  assert.equal(nomGroupe({ categorie: "Atome", division: "", zone: "Nord" }), "Atome Nord");
  assert.equal(nomGroupe({ categorie: "Midget", division: "D2", zone: null }), "Midget · Division 2");
  assert.equal(nomGroupe({ categorie: "Bantam AAA", division: "", zone: "" }), "Bantam AAA");
  assert.equal(nomGroupe({ categorie: "Benjamin", division: "D4" }), "Benjamin · Division 4");
  assert.equal(nomGroupe({}), "");
});
