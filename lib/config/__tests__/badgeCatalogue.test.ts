/* Suite — lib/config/badgeCatalogue.ts.

   Ne couvre que des fonctions PURES ; loadBadgeCatalogue n'est pas appelé
   (le client Supabase est stubé par le hook d'alias, comme pour grilles).

   Le jeu d'essai reproduit des lignes RÉELLES de public.badges et
   public.badge_sports, relevées le 2026-08-25. Tester un catalogue inventé
   ne dirait rien du comportement en production.

   Lancement (le glob de `npm test` ne couvre que lib/evaluations) :
     node --experimental-strip-types \
       --import ./lib/evaluations/__tests__/register-alias.mjs \
       --test "lib/config/__tests__/*.test.ts"
*/

import test from "node:test";
import assert from "node:assert/strict";
import {
  sectionsPourSport, badgesPourSport, compter, peutAjouter, estPlafonnee,
  contexteComplet, entreesIncompletes, placeholderContexte,
  PLAFOND_PLAFONNES,
  type BadgeCatalogue, type BadgeCatalogueEntry,
} from "@/lib/config/badgeCatalogue";

const FB = "4b859bf1-5832-4258-897c-e094062926af"; // Football
const BB = "5dd6a7c8-2aa4-4b0e-a150-4ac77255f492"; // Basketball
const HK = "119362e8-7b98-47fb-84da-c9ce10fbda2a"; // Hockey

const mk = (
  code: string, famille: BadgeCatalogueEntry["famille"], ordre: number,
  sportIds: string[] = [], contexteForme: BadgeCatalogueEntry["contexteForme"] = null,
): BadgeCatalogueEntry => ({
  code, libelle: code, famille, ordre, actif: true,
  requiertContexte: contexteForme !== null, contexteForme, sportIds,
});

const ALL: BadgeCatalogueEntry[] = [
  mk("capitaine", "universel", 10),
  mk("qi", "universel", 20),
  mk("clutch", "universel", 30),
  mk("costaud", "universel", 40),
  mk("disponibilite", "universel", 50),
  mk("mvp", "honneur", 110, [], "annee"),
  mk("leader-equipe", "honneur", 120, [], "stat_annee"),
  mk("leader-ligue", "honneur", 130, [], "stat_annee"),
  mk("equipe-etoiles", "honneur", 140, [], "annee"),
  mk("nexus-x", "honneur", 150, [], "libre"),
  mk("finisseur", "sport", 210, [BB]),
  mk("verrou", "sport", 240, [BB, FB]),
  mk("rempart", "sport", 310, [FB]),
];

const CAT: BadgeCatalogue = { ok: true, all: ALL, byCode: new Map(ALL.map((b) => [b.code, b])) };

/* ── Filtrage et dégradation ─────────────────────────────────── */

test("sections — ordre universels, sport, honneurs", () => {
  assert.deepEqual(sectionsPourSport(CAT, FB).map((s) => s.famille),
    ["universel", "sport", "honneur"]);
});

test("filtrage — un badge de sport ne fuit jamais vers un sport non rattaché", () => {
  for (const b of badgesPourSport(CAT, BB)) {
    if (b.famille === "sport") assert.ok(b.sportIds.includes(BB), `${b.code} a fui vers Basketball`);
  }
  assert.deepEqual(badgesPourSport(CAT, BB).filter((b) => b.famille === "sport").map((b) => b.code),
    ["finisseur", "verrou"]);
});

test("dégradation — sport null, inconnu ou sans badges : universels + honneurs SEULEMENT", () => {
  for (const sid of [null, "00000000-0000-0000-0000-000000000000", HK]) {
    const s = sectionsPourSport(CAT, sid);
    assert.deepEqual(s.map((x) => x.famille), ["universel", "honneur"],
      `sportId=${sid} ne doit proposer aucun badge de sport`);
    assert.equal(s.reduce((a, x) => a + x.badges.length, 0), 10);
  }
});

test("dégradation — JAMAIS le catalogue entier quand le sport est inconnu", () => {
  assert.ok(badgesPourSport(CAT, null).length < CAT.all.length);
  assert.equal(badgesPourSport(CAT, null).some((b) => b.famille === "sport"), false);
});

test("un badge inactif n'est jamais proposé", () => {
  const inactif = [...ALL.map((b) => b.code === "clutch" ? { ...b, actif: false } : b)];
  const cat: BadgeCatalogue = { ok: true, all: inactif, byCode: new Map(inactif.map((b) => [b.code, b])) };
  assert.equal(badgesPourSport(cat, FB).some((b) => b.code === "clutch"), false);
});

