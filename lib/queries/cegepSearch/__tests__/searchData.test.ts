/* ═══════════════════════════════════════════════════════════════
   « Trouver mon cégep » — regroupement des équipes et saisie de programme.
   Les cas reprennent les données RÉELLES relevées le 2026-09-22 :
   Chicoutimi / Chicoutimi 2 (même sport, même division, même genre),
   Notre-Dame Bleu / Jaune (sans division), et les libellés
   « DEC Techniques policières » / « Techniques policières » d'un même
   programme canonique (310.A0).
   ═══════════════════════════════════════════════════════════════ */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  equipesParSport,
  trouverProgramme,
  type SearchData,
  type TeamBadge,
} from "@/lib/queries/cegepSearch/searchData";
import { norm } from "@/lib/queries/cegepSearch/scoring";

const eq = (sport: string, division: string | null, gender: string | null, name: string): TeamBadge =>
  ({ sport, division, gender, name });

test("une ligne par sport, divisions et genres en détail, triés", () => {
  const lignes = equipesParSport([
    eq("Basketball", "D2", "Masculin", "Titans"),
    eq("Volleyball", "D1", "Féminin", "Titans"),
    eq("Basketball", "D1", "Féminin", "Titans"),
    eq("Basketball", "D1", "Masculin", "Titans"),
  ]);
  assert.deepEqual(lignes, [
    { sport: "Basketball", details: ["D1 · Féminin", "D1 · Masculin", "D2 · Masculin"] },
    { sport: "Volleyball", details: ["D1 · Féminin"] },
  ]);
});

test("le nom d'équipe n'apparaît que si deux lignes restent identiques", () => {
  const [volley] = equipesParSport([
    eq("Volleyball", "D3", "Féminin", "Chicoutimi 2"),
    eq("Volleyball", "D3", "Féminin", "Chicoutimi"),
    eq("Volleyball", "D2", "Masculin", "Chicoutimi"),
  ]);
  assert.deepEqual(volley.details, ["D2 · Masculin", "D3 · Féminin (Chicoutimi 2)", "D3 · Féminin (Chicoutimi)"]);
});

test("sans division : le genre seul, puis le nom en cas d'égalité", () => {
  const [rugby] = equipesParSport([
    eq("Rugby", null, "Féminin", "Notre-Dame Bleu"),
    eq("Rugby", null, "Féminin", "Notre-Dame Jaune"),
  ]);
  assert.deepEqual(rugby.details, ["Féminin (Notre-Dame Bleu)", "Féminin (Notre-Dame Jaune)"]);
});

test("ni division ni genre : aucun détail, jamais une chaîne vide", () => {
  const [l] = equipesParSport([eq("Ultimate frisbee", null, null, "X")]);
  assert.deepEqual(l.details, []);
});

const donnees = {
  cegeps: [],
  catalogueProgrammes: [
    { id: "p-police", nom: "Techniques policières" },
    { id: "p-nature", nom: "Sciences de la nature" },
  ],
  libellesProgrammes: [
    { libelle: "DEC Techniques policières", id: "p-police" },
    { libelle: "DecPLUS en sciences de la nature", id: "p-nature" },
  ],
  regions: [],
  sports: [],
  postesEnDemande: new Set<string>(),
  viewer: null,
} satisfies SearchData;

test("saisie libre : le nom canonique d'abord", () => {
  assert.equal(trouverProgramme(donnees, norm("policières"), norm)?.id, "p-police");
});

test("saisie libre : un libellé d'école ramène à son programme canonique", () => {
  assert.equal(trouverProgramme(donnees, norm("dec techniques polic"), norm)?.id, "p-police");
  assert.equal(trouverProgramme(donnees, norm("decplus"), norm)?.nom, "Sciences de la nature");
});

test("saisie libre : rien ne correspond → null", () => {
  assert.equal(trouverProgramme(donnees, norm("astrophysique"), norm), null);
  assert.equal(trouverProgramme(donnees, "", norm), null);
});
