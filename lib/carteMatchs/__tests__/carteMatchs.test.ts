import { test } from "node:test";
import assert from "node:assert/strict";
import {
  lieuExploitable, LIEU_NON_PRECISE, TYPES_PAR_DEFAUT, joursDansPlage, erreurPlage, optionsCatDiv, filtrerCatDiv,
  jourDecale, libelleJour, grouperParJour, terrainDe, terrainsCarte, etatCalendrier, minutesDe, heureQuebec,
  libelleDivision, lienItineraire, titreMatch, profilsParMatch, libelleProfils, libelleDontSuivis,
  estGesteMatch, libelleGesteMatch, dateSaisie, sourcesParMatch, paquets,
  bornerFin, avisFinAjustee, matchsLisibles, JOURS_MAX, fenetres,
  dateCourte, dateCarte, enTeteJour, heureCarte, trierMatchs,
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

test("plage de dates : 31 jours au plus, fin facultative, fin avant début refusée", () => {
  assert.equal(JOURS_MAX, 31, "même borne que la garde de matchs_recherche (p_fin - p_debut > 30)");
  assert.equal(joursDansPlage("2026-10-10", null), 1, "une date seule = 1 jour");
  assert.equal(joursDansPlage("2026-10-10", "2026-10-16"), 7);
  assert.equal(joursDansPlage("2026-10-28", "2026-11-03"), 7, "à cheval sur deux mois");
  assert.equal(joursDansPlage("2026-10-10", "2026-10-09"), null);
  assert.equal(erreurPlage("2026-10-10", "2026-11-09"), null, "31 jours");
  assert.equal(erreurPlage("2026-10-10", "2026-11-10"), "31 jours au plus (32 demandés).");
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

test("plage de BP (2026-10-09) : 9 oct. → 6 nov., 29 jours — acceptée, rien d'ajusté", () => {
  // Avant : refusée par la base (7 jours au plus), la page restait figée sur les anciens marqueurs.
  assert.equal(joursDansPlage("2026-10-09", "2026-11-06"), 29);
  assert.equal(erreurPlage("2026-10-09", "2026-11-06"), null);
  assert.deepEqual(bornerFin("2026-10-09", "2026-11-06"), { fin: "2026-11-06", ajustee: false });
});

test("bornerFin : au-delà de 31 jours, la fin est ramenée à début + 30 et on le dit", () => {
  assert.deepEqual(bornerFin("2026-10-09", "2026-12-31"), { fin: "2026-11-08", ajustee: true });
  assert.equal(joursDansPlage("2026-10-09", bornerFin("2026-10-09", "2026-12-31").fin), 31);
  assert.deepEqual(bornerFin("2026-12-15", "2027-02-01"), { fin: "2027-01-14", ajustee: true }, "à cheval sur l'année");
  assert.deepEqual(bornerFin("2026-10-09", ""), { fin: "", ajustee: false }, "fin vide = un seul jour");
  assert.deepEqual(bornerFin("2026-10-09", "2026-10-01"), { fin: "2026-10-01", ajustee: false }, "fin avant début : laissée à erreurPlage");
  assert.equal(avisFinAjustee("2026-11-08"), "Période limitée à 31 jours — fin ajustée au 8 novembre 2026.");
});

test("cache réhydraté illisible : jamais d'exception, valeurs vides (plantage au rechargement, BP 2026-10-09)", () => {
  // Une Map passée par JSON (sessionStorage) revient `{}` : c'était `sources?.get is not a function`.
  assert.equal(JSON.stringify(new Map([["a", 1]])), "{}");
  for (const illisible of [{}, null, undefined, "x", 42, [null, { pas: "d'id" }]]) {
    assert.equal(sourcesParMatch(illisible).size, 0);
    assert.deepEqual(matchsLisibles(illisible), []);
  }
  // Ce que le hook met désormais en cache (des lignes) survit à l'aller-retour JSON.
  const lignes = [{ id: "a", source_nom: "RSEQ", source_url: null, collecte_le: null, rseq_league_id: "a3d2c1b0-0000-4000-8000-000000000001", league_name: "L" }];
  assert.equal(sourcesParMatch(JSON.parse(JSON.stringify(lignes))).get("a")?.ligue, "L");
  const m = match({});
  assert.deepEqual(matchsLisibles(JSON.parse(JSON.stringify([m]))), [m]);
});

test("fenetres : 31 jours en fenêtres de 7 (plafond PostgREST de 1 000 lignes), contiguës, sans chevauchement", () => {
  const f = fenetres("2026-10-09", "2026-11-08", 7);
  assert.deepEqual(f, [
    ["2026-10-09", "2026-10-15"], ["2026-10-16", "2026-10-22"], ["2026-10-23", "2026-10-29"],
    ["2026-10-30", "2026-11-05"], ["2026-11-06", "2026-11-08"],
  ]);
  assert.deepEqual(fenetres("2026-10-09", "2026-11-06", 7).length, 5, "la plage de BP : 29 jours");
  assert.deepEqual(fenetres("2026-10-09", "", 7), [["2026-10-09", "2026-10-09"]], "une date seule");
  assert.deepEqual(fenetres("2026-10-09", "2026-10-11", 1), [["2026-10-09", "2026-10-09"], ["2026-10-10", "2026-10-10"], ["2026-10-11", "2026-10-11"]]);
  assert.deepEqual(fenetres("2026-10-09", "2026-10-01", 7), [], "fin avant début");
});

test("dates claires (BP 2026-10-09) : champs « 9 oct. 2026 », jamais « 10/09/2026 »", () => {
  assert.equal(dateCourte("2026-10-09"), "9 oct. 2026");
  assert.equal(dateCourte("2026-11-01"), "1er nov. 2026");
  assert.equal(dateCourte("2027-02-14"), "14 févr. 2027");
  assert.equal(dateCourte(""), "");
  assert.equal(dateCourte("10/09/2026"), "", "une forme ambiguë n'est jamais relayée");
});

test("en-tête de jour : Aujourd'hui / Demain gardent la date ; compte au singulier ; année seulement si elle change", () => {
  const auj = "2026-10-09";
  assert.deepEqual(enTeteJour("2026-10-09", auj, 74), { jour: "Aujourd'hui · vendredi 9 octobre", compte: "74 matchs" });
  assert.deepEqual(enTeteJour("2026-10-10", auj, 1), { jour: "Demain · samedi 10 octobre", compte: "1 match" });
  assert.deepEqual(enTeteJour("2026-10-11", auj, 42), { jour: "Dimanche 11 octobre", compte: "42 matchs" });
  assert.deepEqual(enTeteJour("2027-01-01", "2026-12-15", 3), { jour: "Vendredi 1er janvier 2027", compte: "3 matchs" });
  assert.equal(enTeteJour("2026-11-01", "2026-10-31", 2).jour, "Demain · dimanche 1er novembre", "demain, à cheval sur deux mois");
});

test("heure de la carte : « 13 h 00 », « 9 h 30 », sinon « Heure à confirmer »", () => {
  assert.equal(heureCarte("13:00"), "13 h 00");
  assert.equal(heureCarte("9:30"), "9 h 30");
  assert.equal(heureCarte("18h15"), "18 h 15");
  assert.equal(heureCarte(null), "Heure à confirmer");
  assert.equal(heureCarte("À déterminer"), "Heure à confirmer");
});

test("trierMatchs : date, puis heure (inconnue en fin de jour), puis domicile — fenêtres recollées dans le désordre", () => {
  const a = match({ jour: "2026-10-10", heure: "18:00", domicile: "B" });
  const b = match({ jour: "2026-10-10", heure: null, domicile: "A" });
  const c = match({ jour: "2026-10-09", heure: "20:00", domicile: "Z" });
  const d = match({ jour: "2026-10-10", heure: "9:30", domicile: "C" });
  const e = match({ jour: "2026-10-10", heure: "18:00", domicile: "A" });
  const entree = [a, b, c, d, e];
  assert.deepEqual(trierMatchs(entree).map((m) => m.id), [c, d, e, a, b].map((m) => m.id));
  assert.deepEqual(entree, [a, b, c, d, e], "l'entrée n'est pas modifiée");
  assert.deepEqual(grouperParJour(trierMatchs(entree)).map((g) => [g.jour, g.matchs.length]), [["2026-10-09", 1], ["2026-10-10", 4]]);
});

test("date sous l'heure de la carte : « ven. 9 oct. », jamais numérique", () => {
  assert.equal(dateCarte("2026-10-09"), "ven. 9 oct.");
  assert.equal(dateCarte("2026-11-01"), "dim. 1er nov.");
  assert.equal(dateCarte("2026-12-31"), "jeu. 31 déc.");
  assert.equal(dateCarte(null), "");
});
