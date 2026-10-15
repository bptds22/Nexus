/* Suite — lib/teams/teamLabel.ts (règle du libellé d'équipe, bug NLS).

   Jeu d'essai réel : équipes NLS du club « No Limits Showcases » telles qu'en
   prod depuis le 2026-10-14 (nom NLS exact, division '' pour le féminin
   Benjamin/Cadet) et équipe RSEQ nommée comme son école.

   Lancement :
     node --experimental-strip-types \
       --import ./lib/evaluations/__tests__/register-alias.mjs \
       --test "lib/teams/__tests__/teamLabel.test.ts"
*/

import test from "node:test";
import assert from "node:assert/strict";
import {
  libelleEquipe, formatTeamLabel, attributsEquipe, nomEstCeluiDuClub,
  trierEquipes, equipeCorrespond, rangCategorie,
} from "@/lib/teams/teamLabel";

const NLS = "No Limits Showcases";

test("équipe NLS : le nom puis les attributs", () => {
  assert.equal(
    libelleEquipe({ name: "PHEBUS JM", age_group: "Juvénile", division: "Gold", gender: "Masculin", zone: "" }, NLS),
    "PHEBUS JM — Juvénile · Gold · Masculin",
  );
});

test("équipe RSEQ nommée comme son école : pas de nom (casse et accents ignorés)", () => {
  const t = { name: "Collège Notre-Dame", age_group: "Juvénile", division: "D1", gender: "masculin" };
  assert.equal(libelleEquipe(t, "Collège Notre-Dame"), "Juvénile · D1 · Masculin");
  assert.equal(libelleEquipe(t, "COLLEGE NOTRE-DAME"), "Juvénile · D1 · Masculin");
  assert.equal(libelleEquipe({ ...t, name: "  collège  notre-dame " }, "Collège Notre-Dame"), "Juvénile · D1 · Masculin");
  assert.equal(nomEstCeluiDuClub("Collège Notre-Dame", "College notre-dame"), true);
});

test("DALBÉ-VIAU BF et DALBÉ-VIAU (2) : même catégorie, libellés distincts", () => {
  const a = libelleEquipe({ name: "DALBÉ-VIAU BF", age_group: "Benjamin", division: "", gender: "Féminin" }, NLS);
  const b = libelleEquipe({ name: "DALBÉ-VIAU (2)", age_group: "Benjamin", division: "", gender: "Féminin" }, NLS);
  assert.equal(a, "DALBÉ-VIAU BF — Benjamin · Féminin");
  assert.equal(b, "DALBÉ-VIAU (2) — Benjamin · Féminin");
  assert.notEqual(a, b);
});

test("les 107 libellés NLS d'un même club ne se répètent jamais (échantillon des paires piégées)", () => {
  const eqs = [
    { name: "C.S.S. BM", age_group: "Benjamin", division: "Diamond", gender: "Masculin" },
    { name: "C.S.S. BM", age_group: "Benjamin", division: "Gold", gender: "Masculin" },
    { name: "DALBÉ-VIAU (2)", age_group: "Benjamin", division: "", gender: "Féminin" },
    { name: "DALBÉ-VIAU (2)", age_group: "Benjamin", division: "Gold", gender: "Masculin" },
    { name: "CSS CM", age_group: "Cadet", division: "Gold", gender: "Masculin" },
  ];
  const libs = eqs.map((t) => libelleEquipe(t, NLS));
  assert.equal(new Set(libs).size, libs.length);
});

test("champs vides : ils disparaissent, sans séparateur orphelin", () => {
  assert.equal(libelleEquipe({ name: "ARGO ELITE", age_group: "Juvénile", division: null, gender: "" }, NLS), "ARGO ELITE — Juvénile");
  assert.equal(libelleEquipe({ name: "Wildcats", age_group: null, division: "  ", gender: null }, "Club X"), "Wildcats");
  assert.equal(libelleEquipe({ name: "Club X", age_group: null, division: null, gender: null }, "Club X"), "Club X");
  assert.equal(libelleEquipe({ name: "", age_group: "Cadet", division: "", gender: "f" }, "Club X"), "Cadet · Féminin");
  assert.equal(libelleEquipe({ name: null, age_group: null, division: null, gender: null }, "Club X"), "");
});

test("zone : règle actuelle (après la division, ou collée à la catégorie)", () => {
  assert.equal(attributsEquipe({ age_group: "Pee-Wee AAA", division: "D1", zone: "Sud", gender: "M" }), "Pee-Wee AAA · D1 · Sud · Masculin");
  assert.equal(attributsEquipe({ age_group: "Atome", division: "", zone: "Nord", gender: null }), "Atome Nord");
});

test("sport en tête, ligue en fin (listes multi-sports, cartes prospect)", () => {
  assert.equal(
    libelleEquipe({ name: "PHEBUS CF", age_group: "Cadet", division: "", gender: "Féminin" }, NLS, { sport: "Basketball", ligue: NLS }),
    "PHEBUS CF — Basketball · Cadet · Féminin · No Limits Showcases",
  );
  assert.equal(formatTeamLabel("Football", "Juvénile", "D2", "masculin", "Cégep X", null, "Cégep X"), "Football · Juvénile · D2 · Masculin");
});

test("tri : nom, puis catégorie dans l'ordre des âges, puis division, puis genre", () => {
  const t = (name: string, age_group: string, division: string, gender: string) => ({ name, age_group, division, gender });
  const tries = trierEquipes([
    t("PHEBUS JM", "Juvénile", "Gold", "Masculin"),
    t("Collège X", "Juvénile", "D1", "Masculin"),
    t("Collège X", "Benjamin", "D2", "Féminin"),
    t("Collège X", "Cadet", "D1", "Masculin"),
    t("Collège X", "Benjamin", "D1", "Masculin"),
    t("Collège X", "Benjamin", "D1", "Féminin"),
    t("3KBM BM", "Benjamin", "Gold", "Masculin"),
  ]).map((e) => `${e.name}|${e.age_group}|${e.division}|${e.gender}`);
  assert.deepEqual(tries, [
    "3KBM BM|Benjamin|Gold|Masculin",
    "Collège X|Benjamin|D1|Féminin",
    "Collège X|Benjamin|D1|Masculin",
    "Collège X|Benjamin|D2|Féminin",
    "Collège X|Cadet|D1|Masculin",
    "Collège X|Juvénile|D1|Masculin",
    "PHEBUS JM|Juvénile|Gold|Masculin",
  ]);
  assert.ok(rangCategorie("Atome") < rangCategorie("Pee-Wee AAA"));
  assert.ok(rangCategorie("M15") < rangCategorie("M18 AAA"));
  assert.ok(rangCategorie("Juvénile") < rangCategorie("Inconnue"));
});

test("recherche : nom + 4 attributs, genre compris, accents et casse ignorés", () => {
  const jm = { name: "PHEBUS JM", age_group: "Juvénile", division: "Gold", gender: "Masculin" };
  const bf = { name: "DALBÉ-VIAU BF", age_group: "Benjamin", division: "", gender: "Féminin" };
  assert.equal(equipeCorrespond(jm, "phebus jm"), true);
  assert.equal(equipeCorrespond(jm, "juvenile masculin"), true);
  assert.equal(equipeCorrespond(jm, "gold"), true);
  assert.equal(equipeCorrespond(jm, "feminin"), false);
  assert.equal(equipeCorrespond(bf, "dalbe-viau feminin"), true);
  assert.equal(equipeCorrespond({ ...jm, gender: "m" }, "masculin"), true);
  assert.equal(equipeCorrespond(jm, "   "), true);
});
