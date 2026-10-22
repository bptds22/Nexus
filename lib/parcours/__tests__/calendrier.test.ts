/* Suite — lib/parcours/calendrier.ts.

   Lancement :
     node --experimental-strip-types \
       --import ./lib/evaluations/__tests__/register-alias.mjs \
       --test "lib/parcours/__tests__/*.test.ts"

   Les dates sont construites à MIDI heure locale : un minuit UTC tomberait la
   veille à Montréal et ferait mentir le test du 1er juillet. */

import test from "node:test";
import assert from "node:assert/strict";
import {
  CALENDRIERS, ETAPES, calendrierDuSport, phaseParDate, phaseCourante,
  choixPhase, libelleSaison, type Calendrier, type Phase,
} from "@/lib/parcours/calendrier";

const le = (a: number, m: number, j: number) => new Date(a, m - 1, j, 12);

const CAS: [string, Date, Record<Calendrier, Phase>][] = [
  ["1 juil", le(2026, 7, 1), { AUTOMNE: "entrainement", HIVER: "entrainement" }],
  ["31 juil", le(2026, 7, 31), { AUTOMNE: "entrainement", HIVER: "entrainement" }],
  ["15 août", le(2026, 8, 15), { AUTOMNE: "camps", HIVER: "entrainement" }],
  ["22 oct", le(2026, 10, 22), { AUTOMNE: "saison", HIVER: "camps" }],
  ["15 janv", le(2027, 1, 15), { AUTOMNE: "signature", HIVER: "saison" }],
  ["1 mai", le(2027, 5, 1), { AUTOMNE: "signature", HIVER: "signature" }],
  ["30 juin", le(2027, 6, 30), { AUTOMNE: "signature", HIVER: "signature" }],
];

for (const [nom, d, attendu] of CAS) {
  for (const cal of ["AUTOMNE", "HIVER"] as Calendrier[]) {
    test(`${cal} — ${nom} → ${attendu[cal]}`, () => {
      assert.equal(phaseParDate(cal, d), attendu[cal]);
    });
  }
}

test("chaque calendrier couvre les 12 mois, une seule fois", () => {
  for (const cal of Object.values(CALENDRIERS)) {
    const mois = ETAPES.flatMap((e) => cal[e.phase]).sort((a, b) => a - b);
    assert.deepEqual(mois, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  }
});

test("sport → calendrier, accents et casse ignorés ; inconnu → AUTOMNE", () => {
  assert.equal(calendrierDuSport("Football"), "AUTOMNE");
  assert.equal(calendrierDuSport("Flag football"), "AUTOMNE");
  assert.equal(calendrierDuSport("Soccer"), "AUTOMNE");
  assert.equal(calendrierDuSport("Basketball"), "HIVER");
  assert.equal(calendrierDuSport("VOLLEYBALL"), "HIVER");
  assert.equal(calendrierDuSport("Hockey"), "HIVER");
  assert.equal(calendrierDuSport("Futsal"), "HIVER");
  assert.equal(calendrierDuSport("Soccer intérieur"), "HIVER");
  assert.equal(calendrierDuSport("Athlétisme"), "AUTOMNE");
  assert.equal(calendrierDuSport(null), "AUTOMNE");
});

test("sans choix manuel : l'étape vient de la date (le défaut « entrainement » est mort)", () => {
  assert.equal(phaseCourante({}, "Football", le(2026, 10, 22)), "saison");
  assert.equal(phaseCourante(null, "Basketball", le(2026, 10, 22)), "camps");
});

test("choix manuel posé dans la saison courante : gardé", () => {
  const r = choixPhase("signature", le(2026, 9, 3));
  assert.deepEqual(r, { current_phase: "signature", phase_saison: "2026-2027" });
  assert.equal(phaseCourante(r, "Football", le(2026, 10, 22)), "signature");
  // Toujours la même saison en janvier : encore gardé.
  assert.equal(phaseCourante(r, "Football", le(2027, 1, 15)), "signature");
});

test("choix manuel de la saison précédente : ignoré", () => {
  const r = choixPhase("signature", le(2026, 5, 10)); // saison 2025-2026
  assert.equal(r.phase_saison, "2025-2026");
  assert.equal(phaseCourante(r, "Football", le(2026, 10, 22)), "saison");
  // Bascule du 1er juillet : la veille gardé, le jour même ignoré.
  assert.equal(phaseCourante(r, "Football", le(2026, 6, 30)), "signature");
  assert.equal(phaseCourante(r, "Football", le(2026, 7, 1)), "entrainement");
});

test("futsal / soccer intérieur suivent le calendrier HIVER", () => {
  assert.equal(phaseCourante({}, "Futsal", le(2026, 10, 22)), "camps");
  assert.equal(phaseCourante({}, "Soccer intérieur", le(2027, 1, 15)), "saison");
});

test("choix ancien (sans phase_saison) : gardé seulement s'il est égal ou plus avancé", () => {
  const oct = le(2026, 10, 22);
  // Plus avancé que le calcul (football oct = saison) : gardé.
  assert.equal(phaseCourante({ current_phase: "signature" }, "Football", oct), "signature");
  // En retard sur le calcul : remplacé.
  assert.equal(phaseCourante({ current_phase: "entrainement" }, "Football", oct), "saison");
  // Basket oct = camps ; « saison » est plus avancé : gardé.
  assert.equal(phaseCourante({ current_phase: "saison" }, "Basketball", oct), "saison");
  // Égal au calcul : gardé (même résultat).
  assert.equal(phaseCourante({ current_phase: "camps" }, "Basketball", oct), "camps");
});

test("phase inconnue dans le JSONB : ignorée", () => {
  assert.equal(
    phaseCourante({ current_phase: "n_importe", phase_saison: "2026-2027" }, "Hockey", le(2026, 10, 22)),
    "camps",
  );
});

test("libellé de saison : bascule le 1er juillet, juste en janvier", () => {
  assert.equal(libelleSaison(le(2026, 6, 30)), "Saison 2025-2026");
  assert.equal(libelleSaison(le(2026, 7, 1)), "Saison 2026-2027");
  assert.equal(libelleSaison(le(2026, 10, 22)), "Saison 2026-2027");
  assert.equal(libelleSaison(le(2027, 1, 15)), "Saison 2026-2027");
  assert.equal(libelleSaison(le(2027, 7, 1)), "Saison 2027-2028");
});
