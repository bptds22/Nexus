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
  choixPhase, libelleSaison, niveauScolaire, signatureVerrouillee, etapesPourNiveau,
  type Calendrier, type Phase,
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

test("choix ancien : traité comme posé en 2026-2027, ignoré dès le 1er juillet 2027", () => {
  const ancienSignature = { current_phase: "signature" };
  assert.equal(phaseCourante(ancienSignature, "Football", le(2027, 6, 15)), "signature");
  assert.equal(phaseCourante(ancienSignature, "Football", le(2027, 7, 1)), "entrainement");
  assert.equal(phaseCourante({ current_phase: "saison" }, "Basketball", le(2027, 7, 1)), "entrainement");
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

/* ── Niveau scolaire ─────────────────────────────────────────────────────── */

const OCT_2026 = le(2026, 10, 22);

test("niveau en octobre 2026 : 2027 → Sec 5 … 2031 → Sec 1", () => {
  const attendu: [number, number][] = [[2027, 5], [2028, 4], [2029, 3], [2030, 2], [2031, 1]];
  for (const [annee, sec] of attendu) {
    assert.deepEqual(niveauScolaire(annee, OCT_2026), { type: "sec", sec, saisonSec5: `${annee - 1}-${annee}` });
  }
  // La colonne peut arriver en texte : même résultat.
  assert.deepEqual(niveauScolaire("2028", OCT_2026), { type: "sec", sec: 4, saisonSec5: "2027-2028" });
});

test("bascule au 1er juillet 2027 : 2028 devient Sec 5, 2027 diplômé", () => {
  assert.deepEqual(niveauScolaire(2028, le(2027, 6, 30)), { type: "sec", sec: 4, saisonSec5: "2027-2028" });
  assert.deepEqual(niveauScolaire(2028, le(2027, 7, 1)), { type: "sec", sec: 5, saisonSec5: "2027-2028" });
  assert.deepEqual(niveauScolaire(2027, le(2027, 7, 1)), { type: "diplome", annee: 2027 });
});

test("diplômé : « Saison » sans Sec, mention, signature active", () => {
  const n = niveauScolaire(2026, OCT_2026);
  assert.deepEqual(n, { type: "diplome", annee: 2026 });
  const [, , saison, signature] = etapesPourNiveau(n);
  assert.equal(saison.label, "Saison");
  assert.equal(saison.note, "Diplômé 2026");
  assert.equal(signature.verrouillee, false);
  assert.equal(phaseCourante({}, "Football", le(2027, 1, 15), n), "signature");
});

test("année vide ou hors 1-5 (2036) : inconnu, « Saison » sans niveau, aucune restriction", () => {
  for (const v of [null, undefined, "", 2036]) {
    const n = niveauScolaire(v as number | null | undefined, OCT_2026);
    assert.deepEqual(n, { type: "inconnu" });
    const [, , saison, signature] = etapesPourNiveau(n);
    assert.equal(saison.label, "Saison");
    assert.equal(saison.note, undefined);
    assert.equal(signature.verrouillee, false);
  }
});

test("Sec 5 : « Saison Sec 5 », signature active", () => {
  const n = niveauScolaire(2027, OCT_2026);
  const [, , saison, signature] = etapesPourNiveau(n);
  assert.equal(saison.label, "Saison Sec 5");
  assert.equal(signature.verrouillee, false);
  assert.equal(signatureVerrouillee(n), false);
  assert.equal(phaseCourante({}, "Football", le(2027, 1, 15), n), "signature");
});

test("Sec 4 : signature grisée « en Sec 5 (2027-2028) »", () => {
  const n = niveauScolaire(2028, OCT_2026);
  const etapes = etapesPourNiveau(n);
  assert.equal(etapes[2].label, "Saison Sec 4");
  assert.equal(etapes[3].verrouillee, true);
  assert.equal(etapes[3].note, "en Sec 5 (2027-2028)");
  assert.equal(etapes[3].label, "Fenêtre de signature");
  // Les autres étapes ne sont pas touchées.
  assert.deepEqual(etapes.slice(0, 2).map((e) => [e.label, e.verrouillee]),
    [["Entraînement d'été", false], ["Camps & essais", false]]);
});

test("Sec 4 : l'étape calculée s'arrête à « saison »", () => {
  const n = niveauScolaire(2028, OCT_2026);
  // Football en janvier = signature par le calendrier → plafonné.
  assert.equal(phaseCourante({}, "Football", le(2027, 1, 15), n), "saison");
  // Hors signature, rien ne change.
  assert.equal(phaseCourante({}, "Football", OCT_2026, n), "saison");
  assert.equal(phaseCourante({}, "Basketball", OCT_2026, n), "camps");
});

test("Sec 4 : un choix manuel « signature » est ramené à « saison »", () => {
  const n = niveauScolaire(2028, OCT_2026);
  assert.equal(phaseCourante(choixPhase("signature", OCT_2026), "Football", OCT_2026, n), "saison");
  assert.equal(phaseCourante({ current_phase: "signature" }, "Football", OCT_2026, n), "saison");
});

test("diplômé rattaché à une école secondaire : traité comme Sec 5", () => {
  const n = niveauScolaire(2026, OCT_2026, "SECONDAIRE");
  assert.deepEqual(n, { type: "sec", sec: 5, saisonSec5: "2026-2027" });
  const [, , saison, signature] = etapesPourNiveau(n);
  assert.equal(saison.label, "Saison Sec 5");
  assert.equal(saison.note, undefined);
  assert.equal(signature.verrouillee, false);
  assert.equal(phaseCourante({}, "Football", le(2027, 1, 15), n), "signature");
});

test("diplômé en ligue civile ou sans organisation : « Diplômé AAAA »", () => {
  for (const type of ["LIGUE_CIVILE", null, undefined]) {
    const n = niveauScolaire(2026, OCT_2026, type);
    assert.deepEqual(n, { type: "diplome", annee: 2026 });
    assert.equal(etapesPourNiveau(n)[2].note, "Diplômé 2026");
  }
});

test("l'organisation ne change rien hors diplômés", () => {
  assert.deepEqual(niveauScolaire(2028, OCT_2026, "SECONDAIRE"), { type: "sec", sec: 4, saisonSec5: "2027-2028" });
  assert.deepEqual(niveauScolaire(null, OCT_2026, "SECONDAIRE"), { type: "inconnu" });
  assert.deepEqual(niveauScolaire(2036, OCT_2026, "SECONDAIRE"), { type: "inconnu" });
});

test("lot C1 — cégépien : jamais « Sec N », l'année est celle de la fin du cégep, signature ouverte", async () => {
  const { niveauScolaire, etapesPourNiveau } = await import("@/lib/parcours/calendrier");
  const oct = new Date(2026, 9, 27, 12);
  const niveau = niveauScolaire(2029, oct, "CEGEP");
  assert.deepEqual(niveau, { type: "cegep", annee: 2029 });
  const saison = etapesPourNiveau(niveau).find((e) => e.phase === "saison")!;
  assert.equal(saison.label, "Saison");
  assert.equal(saison.note, "Cégep 2029");
  assert.equal(etapesPourNiveau(niveau).some((e) => e.verrouillee), false);
  // Le même 2029 au secondaire reste un Sec 3.
  assert.deepEqual(niveauScolaire(2029, oct, "SECONDAIRE"), { type: "sec", sec: 3, saisonSec5: "2028-2029" });
});
