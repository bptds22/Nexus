/* Suite — lib/config/team-taxonomy.ts.

   Module 100 % PUR : aucun client Supabase, aucun stub nécessaire.

   LE JEU D'ESSAI EST RÉEL. Chaque valeur ci-dessous a été relevée en prod le
   2026-09-05 (projet nrloizyemulbhujrqhgx) — les divisions D1..D4 et leurs
   variantes civiles, les ligues RSEQ / LFMM / QMFL, le `''` de
   `teams.division`, les 256 descripteurs longs du pont. Tester une taxonomie
   inventée ne dirait rien du comportement en production, et c'est justement
   la production qui est tordue.

   Lancement (le glob de `npm test` ne couvre que lib/evaluations) :
     node --experimental-strip-types \
       --import ./lib/evaluations/__tests__/register-alias.mjs \
       --test "lib/config/__tests__/team-taxonomy.test.ts"
*/

import test from "node:test";
import assert from "node:assert/strict";
import {
  UNSET_VALUE, UNSET_LABEL, RSEQ,
  normalizeDivision, normalizeLeague,
  organisationOf, leagueOf, divisionOf,
  organisationOptions, leagueOptions, divisionOptions,
  matchesOrganisation, matchesLeague, matchesDivision,
  axisDisplay,
  type TaxonomySource,
  type AxisSelection,
} from "@/lib/config/team-taxonomy";

/** Fabrique une source ; tout est vide par défaut, chaque test ne pose que ce
 *  qu'il teste. Le défaut « rien du tout » est le cas le plus fréquent en prod
 *  (33 athlètes sur 86 n'ont aucune équipe). */
const mk = (over: Partial<TaxonomySource> = {}): TaxonomySource => ({
  context: null, schoolType: null,
  teamDivision: null, teamLeague: null, teamIsRseq: false,
  hasTeam: false, teamSchoolType: null,
  ...over,
});

/** Athlete rattache a une equipe d'ECOLE (SECONDAIRE par defaut). */
const avecEquipeScolaire = (over: Partial<TaxonomySource> = {}): TaxonomySource =>
  mk({ hasTeam: true, teamSchoolType: "SECONDAIRE", ...over });

/** Athlete rattache a une equipe de CLUB CIVIL. */
const avecEquipeCivile = (over: Partial<TaxonomySource> = {}): TaxonomySource =>
  mk({ hasTeam: true, teamSchoolType: "LIGUE_CIVILE", ...over });

/* ── normalizeDivision ─────────────────────────────────────────────────────── */

test("normalizeDivision — « Division N » et « DN » sont le même libellé", () => {
  for (const raw of ["D1", "d1", "Division 1", "division 1", "DIVISION 1", "D 1", "  Division   1  "]) {
    assert.equal(normalizeDivision(raw), "D1", `échoue sur ${JSON.stringify(raw)}`);
  }
  assert.equal(normalizeDivision("D4"), "D4");
  assert.equal(normalizeDivision("Division 4"), "D4");
});

test("normalizeDivision — `''` et NULL sont le même trou", () => {
  assert.equal(normalizeDivision(""), null);
  assert.equal(normalizeDivision("   "), null);
  assert.equal(normalizeDivision(null), null);
  assert.equal(normalizeDivision(undefined), null);
});

test("normalizeDivision — les libellés civils passent TELS QUELS", () => {
  // Arbitrage BP : deux vocabulaires assumés, aucune équivalence inventée.
  // « Midget — Division 1 » ne doit surtout PAS devenir « D1 » : le civil
  // fusionne l'âge et la division, le scolaire ne le fait pas.
  for (const raw of [
    "AAA", "AAA Civil — Élite", "Midget — Division 1", "Bantam — Division 2",
    "Pee-Wee AAA — Division 1 Sud", "Atome Nord", "Majeur",
  ]) {
    assert.equal(normalizeDivision(raw), raw);
  }
  assert.equal(normalizeDivision("  Atome   Sud "), "Atome Sud"); // espaces seulement
});

test("normalizeDivision — l'ancre ne mord pas au-delà d'un chiffre isolé", () => {
  assert.equal(normalizeDivision("Division 1 Sud"), "Division 1 Sud");
  assert.equal(normalizeDivision("D12"), "D12");
  assert.equal(normalizeDivision("D0"), "D0");
});

/* ── normalizeLeague ───────────────────────────────────────────────────────── */

