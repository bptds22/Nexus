import { test } from "node:test";
import assert from "node:assert/strict";
import { trierTableau, triApresClic, triVersMode, MODE_VERS_TRI, valeurTri, type CarteTriable } from "@/lib/pipeline/triTableau";

const c = (o: Record<string, unknown>): CarteTriable => ({ moved_at: "2026-09-01T00:00:00Z", ...o }) as CarteTriable;
const noms = (l: { full_name?: string }[]) => l.map((x) => x.full_name);

test("croissant puis décroissant au second clic, et on alterne", () => {
  const t1 = triApresClic(null, "nom");
  assert.deepEqual(t1, { cle: "nom", sens: "asc" });
  const t2 = triApresClic(t1, "nom");
  assert.deepEqual(t2, { cle: "nom", sens: "desc" });
  assert.deepEqual(triApresClic(t2, "nom"), { cle: "nom", sens: "asc" });
  assert.deepEqual(triApresClic(t2, "poids"), { cle: "poids", sens: "asc" });
});

test("texte en français : accents et casse ignorés, numéros naturels", () => {
  const l = [c({ full_name: "Émile" }), c({ full_name: "zoé" }), c({ full_name: "Adam" })];
  assert.deepEqual(noms(trierTableau(l, { cle: "nom", sens: "asc" })), ["Adam", "Émile", "zoé"]);
  const d = [c({ full_name: "a", division_equipe: "D10" }), c({ full_name: "b", division_equipe: "D2" })];
  assert.deepEqual(noms(trierTableau(d, { cle: "division", sens: "asc" })), ["b", "a"]);
});

test("les cases vides vont à la fin dans LES DEUX sens", () => {
  const l = [c({ full_name: "sans", next_action_at: null }), c({ full_name: "tôt", next_action_at: "2026-10-01" }), c({ full_name: "tard", next_action_at: "2026-12-01" })];
  assert.deepEqual(noms(trierTableau(l, { cle: "relance", sens: "asc" })), ["tôt", "tard", "sans"]);
  assert.deepEqual(noms(trierTableau(l, { cle: "relance", sens: "desc" })), ["tard", "tôt", "sans"]);
});

test("taille en pouces, étape dans l'ordre du processus, grade du plus faible au meilleur", () => {
  const t = [c({ full_name: "6'0", taille_pieds: 6, taille_pouces: 0 }), c({ full_name: "5'11", taille_pieds: 5, taille_pouces: 11 })];
  assert.deepEqual(noms(trierTableau(t, { cle: "taille", sens: "asc" })), ["5'11", "6'0"]);
  const e = [c({ full_name: "engage", status: "engage" }), c({ full_name: "identifie", status: "identifie" })];
  assert.deepEqual(noms(trierTableau(e, { cle: "etape", sens: "asc" })), ["identifie", "engage"]);
  const g = [c({ full_name: "A+", grade: "A+" }), c({ full_name: "C", grade: "C" }), c({ full_name: "aucun", grade: null })];
  assert.deepEqual(noms(trierTableau(g, { cle: "grade", sens: "desc" })), ["A+", "C", "aucun"]);
});

test("ne mute pas le tableau d'origine", () => {
  const l = [c({ full_name: "b" }), c({ full_name: "a" })];
  trierTableau(l, { cle: "nom", sens: "asc" });
  assert.deepEqual(noms(l), ["b", "a"]);
});

test("synchronisation avec le menu : aller-retour exact pour les 5 modes", () => {
  for (const [mode, tri] of Object.entries(MODE_VERS_TRI)) assert.equal(triVersMode(tri!), mode);
  assert.equal(triVersMode({ cle: "nom", sens: "desc" }), null);
  assert.equal(triVersMode({ cle: "poids", sens: "asc" }), null);
  assert.equal(triVersMode(null), null);
});

test("un # non numérique est une case vide", () => {
  assert.equal(valeurTri("numero", { jersey: "" }), null);
  assert.equal(valeurTri("numero", { jersey: "12" }), 12);
});
