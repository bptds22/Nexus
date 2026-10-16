/* Registre §94 — grades D+ et E côté mobile. La donnée passe par le tronc
   partagé (isGrade, gradeRank) ; reste la grille tactile du picker, qui doit
   garder des cibles de 44 px sur un écran de 390 px. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GRADES, isGrade, gradeRank } from "@/lib/config/grades";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

test("D+ et E traversent la frontière de données mobile (isGrade) et se trient après D", () => {
  for (const g of ["D+", "E"]) assert.equal(isGrade(g), true, g);
  assert.ok(gradeRank("D+") < gradeRank("D") && gradeRank("D") < gradeRank("E"));
});

test("les lectures de grade du mobile passent toutes par isGrade (aucune liste locale à 7)", () => {
  for (const f of ["lib/queries/recruiter/usePipelineCards.ts", "lib/queries/recruiter/useProcessusUnite.ts", "lib/cartes/carteProspect.ts"]) {
    const src = lire(f);
    assert.match(src, /isGrade\(/, f);
    assert.doesNotMatch(src, /\["A\+", "A", "B\+", "B", "C\+", "C", "D"\]/, f);
  }
  assert.doesNotMatch(lire("components/shared/RecruteurPipelineMobile.tsx"), /"A\+", "A", "B\+"/);
});

test("picker tactile : 5 colonnes (5 + 4), compact : 9", () => {
  const src = lire("components/shared/GradeChip.tsx");
  assert.match(src, /const grille = compact \? "grid-cols-9" : "grid-cols-5";/);
  assert.match(lire("components/shared/RecruteurPipelineMobile.tsx"), /<GradePicker[^>]*compact=\{false\}/);
});

test("arithmétique : 5 colonnes gardent ≥ 44 px sur 390 px, 9 non", () => {
  // Fiche mobile : 390 px - 2 × 16 px de marge - 2 × 16 px de padding de carte ; gap-1.5 = 6 px.
  const utile = 390 - 64;
  const largeur = (n: number) => (utile - (n - 1) * 6) / n;
  assert.ok(largeur(5) >= 44, `5 colonnes : ${largeur(5)} px`);
  assert.ok(largeur(9) < 44, `9 colonnes : ${largeur(9)} px`);
  assert.equal(Math.ceil(GRADES.length / 5), 2, "deux rangées");
});
