/* ═══════════════════════════════════════════════════════════════
   QG admin — périodes « à date vs même moment » en heure de Montréal,
   alors que le serveur tourne en UTC. Les bornes qui comptent :
   - fin de l'heure d'été le 1er nov. 2026 (journée de 25 h) ;
   - début de l'heure d'été le 14 mars 2027 (journée de 23 h, 2 h 30 n'existe pas) ;
   - lundi 0 h pile, le 1er du mois, janvier → décembre ;
   - le 31 sans 31 le mois d'avant, et février 2028 (29 jours).
   ═══════════════════════════════════════════════════════════════ */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  debutJourMontreal,
  debutMoisMontreal,
  debutsPeriodes,
  fenetresADate,
  libellePeriode,
  parPeriode,
  type Fenetre,
} from "@/lib/admin/ecranMural";

const iso = (f: Fenetre) => [f.de.toISOString(), f.a.toISOString()];

test("0 h du jour et du mois se prennent à Montréal", () => {
  // 1er nov. 2026, 15:00 UTC = 10:00 HNE ; minuit était encore à l'heure d'été.
  assert.equal(debutJourMontreal(new Date("2026-11-01T15:00:00Z")).toISOString(), "2026-11-01T04:00:00.000Z");
  // 2 nov. 2026, 03:30 UTC = 1er nov., 22:30 à Montréal : toujours le 1er.
  assert.equal(debutJourMontreal(new Date("2026-11-02T03:30:00Z")).toISOString(), "2026-11-01T04:00:00.000Z");
  assert.equal(debutMoisMontreal(new Date("2026-12-01T03:00:00Z")).toISOString(), "2026-11-01T04:00:00.000Z");
  assert.equal(debutMoisMontreal(new Date("2026-12-01T05:00:00Z")).toISOString(), "2026-12-01T05:00:00.000Z");
});

test("jour : fin de l'heure d'été (1er nov. 2026, 25 h) — même heure murale hier", () => {
  // Maintenant : 1er nov., 22:30 HNE (UTC−5).
  const f = fenetresADate(new Date("2026-11-02T03:30:00Z"), "jour");
  assert.deepEqual(iso(f.courant), ["2026-11-01T04:00:00.000Z", "2026-11-02T03:30:00.000Z"]);
  // Hier : 31 oct. 0 h → 22:30, encore à l'heure d'été (UTC−4).
  assert.deepEqual(iso(f.precedent), ["2026-10-31T04:00:00.000Z", "2026-11-01T02:30:00.000Z"]);
});

test("jour : l'heure en double du 1er nov. (1 h 30 deux fois) reste dans le même jour", () => {
  const debuts = debutsPeriodes(new Date("2026-11-02T15:00:00Z"), "jour", 3);
  assert.deepEqual(debuts.map((d) => d.toISOString()),
    ["2026-10-31T04:00:00.000Z", "2026-11-01T04:00:00.000Z", "2026-11-02T05:00:00.000Z"]);
  const n = parPeriode(
    ["2026-11-01T05:30:00Z", "2026-11-01T06:30:00Z", "2026-11-02T04:30:00Z", "2026-11-02T05:00:00Z"],
    debuts, new Date("2026-11-02T15:00:00Z"));
  // 1 h 30 HAE, 1 h 30 HNE et 23 h 30 HNE : le 1er ; minuit pile : le 2.
  assert.deepEqual(n, [0, 3, 1]);
});

test("jour : début de l'heure d'été (14 mars 2027, 23 h)", () => {
  // Maintenant : 14 mars, 12:00 HAE (UTC−4).
  const f = fenetresADate(new Date("2027-03-14T16:00:00Z"), "jour");
  assert.deepEqual(iso(f.courant), ["2027-03-14T05:00:00.000Z", "2027-03-14T16:00:00.000Z"]);
  assert.deepEqual(iso(f.precedent), ["2027-03-13T05:00:00.000Z", "2027-03-13T17:00:00.000Z"]);
});

test("jour : hier, 2 h 30 n'existait pas (14 mars 2027) — on s'arrête au saut, 3 h 00 HAE", () => {
  // Maintenant : 15 mars, 02:30 HAE. Hier avant 2 h 30 à l'horloge = jusqu'au saut (07:00 UTC).
  const f = fenetresADate(new Date("2027-03-15T06:30:00Z"), "jour");
  assert.deepEqual(iso(f.precedent), ["2027-03-14T05:00:00.000Z", "2027-03-14T07:00:00.000Z"]);
  // Semaine : dimanche 21 mars 2027, 02:30 HAE → dimanche 14, 2 h 30 n'existait pas non plus.
  const s = fenetresADate(new Date("2027-03-21T06:30:00Z"), "semaine");
  assert.deepEqual(iso(s.precedent), ["2027-03-08T05:00:00.000Z", "2027-03-14T07:00:00.000Z"]);
});

test("semaine : lundi précédent → même jour, même heure, à travers le changement d'heure", () => {
  // Mercredi 4 nov. 2026, 10:00 HNE.
  const f = fenetresADate(new Date("2026-11-04T15:00:00Z"), "semaine");
  assert.deepEqual(iso(f.courant), ["2026-11-02T05:00:00.000Z", "2026-11-04T15:00:00.000Z"]);
  assert.deepEqual(iso(f.precedent), ["2026-10-26T04:00:00.000Z", "2026-10-28T14:00:00.000Z"]);
});

