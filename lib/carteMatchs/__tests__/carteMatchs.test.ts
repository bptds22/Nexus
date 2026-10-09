import { test } from "node:test";
import assert from "node:assert/strict";
import {
  lieuExploitable, LIEU_NON_PRECISE, TYPES_PAR_DEFAUT, joursDansPlage, erreurPlage, optionsCatDiv, filtrerCatDiv,
  jourDecale, libelleJour, grouperParJour, terrainDe, terrainsCarte, etatCalendrier, minutesDe, heureQuebec,
  libelleDivision, lienItineraire, titreMatch, profilsParMatch, libelleProfils, libelleDontSuivis,
  estGesteMatch, libelleGesteMatch, dateSaisie, sourcesParMatch, paquets,
  type MatchRecherche,
} from "@/lib/carteMatchs/carteMatchs";

let n = 0;
const match = (o: Partial<MatchRecherche>): MatchRecherche => ({
  id: `m${++n}`, jour: "2026-10-10", heure: "18:00", domicile: "Équipe A", visiteur: "Équipe B",
  terrain: "Stade A", sport: "Football", categorie: "Juvénile", division: "D1", ligue: "Football J M D1",
  type: "SECONDAIRE", lat: 45.5, lon: -73.6, nb_profils: 0, cible: false, ajoute: false,
  ...o,
});

test("lieuExploitable : 0,0, hors Québec, absent → non ; Montréal → oui", () => {
  assert.equal(lieuExploitable(45.5, -73.6), true);
  assert.equal(lieuExploitable(0, 0), false);
  assert.equal(lieuExploitable(0, -73.6), false);
  assert.equal(lieuExploitable(40.7, -74.0), false, "New York : lat sous 44");
  assert.equal(lieuExploitable(48.85, 2.35), false, "Paris");
  assert.equal(lieuExploitable(44, -57), true, "bornes incluses");
  assert.equal(lieuExploitable(null, -73), false);
  assert.equal(lieuExploitable(Number.NaN, -73), false);
});

test("plage de dates : 7 jours au plus, fin facultative, fin avant début refusée", () => {
  assert.equal(joursDansPlage("2026-10-10", null), 1, "une date seule = 1 jour");
  assert.equal(joursDansPlage("2026-10-10", "2026-10-16"), 7);
  assert.equal(joursDansPlage("2026-10-28", "2026-11-03"), 7, "à cheval sur deux mois");
  assert.equal(joursDansPlage("2026-10-10", "2026-10-09"), null);
  assert.equal(erreurPlage("2026-10-10", "2026-10-16"), null);
  assert.equal(erreurPlage("2026-10-10", "2026-10-17"), "7 jours au plus (8 demandés).");
  assert.equal(erreurPlage("2026-10-10", "2026-10-09"), "La date de fin précède la date de début.");
  assert.deepEqual(TYPES_PAR_DEFAUT, ["SECONDAIRE", "CIVIL"], "collégial décoché par défaut");
});

test("catégorie et division : options triées, filtre accents et casse ignorés", () => {
  const ms = [match({ categorie: "Juvénile", division: "D1" }), match({ categorie: "Cadet", division: "D2" }), match({ categorie: null, division: "D1" })];
  assert.deepEqual(optionsCatDiv(ms), { categories: ["Cadet", "Juvénile"], divisions: ["D1", "D2"] });
  assert.deepEqual(filtrerCatDiv(ms, "juvenile", "").map((m) => m.categorie), ["Juvénile"]);
  assert.deepEqual(filtrerCatDiv(ms, "", "D1").length, 2);
  assert.deepEqual(filtrerCatDiv(ms, "", "").length, 3);
});

test("jours : décalage, libellé québécois, groupement dans l'ordre reçu", () => {
  assert.equal(jourDecale(new Date(2026, 11, 31), 1), "2027-01-01");
  assert.equal(libelleJour("2026-10-10"), "samedi 10 octobre");
  assert.equal(libelleJour("2026-11-01"), "dimanche 1er novembre");
  const g = grouperParJour([match({ jour: "2026-10-10" }), match({ jour: "2026-10-10" }), match({ jour: "2026-10-11" })]);
  assert.deepEqual(g.map((x) => [x.jour, x.matchs.length]), [["2026-10-10", 2], ["2026-10-11", 1]]);
});

test("terrains : un point par terrain, étoile si un match y est cible, sans lieu → aucun point", () => {
  const ms = [
    match({ id: "a", terrain: "Parc Jarry", lat: 45.53401, lon: -73.62799 }),
    match({ id: "b", terrain: "Parc Jarry", lat: 45.534014, lon: -73.627994, cible: true }),  // ~1 m : même terrain
    match({ id: "c", terrain: "Parc Jarry", lat: 46.81, lon: -71.21 }),                          // même nom, autre ville
    match({ id: "d", terrain: "Inconnu", lat: 0, lon: 0 }),
    match({ id: "e", terrain: null, lat: null, lon: null }),
  ];
  const t = terrainsCarte(ms);
  assert.equal(t.length, 2);
  assert.deepEqual(t[0].matchIds, ["a", "b"]);
  assert.equal(t[0].cible, true, "étoile : un des matchs du terrain est cible");
  assert.equal(t[1].cible, false);
  assert.equal(terrainDe(ms[3]), null);
  assert.equal(terrainDe(match({ terrain: "  ", lat: 45.5, lon: -73.6 }))!.nom, LIEU_NON_PRECISE);
});

test("calendrier de l'unité : suivi (✓ fixe), ajouté (✓ retirable), libre (+)", () => {
  assert.equal(etatCalendrier({ cible: true, ajoute: false }), "SUIVI");
  assert.equal(etatCalendrier({ cible: true, ajoute: true }), "SUIVI", "un match suivi ne se retire jamais");
  assert.equal(etatCalendrier({ cible: false, ajoute: true }), "AJOUTE");
  assert.equal(etatCalendrier({ cible: false, ajoute: false }), "LIBRE");
});