test("normalizeLeague — trime et normalise les espaces, sans toucher à la casse", () => {
  assert.equal(normalizeLeague("  LFMM "), "LFMM");
  assert.equal(normalizeLeague("Monterégie "), "Monterégie");
  assert.equal(normalizeLeague("RSEQ  —  Sud-Ouest"), "RSEQ — Sud-Ouest");
  assert.equal(normalizeLeague("Senior"), "Senior"); // n'invente aucune majuscule
  assert.equal(normalizeLeague(""), null);
  assert.equal(normalizeLeague(null), null);
});

/* ── organisationOf ────────────────────────────────────────────────────────── */

test("organisationOf — la déclaration de l'athlète prime", () => {
  assert.equal(organisationOf(mk({ context: "scolaire" })), "scolaire");
  assert.equal(organisationOf(mk({ context: "ligue_civile" })), "ligue_civile");
  // Elle prime MÊME quand le type d'école dirait l'inverse.
  assert.equal(
    organisationOf(mk({ context: "ligue_civile", schoolType: "SECONDAIRE" })),
    "ligue_civile",
  );
});

test("organisationOf — repli sur le type d'école quand le contexte est vide", () => {
  assert.equal(organisationOf(mk({ schoolType: "SECONDAIRE" })), "scolaire");
  assert.equal(organisationOf(mk({ schoolType: "CEGEP" })), "scolaire");
  assert.equal(organisationOf(mk({ schoolType: "LIGUE_CIVILE" })), "ligue_civile");
});

test("organisationOf — « PAS D'ÉCOLE » N'EST PAS « LIGUE CIVILE »", () => {
  // LE test de ce module. Les définitions 2 et 3 relevées dans l'app
  // (partner_athlete_profile.is_civil, recherche partenaire) déclarent civil
  // tout athlète sans school_id — 7 des 18 athlètes à contexte NULL y passent
  // sur la foi d'un champ vide. Ici : null, donc « Non renseigné ».
  assert.equal(organisationOf(mk()), null);
  assert.equal(organisationOf(mk({ teamDivision: "D3" })), null);
});

test("organisationOf — 3e repli : une ligue civile NOMMÉE suffit", () => {
  // Arbitrage BP du 2026-09-06 : une donnée qu'on possède ne s'affiche pas
  // « Non renseigné ». L'athlète LFMM sans contexte ni école du gate Lot 1.
  assert.equal(organisationOf(mk({ teamLeague: "LFMM" })), "ligue_civile");
  assert.equal(organisationOf(mk({ teamLeague: "QMFL" })), "ligue_civile");
  assert.equal(organisationOf(mk({ teamLeague: "M18 AAA" })), "ligue_civile");
});

test("organisationOf — 3e repli : RSEQ N'IMPLIQUE PAS scolaire", () => {
  // Interdit explicitement. RSEQ arrive du texte tapé OU de la clé du pont ;
  // en déduire l'organisation empilerait une inférence sur une inférence.
  assert.equal(organisationOf(mk({ teamLeague: "RSEQ" })), null);
  assert.equal(organisationOf(mk({ teamLeague: "RSEQ — Sud-Ouest" })), null);
  assert.equal(organisationOf(mk({ teamIsRseq: true })), null);
  assert.equal(organisationOf(mk({ teamIsRseq: true, teamLeague: null })), null);
});

test("organisationOf — 4e repli : une équipe de CLUB CIVIL suffit", () => {
  // Symetrie du 3e repli de leagueOf (arbitrage BP du 2026-09-07) : meme
  // source (schools.type de l'EQUIPE), meme principe — une donnee qu'on
  // possede ne s'affiche pas « Non renseigne ». Cas : ni contexte, ni ecole
  // cote athlete, mais une equipe rattachee a un club civil SANS ligue saisie
  // (donc le 3e repli, qui lit la ligue nommee, reste muet).
  assert.equal(organisationOf(avecEquipeCivile()), "ligue_civile");
  assert.equal(
    organisationOf(avecEquipeCivile({ teamDivision: "Midget — Division 1" })),
    "ligue_civile",
  );
  assert.equal(organisationOf(avecEquipeCivile({ teamSchoolType: " ligue_civile " })), "ligue_civile");
});

test("organisationOf — 4e repli : une équipe d'ÉCOLE ne rend PAS « scolaire »", () => {
  // Volontairement asymetrique : seul le cote civil a ete arbitre. L'athlete
  // lit « RSEQ » en Ligue (3e repli de leagueOf) et « Non renseigne » en
  // Organisation. Aucun cas en prod aujourd'hui.
  const equipeEcole = avecEquipeScolaire();
  assert.equal(leagueOf(equipeEcole), RSEQ);
  assert.equal(organisationOf(equipeEcole), null);
});

