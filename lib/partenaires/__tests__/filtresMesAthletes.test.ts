/* « Mes athlètes » du partenaire : recherche (nom, école/club, position) et
   filtre « Distinctions » à choix multiple, combinés (2026-10-16). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { BadgeMonAthlete, MonAthlete } from "@/lib/partenaires/mesAthletes";
import {
  basculerDistinction,
  cleDistinction,
  elaguerDistinctions,
  filtrerMesAthletes,
  filtresActifs,
  optionsDistinctions,
  resumeDistinctions,
  toutesLesDistinctions,
} from "@/lib/partenaires/filtresMesAthletes";

// Fins de ligne normalisées : une extraction Windows (autocrlf) rend des CRLF.
const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

const badge = (ref: string, libelle: string, nexus: boolean): BadgeMonAthlete => ({
  attributionId: `att-${ref}-${Math.random()}`, badgeRef: ref, libelle, nexus,
  code: nexus ? ref : null, iconePath: nexus ? null : `p/${ref}.png`, masque: false, le: "2026-10-10",
});
const athlete = (id: string, prenom: string, nom: string, ecole: string | null, poste: string | null, posteAbr: string | null, badges: BadgeMonAthlete[]): MonAthlete => ({
  athleteId: id, prenom, nom, sport: "Football", ecole, poste, posteAbr,
  evaluationId: null, coteGlobale: null, evalueeLe: null, badges, derniereAction: null,
});

const ESPRIT = badge("pb-1", "Esprit sportif", false);
const VITESSE = badge("vitesse", "Vitesse", true);
const LISTE = [
  athlete("1", "Félix", "Gauthier", "École secondaire Saint-Jean-Eudes", "Botteur", "K", [ESPRIT, VITESSE]),
  athlete("2", "Léa", "Côté", "Club Les Élans", "Quart-arrière", "QB", [badge("vitesse", "Vitesse", true)]),
  athlete("3", "Noé", "Tremblay", "Collège Notre-Dame", "Receveur", "WR", []),
];
const ids = (l: MonAthlete[]) => l.map((a) => a.athleteId);
const f = (texte: string, distinctions: string[] = []) => ({ texte, distinctions: new Set(distinctions) });

test("recherche : par mots, accents et casse ignorés, sur nom, école/club et position", () => {
  assert.deepEqual(ids(filtrerMesAthletes(LISTE, f(""))), ["1", "2", "3"]);
  assert.deepEqual(ids(filtrerMesAthletes(LISTE, f("felix"))), ["1"]);
  assert.deepEqual(ids(filtrerMesAthletes(LISTE, f("COTE"))), ["2"]);
  assert.deepEqual(ids(filtrerMesAthletes(LISTE, f("elans"))), ["2"], "un club se trouve comme une école");
  assert.deepEqual(ids(filtrerMesAthletes(LISTE, f("saint-jean"))), ["1"]);
  assert.deepEqual(ids(filtrerMesAthletes(LISTE, f("quart"))), ["2"], "position, nom complet");
  assert.deepEqual(ids(filtrerMesAthletes(LISTE, f("wr"))), ["3"], "position, abréviation");
  assert.deepEqual(ids(filtrerMesAthletes(LISTE, f("  lea   elans "))), ["2"], "chaque mot doit trouver un champ");
  assert.deepEqual(ids(filtrerMesAthletes(LISTE, f("lea notre"))), [], "mots dans deux athlètes différents : rien");
});

test("options : badges réellement remis, propres d'abord puis Nexus, dédoublonnés, comptés par athlète", () => {
  const o = optionsDistinctions(LISTE);
  assert.deepEqual(o.map((x) => [x.libelle, x.nexus, x.nbAthletes]), [["Esprit sportif", false, 1], ["Vitesse", true, 2]]);
  assert.deepEqual(o.map((x) => x.cle), ["propre:pb-1", "nexus:vitesse"]);
});

test("Distinctions : au moins un des badges choisis ; vide = inactif ; « Tout » exclut les athlètes sans badge", () => {
  const o = optionsDistinctions(LISTE);
  assert.deepEqual(ids(filtrerMesAthletes(LISTE, f("", ["propre:pb-1"]))), ["1"]);
  assert.deepEqual(ids(filtrerMesAthletes(LISTE, f("", ["nexus:vitesse"]))), ["1", "2"]);
  assert.deepEqual(ids(filtrerMesAthletes(LISTE, { texte: "", distinctions: toutesLesDistinctions(o) })), ["1", "2"]);
  assert.deepEqual(ids(filtrerMesAthletes(LISTE, f("", []))), ["1", "2", "3"], "« Aucun » = filtre inactif");
});

test("les filtres se combinent (ET)", () => {
  assert.deepEqual(ids(filtrerMesAthletes(LISTE, f("lea", ["propre:pb-1"]))), []);
  assert.deepEqual(ids(filtrerMesAthletes(LISTE, f("lea", ["nexus:vitesse"]))), ["2"]);
  assert.equal(filtresActifs(f("", [])), false);
  assert.equal(filtresActifs(f("  ", [])), false);
  assert.equal(filtresActifs(f("x")), true);
  assert.equal(filtresActifs(f("", ["nexus:vitesse"])), true);
});

test("un badge propre et un badge Nexus de même libellé restent deux choix", () => {
  const l = [athlete("9", "A", "B", null, null, null, [badge("x1", "Leader", false), badge("x2", "Leader", true)])];
  assert.equal(optionsDistinctions(l).length, 2);
  assert.notEqual(cleDistinction(l[0].badges[0]), cleDistinction(l[0].badges[1]));
});

test("sans badge_ref (serveur d'avant la migration) : repli sur le libellé, sans planter", () => {
  const b = { ...ESPRIT, badgeRef: null };
  assert.equal(cleDistinction(b), "propre:libelle:esprit sportif");
});

test("bascule, élagage et résumé du bouton", () => {
  const o = optionsDistinctions(LISTE);
  let c = basculerDistinction(new Set(), "nexus:vitesse");
  assert.deepEqual([...c], ["nexus:vitesse"]);
  assert.equal(resumeDistinctions(c, o), "Vitesse");
  c = basculerDistinction(c, "propre:pb-1");
  assert.equal(resumeDistinctions(c, o), "Toutes les distinctions");
  assert.equal(resumeDistinctions(new Set(), o), "Distinctions");
  c = basculerDistinction(c, "nexus:vitesse");
  assert.deepEqual([...c], ["propre:pb-1"]);
  assert.deepEqual([...elaguerDistinctions(new Set(["propre:pb-1", "propre:disparu"]), o)], ["propre:pb-1"]);
  const trois = optionsDistinctions([...LISTE, athlete("4", "Z", "Z", null, null, null, [badge("qi", "QI", true)])]);
  assert.equal(resumeDistinctions(new Set(["nexus:vitesse", "nexus:qi"]), trois), "2 distinctions");
});

test("lib : poste, poste_abr et badge_ref lus depuis partenaire_mes_athletes", () => {
  const src = lire("lib/partenaires/mesAthletes.ts");
  assert.match(src, /poste: \(r\.poste as string \| null\) \?\? null,/);
  assert.match(src, /posteAbr: \(r\.poste_abr as string \| null\) \?\? null,/);
  assert.match(src, /badgeRef: \(b\.badge_ref as string \| null\) \?\? null,/);
});

test("page web : la liste rendue est la liste FILTRÉE, par la logique partagée", () => {
  const page = lire("app/partenaire/mes-athletes/page.tsx");
  assert.match(page, /filtrerMesAthletes\(athletes, \{ texte, distinctions \}\)/);
  assert.match(page, /\{visibles\.map\(\(a\) => \(/);
  assert.doesNotMatch(page, /\{athletes\.map\(/);
  assert.match(page, />Tout<\/button>/);
  assert.match(page, />Aucun<\/button>/);
  assert.match(page, /text-\[16px\] sm:text-\[13px\]/, "champ à 16 px sous sm (zoom iOS)");
});
