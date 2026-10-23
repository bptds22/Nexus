/* Suite — optionsAnneeSec5() de lib/config/gradYears.ts (onboarding athlète).

   Lancement :
     node --experimental-strip-types \
       --import ./lib/evaluations/__tests__/register-alias.mjs \
       --test lib/config/__tests__/gradYearsSec5.test.ts */

import test from "node:test";
import assert from "node:assert/strict";
import { optionsAnneeSec5 } from "@/lib/config/gradYears";

const le = (a: number, m: number, j: number) => new Date(a, m - 1, j, 12);
const valeurs = (d: Date, garder?: string | null) => optionsAnneeSec5(d, garder).map((o) => o.value);

test("octobre 2026 : 2027 (Sec 5) → 2031 (Sec 1), jamais l'année civile", () => {
  assert.deepEqual(valeurs(le(2026, 10, 22)), ["2027", "2028", "2029", "2030", "2031"]);
});

test("bascule au 1er juillet, pas au 1er janvier ni au 1er août", () => {
  assert.deepEqual(valeurs(le(2027, 1, 15))[0], "2027");
  assert.deepEqual(valeurs(le(2027, 6, 30))[0], "2027");
  assert.deepEqual(valeurs(le(2027, 7, 1)), ["2028", "2029", "2030", "2031", "2032"]);
});

test("une année déjà enregistrée hors fenêtre reste offerte, une seule fois", () => {
  assert.deepEqual(valeurs(le(2026, 10, 22), "2026"), ["2026", "2027", "2028", "2029", "2030", "2031"]);
  assert.deepEqual(valeurs(le(2026, 10, 22), "2028"), ["2027", "2028", "2029", "2030", "2031"]);
  assert.deepEqual(valeurs(le(2026, 10, 22), ""), ["2027", "2028", "2029", "2030", "2031"]);
});