test("organisationOf — SANS équipe, les deux derniers replis sont muets", () => {
  // Ils lisent l'EQUIPE. Pas d'equipe, rien a lire — on ne devine pas.
  assert.equal(organisationOf(mk()), null);
  assert.equal(organisationOf(mk({ teamSchoolType: "LIGUE_CIVILE" })), null); // hasTeam=false
});

test("organisationOf — l'ordre des replis : chaque cran ne parle que si le précédent se tait", () => {
  // Le contexte bat l'école ET la ligue.
  assert.equal(
    organisationOf(mk({ context: "scolaire", schoolType: "LIGUE_CIVILE", teamLeague: "LFMM" })),
    "scolaire",
  );
  // L'école bat la ligue.
  assert.equal(
    organisationOf(mk({ schoolType: "SECONDAIRE", teamLeague: "LFMM" })),
    "scolaire",
  );
  // La ligue ne parle qu'en dernier.
  assert.equal(organisationOf(mk({ teamLeague: "LFMM" })), "ligue_civile");
});

test("organisationOf — casse et espaces parasites ne cassent rien", () => {
  assert.equal(organisationOf(mk({ context: "  SCOLAIRE " })), "scolaire");
  assert.equal(organisationOf(mk({ schoolType: " ligue_civile " })), "ligue_civile");
  assert.equal(organisationOf(mk({ context: "peu importe", schoolType: "CEGEP" })), "scolaire");
});

/* ── leagueOf — la règle qui rattrape 26 athlètes ──────────────────────────── */

test("leagueOf — une équipe pontée RSEQ est RSEQ même avec `league` VIDE", () => {
  // Les 26 athlètes du diagnostic. Sans cette règle ils tombent dans
  // « Non renseigné » à côté des 15 dont un humain a tapé « RSEQ ».
  assert.equal(leagueOf(mk({ teamIsRseq: true, teamLeague: null })), RSEQ);
  assert.equal(leagueOf(mk({ teamIsRseq: true, teamLeague: "" })), RSEQ);
});

test("leagueOf — les 256 descripteurs longs du pont sont absorbés par la CLÉ, pas par un parseur", () => {
  const descripteurs = [
    "Volleyball C F D2 Nord-Est QCA-EDQ (2026-2027)",
    "Soccer C M D2 Nord-Est QCA-EDQ-SLSJ (A) (2026-2027)",
    "Flag football C F D3 Sud-Ouest A (2026-2027)",
    "Basketball C M D3 Sud-Ouest A (2026-2027)",
  ];
  for (const d of descripteurs) {
    assert.equal(leagueOf(mk({ teamIsRseq: true, teamLeague: d })), RSEQ);
  }
});

test("leagueOf — « RSEQ » tapé à la main, et ses déclinaisons régionales", () => {
  for (const raw of ["RSEQ", "Rseq", "rseq", "RSEQ — Sud-Ouest", "RSEQ — Nord-Est — QCA-EDQ", "RSEQ — A1"]) {
    assert.equal(leagueOf(mk({ teamLeague: raw })), RSEQ, `échoue sur ${JSON.stringify(raw)}`);
  }
});

test("leagueOf — les ligues civiles nommées gardent leur nom", () => {
  assert.equal(leagueOf(mk({ teamLeague: "LFMM" })), "LFMM");
  assert.equal(leagueOf(mk({ teamLeague: "QMFL" })), "QMFL");
  assert.equal(leagueOf(mk({ teamLeague: "M18 AAA" })), "M18 AAA");
  // La frontière de mot protège un nom qui commencerait par les mêmes lettres.
  assert.equal(leagueOf(mk({ teamLeague: "RSEQUOIA" })), "RSEQUOIA");
});

test("leagueOf — sans équipe : inconnue, et surtout PAS déduite", () => {
  // Les 15 athlètes ACTIF sans équipe. Le 3e repli ne doit pas les atteindre :
  // sans équipe il n'y a pas de ligue à déduire, il y en aurait une à INVENTER.
  assert.equal(leagueOf(mk()), null);
  assert.equal(leagueOf(mk({ context: "scolaire", schoolType: "SECONDAIRE" })), null);
  assert.equal(leagueOf(mk({ teamDivision: "D3" })), null); // pas d'équipe malgré la division
});

/* ── leagueOf — 3e repli : équipe d'école sans ligue ⇒ RSEQ ────────────────── */

