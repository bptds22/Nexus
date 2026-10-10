import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classerGroupeCivil } from "@/lib/civil/classementCivil";
import { avecZone, teamDetails } from "@/lib/config/teamLabel";
import { formatTeamLabel } from "@/lib/teams/teamLabel";
import { AGE_OPTIONS, AUCUNE_DIVISION, AUTRE_VALUE, DIVISION_OPTIONS, DIVISION_OPTIONS_AVEC_AUCUNE, divisionChoisie } from "@/lib/config/civilVocab";
import { correspond, trierCandidates } from "@/lib/queries/coach/detectExistingTeam";
import { groupeMatch } from "@/lib/carteMatchs/carteMatchs";
import { titreMatchAgenda } from "@/lib/agenda/ics";

test("la table SQL de correction = le classeur des scrapers (un seul classement)", () => {
  const sql = readFileSync("scripts/civil-zone/1-corriger.sql", "utf8");
  const lignes = [...sql.matchAll(/^\s*\('(LFMM|QBFL|QMFL|QMJFL)', '([^']+)', '([^']+)', '([^']+)', '([^']*)', '([^']*)'\),?$/gm)];
  assert.equal(lignes.length, 14);
  for (const [, ligue, ageAvant, divAvant, categorie, division, zone] of lignes) {
    assert.deepEqual(classerGroupeCivil(ligue, ageAvant, divAvant), { categorie, division, zone }, `${ligue} ${divAvant}`);
  }
});

test("avecZone : la zone suit la division, ou la catégorie sans division", () => {
  assert.deepEqual(avecZone("Atome", "", "Nord"), ["Atome Nord"]);
  assert.deepEqual(avecZone("Pee-Wee AAA", "D1", "Sud"), ["Pee-Wee AAA", "D1", "Sud"]);
  assert.deepEqual(avecZone("Cadet", "D1", ""), ["Cadet", "D1"]);
  assert.deepEqual(avecZone("Bantam AAA", "", ""), ["Bantam AAA"]);
  assert.deepEqual(avecZone("", "", ""), []);
});

test("teamDetails / formatTeamLabel nomment la zone ; deux zones ne se lisent jamais pareil", () => {
  const nord = { sport: "Football", age_group: "Pee-Wee AAA", division: "D1", zone: "Nord", gender: "Masculin" };
  const sud = { ...nord, zone: "Sud" };
  assert.equal(teamDetails(nord), "Football · Pee-Wee AAA · D1 · Nord · Masculin");
  assert.notEqual(teamDetails(nord), teamDetails(sud));
  assert.equal(teamDetails({ sport: "Football", age_group: "Atome", division: "", zone: "Nord" }), "Football · Atome Nord");
  assert.equal(formatTeamLabel("Football", "Atome", "", "Masculin", "Patriotes", "Nord"), "Football · Atome Nord · Masculin");
  // sans zone : inchangé (RSEQ)
  assert.equal(formatTeamLabel("Basketball", "Cadet", "D1", "Féminin", "X"), "Basketball · Cadet · D1 · Féminin");
  assert.equal(teamDetails({ sport: "Basketball", age_group: "Cadet", division: "D1" }), "Basketball · Cadet · D1");
});

test("« Aucune division » : sentinelle jamais écrite, liste mobile inchangée", () => {
  assert.equal(divisionChoisie(AUCUNE_DIVISION, ""), "");
  assert.equal(divisionChoisie(AUTRE_VALUE, "  Élite "), "Élite");
  assert.equal(divisionChoisie("AAA", ""), "AAA");
  assert.equal(DIVISION_OPTIONS_AVEC_AUCUNE[0].value, AUCUNE_DIVISION);
  // l'inscription mobile civile lit DIVISION_OPTIONS avec sa propre résolution :
  // la sentinelle n'y figure pas (elle l'écrirait telle quelle)
  assert.ok(!DIVISION_OPTIONS.some((o) => o.value === AUCUNE_DIVISION));
});

test("les catégories avec calibre sont proposées au coach (sinon il ne retrouve pas son équipe)", () => {
  const ages = AGE_OPTIONS.map((o) => o.value);
  for (const v of ["Moustique AAA", "Pee-Wee AAA", "Bantam AAA", "Midget AAA", "M18 AAA", "Junior Majeur", "Atome", "Midget"]) assert.ok(ages.includes(v), v);
});

test("détection : « Aucune » trouve les groupes sans niveau ; « pas choisi » ne trouve rien", () => {
  const atome = { age_group: "Atome", gender: "Masculin", division: "" };
  const atomeNull = { age_group: "Atome", gender: "Masculin", division: null };
  const p = { ageGroup: "Atome", gender: "masculin", division: AUCUNE_DIVISION };
  assert.ok(correspond(atome, p));
  assert.ok(correspond(atomeNull, p));
  assert.ok(!correspond(atome, { ...p, division: "" }));          // pas encore choisi
  assert.ok(!correspond({ ...atome, division: "AAA" }, p));
  assert.ok(correspond({ age_group: "Bantam", gender: "Masculin", division: "D1" }, { ageGroup: "Bantam", gender: "Masculin", division: "Division 1" }));
});

test("plusieurs candidates : celle qui porte le nom saisi passe en tête", () => {
  const rows = [{ name: "Diablos Blanc" }, { name: "Diablos Noir" }];
  assert.deepEqual(trierCandidates(rows, "diablos noir").map((r) => r.name), ["Diablos Noir", "Diablos Blanc"]);
  assert.deepEqual(trierCandidates(rows, "").map((r) => r.name), ["Diablos Blanc", "Diablos Noir"]);
  assert.deepEqual(trierCandidates(rows, "Autre").map((r) => r.name), ["Diablos Blanc", "Diablos Noir"]);
});

test("carte et agenda nomment le groupe du match, zone comprise", () => {
  assert.equal(groupeMatch({ categorie: "Atome", division: "", zone: "Nord" }), "Atome Nord");
  assert.equal(groupeMatch({ categorie: "Pee-Wee AAA", division: "D1", zone: "Sud" }), "Pee-Wee AAA · Division 1 · Sud");
  assert.equal(groupeMatch({ categorie: "Junior Majeur", division: "", zone: "" }), "Junior Majeur");
  assert.equal(groupeMatch({ categorie: "Benjamin", division: "D4", zone: null }), "Benjamin · Division 4");
  assert.equal(groupeMatch({ categorie: null, division: null }), "");
  assert.equal(titreMatchAgenda({ domicile: "Patriotes", visiteur: "Rhinos", categorie: "Atome", division: null, zone: "Nord" }),
    "Match — Patriotes vs Rhinos · Atome Nord");
  assert.equal(titreMatchAgenda({ domicile: "A", visiteur: "B" }), "Match — A vs B");
});
