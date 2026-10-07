import { test } from "node:test";
import assert from "node:assert/strict";
import {
  lieuExploitable, matchsDuJour, terrainsDuJour, distanceKm, libelleDistance, optionsFiltres,
  lienItineraire, titreMatch, evenementMatch, minutesDe, chargeParJour, jourDecale, FILTRES_VIDES, LIEU_NON_PRECISE, nomSuivi,
} from "@/lib/carteMatchs/carteMatchs";
import type { CalendarGame, CalendarTarget } from "@/lib/queries/recruiter/useRecruitingCalendar";

const cible = (athleteId: string, teamId: string, identityVisible = true): CalendarTarget => ({
  athleteId, identityVisible, fullName: identityVisible ? `Athlète ${athleteId}` : "Identité réservée",
  firstName: "", lastName: "", initials: "", photo: "", sport: "football", sportName: "Football",
  position: "", graduationYear: 0, region: "", school: "", verified: false, hasVideo: false, stars: 0, gpa: 0,
  orgType: "scolaire", pipelineStage: null, listIds: [], teamId, teamName: `Équipe ${teamId}`,
});

let n = 0;
const match = (o: Partial<CalendarGame>): CalendarGame => ({
  id: `g${++n}`, gameDate: "2026-10-10", gameTime: "18:00", venue: "Stade A",
  homeTeamId: "T1", visitorTeamId: "X", homeName: "Équipe T1", visitorName: "Adversaire", competition: "Football juvénile D1",
  source: { nom: null, url: null, collecteLe: null } as unknown as CalendarGame["source"],
  venueLat: 45.5, venueLon: -73.6, sector: "Secondaire", sport: "Football", category: "Juvénile", division: "D1", leagueName: "RSEQ Montréal",
  ...o,
});

test("lieuExploitable : 0,0, hors Québec, absent → non ; Montréal → oui", () => {
  assert.equal(lieuExploitable(45.5, -73.6), true);
  assert.equal(lieuExploitable(0, 0), false);
  assert.equal(lieuExploitable(0, -73.6), false, "lat = 0 seul suffit à écarter");
  assert.equal(lieuExploitable(45.5, 0), false);
  assert.equal(lieuExploitable(40.7, -74.0), false, "New York : lat sous 44");
  assert.equal(lieuExploitable(48.85, 2.35), false, "Paris : lon hors -80…-57");
  assert.equal(lieuExploitable(64, -70), false, "au nord de 63");
  assert.equal(lieuExploitable(46, -81), false, "à l'ouest de -80");
  assert.equal(lieuExploitable(44, -57), true, "bornes incluses");
  assert.equal(lieuExploitable(null, -73), false);
  assert.equal(lieuExploitable(undefined, undefined), false);
  assert.equal(lieuExploitable(Number.NaN, -73), false);
});

test("matchsDuJour : le jour seul, au moins un suivi, collégial exclu, tri par heure, sans heure en fin", () => {
  const targets = [cible("a1", "T1"), cible("a2", "T2"), cible("a3", "T3", false)];
  const games = [
    match({ id: "tard", gameTime: "20:30", homeTeamId: "T1" }),
    match({ id: "sansHeure", gameTime: "", homeTeamId: "T2" }),
    match({ id: "tot", gameTime: "9:15", visitorTeamId: "T3", homeTeamId: "Y" }),
    match({ id: "collegial", gameTime: "10:00", sector: "Collégial" }),
    match({ id: "personne", gameTime: "11:00", homeTeamId: "Z", visitorTeamId: "W" }),
    match({ id: "autreJour", gameDate: "2026-10-11", gameTime: "08:00" }),
    match({ id: "illisible", gameTime: "à confirmer", homeTeamId: "T1" }),
  ];
  const m = matchsDuJour({ games, targets }, "2026-10-10");
  assert.deepEqual(m.map((x) => x.game.id), ["tot", "tard", "sansHeure", "illisible"]);
  assert.equal(m[0].suivisVisiteur[0].identityVisible, false, "la cible masquée reste masquée (Identité réservée)");
  assert.equal(m[0].suivisDomicile.length, 0);
});

