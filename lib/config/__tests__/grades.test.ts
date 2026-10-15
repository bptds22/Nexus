/* ═══════════════════════════════════════════════════════════════
   Le contrat web ↔ base du grade recruteur, vérifié mécaniquement.

   grades.ts le dit : GRADES et les deux CHECK SQL sont LE MÊME ENSEMBLE,
   et tsc comme ESLint sont aveugles à un écart. Un picker qui propose une
   valeur que la base refuse ne casse qu'au geste de l'utilisateur. Ce test
   relit la dernière migration qui pose les CHECK et compare les listes.
   ═══════════════════════════════════════════════════════════════ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GRADES, GRADE_RANK, UNGRADED_RANK, gradeRank, isGrade } from "@/lib/config/grades";

const MIGRATION = join(process.cwd(), "supabase/migrations/20261015130353_grades_d_plus_e.sql");

test("grades — 9 valeurs, du meilleur au moins bon", () => {
  assert.deepEqual([...GRADES], ["A+", "A", "B+", "B", "C+", "C", "D+", "D", "E"]);
  assert.equal(GRADE_RANK["A+"], 0);
  assert.equal(GRADE_RANK["D+"], 6);
  assert.equal(GRADE_RANK["E"], 8);
  assert.equal(UNGRADED_RANK, 9);
  assert.ok(gradeRank("E") < gradeRank(null), "un non-gradé se range après E");
});

test("grades — isGrade accepte D+ et E, refuse le reste", () => {
  for (const g of ["D+", "E"]) assert.ok(isGrade(g), g);
  for (const g of ["D-", "F", "E+", "e", "", null, 3]) assert.ok(!isGrade(g), String(g));
});

test("grades — les deux CHECK de la migration portent exactement GRADES, dans le même ordre", () => {
  const sql = readFileSync(MIGRATION, "utf8");
  const listes = [...sql.matchAll(/add constraint (\w+)\s+check \([^;]*?grade in \(([^)]*)\)/g)];
  assert.equal(listes.length, 2, "deux CHECK attendus");
  for (const [, nom, liste] of listes) {
    const valeurs = [...liste.matchAll(/'([^']*)'/g)].map((m) => m[1]);
    assert.deepEqual(valeurs, [...GRADES], nom);
  }
});
