import { test } from "node:test";
import assert from "node:assert/strict";
import { dossiersParUnite, type LignePipelineCegep } from "@/lib/cegep/dossiersUnite";

const FOOT = "s-foot", BASK = "s-bask";
const sports = new Map<string, string | null>([["r1", FOOT], ["r3", FOOT], ["r5", BASK], ["r2", null]]);
const ligne = (recruiter_id: string, athlete_id: string, stage: string, moved_at = "2026-09-01"): LignePipelineCegep =>
  ({ recruiter_id, athlete_id, stage, created_at: null, updated_at: null, moved_at });

test("deux lignes sœurs d'une unité = UN dossier, suivi par les deux", () => {
  const d = dossiersParUnite([ligne("r1", "A", "CONTACTE"), ligne("r3", "A", "CONTACTE")], sports);
  assert.equal(d.length, 1);
  assert.deepEqual(d[0].suivi_par, ["r1", "r3"]);
  assert.equal(d[0].sport_id, FOOT);
});

test("le même athlète dans deux unités (deux sports) = deux dossiers", () => {
  const d = dossiersParUnite([ligne("r1", "A", "CONTACTE"), ligne("r5", "A", "ENGAGE")], sports);
  assert.equal(d.length, 2);
  assert.deepEqual(d.map((x) => x.sport_id).sort(), [BASK, FOOT].sort());
});

test("l'étape du dossier est la plus avancée des lignes sœurs", () => {
  const d = dossiersParUnite([ligne("r1", "A", "CONTACTE"), ligne("r3", "A", "LETTRE_SIGNEE")], sports);
  assert.equal(d[0].stage, "LETTRE_SIGNEE");
  assert.deepEqual(d[0].suivi_par, ["r1", "r3"]);
});

test("à étape égale, la ligne la plus récemment déplacée", () => {
  const d = dossiersParUnite([ligne("r1", "A", "ENGAGE", "2026-09-01"), ligne("r3", "A", "ENGAGE", "2026-09-20")], sports);
  assert.equal(d[0].recruiter_id, "r3");
});

test("un recruteur sans sport forme son propre dossier", () => {
  const d = dossiersParUnite([ligne("r2", "A", "CONTACTE"), ligne("r1", "A", "CONTACTE")], sports);
  assert.equal(d.length, 2);
});
