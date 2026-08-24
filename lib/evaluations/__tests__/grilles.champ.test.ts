/* Suite 4 — TRADUCTION DU CHAMP athlete_suggestions.champ.
   L'app mobile 1.2 est EN MAGASIN et émet des libellés FR. Tant qu'elle y est,
   retirer une entrée de LEGACY_CHAMP_BY_COLUMN casse la saisie de tous ses
   utilisateurs iOS et Android. Ces assertions sont là pour l'empêcher. */

import test from "node:test";
import assert from "node:assert/strict";
import { champToColumn, isRatingChamp, LEGACY_CHAMP_BY_COLUMN,
         CHAMP_COTE_GLOBALE, TRAIT_COLUMNS } from "@/lib/evaluations/grilles";

/* Les 14 littéraux du CASE de apply_approved_suggestion, recopiés depuis le
   corps DÉPLOYÉ (pg_get_functiondef, 2026-08-24). Toute divergence ici est une
   régression côté base, pas côté test. */
const CHAMPS_DU_TRIGGER = [
  "Leadership", "Discipline", "Coachabilité", "Intelligence de jeu",
  "Compétitivité", "Esprit d'équipe", "Résilience", "Attitude / Mentalité",
  "Vitesse / Explosivité", "Force / Puissance", "Endurance cardio",
  "Agilité / Coordination", "Vision du jeu", "Sens tactique",
];

test("les 14 libellés FR du trigger sont tous reconnus", () => {
  assert.deepEqual(CHAMPS_DU_TRIGGER.filter((l) => champToColumn(l) === null), []);
});

test("LEGACY couvre exactement les 14 colonnes", () => {
  assert.deepEqual(Object.keys(LEGACY_CHAMP_BY_COLUMN).sort(), [...TRAIT_COLUMNS].sort());
});

test("les libellés LEGACY sont ceux du trigger, à l'octet près", () => {
  assert.deepEqual(Object.values(LEGACY_CHAMP_BY_COLUMN).sort(), [...CHAMPS_DU_TRIGGER].sort());
});

test("écriture — les 14 colonnes se traduisent en elles-mêmes", () => {
  assert.deepEqual(TRAIT_COLUMNS.filter((c) => champToColumn(c) !== c), []);
});

test("aller-retour colonne → libellé → colonne", () => {
  assert.deepEqual(TRAIT_COLUMNS.filter((c) => champToColumn(LEGACY_CHAMP_BY_COLUMN[c]) !== c), []);
});

test("étoiles — les 14 traits, dans les DEUX espaces de clés", () => {
  assert.deepEqual(TRAIT_COLUMNS.filter((c) => !isRatingChamp(c)), []);
  assert.deepEqual(CHAMPS_DU_TRIGGER.filter((l) => !isRatingChamp(l)), []);
});

test("RÉGRESSION — les 6 traits de juin 2026 rendent des étoiles", () => {
  // Ils étaient absents de STAR_FIELDS et des CHAMP_LABEL_MAP : affichés en
  // texte brut chez le coach.
  const six = ["vitesse_explosivite", "force_puissance", "endurance_cardio",
               "agilite_coordination", "vision_du_jeu", "sens_tactique"];
  assert.ok(six.every(isRatingChamp));
  assert.ok(six.map((c) => LEGACY_CHAMP_BY_COLUMN[c]).every(isRatingChamp));
});

test("la cote globale est notée, mais n'est pas un trait", () => {
  assert.equal(isRatingChamp(CHAMP_COTE_GLOBALE), true);
  assert.equal(champToColumn(CHAMP_COTE_GLOBALE), null);
});

test("les champs non-traits ne sont ni traduits ni étoilés", () => {
  const autres = ["Taille", "Poids", "Distinctions", "Distinction personnalisée",
                  "Main dominante", "Sport principal", "Position"];
  assert.deepEqual(autres.filter(champToColumn), []);
  assert.deepEqual(autres.filter(isRatingChamp), []);
});

test("entrées vides ou inconnues", () => {
  assert.deepEqual([champToColumn(null), champToColumn(undefined),
                    champToColumn(""), champToColumn("zzz")], [null, null, null, null]);
  assert.equal(isRatingChamp(null), false);
});

test("faux ami — « Endurance / Cardio » n'est PAS reconnu", () => {
  // Orthographe qui traînait dans notify_athlete_suggestion_result et ne
  // correspondait à aucun champ jamais émis. La reconnaître masquerait le bug.
  assert.equal(champToColumn("Endurance / Cardio"), null);
});
