import { test } from "node:test";
import assert from "node:assert/strict";
import { optionsSport, choixEffectif, idsRetenus, menuUtile, TOUS, SANS_SPORT } from "@/lib/cegep/filtreSportUnite";

const FOOT = "s-foot", BASK = "s-bask";
const noms = new Map([[FOOT, "Football"], [BASK, "Basketball"]]);
const membres = [
  { id: "a", sport_id: FOOT }, { id: "b", sport_id: FOOT },
  { id: "c", sport_id: BASK }, { id: "d", sport_id: null },
];

test("options : sport de l'admin en tête, compté, puis Sans sport, puis Tous", () => {
  const o = optionsSport(membres, noms, BASK);
  assert.deepEqual(o.map((x) => [x.valeur, x.nb]), [[BASK, 1], [FOOT, 2], [SANS_SPORT, 1], [TOUS, 4]]);
});

test("choix par défaut = le sport de l'admin", () => {
  const o = optionsSport(membres, noms, FOOT);
  assert.equal(choixEffectif(null, o, FOOT), FOOT);
});

test("un choix mémorisé encore offert gagne ; périmé, on retombe sur le sport de l'admin", () => {
  const o = optionsSport(membres, noms, FOOT);
  assert.equal(choixEffectif(BASK, o, FOOT), BASK);
  assert.equal(choixEffectif("s-disparu", o, FOOT), FOOT);
});

test("admin sans sport (ou sport absent du cégep) → Tous", () => {
  const o = optionsSport(membres, noms, null);
  assert.equal(choixEffectif(null, o, null), TOUS);
});

test("ids retenus : par sport, sans sport, et null pour Tous", () => {
  assert.deepEqual([...idsRetenus(membres, FOOT)!].sort(), ["a", "b"]);
  assert.deepEqual([...idsRetenus(membres, SANS_SPORT)!], ["d"]);
  assert.equal(idsRetenus(membres, TOUS), null);
});

test("menu masqué quand un seul groupe existe", () => {
  assert.equal(menuUtile(optionsSport([{ id: "a", sport_id: FOOT }], noms, FOOT)), false);
  assert.equal(menuUtile(optionsSport(membres, noms, FOOT)), true);
  assert.equal(menuUtile(optionsSport([{ id: "a", sport_id: FOOT }, { id: "d", sport_id: null }], noms, FOOT)), true);
});
