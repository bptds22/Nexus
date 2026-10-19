/* Dépistage — joueur déjà connu pendant le match (BP 2026-10-19). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { avecPasLui, carteJumelle, connusDuCote, joueurConnu, nomCourt, prenomDe, nouvelleSeance, type AthleteCandidat, type CarteCandidate } from "@/lib/gameOn/gameOn";

const carte = (id: string, numero: string | null, teamId: string | null, prenom = "Marc", nom = "Tremblay"): CarteCandidate =>
  ({ id, prenom, nom, numero, teamId, equipe: "Cougars" });
const athlete = (id: string, numero: string | null, cote: "A" | "B"): AthleteCandidat =>
  ({ id, prenom: "Léo", nom: "Gagnon", numero, cote });

test("la carte de la même équipe au même numéro est reconnue", () => {
  const c = joueurConnu({ cote: "A", numero: "16" }, [], [carte("c1", "16", "t-A"), carte("c2", "16", "t-Z")], "t-A");
  assert.equal(c?.type, "carte");
  assert.equal(c?.id, "c1");
  assert.equal(c?.nom, "Marc Tremblay");
});

test("l'athlète Nexus du bon côté passe avant la carte", () => {
  const c = joueurConnu({ cote: "A", numero: "16" }, [athlete("a1", "16", "A")], [carte("c1", "16", "t-A")], "t-A");
  assert.equal(c?.type, "athlete");
  assert.equal(c?.id, "a1");
  assert.equal(joueurConnu({ cote: "B", numero: "16" }, [athlete("a1", "16", "A")], [], "t-B"), null);
});

test("pas de numéro, autre équipe, match sans équipe ou deux cartes au même numéro : personne", () => {
  assert.equal(joueurConnu({ cote: "A", numero: null }, [], [carte("c1", "16", "t-A")], "t-A"), null);
  assert.equal(joueurConnu({ cote: "A", numero: "16" }, [], [carte("c1", "16", "t-Z")], "t-A"), null);
  assert.equal(joueurConnu({ cote: "A", numero: "16" }, [], [carte("c1", "16", "t-A")], null), null);
  assert.equal(joueurConnu({ cote: "A", numero: "16" }, [], [carte("c1", "16", "t-A"), carte("c2", "16", "t-A")], "t-A"), null);
  assert.equal(joueurConnu({ cote: "A", numero: "7" }, [], [carte("c1", "07", "t-A")], "t-A"), null);
});

test("« Pas lui » écarte le reconnu, et la carte reprend si c'était l'athlète", () => {
  const cartes = [carte("c1", "16", "t-A")];
  assert.equal(joueurConnu({ cote: "A", numero: "16" }, [], cartes, "t-A", "c1"), null);
  assert.equal(joueurConnu({ cote: "A", numero: "16" }, [athlete("a1", "16", "A")], cartes, "t-A", "a1")?.id, "c1");
});

test("avecPasLui retient et rétablit, sur la séance", () => {
  const e = nouvelleSeance("s1", { equipeA: "Cougars", equipeB: "Titans" });
  const e1 = avecPasLui(e, "A|#16", "c1");
  assert.deepEqual(e1.seance.pasLui, { "A|#16": "c1" });
  assert.deepEqual(avecPasLui(e1, "A|#16", null).seance.pasLui, {});
});

test("nomCourt", () => {
  assert.equal(nomCourt("Marc Tremblay"), "Marc T.");
  assert.equal(nomCourt("Marc"), "Marc");
  assert.equal(nomCourt("  Jean de la Fontaine "), "Jean D.");
});

test("dès le début : les connus du côté, sans ceux déjà notés ni les écartés", () => {
  const athletes = [athlete("a1", "9", "A"), athlete("a2", "3", "B")];
  const cartes = [carte("c1", "16", "t-A"), carte("c2", "22", "t-A", "Luc", "Roy"), carte("c3", "5", "t-Z"), carte("c4", null, "t-A")];
  const r = connusDuCote("A", athletes, cartes, "t-A", new Set(["22"]));
  assert.deepEqual(r.map((x) => `${x.numero}:${x.connu.id}`), ["9:a1", "16:c1"]);
  assert.deepEqual(connusDuCote("A", athletes, cartes, "t-A", new Set(), { "A|#16": "c1" }).map((x) => x.numero), ["9", "22"]);
  assert.equal(prenomDe({ nom: "Marc Tremblay" }), "Marc");
  assert.equal(prenomDe(null), null);
});

test("peut-être le même joueur : un athlète Nexus reconnu ET une seule carte de l'équipe au même numéro", () => {
  const cartes = [carte("c1", "16", "t-A"), carte("c2", "16", "t-Z")];
  const athleteConnu = { type: "athlete" as const, id: "a1" };
  assert.equal(carteJumelle({ cote: "A", numero: "16" }, athleteConnu, cartes, "t-A")?.id, "c1");
  assert.equal(carteJumelle({ cote: "A", numero: "16" }, { type: "carte", id: "c1" }, cartes, "t-A"), null, "la carte est déjà le joueur reconnu");
  assert.equal(carteJumelle({ cote: "A", numero: "9" }, athleteConnu, cartes, "t-A"), null);
  assert.equal(carteJumelle({ cote: "A", numero: "16" }, athleteConnu, [...cartes, carte("c3", "16", "t-A")], "t-A"), null, "deux cartes : on ne choisit pas");
});

test("le stock local est rangé PAR COMPTE : un autre compte ne voit rien", async () => {
  const { cleStock, ecrireStock, lireStock } = await import("@/lib/gameOn/gameOn");
  const m = new Map<string, string>();
  const s = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); } };
  const e = nouvelleSeance("s1", { equipeA: "Cougars" });
  ecrireStock(s, { seances: { s1: e }, active: "s1" }, cleStock("recruteur"));
  assert.equal(lireStock(s, cleStock("recruteur")).active, "s1");
  assert.deepEqual(lireStock(s, cleStock("partenaire")), { seances: {}, active: null });
  assert.notEqual(cleStock("recruteur"), cleStock("partenaire"));
});
