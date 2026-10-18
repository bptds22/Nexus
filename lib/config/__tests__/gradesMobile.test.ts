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

test("picker : UNE seule rangée défilante, centrée sur le grade choisi (1.4.5)", () => {
  const src = lire("components/shared/GradeChip.tsx");
  assert.match(src, /flex flex-nowrap gap-1\.5 overflow-x-auto/);
  assert.doesNotMatch(src, /grid-cols-/);
  assert.match(src, /querySelector<HTMLElement>\('\[aria-pressed="true"\]'\)/);
  assert.match(lire("components/shared/RecruteurPipelineMobile.tsx"), /<GradePicker[^>]*compact=\{false\}/);
});

test("arithmétique : 9 cibles tactiles de 44 px tiennent sur une rangée qui défile", () => {
  // Fiche mobile : 390 px - 2 × 16 px de marge - 2 × 16 px de padding de carte ; gap-1.5 = 6 px.
  const utile = 390 - 64;
  const requis = GRADES.length * 44 + (GRADES.length - 1) * 6;
  assert.ok(requis > utile, `${requis} px > ${utile} px : la rangée défile au lieu de s'écraser`);
});
