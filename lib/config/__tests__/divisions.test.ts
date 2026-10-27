/* Suite — lib/config/divisions.ts (ordre canonique des divisions, lot 7 civil).

   Lancement :
     node --experimental-strip-types \
       --import ./lib/evaluations/__tests__/register-alias.mjs \
       --test "lib/config/__tests__/divisions.test.ts"
*/

import test from "node:test";
import assert from "node:assert/strict";
import { comparerDivisions, divisionsTriees } from "@/lib/config/divisions";
import { DIVISION_OPTIONS, AGE_OPTIONS } from "@/lib/config/civilVocab";
import { comparerEquipes } from "@/lib/teams/teamLabel";

test("soccer : du provincial au local, plus l'alphabet", () => {
  assert.deepEqual(divisionsTriees(["Local A", "LDIR", "Régional AA", "PLSJQ", "LDP"]),
    ["PLSJQ", "LDP", "LDIR", "Régional AA", "Local A"]);
  assert.deepEqual(divisionsTriees(["Local A", "Ligue 3 QC", "Espoirs", "Ligue 1 QC", "LDIR", "Régional AA", "Ligue 2 QC"]),
    ["Ligue 1 QC", "Ligue 2 QC", "Ligue 3 QC", "Espoirs", "LDIR", "Régional AA", "Local A"]);
});

test("D1 = Division 1 ; casse et accents ignorés ; inconnues après, vides en dernier", () => {
  assert.equal(comparerDivisions("D1", "Division 1"), 0);
  assert.ok(comparerDivisions("D2", "Division 3") < 0);
  assert.equal(comparerDivisions("regional aa", "Régional AA"), 0);
  assert.deepEqual(divisionsTriees(["Zénith", "AAA", "", null, "Bronze", "AA"]), ["AAA", "AA", "Bronze", "Zénith"]);
  assert.ok(comparerDivisions("", "AAA") > 0);
});

test("comparerEquipes : à nom égal, la division se range par niveau", () => {
  const e = (division: string) => ({ name: "Lakeshore", age_group: "U15", division, gender: "Masculin" });
  assert.deepEqual([e("Local A"), e("PLSJQ"), e("LDIR")].sort(comparerEquipes).map((x) => x.division),
    ["PLSJQ", "LDIR", "Local A"]);
});

test("vocabulaire coach : toutes les divisions et catégories de l'import sont saisissables sans « Autre »", () => {
  const divs = new Set(DIVISION_OPTIONS.map((o) => o.value));
  for (const d of ["PLSJQ", "Ligue 1 QC", "Ligue 2 QC", "Ligue 3 QC", "Espoirs", "LDP", "LDIR", "Régional AA", "Local A",
                   "Élite", "Majeur", "AAA", "AA"]) assert.ok(divs.has(d), d);
  const ages = new Set(AGE_OPTIONS.map((o) => o.value));
  for (const a of ["U14", "U15", "U16", "U17", "U18", "U19", "U21", "Senior", "Benjamin", "Cadet", "Juvénile"]) assert.ok(ages.has(a), a);
  assert.equal(DIVISION_OPTIONS.at(-1)?.value, "Autre");
});