test("leagueOf — une équipe d'ÉCOLE sans ligue saisie joue en RSEQ", () => {
  // Le cas qui a déclenché l'arbitrage : « Dragons Juvenile », Nexus Secondaire,
  // division « Division 1 », league NULL, aucun rseq_team_id. Le menu Ligue
  // lisait « Non renseigné » alors que l'école ne joue nulle part ailleurs.
  // 0 contre-exemple sur les 8 182 équipes d'école (prod, 2026-09-07).
  assert.equal(leagueOf(avecEquipeScolaire({ teamDivision: "Division 1" })), RSEQ);
  assert.equal(leagueOf(avecEquipeScolaire({ teamDivision: "D3" })), RSEQ);
  assert.equal(leagueOf(avecEquipeScolaire({ teamSchoolType: "CEGEP" })), RSEQ);
  assert.equal(leagueOf(avecEquipeScolaire({ teamSchoolType: " secondaire " })), RSEQ);
});

test("leagueOf — une équipe de CLUB CIVIL sans ligue reste inconnue", () => {
  // Là, la ligue manquante est une VRAIE inconnue : les clubs civils jouent
  // dans des ligues nommées (LFMM, QMFL…) qu'aucune clé ne supplée.
  assert.equal(leagueOf(avecEquipeCivile()), null);
  assert.equal(leagueOf(avecEquipeCivile({ teamDivision: "Midget — Division 1" })), null);
});

test("leagueOf — le 3e repli ne PRÉEMPTE jamais une ligue saisie", () => {
  // Une équipe d'école qui déclare une ligue garde la sienne. Le repli ne parle
  // que dans le silence.
  assert.equal(leagueOf(avecEquipeScolaire({ teamLeague: "LFMM" })), "LFMM");
  assert.equal(leagueOf(avecEquipeScolaire({ teamLeague: "RSEQ — Sud-Ouest" })), RSEQ);
});

test("leagueOf — le 3e repli n'ouvre AUCUNE porte vers organisationOf", () => {
  // L'interdiction symétrique : une ligue RSEQ déduite ne redevient jamais une
  // organisation « scolaire ». Sinon on empilerait inférence sur inférence.
  const equipeEcoleSansRien = avecEquipeScolaire();
  assert.equal(leagueOf(equipeEcoleSansRien), RSEQ);
  assert.equal(organisationOf(equipeEcoleSansRien), null);
});

/* ── divisionOf ────────────────────────────────────────────────────────────── */

test("divisionOf — délègue à normalizeDivision", () => {
  assert.equal(divisionOf(mk({ teamDivision: "Division 1" })), "D1");
  assert.equal(divisionOf(mk({ teamDivision: "Midget — Division 1" })), "Midget — Division 1");
  assert.equal(divisionOf(mk()), null);
});

/* ── Les options ───────────────────────────────────────────────────────────── */

test("organisationOptions — compte, et « Non renseigné » ferme la marche", () => {
  const rows = [
    mk({ context: "scolaire" }), mk({ context: "scolaire" }),
    mk({ context: "ligue_civile" }),
    mk(), mk(),
  ];
  const opts = organisationOptions(rows);
  assert.deepEqual(opts.map((o) => [o.label, o.count]), [
    ["Ligue civile", 1],
    ["Scolaire", 2],
    [UNSET_LABEL, 2],
  ]);
  assert.equal(opts.at(-1)?.value, UNSET_VALUE);
});

test("les options couvrent 100 % des cartes — le compteur « X sur N » se vérifie à l'oeil", () => {
  const rows = [
    mk({ context: "scolaire", teamIsRseq: true, teamDivision: "D3" }),
    mk({ context: "scolaire", teamLeague: "RSEQ", teamDivision: "D1" }),
    mk({ context: "ligue_civile", teamLeague: "LFMM", teamDivision: "Midget — Division 1" }),
    mk(),
  ];
  for (const opts of [organisationOptions(rows), leagueOptions(rows), divisionOptions(rows)]) {
    const total = opts.reduce((n, o) => n + o.count, 0);
    assert.equal(total, rows.length);
  }
});

test("« Non renseigné » n'apparaît QUE s'il y a un trou", () => {
  const pleines = [
    mk({ context: "scolaire", teamIsRseq: true, teamDivision: "D3" }),
    mk({ context: "ligue_civile", teamLeague: "LFMM", teamDivision: "AAA" }),
  ];
  for (const opts of [organisationOptions(pleines), leagueOptions(pleines), divisionOptions(pleines)]) {
    assert.equal(opts.some((o) => o.value === UNSET_VALUE), false);
  }
});

