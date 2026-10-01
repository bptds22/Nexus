import { test } from "node:test";
import assert from "node:assert/strict";
import {
  genererIcs, echapper, plier, titreEvenement, adresseFlux, adresseWebcal, lienGoogle, lienOutlook, FORME_JETON,
  type EvenementAgenda,
} from "@/lib/agenda/ics";

const ORIGINE = "https://nexussports.ca";
const MAINTENANT = new Date("2026-10-01T18:00:00Z");
const relance: EvenementAgenda = { type: "RELANCE", cible: "athlete", cible_id: "a1", nom: "Léa Roy", jour: "2026-10-05", instant: null, note: "Appeler le coach, après 20 h; pas avant" };
const visite: EvenementAgenda = { type: "VISITE", cible: "carte", cible_id: "c1", nom: "Preuve Agenda", jour: null, instant: "2026-10-08T23:30:00Z", note: null };

test("calendrier vide = calendrier VALIDE sans événement", () => {
  const ics = genererIcs([], ORIGINE, MAINTENANT);
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
  assert.doesNotMatch(ics, /BEGIN:VEVENT/);
});

test("relance : journée entière, titre, note, lien du dossier", () => {
  const ics = genererIcs([relance], ORIGINE, MAINTENANT).replace(/\r\n /g, "");
  assert.match(ics, /DTSTART;VALUE=DATE:20261005\r\nDTEND;VALUE=DATE:20261006/);
  assert.match(ics, /SUMMARY:Relance — Léa Roy/);
  assert.match(ics, /DESCRIPTION:Appeler le coach\\, après 20 h\\; pas avant\\n\\nDossier : https:\/\/nexussports.ca\/recruteur\/pipeline\?athlete=a1/);
  assert.match(ics, /UID:relance-athlete-a1@nexussports.ca/);
});

test("visite : à l'heure, 1 h, UTC", () => {
  const ics = genererIcs([visite], ORIGINE, MAINTENANT);
  assert.match(ics, /DTSTART:20261008T233000Z\r\nDTEND:20261009T003000Z/);
  assert.match(ics, /SUMMARY:Visite — Preuve Agenda/);
});

test("fin de mois : le lendemain d'une relance du 31", () => {
  assert.match(genererIcs([{ ...relance, jour: "2026-10-31" }], ORIGINE, MAINTENANT), /DTEND;VALUE=DATE:20261101/);
});

test("nom absent → « Identité réservée », jamais vide", () => {
  assert.equal(titreEvenement({ type: "VISITE", nom: null }), "Visite — Identité réservée");
});

test("échappement et pliage RFC 5545", () => {
  assert.equal(echapper("a,b;c\\d\ne"), "a\\,b\\;c\\\\d\\ne");
  const long = "DESCRIPTION:" + "é".repeat(100);
  const plie = plier(long);
  for (const l of plie.split("\r\n")) assert.ok(new TextEncoder().encode(l).length <= 75);
  assert.equal(plie.replace(/\r\n /g, ""), long);
});

test("toutes les lignes ≤ 75 octets", () => {
  const ics = genererIcs([relance, visite, { ...relance, note: "x".repeat(400) }], ORIGINE, MAINTENANT);
  for (const l of ics.split("\r\n")) assert.ok(new TextEncoder().encode(l).length <= 75, l);
});

test("adresses d'abonnement", () => {
  const j = "nxa_" + "ab".repeat(32);
  assert.ok(FORME_JETON.test(j));
  assert.ok(!FORME_JETON.test("nxa_../../etc"));
  const url = adresseFlux(ORIGINE, j);
  assert.equal(url, `https://nexussports.ca/api/agenda/${j}.ics`);
  assert.equal(adresseWebcal(url), `webcal://nexussports.ca/api/agenda/${j}.ics`);
  assert.equal(lienGoogle(url), `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(`webcal://nexussports.ca/api/agenda/${j}.ics`)}`);
  assert.match(lienOutlook(url), /^https:\/\/outlook\.office\.com\/calendar\/0\/addfromweb\?url=https%3A%2F%2Fnexussports\.ca/);
});