test("semaine : lundi 0 h pile — les deux fenêtres sont vides, pas décalées", () => {
  const f = fenetresADate(new Date("2026-10-26T04:00:00Z"), "semaine");
  assert.deepEqual(iso(f.courant), ["2026-10-26T04:00:00.000Z", "2026-10-26T04:00:00.000Z"]);
  assert.deepEqual(iso(f.precedent), ["2026-10-19T04:00:00.000Z", "2026-10-19T04:00:00.000Z"]);
});

test("mois : le 31 mars se compare à TOUT février (borné à la fin du mois)", () => {
  const f = fenetresADate(new Date("2026-03-31T14:00:00Z"), "mois");
  assert.deepEqual(iso(f.courant), ["2026-03-01T05:00:00.000Z", "2026-03-31T14:00:00.000Z"]);
  assert.deepEqual(iso(f.precedent), ["2026-02-01T05:00:00.000Z", "2026-03-01T05:00:00.000Z"]);
});

test("mois : le 31 octobre se compare à tout septembre (30 jours)", () => {
  const f = fenetresADate(new Date("2026-10-31T16:00:00Z"), "mois");
  assert.deepEqual(iso(f.precedent), ["2026-09-01T04:00:00.000Z", "2026-10-01T04:00:00.000Z"]);
});

test("mois : février 2028 a 29 jours", () => {
  // 29 mars 2028, 10:00 HAE → 29 février, 10:00 HNE.
  assert.deepEqual(iso(fenetresADate(new Date("2028-03-29T14:00:00Z"), "mois").precedent),
    ["2028-02-01T05:00:00.000Z", "2028-02-29T15:00:00.000Z"]);
  // 30 mars 2028 : le 30 février n'existe pas → tout février.
  assert.deepEqual(iso(fenetresADate(new Date("2028-03-30T14:00:00Z"), "mois").precedent),
    ["2028-02-01T05:00:00.000Z", "2028-03-01T05:00:00.000Z"]);
});

test("mois : janvier se compare à décembre de l'année d'avant", () => {
  const f = fenetresADate(new Date("2027-01-15T17:00:00Z"), "mois");
  assert.deepEqual(iso(f.courant), ["2027-01-01T05:00:00.000Z", "2027-01-15T17:00:00.000Z"]);
  assert.deepEqual(iso(f.precedent), ["2026-12-01T05:00:00.000Z", "2026-12-15T17:00:00.000Z"]);
});

test("mois : à travers la fin de l'heure d'été, même heure MURALE", () => {
  // 15 nov. 2026, 12:00 HNE → 15 oct., 12:00 HAE.
  assert.deepEqual(iso(fenetresADate(new Date("2026-11-15T17:00:00Z"), "mois").precedent),
    ["2026-10-01T04:00:00.000Z", "2026-10-15T16:00:00.000Z"]);
});

test("séries : 30 jours, 12 semaines, 12 mois, la dernière est la période en cours", () => {
  const t = new Date("2026-10-22T19:00:00Z");
  const j = debutsPeriodes(t, "jour");
  assert.equal(j.length, 30);
  assert.equal(j[29].toISOString(), "2026-10-22T04:00:00.000Z");
  assert.equal(j[0].toISOString(), "2026-09-23T04:00:00.000Z");
  const s = debutsPeriodes(t, "semaine");
  assert.equal(s.length, 12);
  assert.equal(s[11].toISOString(), "2026-10-19T04:00:00.000Z");
  const m = debutsPeriodes(t, "mois");
  assert.equal(m.length, 12);
  assert.equal(m[11].toISOString(), "2026-10-01T04:00:00.000Z");
  assert.equal(m[0].toISOString(), "2025-11-01T04:00:00.000Z");
  // 12 mois qui traversent janvier : de février 2027 à janvier 2028.
  const m2 = debutsPeriodes(new Date("2028-01-10T17:00:00Z"), "mois");
  assert.equal(m2[0].toISOString(), "2027-02-01T05:00:00.000Z");
  assert.equal(m2[11].toISOString(), "2028-01-01T05:00:00.000Z");
});

test("séries : un compte par période, rien hors des bornes", () => {
  const t = new Date("2026-10-22T19:00:00Z");
  const m = debutsPeriodes(t, "mois", 2); // sept., oct.
  const n = parPeriode(
    ["2026-08-31T23:00:00Z", /* 31 août 19 h → hors série */
     "2026-09-01T03:59:59Z", /* 31 août 23:59:59 → hors série */
     "2026-09-01T04:00:00Z", "2026-10-01T03:00:00Z", /* septembre */
     "2026-10-01T04:00:00Z", "2026-10-22T18:59:59Z", /* octobre */
     "2026-10-22T19:00:00Z", /* maintenant : exclu */
     null, "pas une date"],
    m, t);
  assert.deepEqual(n, [2, 2]);
});

test("libellés : jour et semaine « 22 oct. », mois avec l'année", () => {
  assert.equal(libellePeriode(new Date("2026-10-22T04:00:00Z"), "jour"), "22 oct.");
  assert.match(libellePeriode(new Date("2026-10-01T04:00:00Z"), "mois"), /^oct\.? 2026$/);
});
