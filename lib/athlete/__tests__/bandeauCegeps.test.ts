/* Suite — lib/athlete/bandeauCegeps.ts (lot C1 cégep, point 5).

   Lancement :
     node --experimental-strip-types \
       --import ./lib/evaluations/__tests__/register-alias.mjs \
       --test "lib/athlete/__tests__/bandeauCegeps.test.ts"
*/

import test from "node:test";
import assert from "node:assert/strict";
import { doitVoirBandeauCegeps, type EtatBandeauCegeps } from "@/lib/athlete/bandeauCegeps";

const base: EtatBandeauCegeps = { lancementCollegial: true, typeEcole: null, dansEquipeDeCegep: false, ecoleNonListee: null };

test("OFF : jamais de bandeau, quel que soit l'athlète", () => {
  assert.equal(doitVoirBandeauCegeps({ ...base, lancementCollegial: false, typeEcole: "CEGEP" }), false);
  assert.equal(doitVoirBandeauCegeps({ ...base, lancementCollegial: false, ecoleNonListee: "Cégep Garneau" }), false);
});

test("ON : ancré à un cégep sans équipe de cégep → bandeau ; avec une équipe de cégep → rien", () => {
  assert.equal(doitVoirBandeauCegeps({ ...base, typeEcole: "CEGEP" }), true);
  assert.equal(doitVoirBandeauCegeps({ ...base, typeEcole: "CEGEP", dansEquipeDeCegep: true }), false);
});

test("ON : un cégep tapé à la main → bandeau ; une école secondaire tapée → rien", () => {
  assert.equal(doitVoirBandeauCegeps({ ...base, ecoleNonListee: "Cégep de Jonquière" }), true);
  assert.equal(doitVoirBandeauCegeps({ ...base, ecoleNonListee: "Polyvalente des Abords" }), false);
  assert.equal(doitVoirBandeauCegeps({ ...base, ecoleNonListee: " " }), false);
});

test("ON : athlète du secondaire ordinaire → rien", () => {
  assert.equal(doitVoirBandeauCegeps({ ...base, typeEcole: "SECONDAIRE" }), false);
  assert.equal(doitVoirBandeauCegeps({ ...base, typeEcole: "LIGUE_CIVILE" }), false);
});