/* ── Plafond ─────────────────────────────────────────────────── */

test("plafond — les honneurs en sont exempts", () => {
  assert.equal(estPlafonnee("universel"), true);
  assert.equal(estPlafonnee("sport"), true);
  assert.equal(estPlafonnee("honneur"), false);
});

test("compteurs — plafonnés et honneurs sont comptés SÉPARÉMENT", () => {
  const v = [
    { code: "capitaine" }, { code: "qi" }, { code: "clutch" },
    { code: "costaud" }, { code: "disponibilite" },           // 5 plafonnés
    { code: "mvp" }, { code: "nexus-x" },                      // 2 honneurs
  ];
  assert.deepEqual(compter(v, CAT), { plafonnes: 5, honneurs: 2 });
});

test("plafond — au 6e plafonné on bloque, au 6e honneur jamais", () => {
  const cinq = ["capitaine", "qi", "clutch", "costaud", "disponibilite"].map((code) => ({ code }));
  const c = compter(cinq, CAT);
  assert.equal(c.plafonnes, PLAFOND_PLAFONNES);
  assert.equal(peutAjouter("sport", c), false, "un 6e badge de sport doit être refusé");
  assert.equal(peutAjouter("universel", c), false);
  assert.equal(peutAjouter("honneur", c), true, "un honneur ne doit JAMAIS être bloqué par le plafond");
});

test("compteurs — un code hors catalogue ne compte pour rien", () => {
  assert.deepEqual(compter([{ code: "progression" }], CAT), { plafonnes: 0, honneurs: 0 });
});

/* ── Contexte : trois formes ─────────────────────────────────── */


test("complétude — un honneur sans contexte est incomplet, un badge sans exigence est complet", () => {
  const mvp = CAT.byCode.get("mvp")!;
  const cap = CAT.byCode.get("capitaine")!;
  assert.equal(contexteComplet(mvp, null), false);
  assert.equal(contexteComplet(mvp, "2026"), true);
  assert.equal(contexteComplet(cap, null), true);
});

test("entreesIncompletes — liste exactement ce qui bloque l'enregistrement", () => {
  const v = [{ code: "capitaine" }, { code: "mvp" }, { code: "nexus-x", contexte: "Titre" }];
  assert.deepEqual(entreesIncompletes(v, CAT).map((e) => e.code), ["mvp"]);
});

/* ── Années ──────────────────────────────────────────────────── */


/* ── Contexte libre ─────────────────────────────────────────────
   Les assertions qui REFUSAIENT « saison 2026 » et « 26 » ont été
   retirées : la forme du contexte n'est plus contrainte. Ces badges
   servent à mettre en valeur, pas à être triés — donc rien à comparer,
   donc rien à normaliser. contexte_forme ne choisit plus que le
   placeholder.
─────────────────────────────────────────────────────────────── */

test("contexte — toute chaîne non vide suffit, quelle que soit la forme", () => {
  const mvp = CAT.byCode.get("mvp")!;          // forme 'annee'
  const le = CAT.byCode.get("leader-equipe")!; // forme 'stat_annee'
  for (const brut of ["2026", "saison 2026", "26", "2025-26", "Plaqués · 2026", "Plaqués"]) {
    assert.equal(contexteComplet(mvp, brut), true, `mvp / ${brut}`);
    assert.equal(contexteComplet(le, brut), true, `leader-equipe / ${brut}`);
  }
});

test("contexte — vide, blanc et null restent refusés quand le badge l'exige", () => {
  const mvp = CAT.byCode.get("mvp")!;
  assert.equal(contexteComplet(mvp, null), false);
  assert.equal(contexteComplet(mvp, ""), false);
  assert.equal(contexteComplet(mvp, "   "), false);
});

test("contexte — un badge qui n'en exige pas passe toujours", () => {
  assert.equal(contexteComplet(CAT.byCode.get("capitaine")!, null), true);
});

test("placeholder — une suggestion par forme, jamais une contrainte", () => {
  assert.equal(placeholderContexte("stat_annee"), "ex. Plaqués · 2026");
  assert.equal(placeholderContexte("annee"), "ex. 2026");
  assert.equal(placeholderContexte("libre"), "Titre de la distinction");
  // Forme absente au catalogue : on retombe sur le libellé le plus neutre.
  assert.equal(placeholderContexte(null), "Titre de la distinction");
});
