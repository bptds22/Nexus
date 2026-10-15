/* Suite — lib/onboarding/civilSansEquipe.ts (directeur de club civil sans équipe).

   Lancement :
     node --experimental-strip-types \
       --import ./lib/evaluations/__tests__/register-alias.mjs \
       --test "lib/onboarding/__tests__/civilSansEquipe.test.ts"
*/

import test from "node:test";
import assert from "node:assert/strict";
import { equipeCivileOk, estResponsableDeclare, MSG_EQUIPE_REQUISE, MSG_SANS_EQUIPE_RESPONSABLE } from "@/lib/onboarding/civilSansEquipe";

test("responsable civil sans équipe (« C'est moi » ou intérimaire) : peut terminer", () => {
  for (const choix of ["owner", "interim"]) {
    const e = { aUneEquipe: false, sansEquipe: true, choixResponsable: choix };
    assert.deepEqual(equipeCivileOk(e, false), { ok: true, error: "" });
    assert.deepEqual(equipeCivileOk(e, true), { ok: true, error: "" });
  }
});

test("« Je ne coache aucune équipe » passe l'étape des équipes, puis exige le responsable", () => {
  const avantChoix = { aUneEquipe: false, sansEquipe: true, choixResponsable: undefined };
  assert.equal(equipeCivileOk(avantChoix, false).ok, true);
  assert.deepEqual(equipeCivileOk(avantChoix, true), { ok: false, error: MSG_SANS_EQUIPE_RESPONSABLE });
});

test("simple coach sans équipe : bloqué, à toutes les étapes", () => {
  // N'a pas choisi « Je ne coache aucune équipe » : l'équipe reste obligatoire.
  for (const choix of [undefined, null, "coach_only", "owner", "interim"]) {
    const e = { aUneEquipe: false, sansEquipe: false, choixResponsable: choix };
    assert.deepEqual(equipeCivileOk(e, false), { ok: false, error: MSG_EQUIPE_REQUISE });
    assert.deepEqual(equipeCivileOk(e, true), { ok: false, error: MSG_EQUIPE_REQUISE });
  }
  // A choisi « sans équipe » mais se déclare simple coach, ou invite quelqu'un d'autre : bloqué à la fin.
  for (const e of [
    { aUneEquipe: false, sansEquipe: true, choixResponsable: "coach_only" },
    { aUneEquipe: false, sansEquipe: true, choixResponsable: null },
    { aUneEquipe: false, sansEquipe: true, choixResponsable: "owner", inviteEnCours: true },
  ]) {
    assert.deepEqual(equipeCivileOk(e, true), { ok: false, error: MSG_SANS_EQUIPE_RESPONSABLE });
  }
});

test("avec une équipe : inchangé, quel que soit le choix du responsable", () => {
  for (const choix of [undefined, "coach_only", "owner", "interim"]) {
    assert.equal(equipeCivileOk({ aUneEquipe: true, sansEquipe: false, choixResponsable: choix }, true).ok, true);
    // Un « sans équipe » resté coché ne gêne pas une fois une équipe choisie.
    assert.equal(equipeCivileOk({ aUneEquipe: true, sansEquipe: true, choixResponsable: choix }, true).ok, true);
  }
});

test("estResponsableDeclare", () => {
  assert.equal(estResponsableDeclare({ choixResponsable: "owner" }), true);
  assert.equal(estResponsableDeclare({ choixResponsable: "interim" }), true);
  assert.equal(estResponsableDeclare({ choixResponsable: "owner", inviteEnCours: true }), false);
  assert.equal(estResponsableDeclare({ choixResponsable: "coach" }), false);
  assert.equal(estResponsableDeclare({ choixResponsable: undefined }), false);
});
