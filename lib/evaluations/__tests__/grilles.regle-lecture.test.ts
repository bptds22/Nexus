/* Suite 3 — RÈGLE DE LECTURE : grille_id > position > GENERIQUE.
   Ce n'est pas un cas limite : 21 des 23 évaluations locales ont grille_id
   NULL, donc le repli par position est le chemin NORMAL. */

import test from "node:test";
import assert from "node:assert/strict";
import { traitGroups, resolveGrille, resolvePositionId,
         resolveGrilleByName } from "@/lib/evaluations/grilles";
import { SET, slotLabels } from "./fixtures.ts";

const QB_SLOTS = "Précision de passe / Lecture de défensive / Force de bras / Gestion de la pochette / Synchronisme";
const LO_SLOTS = "Protection de passe / Blocage de zone / Blocage individuel / Jeu de pieds / Technique de mains";
const GEN_SLOTS = "Compétitivité / Esprit d'équipe / Résilience / Vision du jeu / Sens tactique";

const slots = (ref: Parameters<typeof traitGroups>[1]) => slotLabels(traitGroups(SET, ref));

test("grille_id NON NULL prime sur la position", () => {
  // L'athlète est OL aujourd'hui, l'éval a été saisie en QB : c'est QB qui
  // s'affiche. C'est toute la raison d'être de grille_id.
  assert.equal(slots({ grilleId: "g-qb", positionId: "p-ol" }), QB_SLOTS);
});

test("grille_id NULL → repli par position (CHEMIN NORMAL)", () => {
  assert.equal(slots({ grilleId: null, positionId: "p-ol" }), LO_SLOTS);
});

test("ni grille_id ni position → GENERIQUE", () => {
  assert.equal(slots({ grilleId: null, positionId: null }), GEN_SLOTS);
  assert.equal(slots({}), GEN_SLOTS);
});

test("position non rattachée → GENERIQUE", () => {
  assert.equal(slots({ positionId: "p-inconnue" }), GEN_SLOTS);
});

test("grille_id fantôme → repli par position, jamais d'écran vide", () => {
  // Grille supprimée en base : on ne devine pas, on redescend.
  assert.equal(slots({ grilleId: "g-disparue", positionId: "p-qb" }), QB_SLOTS);
  assert.equal(slots({ grilleId: "g-disparue", positionId: null }), GEN_SLOTS);
  assert.equal(resolveGrille(SET, { grilleId: "g-disparue" })?.code, "GENERIQUE");
});

/* ── Chemin PARTENAIRE : la RPC ne projette ni grille_id ni position_id,
      seulement des NOMS. Le filtre sport n'est pas une précaution : 18
      abréviations sont partagées entre sports. ── */

test("partenaire — (sport, abréviation) résout", () => {
  assert.equal(resolvePositionId(SET, "Football", "QB"), "p-qb");
  assert.equal(resolvePositionId(SET, "Basketball", "PG"), "p-meneur");
});

test("partenaire — (sport, nom complet) résout aussi", () => {
  assert.equal(resolvePositionId(SET, "Football", "Quart-arrière"), "p-qb");
  assert.equal(resolvePositionId(SET, "Basketball", "Meneur"), "p-meneur");
});

test("partenaire — COLLISION : « C » et « Centre » dépendent du sport", () => {
  assert.equal(resolvePositionId(SET, "Football", "C"), "p-ol");
  assert.equal(resolvePositionId(SET, "Basketball", "C"), "p-bb-centre");
  assert.equal(resolvePositionId(SET, "Football", "Centre"), "p-ol");
  assert.equal(resolvePositionId(SET, "Basketball", "Centre"), "p-bb-centre");
});

test("partenaire — sans sport, on rend null : JAMAIS de devinette", () => {
  assert.equal(resolvePositionId(SET, null, "QB"), null);
  assert.equal(resolvePositionId(SET, undefined, "C"), null);
  assert.equal(resolvePositionId(SET, "Hockey", "QB"), null);   // sport inconnu
  assert.equal(resolvePositionId(SET, "Football", null), null);
});

test("partenaire — le raccourci par nom rend la bonne grille", () => {
  assert.equal(resolveGrilleByName(SET, "Football", "QB")?.code, "FB-QB");
  assert.equal(resolveGrilleByName(SET, "Basketball", "PG")?.code, "BB");
  // Sans sport : repli GENERIQUE, pas la grille d'un autre sport.
  assert.equal(resolveGrilleByName(SET, null, "QB")?.code, "GENERIQUE");
});
