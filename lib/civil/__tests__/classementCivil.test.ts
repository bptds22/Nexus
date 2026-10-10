import { test } from "node:test";
import assert from "node:assert/strict";
import { classerGroupeCivil, categorieCivile, nomGroupe } from "@/lib/civil/classementCivil";

const c = (l: string, cat: string, div: string | null) => classerGroupeCivil(l, cat, div);

test("LFMM : les libellés SOURCE (majuscules, tiret)", () => {
  assert.deepEqual(c("LFMM", "ATOME", "ATOME NORD"), { categorie: "Atome", division: "", zone: "Nord" });
  assert.deepEqual(c("LFMM", "ATOME", "ATOME SUD"), { categorie: "Atome", division: "", zone: "Sud" });
  assert.deepEqual(c("LFMM", "BANTAM AAA", "BANTAM - DIVISION 1"), { categorie: "Bantam", division: "D1", zone: "" });
  assert.deepEqual(c("LFMM", "BANTAM AAA", "BANTAM - DIVISION 2"), { categorie: "Bantam", division: "D2", zone: "" });
  assert.deepEqual(c("LFMM", "MIDGET AAA", "MIDGET - DIVISION 1"), { categorie: "Midget", division: "D1", zone: "" });
  assert.deepEqual(c("LFMM", "MIDGET AAA", "MIDGET - DIVISION 2"), { categorie: "Midget", division: "D2", zone: "" });
  assert.deepEqual(c("LFMM", "MOUSTIQUE", "MOUSTIQUE AAA - DIVISION 1 NORD"), { categorie: "Moustique", division: "AAA", zone: "Nord" });
  assert.deepEqual(c("LFMM", "PEE-WEE", "PEE-WEE AAA - DIVISION 1 SUD"), { categorie: "Pee-Wee", division: "AAA", zone: "Sud" });
});

test("LFMM : les libellés DÉJÀ IMPORTÉS (cadratin) donnent le même groupe", () => {
  assert.deepEqual(c("LFMM", "Atome", "Atome Nord"), c("LFMM", "ATOME", "ATOME NORD"));
  assert.deepEqual(c("LFMM", "Bantam", "Bantam — Division 1"), c("LFMM", "BANTAM AAA", "BANTAM - DIVISION 1"));
  assert.deepEqual(c("LFMM", "Midget", "Midget — Division 2"), c("LFMM", "MIDGET AAA", "MIDGET - DIVISION 2"));
  assert.deepEqual(c("LFMM", "Moustique", "Moustique AAA — Division 1 Sud"), { categorie: "Moustique", division: "AAA", zone: "Sud" });
  assert.deepEqual(c("LFMM", "Pee-Wee", "Pee-Wee AAA — Division 1 Nord"), { categorie: "Pee-Wee", division: "AAA", zone: "Nord" });
  // saisie coach (Wildcats D2)
  assert.deepEqual(c("LFMM", "Midget", "Division 2"), { categorie: "Midget", division: "D2", zone: "" });
  // idempotent : un groupe déjà corrigé se reclasse à l'identique
  assert.deepEqual(c("LFMM", "Pee-Wee", "AAA"), { categorie: "Pee-Wee", division: "AAA", zone: "" });
  assert.deepEqual(c("LFMM", "Bantam", "D1"), { categorie: "Bantam", division: "D1", zone: "" });
  assert.deepEqual(c("LFMM", "Atome", ""), { categorie: "Atome", division: "", zone: "" });
});

test("LeagueSuite : un niveau par ligue, aucune zone", () => {
  assert.deepEqual(c("QBFL", "Bantam AAA", "QBFL"), { categorie: "Bantam", division: "AAA", zone: "" });
  assert.deepEqual(c("QMFL", "Midget AAA", "QMFL"), { categorie: "Midget", division: "AAA", zone: "" });
  assert.deepEqual(c("QMJFL", "Junior Major", "QMJFL"), { categorie: "Junior", division: "Majeur", zone: "" });
  // déjà importé
  assert.deepEqual(c("QMJFL", "Junior", "Majeur"), { categorie: "Junior", division: "Majeur", zone: "" });
});

test("un libellé inconnu ARRÊTE le générateur au lieu de deviner", () => {
  assert.throws(() => c("LFMM", "FLAG 10M", "DIVISION SUD-CENTRE"), /catégorie inconnue/);
  assert.throws(() => c("LFMM", "ATOME", "ATOME CONFÉRENCE ROUGE"), /division illisible/);
  assert.throws(() => c("LFQ9", "MIDGET", "AAA"), /ligue inconnue/);
  assert.throws(() => categorieCivile("Juvénile"), /catégorie inconnue/); // RSEQ : jamais par ce classeur
});

test("nomGroupe : la zone fait partie du nom du groupe", () => {
  assert.equal(nomGroupe({ categorie: "Atome", division: "", zone: "Nord" }), "Atome Nord");
  assert.equal(nomGroupe({ categorie: "Pee-Wee", division: "AAA", zone: "Sud" }), "Pee-Wee AAA Sud");
  assert.equal(nomGroupe({ categorie: "Bantam", division: "D1", zone: null }), "Bantam D1");
  assert.equal(nomGroupe({ categorie: "Cadet", division: "D3" }), "Cadet D3");
  assert.equal(nomGroupe({}), "");
});