test("matchsDuJour : secteur null n'est pas collégial ; accents et casse ignorés (« COLLEGIAL »)", () => {
  const targets = [cible("a1", "T1")];
  const m = matchsDuJour({ games: [match({ id: "nul", sector: null }), match({ id: "maj", sector: "COLLEGIAL" })], targets }, "2026-10-10");
  assert.deepEqual(m.map((x) => x.game.id), ["nul"]);
});

test("filtres : sport, catégorie, division, ligue (casse et accents ignorés)", () => {
  const targets = [cible("a1", "T1")];
  const games = [
    match({ id: "foot-juv-d1", sport: "Football", category: "Juvénile", division: "D1" }),
    match({ id: "foot-cad-d2", sport: "Football", category: "Cadet", division: "D2", leagueName: "RSEQ Laurentides" }),
    match({ id: "basket", sport: "Basketball", category: "Juvénile", division: "D1" }),
  ];
  const cal = { games, targets };
  assert.deepEqual(matchsDuJour(cal, "2026-10-10", { ...FILTRES_VIDES, sport: "football" }).map((x) => x.game.id), ["foot-juv-d1", "foot-cad-d2"]);
  assert.deepEqual(matchsDuJour(cal, "2026-10-10", { ...FILTRES_VIDES, sport: "Football", categorie: "juvenile" }).map((x) => x.game.id), ["foot-juv-d1"]);
  assert.deepEqual(matchsDuJour(cal, "2026-10-10", { ...FILTRES_VIDES, division: "D2" }).map((x) => x.game.id), ["foot-cad-d2"]);
  assert.deepEqual(matchsDuJour(cal, "2026-10-10", { ...FILTRES_VIDES, ligue: "RSEQ Laurentides" }).map((x) => x.game.id), ["foot-cad-d2"]);

  const o = optionsFiltres(cal, "2026-10-10", "Football");
  assert.deepEqual(o.sports, ["Basketball", "Football"]);
  assert.deepEqual(o.categories, ["Cadet", "Juvénile"], "dans le sport choisi seulement");
  assert.deepEqual(o.ligues, ["RSEQ Laurentides", "RSEQ Montréal"]);
  assert.deepEqual(optionsFiltres(cal, "2026-10-10", "Basketball").divisions, ["D1"], "une seule valeur → la page grise le filtre");
});

test("terrainsDuJour : deux matchs au même terrain = un point ; même nom à deux endroits = deux points ; sans lieu = aucun point", () => {
  const targets = [cible("a1", "T1")];
  const games = [
    match({ id: "m1", gameTime: "13:00", venue: "Parc Jarry", venueLat: 45.53401, venueLon: -73.62799 }),
    // ~1 m plus loin : arrondi à 4 décimales → MÊME terrain.
    match({ id: "m2", gameTime: "15:00", venue: "Parc Jarry", venueLat: 45.534014, venueLon: -73.627994 }),
    // Même nom, autre ville : un AUTRE terrain.
    match({ id: "m3", gameTime: "16:00", venue: "Parc Jarry", venueLat: 46.81, venueLon: -71.21 }),
    match({ id: "m4", gameTime: "17:00", venue: "Terrain inconnu", venueLat: 0, venueLon: 0 }),
    match({ id: "m5", gameTime: "18:00", venue: "Ohio", venueLat: 40.0, venueLon: -83.0 }),
  ];
  const m = matchsDuJour({ games, targets }, "2026-10-10");
  const t = terrainsDuJour(m);
  assert.equal(t.length, 2);
  assert.deepEqual(t[0].matchs.map((x) => x.game.id), ["m1", "m2"]);
  assert.deepEqual(t[1].matchs.map((x) => x.game.id), ["m3"]);
  assert.notEqual(t[0].id, t[1].id);
  assert.deepEqual(m.filter((x) => !x.lieuOk).map((x) => x.game.id), ["m4", "m5"], "restent dans la liste");
  assert.equal(LIEU_NON_PRECISE, "Lieu non précisé");
});