test("leagueOptions — deux orthographes d'une ligue sont UNE option", () => {
  const rows = [
    mk({ teamLeague: "LFMM" }), mk({ teamLeague: "LFMM" }), mk({ teamLeague: "Lfmm" }),
  ];
  const opts = leagueOptions(rows);
  assert.equal(opts.length, 1);
  assert.equal(opts[0].count, 3);
  assert.equal(opts[0].label, "LFMM"); // l'orthographe la plus fréquente
  assert.equal(opts[0].value, "lfmm"); // la clé est casefoldée
});

test("leagueOptions — cocher « Scolaire » ne RETIRE plus LFMM : elle tombe à 0 et se grise", () => {
  /* Changement de règle du 2026-09-09. Avant, l'option disparaissait de la
     liste ; désormais le VOCABULAIRE vient de toute la page et seul le COMPTE
     est cadré. Une option à 0 reste visible, grisée — cacher une option laisse
     croire qu'elle n'existe pas, et un menu qui se vide sous les doigts retire
     à l'utilisateur le moyen de revenir en arrière. */
  const rows = [
    mk({ context: "scolaire", teamIsRseq: true }),
    mk({ context: "scolaire", teamLeague: "RSEQ" }),
    mk({ context: "ligue_civile", teamLeague: "LFMM" }),
    mk({ context: "ligue_civile", teamLeague: "QMFL" }),
  ];
  assert.deepEqual(
    leagueOptions(rows, { org: "scolaire" }).map((o) => [o.label, o.count, o.disabled]),
    [["LFMM", 0, true], ["QMFL", 0, true], [RSEQ, 2, false]],
  );
  assert.deepEqual(
    leagueOptions(rows, { org: "ligue_civile" }).map((o) => [o.label, o.count, o.disabled]),
    [["LFMM", 1, false], ["QMFL", 1, false], [RSEQ, 0, true]],
  );
  // Sans organisation cochée : toutes, toutes actives.
  assert.deepEqual(leagueOptions(rows).map((o) => [o.label, o.disabled]),
    [["LFMM", false], ["QMFL", false], [RSEQ, false]]);
});

test("divisionOptions — le second niveau sépare les deux vocabulaires sans les fusionner", () => {
  const rows = [
    mk({ context: "scolaire", teamDivision: "D3" }),
    mk({ context: "scolaire", teamDivision: "Division 3" }), // même chose, écrite autrement
    mk({ context: "ligue_civile", teamDivision: "Midget — Division 1" }),
  ];
  assert.deepEqual(
    divisionOptions(rows, { org: "scolaire" }).map((o) => [o.label, o.count, o.disabled]),
    [["D3", 2, false], ["Midget — Division 1", 0, true]],
  );
  assert.deepEqual(
    divisionOptions(rows, { org: "ligue_civile" }).map((o) => [o.label, o.count, o.disabled]),
    [["D3", 0, true], ["Midget — Division 1", 1, false]],
  );
});

test("les options ne dépendent pas de l'ordre des cartes", () => {
  // Deux recruteurs, deux tris, la même barre. Le regroupement à la casse près
  // ne doit pas faire dépendre le libellé retenu de l'ordre d'arrivée.
  const rows = [
    mk({ teamLeague: "QMFL" }), mk({ teamLeague: "LFMM" }),
    mk({ teamLeague: "qmfl" }), mk({ teamLeague: "Lfmm" }), mk(),
  ];
  assert.deepEqual(leagueOptions(rows), leagueOptions([...rows].reverse()));
  assert.deepEqual(divisionOptions(rows), divisionOptions([...rows].reverse()));
});

/* ── axisDisplay — actif / pré-rempli / vide ──────────────────────────────── */

test("axisDisplay — un monde unique se LIT au lieu de se choisir", () => {
  // Le directeur pur RSEQ : le menu ne disparait pas, il affiche « RSEQ ».
  const rseqPur = [
    mk({ context: "scolaire", teamIsRseq: true, teamDivision: "D3" }),
    mk({ context: "scolaire", teamLeague: "RSEQ", teamDivision: "D1" }),
  ];
  assert.deepEqual(axisDisplay(organisationOptions(rseqPur)), {
    state: "prefilled", label: "Scolaire",
  });
  assert.deepEqual(axisDisplay(leagueOptions(rseqPur)), {
    state: "prefilled", label: RSEQ,
  });
});

