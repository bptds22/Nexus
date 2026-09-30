import { test } from "node:test";
import assert from "node:assert/strict";
import { phraseFusion } from "@/lib/cartes/phraseFusion";

test("fusion : la carte et l'étape", () => {
  assert.equal(phraseFusion({ new_stage: "EN_DISCUSSION", fusion: { id: "x", carte: "Jade Tremblay" } }, "En discussion"),
    "a fusionné la carte prospect « Jade Tremblay » avec ce profil (En discussion)");
});

test("annulation : ce qui a été gardé", () => {
  assert.equal(phraseFusion({ retire: false, fusion_annulee: { id: "x", carte: "Jade Tremblay", conserves: ["étape et suivi", "1 note(s)"] } }),
    "a annulé la fusion de la carte prospect « Jade Tremblay » — gardé, car modifié depuis : étape et suivi, 1 note(s)");
});

test("annulation qui retire le dossier : pas lue comme un simple retrait", () => {
  assert.equal(phraseFusion({ retire: true, fusion_annulee: { id: "x", carte: "Noé Fortin", conserves: [] } }),
    "a annulé la fusion de la carte prospect « Noé Fortin »");
});

test("changement d'étape ordinaire : pas une fusion", () => {
  assert.equal(phraseFusion({ new_stage: "CONTACTE", before_stage: "IDENTIFIE" }), null);
  assert.equal(phraseFusion(null), null);
});