test("distanceKm : haversine (Montréal → Québec ≈ 233 km), points manquants → null", () => {
  const mtl = { lat: 45.5017, lon: -73.5673 }, qc = { lat: 46.8139, lon: -71.2080 };
  const d = distanceKm(mtl, qc)!;
  assert.ok(d > 230 && d < 236, String(d));
  assert.equal(distanceKm(mtl, mtl), 0);
  assert.equal(distanceKm(null, qc), null);
  assert.equal(distanceKm({ lat: null, lon: null }, qc), null, "cégep sans coordonnées");
  assert.equal(libelleDistance(3.24), "3,2 km");
  assert.equal(libelleDistance(232.7), "233 km");
  assert.equal(libelleDistance(null), null);
});

test("actions : itinéraire, titre, agenda (Google, Outlook, .ics) ; sans heure → pas d'événement", () => {
  const g = match({ gameDate: "2026-10-10", gameTime: "18:30", homeName: "Spartiates", visitorName: "Phénix", venue: "Stade Hébert", venueLat: 45.6, venueLon: -73.5 });
  assert.equal(lienItineraire(45.6, -73.5), "https://www.google.com/maps/dir/?api=1&destination=45.6,-73.5");
  assert.equal(titreMatch(g), "Spartiates vs Phénix");
  const e = evenementMatch(g)!;
  assert.match(e.googleUrl, /^https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE&text=Spartiates%20vs%20Ph%C3%A9nix/);
  assert.match(e.googleUrl, /location=Stade%20H%C3%A9bert/);
  assert.match(e.outlookUrl, /^https:\/\/outlook\.office\.com\/calendar\/0\/deeplink\/compose\?/);
  assert.match(e.outlookUrl, /subject=Spartiates%20vs%20Ph%C3%A9nix/);
  const debut = new Date(2026, 9, 10, 18, 30);
  assert.match(e.outlookUrl, new RegExp(`startdt=${encodeURIComponent(debut.toISOString())}`));
  assert.match(e.icsContent, /SUMMARY:Spartiates vs Phénix/);
  assert.match(e.icsContent, /LOCATION:Stade Hébert/);
  assert.equal(evenementMatch(match({ gameTime: "" })), null);
  assert.equal(evenementMatch(match({ gameTime: "à confirmer" })), null);
});

test("minutesDe, jourDecale, chargeParJour", () => {
  assert.equal(minutesDe("9:05"), 545);
  assert.equal(minutesDe("19h30"), 1170);
  assert.equal(minutesDe("25:00"), null);
  assert.equal(minutesDe(null), null);
  assert.equal(jourDecale(new Date(2026, 11, 31), 1), "2027-01-01");
  const targets = [cible("a1", "T1")];
  const charge = chargeParJour({ targets, games: [
    match({ id: "c1", venue: "A" }), match({ id: "c2", venue: "B", venueLat: 46, venueLon: -72 }), match({ id: "c3", venueLat: 0, venueLon: 0 }),
    match({ id: "c4", gameDate: "2026-10-12" }),
  ] }, "Football");
  assert.deepEqual(charge, [
    { date: "2026-10-10", matchs: 3, terrains: 2, sansLieu: 1 },
    { date: "2026-10-12", matchs: 1, terrains: 1, sansLieu: 0 },
  ]);
});

test("nomSuivi : identité masquée → « Identité réservée », jamais le nom", () => {
  assert.equal(nomSuivi({ identityVisible: true, fullName: "Léa Gagnon" }), "Léa Gagnon");
  assert.equal(nomSuivi({ identityVisible: false, fullName: "Léa Gagnon" }), "Identité réservée");
  assert.equal(nomSuivi({ identityVisible: true, fullName: "  " }), "Identité réservée");
});
