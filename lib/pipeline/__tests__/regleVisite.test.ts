/* ═══════════════════════════════════════════════════════════════
   regleVisite — la règle visite ↔ étape (décision BP 2026-09-23).
   ═══════════════════════════════════════════════════════════════ */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  etapePorteVisite,
  etapeApresSaisieVisite,
  champVisitePourEtape,
  visiteApresChangementEtape,
} from "@/lib/pipeline/regleVisite";

const ISO = "2026-10-02T18:00:00.000Z";
const ANCIENNE = "2026-09-28T14:00:00.000Z";

test("etapePorteVisite : de Visite planifiée à Lettre signée, minuscules ou majuscules", () => {
  for (const e of ["visite_planifiee", "engage", "lettre_signee", "VISITE_PLANIFIEE", "ENGAGE", "LETTRE_SIGNEE"]) {
    assert.equal(etapePorteVisite(e), true, e);
  }
  for (const e of ["identifie", "contacte", "en_discussion", "retire", "none", "EN_DISCUSSION"]) {
    assert.equal(etapePorteVisite(e), false, e);
  }
});

test("saisir une visite fait AVANCER jusqu'à Visite planifiée, ne recule JAMAIS", () => {
  assert.equal(etapeApresSaisieVisite("identifie"), "visite_planifiee");
  assert.equal(etapeApresSaisieVisite("contacte"), "visite_planifiee");
  assert.equal(etapeApresSaisieVisite("en_discussion"), "visite_planifiee");
  assert.equal(etapeApresSaisieVisite("visite_planifiee"), "visite_planifiee");
  assert.equal(etapeApresSaisieVisite("engage"), "engage", "Engagé ne recule pas");
  assert.equal(etapeApresSaisieVisite("lettre_signee"), "lettre_signee", "Lettre signée ne recule pas");
});

test("la date n'est effacée que sous Visite planifiée", () => {
  assert.deepEqual(champVisitePourEtape("identifie"), { visit_at: null });
  assert.deepEqual(champVisitePourEtape("contacte"), { visit_at: null });
  assert.deepEqual(champVisitePourEtape("en_discussion"), { visit_at: null });
  // À partir de Visite planifiée, sans saisie : colonne NON touchée.
  assert.deepEqual(champVisitePourEtape("visite_planifiee"), {});
  assert.deepEqual(champVisitePourEtape("engage"), {});
  assert.deepEqual(champVisitePourEtape("lettre_signee"), {});
  // Avec saisie : la date saisie.
  assert.deepEqual(champVisitePourEtape("visite_planifiee", ISO), { visit_at: ISO });
});

test("état local : la date survit à Engagé, disparaît en redescendant", () => {
  assert.equal(visiteApresChangementEtape("engage", undefined, ANCIENNE), ANCIENNE);
  assert.equal(visiteApresChangementEtape("lettre_signee", null, ANCIENNE), ANCIENNE);
  assert.equal(visiteApresChangementEtape("visite_planifiee", ISO, ANCIENNE), ISO);
  assert.equal(visiteApresChangementEtape("visite_planifiee", undefined, ANCIENNE), ANCIENNE);
  assert.equal(visiteApresChangementEtape("contacte", undefined, ANCIENNE), null);
});
