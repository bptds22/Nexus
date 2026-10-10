import { test } from "node:test";
import assert from "node:assert/strict";
import {
  genererIcs, debutFinMatch, titreMatchAgenda, FORME_JETON, estJetonPartenaire, NOM_CALENDRIER, NOM_CALENDRIER_PARTENAIRE,
  type MatchAgenda,
} from "@/lib/agenda/ics";
import { profilsPartenaireLisibles } from "@/lib/carteMatchs/carteMatchs";

const ORIGINE = "https://nexussports.ca";
const MAINTENANT = new Date("2026-10-09T12:00:00Z");
const qmfl: MatchAgenda = {
  game_id: "fa000000-0000-4000-8000-000000000630", jour: "2026-10-24", heure: "6:30 PM",
  domicile: "Bel Air Norsemen", visiteur: "Myers Riders", terrain: "Nepean Sportsplex (Main)", ligue: "QMFL",
};
const deplier = (ics: string) => ics.replace(/\r\n /g, "");

test(".ics partenaire : un match QMFL « 6:30 PM » = 18 h 30 à Montréal (22:30 UTC, heure d'été), 2 h", () => {
  const ics = deplier(genererIcs([], ORIGINE, MAINTENANT, { matchs: [qmfl], nom: NOM_CALENDRIER_PARTENAIRE }));
  assert.match(ics, /DTSTART:20261024T223000Z/);
  assert.match(ics, /DTEND:20261025T003000Z/);
  assert.match(ics, /SUMMARY:Match — Bel Air Norsemen vs Myers Riders/);
  assert.match(ics, /LOCATION:Nepean Sportsplex \(Main\)/);
  assert.match(ics, /UID:match-fa000000-0000-4000-8000-000000000630@nexussports\.ca/);
  assert.match(ics, /X-WR-CALNAME:Nexus — mes matchs/);
  assert.doesNotMatch(ics, /Dossier :|recruteur\/pipeline/, "aucun lien vers Mon processus dans le flux partenaire");
});

test(".ics : sans heure lisible, journée entière — jamais une heure inventée", () => {
  assert.deepEqual(debutFinMatch({ jour: "2026-10-25", heure: null }), ["DTSTART;VALUE=DATE:20261025", "DTEND;VALUE=DATE:20261026"]);
  assert.deepEqual(debutFinMatch({ jour: "2026-10-31", heure: "À déterminer" }), ["DTSTART;VALUE=DATE:20261031", "DTEND;VALUE=DATE:20261101"]);
  const ics = deplier(genererIcs([], ORIGINE, MAINTENANT, { matchs: [{ ...qmfl, heure: null }] }));
  assert.match(ics, /DTSTART;VALUE=DATE:20261024/);
  assert.match(ics, /Heure à confirmer à la source\./);
  assert.equal(debutFinMatch({ jour: "24/10/2026", heure: "6:30 PM" }), null, "jour illisible : pas d'événement");
});

test(".ics : heure normale en décembre (UTC−5) et 24 h du RSEQ", () => {
  assert.deepEqual(debutFinMatch({ jour: "2026-12-05", heure: "6:30 PM" })?.[0], "DTSTART:20261205T233000Z");
  assert.deepEqual(debutFinMatch({ jour: "2026-10-24", heure: "18:30" })?.[0], "DTSTART:20261024T223000Z");
});

test(".ics recruteur : relances/visites inchangées, matchs de l'unité en plus, nom du calendrier", () => {
  const ics = deplier(genererIcs([], ORIGINE, MAINTENANT, { matchs: [qmfl] }));
  // La virgule du nom s'échappe en .ics (RFC 5545) : « relances\, visites et matchs ».
  assert.ok(ics.includes("X-WR-CALNAME:Nexus — relances\\, visites et matchs"));
  assert.equal(NOM_CALENDRIER, "Nexus — relances, visites et matchs");
  assert.equal(titreMatchAgenda(qmfl), "Match — Bel Air Norsemen vs Myers Riders");
  assert.equal(deplier(genererIcs([], ORIGINE, MAINTENANT)).includes("BEGIN:VEVENT"), false, "sans match : calendrier vide valide");
});

test("jetons : nxa_ (recruteur) et nxp_ (partenaire), rien d'autre", () => {
  const h = "a".repeat(64);
  assert.ok(FORME_JETON.test(`nxa_${h}`));
  assert.ok(FORME_JETON.test(`nxp_${h}`));
  assert.ok(!FORME_JETON.test(`nxq_${h}`));
  assert.ok(!FORME_JETON.test("nxp_../../etc"));
  assert.equal(estJetonPartenaire(`nxp_${h}`), true);
  assert.equal(estJetonPartenaire(`nxa_${h}`), false);
});

test("joueurs partenaire : total et noms lus tels quels ; une réponse illisible = 0, aucun nom", () => {
  const r = profilsPartenaireLisibles({ total: 11, profils: [
    { athlete_id: "a1", prenom: "Thomas", nom: "Boucher", position: null, promotion: 2028, cote: "DOMICILE" },
    null, { prenom: "sans id" },
  ] });
  assert.equal(r.total, 11);
  assert.deepEqual(r.profils.map((p) => p.athlete_id), ["a1"]);
  assert.deepEqual(profilsPartenaireLisibles(null), { total: 0, profils: [] });
  assert.deepEqual(profilsPartenaireLisibles({ total: -3, profils: "x" }), { total: 0, profils: [] });
});