test("axisDisplay — RÉGRESSION : une valeur + « Non renseigné » = menu ACTIF", () => {
  /* LE BUG VU À L'ÉCRAN LE 2026-09-08. Avec « Ligue civile » coché, le menu
     Ligue affichait « LFMM » grisé alors que la population était LFMM + 17
     athlètes sans équipe. Le libellé présentait une ligue comme le monde
     entier, et surtout : les 17 devenaient INFILTRABLES, le menu grisé
     retirant le seul moyen de les isoler.

     Le pré-rempli n'est légitime que si la valeur unique couvre 100 % des
     lignes. Dès qu'il y a un trou, « Non renseigné » est une option cliquable
     et utile — donc il y a bien deux choses à choisir. */
  const avecTrous = [
    mk({ context: "scolaire", teamIsRseq: true }),
    mk({ context: "scolaire" }),
    mk({ context: "scolaire" }),
  ];
  const opts = leagueOptions(avecTrous);
  assert.equal(opts.length, 2); // RSEQ + Non renseigné
  assert.deepEqual(axisDisplay(opts), { state: "active", label: "" });

  // La forme exacte de la capture : 10 LFMM + 17 sans équipe.
  const commeALEcran = [
    ...Array.from({ length: 10 }, () => avecEquipeCivile({ teamLeague: "LFMM" })),
    ...Array.from({ length: 17 }, () => mk({ context: "ligue_civile" })),
  ];
  assert.deepEqual(axisDisplay(leagueOptions(commeALEcran)), { state: "active", label: "" });
  assert.deepEqual(
    leagueOptions(commeALEcran).map((o) => [o.label, o.count]),
    [["LFMM", 10], [UNSET_LABEL, 17]],
  );
});

test("axisDisplay — le pré-rempli exige une couverture de 100 %", () => {
  const total = [
    avecEquipeScolaire({ teamIsRseq: true }),
    avecEquipeScolaire({ teamIsRseq: true }),
  ];
  assert.deepEqual(axisDisplay(leagueOptions(total)), { state: "prefilled", label: RSEQ });

  const presqueTotal = [...total, mk()];
  assert.deepEqual(axisDisplay(leagueOptions(presqueTotal)), { state: "active", label: "" });
});

test("axisDisplay — aucune valeur du tout : menu vide, atténué", () => {
  const sansRien = [mk(), mk()];
  assert.deepEqual(axisDisplay(leagueOptions(sansRien)), {
    state: "empty", label: UNSET_LABEL,
  });
  assert.deepEqual(axisDisplay(organisationOptions(sansRien)), {
    state: "empty", label: UNSET_LABEL,
  });
});

test("axisDisplay — deux mondes rendent le menu actif", () => {
  const mixte = [
    mk({ context: "scolaire", teamIsRseq: true }),
    mk({ context: "ligue_civile", teamLeague: "LFMM" }),
  ];
  assert.deepEqual(axisDisplay(organisationOptions(mixte)), { state: "active", label: "" });
  assert.deepEqual(axisDisplay(leagueOptions(mixte)), { state: "active", label: "" });
});

test("axisDisplay — les TROIS axes suivent la même règle, plus d'asymétrie", () => {
  /* Avant le 2026-09-08, la division comptait « Non renseigné » et les deux
     autres axes non (paramètre `unsetCounts`). Cette asymétrie n'existait que
     pour rattraper la règle d'affichage/masquage d'origine ; elle a disparu
     avec elle. Un seul comportement à retenir, pour les trois menus. */
  const uneValeurEtUnTrou = [
    mk({ context: "scolaire", teamIsRseq: true, teamDivision: "D3" }),
    mk({ context: "scolaire" }),
  ];
  assert.deepEqual(axisDisplay(divisionOptions(uneValeurEtUnTrou)), { state: "active", label: "" });
  assert.deepEqual(axisDisplay(leagueOptions(uneValeurEtUnTrou)), { state: "active", label: "" });
});

test("axisDisplay — cocher une organisation fait LIRE la ligue de ce monde", () => {
  // La liste CADREE est le bon juge ici : le menu ne disparait pas, il informe.
  // Ce qui protege du piege 2b, c'est la purge de la selection cote page.
  const mixte = [
    mk({ context: "scolaire", teamIsRseq: true }),
    mk({ context: "ligue_civile", teamLeague: "LFMM" }),
  ];
  /* 2026-09-09 : le menu reste ACTIF, parce qu'il porte toujours les deux
     ligues — l'une à son compte, l'autre à 0 et grisée. Le « pré-rempli » ne
     survit qu'à une page qui ne connaît QU'UNE valeur (test suivant), pas à un
     cadrage. C'est ce qui empêche un libellé de présenter une ligue comme le
     monde entier alors qu'il en reste une autre à côté. */
  assert.deepEqual(axisDisplay(leagueOptions(mixte, { org: "scolaire" })), {
    state: "active", label: "",
  });
  assert.deepEqual(
    leagueOptions(mixte, { org: "scolaire" }).map((o) => [o.label, o.count, o.disabled]),
    [["LFMM", 0, true], [RSEQ, 1, false]],
  );
  assert.deepEqual(axisDisplay(leagueOptions(mixte)), { state: "active", label: "" });
});

