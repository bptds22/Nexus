/* D5 Q6 — le programme universitaire visé remplace le programme CÉGEP visé pour le cégépien sous ON
   (jumeau de calculate_profile_completion(), migration 20261029160000). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateCompletion } from "@/lib/utils/profileCompletion";

const cles = (r: ReturnType<typeof calculateCompletion>) => r.checks.map((c) => c.key);

test("athlète du secondaire : le programme CÉGEP visé compte, comme avant", () => {
  const r = calculateCompletion({ programmes_vises: ["x"] }, null, null);
  assert.ok(cles(r).includes("programme_cegep"));
  assert.ok(!cles(r).includes("programme_universitaire"));
  assert.equal(r.checks.find((c) => c.key === "programme_cegep")?.filled, true);
});

test("cégépien sous ON : le programme universitaire visé prend la place (même poids)", () => {
  const sans = calculateCompletion({ parcours_universitaire: true, programmes_vises: ["x"] }, null, null);
  const avec = calculateCompletion({ parcours_universitaire: true, programme_universitaire_vise: "Médecine — Université Laval" }, null, null);
  assert.ok(!cles(sans).includes("programme_cegep"));
  assert.equal(sans.checks.find((c) => c.key === "programme_universitaire")?.filled, false);
  assert.equal(avec.checks.find((c) => c.key === "programme_universitaire")?.filled, true);
  assert.equal(avec.percentage - sans.percentage, 3);
  assert.equal(sans.checks.reduce((s, c) => s + c.weight, 0), 100);
});

test("cégépien sous ON : un libellé vide ne compte pas", () => {
  const r = calculateCompletion({ parcours_universitaire: true, programme_universitaire_vise: "   " }, null, null);
  assert.equal(r.checks.find((c) => c.key === "programme_universitaire")?.filled, false);
});
