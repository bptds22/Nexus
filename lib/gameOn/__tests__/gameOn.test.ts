/* Game On (mode match) — logique pure : file locale, regroupement, remappage, suggestions. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ajouterNote, cleJoueur, ecrireStock, fonctionAbsente, fusionnerNotes, grouperParJoueur, libelleJoueur,
  lireStock, lots, marquerEnvoyees, messageErreur, notesEnAttente, noteValide, nouvelleSeance, numeroValide,
  pastillesCote, remapperSeance, resumeEnvoi, suggestionsCartes, texteRecopie, versEnvoi,
  type NoteAffichee, type Stockage, CLE_STOCK,
} from "@/lib/gameOn/gameOn";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

function fauxStockage(): Stockage & { m: Map<string, string> } {
  const m = new Map<string, string>();
  return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); } };
}

const note = (id: string, cote: "A" | "B", numero: string | null, noteLe: string, extra: Partial<NoteAffichee> = {}): NoteAffichee => ({
  id, cote, numero, prenom: null, texte: "x", etiquettes: [], noteLe, auteurNom: null, deMoi: true, enAttente: false, ...extra,
});

test("stock local : lecture tolérante, écriture qui ne plante jamais", () => {
  const s = fauxStockage();
  assert.deepEqual(lireStock(s), { seances: {}, active: null });
  s.m.set(CLE_STOCK, "{pas du json");
  assert.deepEqual(lireStock(s), { seances: {}, active: null });
  const e = nouvelleSeance("s1", { equipeA: " Cougars ", equipeB: "", lieu: "Aréna" }, new Date("2026-10-18T19:00:00Z"));
  assert.equal(ecrireStock(s, { seances: { s1: e }, active: "s1" }), true);
  assert.equal(lireStock(s).seances.s1.seance.equipeA, "Cougars");
  assert.equal(lireStock(s).seances.s1.seance.equipeB, null);
  const plein: Stockage = { getItem: () => null, setItem: () => { throw new Error("QuotaExceeded"); } };
  assert.equal(ecrireStock(plein, { seances: {}, active: null }), false);
  assert.equal(ecrireStock(null, { seances: {}, active: null }), false);
});

test("notes : validation, nettoyage, file d'attente, lots", () => {
  assert.equal(numeroValide(" 16 "), "16");
  assert.equal(numeroValide("1234"), null);
  assert.equal(numeroValide("A1"), null);
  assert.equal(noteValide({ numero: "16", prenom: null, texte: "", etiquettes: ["Bras"] }), true);
  assert.equal(noteValide({ numero: null, prenom: " ", texte: "bon", etiquettes: [] }), false);
  assert.equal(noteValide({ numero: "16", prenom: null, texte: "  ", etiquettes: [] }), false);

  let e = nouvelleSeance("s1", { equipeA: "A" });
  e = ajouterNote(e, { id: "n1", cote: "A", numero: "16", prenom: " Jean ", texte: " bon bras ", etiquettes: ["Bras"], noteLe: "2026-10-18T19:00:00Z" });
  e = ajouterNote(e, { id: "n2", cote: "B", numero: "1", prenom: null, texte: "rapide", etiquettes: [], noteLe: "2026-10-18T19:01:00Z" });
  assert.equal(e.notes[0].prenom, "Jean");
  assert.equal(e.notes[0].texte, "bon bras");
  assert.equal(notesEnAttente(e).length, 2);
  e = marquerEnvoyees(e, ["n1"]);
  assert.deepEqual(notesEnAttente(e).map((n) => n.id), ["n2"]);
  // Corriger une note (même id) la remet en attente, sans doublon.
  e = ajouterNote(e, { id: "n1", cote: "A", numero: "16", prenom: "Jean", texte: "très bon bras", etiquettes: [], noteLe: "2026-10-18T19:00:00Z" });
  assert.equal(e.notes.length, 2);
  assert.equal(notesEnAttente(e).length, 2);
  assert.deepEqual(versEnvoi(e.notes.slice(0, 1))[0], { id: "n2", cote: "B", numero: "1", prenom: null, texte: "rapide", etiquettes: [], note_le: "2026-10-18T19:01:00Z" });
  assert.deepEqual(lots([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  assert.equal(resumeEnvoi(0, false), "Tout est envoyé");
  assert.equal(resumeEnvoi(1, true), "1 note en attente · envoi…");
  assert.equal(resumeEnvoi(3, false), "3 notes en attente · hors ligne");
});

test("remappage : un collègue a déjà ouvert ce match → la séance locale passe sous son id", () => {
  let e = nouvelleSeance("local", { equipeA: "A", gameId: "g1" });
  e = ajouterNote(e, { id: "n1", cote: "A", numero: "16", prenom: null, texte: "x", etiquettes: [], noteLe: "2026-10-18T19:00:00Z" });
  const r = remapperSeance({ seances: { local: e, autre: nouvelleSeance("autre", { equipeA: "Z" }) }, active: "local" }, "local", "serveur");
  assert.equal(r.active, "serveur");
  assert.equal(r.seances.local, undefined);
  assert.equal(r.seances.serveur.seance.id, "serveur");
  assert.equal(r.seances.serveur.seance.ouverte, true);
  assert.deepEqual(r.seances.serveur.notes.map((n) => n.id), ["n1"]);
  assert.ok(r.seances.autre);
  // Même id : rien ne change.
  const s = { seances: { local: e }, active: "local" };
  assert.equal(remapperSeance(s, "local", "local"), s);
});

test("regroupement : par côté + numéro, plus récent d'abord ; sans numéro, par prénom", () => {
  const groupes = grouperParJoueur([
    note("1", "A", "16", "2026-10-18T19:00:00Z", { prenom: "Jean" }),
    note("2", "B", "1", "2026-10-18T19:02:00Z"),
    note("3", "A", "16", "2026-10-18T19:05:00Z"),
    note("4", "A", null, "2026-10-18T19:03:00Z", { prenom: "Max" }),
    note("5", "A", null, "2026-10-18T19:04:00Z", { prenom: "max " }),
  ]);
  assert.deepEqual(groupes.map((g) => g.cle), ["A|#16", "A|p:max", "B|#1"]);
  assert.equal(groupes[0].notes.length, 2);
  assert.equal(groupes[0].prenom, "Jean");
  assert.equal(libelleJoueur(groupes[0]), "#16 Jean");
  assert.equal(libelleJoueur(groupes[2]), "#1");
  assert.deepEqual(pastillesCote(groupes, "B").map((g) => g.cle), ["B|#1"]);
  assert.equal(cleJoueur({ cote: "B", numero: null, prenom: " Léo " }), "B|p:léo");
});

test("fusion : mes notes locales gagnent, celles des collègues s'ajoutent, sans doublon", () => {
  const locales = [{ id: "n1", cote: "A" as const, numero: "16", prenom: null, texte: "corrigée", etiquettes: [], noteLe: "t1", envoyee: false }];
  const serveur = [
    note("n1", "A", "16", "t1", { texte: "ancienne", auteurNom: "Rec Un", lieLe: "t9" }),
    note("n2", "A", "16", "t2", { deMoi: false, auteurNom: "Rec Deux" }),
  ];
  const f = fusionnerNotes(locales, serveur, "moi");
  assert.equal(f.length, 2);
  const n1 = f.find((n) => n.id === "n1")!;
  assert.equal(n1.texte, "corrigée");
  assert.equal(n1.enAttente, true);
  assert.equal(n1.lieLe, "t9");
  assert.equal(f.find((n) => n.id === "n2")!.auteurNom, "Rec Deux");
});

test("après le match : texte recopié et suggestions de cartes", () => {
  const g = grouperParJoueur([
    note("1", "A", "16", "2026-10-18T19:00:00Z", { texte: "Très bon bras", etiquettes: ["Bras"] }),
    note("2", "A", "16", "2026-10-18T19:05:00Z", { texte: "Lecture du jeu", deMoi: false, auteurNom: "Rec Deux" }),
  ])[0];
  const t = texteRecopie({ equipeA: "Cougars", equipeB: "Titans", commenceLe: "2026-10-18T19:00:00Z" }, g);
  assert.match(t, /^Match Cougars vs Titans — .+ · #16\n• \[Bras\] Très bon bras\n• Lecture du jeu \(Rec Deux\)$/);

  const cartes = [
    { id: "c1", prenom: "Zack", nom: "B", numero: "16", teamId: "t-autre", equipe: null },
    { id: "c2", prenom: "Jean", nom: "A", numero: "16", teamId: "t-match", equipe: null },
    { id: "c3", prenom: "Jean", nom: "C", numero: "7", teamId: "t-match", equipe: null },
  ];
  assert.deepEqual(suggestionsCartes({ numero: "16", prenom: null }, cartes, ["t-match"]).map((c) => c.id), ["c2", "c1"]);
  assert.equal(suggestionsCartes({ numero: "16", prenom: null }, cartes, ["t-match"])[0].memeEquipe, true);
  assert.deepEqual(suggestionsCartes({ numero: "16", prenom: "zack" }, cartes).map((c) => c.id), ["c1", "c2"]);
  assert.deepEqual(suggestionsCartes({ numero: null, prenom: "Jean" }, cartes), []);
});

test("erreurs : fonction absente (prod sans migration) et messages NEXUS", () => {
  assert.equal(fonctionAbsente({ code: "PGRST202", message: "Could not find the function public.match_seances_recentes" }), true);
  assert.equal(fonctionAbsente({ code: "42883" }), true);
  assert.equal(fonctionAbsente({ code: "42501", message: "denied" }), false);
  assert.equal(fonctionAbsente(null), false);
  assert.equal(messageErreur({ message: "NEXUS: séance hors de ton unité" }), "séance hors de ton unité");
  assert.equal(messageErreur({ message: "boom" }), "Une erreur est survenue. Réessaie.");
});

test("entrées : menu « Plus » de l'appli et barre latérale web, route Pro", () => {
  const plus = lire("app/_components/mobile/MorePanel.tsx");
  assert.ok(plus.includes('{ key: "game-on", label: "Game On", href: "/recruteur/game-on"'));
  const web = lire("app/recruteur/_components/RecruiterSidebar.tsx");
  assert.ok(web.includes('label: "Game On", href: "/recruteur/game-on"'));
  const page = lire("app/recruteur/game-on/page.tsx");
  assert.ok(page.includes('<FeatureGate feature="recruiting_calendar" requiredTier="pro">'));
  assert.ok(page.includes("<GameOn mobile={IS_CAPACITOR} />"));
  // Pas d'onglet dans la barre du bas (décision BP).
  assert.ok(!lire("app/_components/mobile/MobileTabBar.tsx").includes("game-on"));
});