test("axisDisplay — le pre-rempli rend le LIBELLE, pas la cle casefoldee", () => {
  const rows = [mk({ teamLeague: "LFMM" }), mk({ teamLeague: "Lfmm" }), mk({ teamLeague: "LFMM" })];
  assert.deepEqual(axisDisplay(leagueOptions(rows)), { state: "prefilled", label: "LFMM" });
});

/* ── Les prédicats ─────────────────────────────────────────────────────────── */

test("un filtre vide laisse tout passer", () => {
  const row = mk({ context: "scolaire", teamIsRseq: true, teamDivision: "D3" });
  assert.equal(matchesOrganisation(row, ""), true);
  assert.equal(matchesLeague(row, ""), true);
  assert.equal(matchesDivision(row, ""), true);
});

test("« Non renseigné » sélectionne EXACTEMENT les cartes sans valeur", () => {
  const vide = mk();
  const pleine = mk({ context: "scolaire", teamIsRseq: true, teamDivision: "D3" });

  assert.equal(matchesOrganisation(vide, UNSET_VALUE), true);
  assert.equal(matchesOrganisation(pleine, UNSET_VALUE), false);
  assert.equal(matchesLeague(vide, UNSET_VALUE), true);
  assert.equal(matchesLeague(pleine, UNSET_VALUE), false);
  assert.equal(matchesDivision(vide, UNSET_VALUE), true);
  assert.equal(matchesDivision(pleine, UNSET_VALUE), false);
});

test("les prédicats matchent sur la clé casefoldée, pas sur le libellé", () => {
  const row = mk({ teamLeague: "Lfmm", teamDivision: "division 2" });
  assert.equal(matchesLeague(row, "lfmm"), true);
  assert.equal(matchesLeague(row, "LFMM"), true);
  assert.equal(matchesDivision(row, "d2"), true);
  assert.equal(matchesDivision(row, "D2"), true);
  assert.equal(matchesLeague(row, "QMFL"), false);
});

test("un athlète RSEQ à `league` vide est bien atteint par le filtre « RSEQ »", () => {
  // Le bug que la règle évite, vu depuis l'utilisateur.
  const importe = mk({ context: "scolaire", teamIsRseq: true, teamLeague: null });
  const tape = mk({ context: "scolaire", teamLeague: "RSEQ" });
  assert.equal(matchesLeague(importe, RSEQ), true);
  assert.equal(matchesLeague(tape, RSEQ), true);
  assert.equal(matchesLeague(importe, UNSET_VALUE), false);
});

/* ── LA GARDE D'ENTRÉE ───────────────────────────────────────────────────────
   Régression du 2026-09-09 : `organisationOf(undefined)` levait un TypeError
   et faisait tomber toute la recherche recruteur. La source manquait sur
   TOUTES les lignes, pas sur un athlète — cache TanStack persisté en
   sessionStorage, mis en boîte avant que la ligne ne porte `taxonomy`.
   Une source absente doit se ranger en « Non renseigné », pas casser. */

test("une source absente dégrade en « Non renseigné » et ne lève jamais", () => {
  for (const absente of [undefined, null]) {
    assert.equal(organisationOf(absente), null);
    assert.equal(leagueOf(absente), null);
    assert.equal(divisionOf(absente), null);
  }
});

test("sans filtre, un athlète sans taxonomie reste trouvable", () => {
  // Le silence serait pire que le crash : un jeune qui disparaît des
  // résultats sans que personne ne le sache.
  assert.equal(matchesOrganisation(undefined, ""), true);
  assert.equal(matchesLeague(undefined, ""), true);
  assert.equal(matchesDivision(undefined, ""), true);
  // Et il est bien joignable par la sentinelle « Non renseigné ».
  assert.equal(matchesOrganisation(undefined, UNSET_VALUE), true);
  assert.equal(matchesLeague(undefined, UNSET_VALUE), true);
  assert.equal(matchesDivision(undefined, UNSET_VALUE), true);
});

test("les trois listes d'options comptent les sources absentes en « Non renseigné »", () => {
  const rows = [undefined, mk({ context: "scolaire", teamLeague: "RSEQ", teamDivision: "D1" }), null];

  const attendu = { value: UNSET_VALUE, label: UNSET_LABEL, count: 2, disabled: false };
  assert.deepEqual(organisationOptions(rows).at(-1), attendu);
  assert.deepEqual(leagueOptions(rows).at(-1), attendu);
  assert.deepEqual(divisionOptions(rows).at(-1), attendu);
});

