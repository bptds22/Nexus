/* Retour d'une fiche vers la page d'origine (BP 2026-10-19). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { estFiche, lireRetourFiche, noterPage } from "@/lib/navigation/retourFiche";

const faux = () => { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } }; };

test("une fiche n'est jamais notée ; la page d'avant l'est", () => {
  const s = faux();
  noterPage("/recruteur/pipeline/", s);
  noterPage("/recruteur/athletes/abc-123/", s);
  assert.equal(lireRetourFiche("/recruteur", "/recruteur/recherche", s), "/recruteur/pipeline/");
  assert.equal(estFiche("/partenaire/athletes/x"), true);
  assert.equal(estFiche("/partenaire/athletes/"), false, "la recherche partenaire n'est pas une fiche");
});

test("une page d'un autre espace donne le défaut", () => {
  const s = faux();
  noterPage("/partenaire/telechargements/", s);
  assert.equal(lireRetourFiche("/recruteur", "/recruteur/recherche", s), "/recruteur/recherche");
  assert.equal(lireRetourFiche("/partenaire", "/partenaire/athletes", s), "/partenaire/telechargements/");
  noterPage("/recruteur/game-on/?x=1", s);
  assert.equal(lireRetourFiche("/recruteur", "/recruteur/recherche", s), "/recruteur/game-on/?x=1");
});

test("recherche d'école : « Polyvalente Saint-Georges », « Poly St-Georges », « saint georges »", async () => {
  const { cleEtablissement, correspondEtablissement } = await import("@/lib/cartes/carteProspect");
  const cle = cleEtablissement("Polyvalente de Saint-Georges Saint-Georges");
  assert.equal(correspondEtablissement(cle, "Polyvalente Saint-Georges"), true);
  assert.equal(correspondEtablissement(cle, "Poly St-Georges"), true);
  assert.equal(correspondEtablissement(cle, "saint georges"), true);
  assert.equal(correspondEtablissement(cle, "Polyvalente Sainte-Marie"), false);
  assert.equal(correspondEtablissement(cleEtablissement("École Georges-Vanier Laval"), "ecole georges vanier"), true);
});
