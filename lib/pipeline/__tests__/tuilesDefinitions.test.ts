/* ═══════════════════════════════════════════════════════════════
   Tuiles du tableau de bord recruteur ↔ filtres de Mon processus.
   Une tuile compte avec le MÊME prédicat que la chip qu'elle active :
   ces tests figent les deux définitions et la lecture de `?filtre=`.
   ═══════════════════════════════════════════════════════════════ */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  estRelanceAFaire,
  estVisiteAVenir,
  filterPipelineCards,
  quickDepuisFiltreUrl,
  FILTRE_PIPELINE_URL,
  EMPTY_FILTERS,
} from "@/lib/pipeline/filterPipelineCards";

const jour = (decalage: number) => {
  const d = new Date();
  d.setDate(d.getDate() + decalage);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
/** Midi local du jour donné — loin de minuit, pas de piège de fuseau. */
const midi = (decalage: number) => {
  const d = new Date();
  d.setDate(d.getDate() + decalage);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
};

test("relances à faire : aujourd'hui et en retard, pas demain, pas sans date", () => {
  assert.equal(estRelanceAFaire({ next_action_at: jour(0) }), true);
  assert.equal(estRelanceAFaire({ next_action_at: jour(-3) }), true);
  assert.equal(estRelanceAFaire({ next_action_at: jour(1) }), false);
  assert.equal(estRelanceAFaire({ next_action_at: null }), false);
});

test("visites à venir : étape VISITE_PLANIFIEE ET date aujourd'hui ou plus tard", () => {
  assert.equal(estVisiteAVenir({ status: "visite_planifiee", visit_at: midi(0) }), true);
  assert.equal(estVisiteAVenir({ status: "visite_planifiee", visit_at: midi(5) }), true);
  assert.equal(estVisiteAVenir({ status: "visite_planifiee", visit_at: midi(-1) }), false, "passée");
  assert.equal(estVisiteAVenir({ status: "visite_planifiee", visit_at: null }), false, "sans date");
  assert.equal(estVisiteAVenir({ status: "en_discussion", visit_at: midi(2) }), false, "autre étape");
  assert.equal(estVisiteAVenir({ status: "visite_planifiee", visit_at: "pas une date" }), false);
});

test("?filtre= → chip active à l'arrivée", () => {
  assert.deepEqual(quickDepuisFiltreUrl(FILTRE_PIPELINE_URL.relances), ["relance"]);
  assert.deepEqual(quickDepuisFiltreUrl(FILTRE_PIPELINE_URL.visites), ["visite"]);
  assert.deepEqual(quickDepuisFiltreUrl(null), []);
  assert.deepEqual(quickDepuisFiltreUrl("inconnu"), []);
});

test("le compte d'une tuile = les cartes que la chip laisse passer", () => {
  const cartes = [
    { id: "a", status: "visite_planifiee", visit_at: midi(2), next_action_at: jour(-1) },
    { id: "b", status: "visite_planifiee", visit_at: midi(-2), next_action_at: null },
    { id: "c", status: "contacte", visit_at: null, next_action_at: jour(0) },
    { id: "d", status: "identifie", visit_at: null, next_action_at: jour(4) },
  ];
  for (const [chip, predicat] of [["visite", estVisiteAVenir], ["relance", estRelanceAFaire]] as const) {
    const parChip = filterPipelineCards(cartes, EMPTY_FILTERS, { quick: [chip] }).map((c) => c.id);
    const parTuile = cartes.filter(predicat).map((c) => c.id);
    assert.deepEqual(parChip, parTuile, chip);
  }
});