/* ── FACETTES DÉPENDANTES ────────────────────────────────────────────────────
   Régression du 2026-09-09, vue en recette : Organisation « Ligue civile (30) »
   + Ligue « LFMM (11) » + Division « Non renseigné (19) » -> ZÉRO résultat. Le
   (19) comptait les civils sans division en IGNORANT LFMM, et aucun athlète
   LFMM n'est sans division. Le compteur promettait, la liste ne livrait pas. */

const CAPTURE = [
  ...Array.from({ length: 3 }, () => mk({ context: "ligue_civile" })),          // civils sans équipe
  ...Array.from({ length: 2 }, () => mk({ context: "ligue_civile", teamLeague: "LFMM", teamDivision: "Midget — Division 1" })),
  mk({ context: "scolaire", teamLeague: "RSEQ", teamDivision: "D1" }),
];

test("la combinaison de la recette ne peut plus se composer : « Non renseigné » est à 0 et grisé", () => {
  const divisions = divisionOptions(CAPTURE, { org: "ligue_civile", league: "lfmm" });
  const trou = divisions.find((o) => o.value === UNSET_VALUE);
  assert.ok(trou, "l'option reste VISIBLE — on ne la cache pas");
  assert.equal(trou.count, 0);
  assert.equal(trou.disabled, true);

  // Et ce qui existe vraiment sous civile+LFMM est bien offert.
  const midget = divisions.find((o) => o.label === "Midget — Division 1");
  assert.equal(midget?.count, 2);
  assert.equal(midget?.disabled, false);
});

test("cocher LFMM fait retomber Division ; la décocher la fait remonter", () => {
  const sansLigue = divisionOptions(CAPTURE, { org: "ligue_civile" });
  assert.equal(sansLigue.find((o) => o.value === UNSET_VALUE)?.count, 3);
  const avecLigue = divisionOptions(CAPTURE, { org: "ligue_civile", league: "lfmm" });
  assert.equal(avecLigue.find((o) => o.value === UNSET_VALUE)?.count, 0);
});

test("INVARIANT — sur les trois axes, le compte d'une option est EXACTEMENT ce que la liste rendrait", () => {
  /* Le garde-fou qui aurait attrapé le bug de recette tout seul : pour chaque
     axe et chaque option, on coche l'option et on compte les lignes qui
     passent les TROIS prédicats. Le menu ne peut plus promettre autre chose. */
  const combinaisons = [
    {}, { org: "ligue_civile" }, { org: "scolaire" },
    { org: "ligue_civile", league: "lfmm" },
    { org: "ligue_civile", division: UNSET_VALUE },
    { league: "lfmm", division: UNSET_VALUE },
    { org: "scolaire", league: "rseq" },
  ];

  const passe = (r: TaxonomySource, sel: AxisSelection) =>
    matchesOrganisation(r, sel.org ?? "")
    && matchesLeague(r, sel.league ?? "")
    && matchesDivision(r, sel.division ?? "");

  for (const base of combinaisons) {
    for (const axe of ["org", "league", "division"] as const) {
      const options = axe === "org" ? organisationOptions(CAPTURE, base)
        : axe === "league" ? leagueOptions(CAPTURE, base)
        : divisionOptions(CAPTURE, base);

      for (const o of options) {
        const sel = { ...base, [axe]: o.value };
        const livre = CAPTURE.filter((r) => passe(r, sel)).length;
        assert.equal(
          o.count, livre,
          `axe ${axe}, option ${o.label}, cadrage ${JSON.stringify(base)} : le menu annonce ${o.count}, la liste livre ${livre}`,
        );
        /* Et rien de choisissable ne mène à une liste vide — SAUF la valeur
           déjà cochée sur cet axe, qu'on ne grise jamais (il faut pouvoir en
           sortir). Cet état n'est pas atteignable au clic : pour y arriver il
           aurait fallu cocher, sur un AUTRE axe, une option qui était elle-même
           grisée. Il n'est ici que parce que la boucle énumère aussi des
           combinaisons que l'écran ne laisse pas composer. */
        const dejaCoche = o.value === (base as Record<string, string | undefined>)[axe];
        if (!o.disabled && !dejaCoche) {
          assert.ok(livre > 0, `option active mais liste vide : ${axe}/${o.label}`);
        }
      }
    }
  }
});
