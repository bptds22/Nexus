/* ═══════════════════════════════════════════════════════════════
   Écran mural — fenêtres et semaines en heure de Montréal, alors que
   le serveur tourne en UTC. Les cas qui comptent : minuit à Montréal
   n'est pas minuit UTC, et les changements d'heure (2 nov. 2026, 8 mars
   2026) ne décalent ni les fenêtres ni les semaines.
   ═══════════════════════════════════════════════════════════════ */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compterDans,
  debutsSemaines,
  fenetres7Jours,
  joursAvant,
  lundiMontreal,
  montrealVersInstant,
  parSemaine,
  partiesMontreal,
  rangSemaine,
} from "@/lib/admin/ecranMural";

test("minuit à Montréal : 04:00 UTC en été, 05:00 UTC en hiver", () => {
  assert.equal(montrealVersInstant(2026, 10, 22).toISOString(), "2026-10-22T04:00:00.000Z");
  assert.equal(montrealVersInstant(2026, 12, 1).toISOString(), "2026-12-01T05:00:00.000Z");
});

test("heure murale lue en UTC, jour de semaine lundi = 0", () => {
  // Jeudi 22 oct. 2026, 02:30 UTC = mercredi 21 oct., 22:30 à Montréal.
  const p = partiesMontreal(new Date("2026-10-22T02:30:00Z"));
  assert.deepEqual([p.annee, p.mois, p.jour, p.heure, p.minute, p.jourSemaine], [2026, 10, 21, 22, 30, 2]);
});

test("le lundi de la semaine se prend à Montréal, pas en UTC", () => {
  // Lundi 26 oct. 2026, 02:00 UTC = dimanche 25 oct., 22:00 à Montréal → semaine du 19.
  assert.equal(lundiMontreal(new Date("2026-10-26T02:00:00Z")).toISOString(), "2026-10-19T04:00:00.000Z");
  // Lundi 26 oct., 04:00 UTC = minuit pile à Montréal → semaine du 26.
  assert.equal(lundiMontreal(new Date("2026-10-26T04:00:00Z")).toISOString(), "2026-10-26T04:00:00.000Z");
});

test("12 semaines du lundi, la dernière est la semaine en cours, changement d'heure compris", () => {
  // Mardi 10 nov. 2026 (après le passage à l'heure normale du 1er nov.).
  const d = debutsSemaines(new Date("2026-11-10T15:00:00Z"), 12);
  assert.equal(d.length, 12);
  assert.equal(d[11].toISOString(), "2026-11-09T05:00:00.000Z"); // lundi 9 nov., heure normale
  assert.equal(d[10].toISOString(), "2026-11-02T05:00:00.000Z");
  assert.equal(d[9].toISOString(), "2026-10-26T04:00:00.000Z"); // encore à l'heure d'été
  for (const x of d) assert.equal(partiesMontreal(x).jourSemaine, 0);
  for (const x of d) assert.equal(partiesMontreal(x).heure, 0);
});

test("7 jours = même heure murale, même à travers le changement d'heure", () => {
  // Jeudi 5 nov. 2026, 12:00 Montréal (heure normale, UTC−5).
  const maintenant = new Date("2026-11-05T17:00:00Z");
  const f = fenetres7Jours(maintenant);
  // 29 oct., 12:00 Montréal (heure d'été, UTC−4) = 16:00 UTC : 7 jours et 1 heure.
  assert.equal(f.courant.de.toISOString(), "2026-10-29T16:00:00.000Z");
  assert.equal(f.precedent.de.toISOString(), "2026-10-22T16:00:00.000Z");
  assert.equal(f.precedent.a.getTime(), f.courant.de.getTime());
  assert.equal(f.courant.a.getTime(), maintenant.getTime());
  assert.equal(joursAvant(maintenant, 0).getTime(), maintenant.getTime());
});

test("7 jours : les millisecondes sont gardées (bornes exactes, comme now() - interval '7 days')", () => {
  const maintenant = new Date("2026-10-22T19:12:21.831Z");
  assert.equal(fenetres7Jours(maintenant).courant.de.toISOString(), "2026-10-15T19:12:21.831Z");
});

test("compterDans : borne de début incluse, de fin exclue, valeurs vides ignorées", () => {
  const f = { de: new Date("2026-10-15T00:00:00Z"), a: new Date("2026-10-22T00:00:00Z") };
  assert.equal(compterDans([
    "2026-10-15T00:00:00Z", // inclus
    "2026-10-21T23:59:59Z", // inclus
    "2026-10-22T00:00:00Z", // exclu
    "2026-10-14T23:59:59Z", // exclu
    null, undefined, "", "pas une date",
  ], f), 2);
});

test("parSemaine et rangSemaine : chaque date tombe dans sa semaine de Montréal", () => {
  const maintenant = new Date("2026-10-22T16:00:00Z");
  const debuts = debutsSemaines(maintenant, 3); // 5 oct., 12 oct., 19 oct.
  const comptes = parSemaine([
    "2026-10-19T03:59:59Z", // dimanche 18 oct., 23:59 à Montréal → semaine du 12
    "2026-10-19T04:00:00Z", // lundi 19 oct., 00:00 → semaine du 19
    "2026-10-05T04:00:00Z", // première seconde de la 1re semaine
    "2026-10-05T03:59:59Z", // avant : ignorée
    "2026-10-22T16:00:00Z", // = maintenant : exclue (fin exclue)
  ], debuts, maintenant);
  assert.deepEqual(comptes, [1, 1, 1]);
  assert.equal(rangSemaine(new Date("2030-01-01T00:00:00Z"), debuts, maintenant), -1);
});