test("libellés : heure québécoise, division, itinéraire, titre", () => {
  assert.equal(minutesDe("9:05"), 545);
  assert.equal(minutesDe("25:00"), null);
  assert.equal(heureQuebec("09:30"), "9 h 30");
  assert.equal(heureQuebec("18:00"), "18 h");
  assert.equal(heureQuebec(null), "Heure à confirmer");
  assert.equal(libelleDivision("D1"), "Division 1");
  assert.equal(libelleDivision("Niveau 1"), "Niveau 1");
  assert.equal(lienItineraire(45.6, -73.5), "https://www.google.com/maps/dir/?api=1&destination=45.6,-73.5");
  assert.equal(titreMatch({ domicile: "Spartiates", visiteur: "Phénix" }), "Spartiates vs Phénix");
});

test("profilsParMatch : regroupe par match, dédoublonne, suivis d'abord puis par nom ; libellés", () => {
  const l = (game_id: string, athlete_id: string, nom: string, prenom = "X", cote: "DOMICILE" | "VISITEUR" = "DOMICILE") =>
    ({ game_id, athlete_id, prenom, nom, position: " QB ", promotion: 2027, cote });
  const r = profilsParMatch([
    l("g1", "a1", "Tremblay"), l("g1", "a2", "Bélanger", "Léa", "VISITEUR"), l("g1", "a3", "Gagnon"),
    l("g1", "a3", "Gagnon", "X", "VISITEUR"),
    l("g2", "a4", "Roy"),
  ], new Set(["a3", "zz"]));
  const g1 = r.get("g1")!;
  assert.equal(g1.total, 3);
  assert.equal(g1.suivis, 1);
  assert.deepEqual(g1.profils.map((p) => p.nom), ["Gagnon", "Bélanger", "Tremblay"]);
  assert.equal(g1.profils[1].position, "QB");
  assert.equal(r.has("g3"), false);
  assert.equal(profilsParMatch([l("g1", "a1", "Roy")]).get("g1")!.suivis, 0, "sans unité : aucun suivi");
  assert.equal(libelleProfils(g1), "3 profils Nexus");
  assert.equal(libelleProfils({ total: 1 }), "1 profil Nexus");
  assert.equal(libelleProfils({ total: 0 }), null);
  assert.equal(libelleDontSuivis(g1), "dont 1 suivi");
  assert.equal(libelleDontSuivis({ suivis: 2 }), "dont 2 suivis");
  assert.equal(libelleDontSuivis({ suivis: 0 }), null);
});

test("journal : MATCH_AJOUTE / MATCH_RETIRE, libellé tiré de details", () => {
  assert.equal(estGesteMatch("MATCH_AJOUTE"), true);
  assert.equal(estGesteMatch("MATCH_RETIRE"), true);
  assert.equal(estGesteMatch("FAVORITED"), false);
  const d = { game_id: "g", domicile: "Collège Laval", visiteur: "Amitié", jour: "2026-10-10", heure: "09:30", terrain: "Collège Laval" };
  assert.equal(libelleGesteMatch("MATCH_AJOUTE", d), "Match ajouté au calendrier : Collège Laval vs Amitié — samedi 10 octobre, 9 h 30");
  assert.equal(libelleGesteMatch("MATCH_RETIRE", d), "Match retiré du calendrier : Collège Laval vs Amitié — samedi 10 octobre, 9 h 30");
  // Match disparu (details vides) : le geste reste lisible.
  assert.equal(libelleGesteMatch("MATCH_RETIRE", {}), "Match retiré du calendrier");
  assert.equal(libelleGesteMatch("MATCH_AJOUTE", null), "Match ajouté au calendrier");
});

test("date au clavier : une année en cours de frappe ne lance pas de recherche", () => {
  // Chrome émet un change à chaque chiffre de l'année : 0002, 0020, 0202, 2026.
  assert.equal(dateSaisie("0002-10-09"), null);
  assert.equal(dateSaisie("0202-10-09"), null);
  assert.equal(dateSaisie("202620-10-09"), null, "six chiffres : lu jusqu'ici comme « fin avant début »");
  assert.equal(dateSaisie(""), null, "date partielle : valeur vide");
  assert.equal(dateSaisie("2026-10-10"), "2026-10-10");
  assert.equal(dateSaisie("2027-01-02"), "2027-01-02");
});

test("source : la même dérivation que le Calendrier ; sans source, rien", () => {
  const rseq = "11111111-2222-3333-4444-555555555555";
  const s = sourcesParMatch([
    { id: "a", source_nom: "RSEQ", source_url: null, collecte_le: "2026-10-08T12:00:00Z", rseq_league_id: rseq, league_name: "Football J M D1" },
    { id: "b", source_nom: "LFMM", source_url: "https://lfmm.example/calendrier", collecte_le: null, rseq_league_id: null, league_name: null },
    { id: "c", source_nom: null, source_url: null, collecte_le: null, rseq_league_id: null, league_name: null },
  ]);
  assert.equal(s.get("a")?.libelle, "Calendrier officiel RSEQ (téléchargement)");
  assert.equal(s.get("a")?.ligue, "Football J M D1");
  assert.ok(s.get("a")?.url?.includes(rseq));
  assert.equal(s.get("a")?.telecharge, true);
  assert.equal(s.get("b")?.url, "https://lfmm.example/calendrier");
  assert.equal(s.get("b")?.libelle, "Calendrier de la ligue");
  assert.equal(s.has("c"), false, "aucune source : aucune ligne");
  assert.deepEqual(paquets([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
});
