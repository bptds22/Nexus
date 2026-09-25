/* Le tableau blanc ne se persiste pas (correctif du 2026-09-24) : un F5
   servait Mon processus d'il y a jusqu'à 30 min. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { estCleTableauBlanc, CLES_TABLEAU_BLANC } from "@/lib/queries/tableauBlanc";

test("les lectures d'unité et du processus ne se persistent pas", () => {
  for (const cle of [
    ["pipeline", "unite", "u1", null, false], ["pipeline", "u1"], ["pipeline-notes", "unite", "u1", "a1"],
    ["pipeline-historique", "u1", "a1"], ["unite-auteurs", "u1"], ["favorites"], ["favoriteCounts"],
    ["dashboard", "kpi"], ["recruiting-calendar"], ["recruiter-lists", "u1"], ["cegep-stats", "s1"],
  ]) assert.equal(estCleTableauBlanc(cle), true, JSON.stringify(cle));
});

test("le reste garde son cache persisté", () => {
  for (const cle of [["currentUser"], ["athletes"], ["regions"], ["positionsBySport"], [], undefined]) {
    assert.equal(estCleTableauBlanc(cle as never), false, JSON.stringify(cle));
  }
});

test("la liste ne contient pas de doublon", () => {
  assert.equal(new Set(CLES_TABLEAU_BLANC).size, CLES_TABLEAU_BLANC.length);
});
