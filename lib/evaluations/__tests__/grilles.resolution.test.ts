/* Suite 1 — RÉSOLUTION ET LIBELLÉS.
   Ce que le module rend, et à partir de quoi. */

import test from "node:test";
import assert from "node:assert/strict";
import {
  resolveGrille, traitLabels, traitList, grilleIdForSave,
  TRAIT_COLUMNS, COLUMN_TO_CAMEL, CAMEL_TO_COLUMN, FIXED_TRAIT_LABELS,
} from "@/lib/evaluations/grilles";
import { SET, SET_HS } from "./fixtures.ts";

test("résolution — la position mène à sa grille", () => {
  assert.equal(resolveGrille(SET, { positionId: "p-qb" })?.code, "FB-QB");
  assert.equal(resolveGrille(SET, { positionId: "p-meneur" })?.code, "BB");
});

test("résolution — repli GENERIQUE : position absente, nulle, ou non rattachée", () => {
  assert.equal(resolveGrille(SET, { positionId: null })?.code, "GENERIQUE");
  assert.equal(resolveGrille(SET, {})?.code, "GENERIQUE");
  assert.equal(resolveGrille(SET, { positionId: "p-inconnue" })?.code, "GENERIQUE");
});

test("libellés — les 14 sont rendus, fusionnés", () => {
  const l = traitLabels(SET, { positionId: "p-meneur" });
  assert.equal(Object.keys(l).length, 14);
  assert.ok(TRAIT_COLUMNS.every((c) => typeof l[c] === "string" && l[c].length > 0));
});

test("libellés — les 5 variables viennent de la grille", () => {
  const l = traitLabels(SET, { positionId: "p-meneur" });   // Basketball
  assert.equal(l.competitivite, "Tir extérieur");
  assert.equal(l.vision_du_jeu, "Défense");
  assert.equal(l.sens_tactique, "Rebond");
});

test("libellés — les 9 fixes ne bougent JAMAIS avec la grille", () => {
  const bb = traitLabels(SET, { positionId: "p-meneur" });
  const qb = traitLabels(SET, { positionId: "p-qb" });
  for (const [col, fixe] of Object.entries(FIXED_TRAIT_LABELS)) {
    assert.equal(bb[col], fixe, `${col} a bougé sur BB`);
    assert.equal(qb[col], fixe, `${col} a bougé sur FB-QB`);
  }
});

test("libellés — les 4 renommages arbitrés sont bien appliqués", () => {
  // Régression : ces 4 divergeaient entre surfaces avant le chantier.
  assert.equal(FIXED_TRAIT_LABELS.vitesse_explosivite, "Vitesse");
  assert.equal(FIXED_TRAIT_LABELS.force_puissance, "Puissance");
  assert.equal(FIXED_TRAIT_LABELS.endurance_cardio, "Endurance");
  assert.equal(FIXED_TRAIT_LABELS.attitude_mentalite, "Disponibilité");
  assert.equal(FIXED_TRAIT_LABELS.discipline, "Discipline / Éthique de travail");
});

test("GENERIQUE porte les libellés historiques — rien ne change pour les sports non couverts", () => {
  const l = traitLabels(SET, { positionId: null });
  assert.equal(l.competitivite, "Compétitivité");
  assert.equal(l.esprit_equipe, "Esprit d'équipe");
  assert.equal(l.resilience, "Résilience");
  assert.equal(l.vision_du_jeu, "Vision du jeu");
  assert.equal(l.sens_tactique, "Sens tactique");
});

test("dégradation — référentiel injoignable : 14 libellés quand même", () => {
  const l = traitLabels(SET_HS, { positionId: "p-qb" });
  assert.equal(Object.keys(l).length, 14);
  assert.equal(l.competitivite, "Compétitivité");        // repli câblé
  assert.equal(l.attitude_mentalite, "Disponibilité");   // fixes intacts
  assert.equal(traitList(SET_HS, {}).length, 14);
});

test("écriture — grilleIdForSave fige la grille, GENERIQUE comprise", () => {
  assert.equal(grilleIdForSave(SET, "p-qb"), "g-qb");
  // GENERIQUE est écrite EXPLICITEMENT : c'est ce qui empêche une vieille éval
  // de changer de libellés si la position reçoit une grille plus tard.
  assert.equal(grilleIdForSave(SET, null), "g-gen");
});

test("écriture — référentiel injoignable : ne fige RIEN plutôt qu'une valeur devinée", () => {
  assert.equal(grilleIdForSave(SET_HS, "p-qb"), null);
});

test("pont camelCase — bijectif sur les 14", () => {
  assert.equal(Object.keys(COLUMN_TO_CAMEL).length, 14);
  for (const c of TRAIT_COLUMNS) assert.equal(CAMEL_TO_COLUMN[COLUMN_TO_CAMEL[c]], c);
});

test("les 9 fixes + les 5 fentes couvrent exactement les 14 colonnes", () => {
  const fixes = Object.keys(FIXED_TRAIT_LABELS);
  assert.equal(fixes.length, 9);
  assert.equal(new Set([...fixes, ...SET.slotColumns]).size, 14);
});
