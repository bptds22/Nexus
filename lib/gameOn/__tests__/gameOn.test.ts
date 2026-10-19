/* Dépistage (ex-Game On, mode match) — logique pure : file locale, regroupement, remappage, suggestions. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  CHANDAILS, couleurCote, texteSur, avecCouleurs,
  ajouterNote, cleJoueur, ecrireStock, fonctionAbsente, fusionnerNotes, grouperParJoueur, libelleJoueur,
  lireStock, lots, marquerEnvoyees, messageErreur, notesEnAttente, noteValide, nouvelleSeance, numeroValide,
  pastillesCote, remapperSeance, resumeEnvoi, suggestionsCartes, texteRecopie, versEnvoi,
  ajouterLigneDatee, avecPrenom, heureLigne, pastilleParDefaut, prenomProche, rangerSeances, suggestionsTri, titreRecopie, PASTILLES,
  type NoteAffichee, type Stockage, CLE_STOCK,
} from "@/lib/gameOn/gameOn";
import { DEPISTAGE, lienDepister, lireDepister } from "@/lib/gameOn/libelles";
import { boutonsCreation } from "@/lib/cartes/boutonsCreation";

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
  // BP 2026-10-18 : le fil de la carte reçoit « Match X vs Y, date », puis une ligne par note (heure).
  assert.match(t, /^Notes du match Cougars vs Titans, .+\n• \d{1,2} h \d{2} : \[Bras\] Très bon bras\n• \d{1,2} h \d{2} : Lecture du jeu \(Rec Deux\)$/);
  assert.equal(titreRecopie({ equipeA: "Cougars", equipeB: null, commenceLe: "pas une date" }), "Notes du match Cougars");

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

test("entrées : barre du bas de l'appli et barre latérale web, route Pro", () => {
  // BP 2026-10-18 (2e avis) : Game On monte dans la barre du bas, avec Calendrier et Messages.
  const barre = lire("app/_components/mobile/MobileTabBar.tsx");
  // Nuit du 2026-10-18 : « Game On » devient « Dépistage », libellé tiré d'UNE constante.
  assert.ok(barre.includes('{ key: "game-on", label: DEPISTAGE.onglet, href: "/recruteur/game-on"'));
  assert.equal(DEPISTAGE.onglet, "Dépistage");
  assert.equal(DEPISTAGE.bouton, "Dépister ce match");
  assert.ok(!lire("app/_components/mobile/MorePanel.tsx").includes('key: "game-on"'));
  const web = lire("app/recruteur/_components/RecruiterSidebar.tsx");
  assert.ok(web.includes('label: DEPISTAGE.onglet, href: "/recruteur/game-on"'));
  // Plus aucun « Game On » affiché à l'écran.
  for (const p of ["components/game-on/GameOn.tsx", "app/_components/mobile/MobileTabBar.tsx", "app/recruteur/_components/RecruiterSidebar.tsx"]) {
    assert.ok(!/label: "Game On"|>Game On<|titre="Game On"|"Game On arrive/.test(lire(p)), p);
  }
  const page = lire("app/recruteur/game-on/page.tsx");
  assert.ok(page.includes('<FeatureGate feature="recruiting_calendar" requiredTier="pro">'));
  assert.ok(page.includes("<GameOn mobile={IS_CAPACITOR} />"));
  // Recherche et Processus passent dans « Plus ».
  const plus = lire("app/_components/mobile/MorePanel.tsx");
  assert.ok(plus.includes('{ key: "recherche", label: "Recherche", href: "/recruteur/recherche"'));
  assert.ok(plus.includes('{ key: "pipeline", label: "Mon processus", href: "/recruteur/pipeline"'));
  assert.ok(!barre.includes('key: "recherche"') && !barre.includes('key: "pipeline"'));
});

test("couleurs des chandails : choisies à chaque match, texte lisible, repli rouge / bleu", () => {
  assert.equal(CHANDAILS.length, 10);
  assert.equal(couleurCote(null, "A"), "#E63946");
  assert.equal(couleurCote({ couleurA: null, couleurB: null }, "B"), "#3B82F6");
  assert.equal(couleurCote({ couleurA: "#27272A", couleurB: "#F8FAFC" }, "A"), "#27272A");
  assert.equal(couleurCote({ couleurA: "pas-une-couleur", couleurB: null }, "A"), "#E63946");
  assert.equal(texteSur("#F8FAFC"), "#111317"); // blanc → texte foncé
  assert.equal(texteSur("#FACC15"), "#111317"); // jaune → texte foncé
  assert.equal(texteSur("#27272A"), "#FFFFFF"); // noir → texte blanc
  assert.equal(texteSur("#1E3A8A"), "#FFFFFF");
  const e = { seance: { id: "s", gameId: null, equipeA: "A", equipeB: "B", lieu: null, commenceLe: "", termineLe: null, ouverte: false, termineeEnvoyee: false }, notes: [] };
  const c = avecCouleurs(e, "#27272A", "#F8FAFC");
  assert.equal(c.seance.couleurA, "#27272A");
  assert.equal(c.seance.couleurB, "#F8FAFC");
  assert.equal(e.seance.couleurA, undefined, "pas de mutation");
  const ui = lire("components/game-on/GameOn.tsx");
  assert.ok(ui.includes("Couleur des chandails"));
  assert.ok(ui.includes("disabled={!ca || !cb}"), "les deux couleurs sont demandées");
});

test("Dépister ce match : le lien porte le match et ses deux équipes", () => {
  const id = "6f1c2a7e-0b1d-4c2e-9a3f-1234567890ab";
  const url = lienDepister({ gameId: id, equipeA: "Cougars", equipeB: "Titans & Co", lieu: "Aréna" });
  assert.ok(url.startsWith("/recruteur/game-on?"));
  const lu = lireDepister(new URLSearchParams(url.split("?")[1]));
  assert.deepEqual(lu, { gameId: id, equipeA: "Cougars", equipeB: "Titans & Co", lieu: "Aréna" });
  assert.equal(lireDepister(new URLSearchParams("match=pas-un-id")), null);
  assert.equal(lireDepister(null), null);
  assert.equal(lireDepister(new URLSearchParams(`match=${id}`))?.equipeB, "Adversaire");
  // Sur la fiche d'un match (carte des matchs, web et appli) et sur un match du calendrier.
  for (const p of ["components/carte-matchs/CarteMatchs.tsx", "components/carte-matchs/CarteMatchsMobile.tsx",
    "app/recruteur/calendrier/page.tsx", "components/shared/RecruteurCalendrierMobile.tsx"]) {
    assert.ok(lire(p).includes("<BoutonDepister gameId="), p);
  }
  // Le bouton de la carte des matchs est réservé au recruteur.
  // BP 2026-10-19 : le partenaire dépiste aussi, vers SA route.
  assert.ok(lire("components/carte-matchs/CarteMatchs.tsx").includes('mode={mode === "partenaire" ? "partenaire" : "recruteur"} />'));
  assert.ok(lire("components/carte-matchs/CarteMatchsMobile.tsx").includes('mode={partenaire ? "partenaire" : "recruteur"} />'));
  assert.ok(lienDepister({ gameId: id, equipeA: "A", equipeB: "B" }, "partenaire").startsWith("/partenaire/depistage?"));
});

test("tableau de bord : quatre pastilles, plus de liste « Matchs d'aujourd'hui »", () => {
  assert.deepEqual(PASTILLES.map((p) => p.libelle), ["En cours", "Mes matchs du jour", "À trier", "Mon unité"]);
  const moi = "moi";
  const seances = [
    { id: "s1", cree_par: moi, termine_le: null, nb_notes: 3, nb_a_lier: 3 },
    { id: "s2", cree_par: "collegue", termine_le: null, nb_notes: 1, nb_a_lier: 0 },
    { id: "s3", cree_par: "collegue", termine_le: "2026-10-18T22:00:00Z", nb_notes: 2, nb_a_lier: 2 },
    { id: "s4", cree_par: moi, termine_le: null, nb_notes: 0, nb_a_lier: 0 },
  ];
  const r = rangerSeances(seances, moi, new Set(["s4"]));
  assert.deepEqual(r.enCours.map((s) => s.id), ["s1"], "les miennes ouvertes, pas déjà sur l'appareil");
  assert.deepEqual(r.aTrier.map((s) => s.id), ["s1", "s3"]);
  assert.deepEqual(r.unite.map((s) => s.id), ["s2"], "les collègues, ouvertes : à rejoindre");
  assert.equal(pastilleParDefaut({ enCours: 1, duJour: 3, aTrier: 0 }), "en-cours");
  assert.equal(pastilleParDefaut({ enCours: 0, duJour: 3, aTrier: 2 }), "du-jour");
  assert.equal(pastilleParDefaut({ enCours: 0, duJour: 0, aTrier: 2 }), "a-trier");
  const ui = lire("components/game-on/GameOn.tsx");
  assert.ok(!ui.includes("useMatchsRecherche"), "aucune 3e liste de matchs");
  assert.ok(!ui.includes("Matchs d'aujourd'hui"));
  assert.ok(ui.includes('useCalendrierUnite(mode === "recruteur")'), "les matchs du jour viennent du calendrier (recruteur)");
  assert.ok(ui.includes('href={mode === "partenaire" ? "/partenaire/carte-matchs" : "/recruteur/carte-matchs"}'), "Trouver un match → la carte des matchs");
  assert.ok(lire("app/recruteur/game-on/page.tsx").includes("<Suspense"), "useSearchParams sous Suspense (export statique)");
});

test("fiche du joueur : pas de Dicter, bloc qui se vide, ajout daté à SA note, prénom au crayon", () => {
  const ui = lire("components/game-on/GameOn.tsx");
  assert.ok(ui.includes("sansGabarits sansDictee"), "pas de bouton Dicter");
  assert.ok(lire("components/shared/ChampNote.tsx").includes("{!sansDictee && ("));
  assert.ok(ui.includes('setTexte("");'), "le bloc se vide après Enregistrer");
  assert.ok(ui.includes('aria-label="Modifier le prénom"'));
  assert.ok(ui.includes("entete={entete}"), "en-tête fixe, hors de la zone qui défile");
  assert.equal(heureLigne(new Date(2026, 9, 18, 14, 32)), "14 h 32");
  assert.equal(heureLigne(new Date(2026, 9, 18, 9, 5)), "9 h 05");
  assert.equal(heureLigne("pas une date"), "");
  const t = ajouterLigneDatee("Très bon bras", "  Bon sur les longues  ", new Date(2026, 9, 18, 14, 32));
  assert.equal(t, "Très bon bras\n14 h 32 : Bon sur les longues", "ajoute, n'écrase pas");
  assert.equal(ajouterLigneDatee("Avant", "   "), "Avant");
  assert.equal(ajouterLigneDatee("x".repeat(1995), "suite").length, 2000, "plafond de la base");
  const e = nouvelleSeance("s1", { equipeA: "A" });
  const e2 = avecPrenom(e, "A|#16", "  Jean ");
  assert.equal(e2.seance.prenoms?.["A|#16"], "Jean");
  assert.equal(avecPrenom(e2, "A|#16", "").seance.prenoms?.["A|#16"], undefined);
  // Le prénom corrigé passe avant celui des notes (d'un collègue, par exemple).
  const g = grouperParJoueur([note("1", "A", "16", "2026-10-18T19:00:00Z", { prenom: "Jon", deMoi: false })], { "A|#16": "Jean" })[0];
  assert.equal(g.prenom, "Jean");
  // Relecture des notes : 15 s en ligne, au retour dans l'appli.
  const hook = lire("lib/gameOn/useGameOn.ts");
  assert.ok(hook.includes("export const RELECTURE_MS = 15_000;"));
  assert.ok(hook.includes("refetchInterval: () => (enLigneMaintenant() ? RELECTURE_MS : false)"));
  assert.ok(hook.includes("const retirer = surReprise(relire);"));
});

test("trier : athlètes Nexus ET cartes de l'équipe, même numéro ou nom proche", () => {
  assert.equal(prenomProche("Alex", "Alexandre"), true);
  assert.equal(prenomProche("élodie", "Elodie-Anne"), true);
  assert.equal(prenomProche("J", "Jean"), false, "une lettre ne suffit pas");
  assert.equal(prenomProche(null, "Jean"), false);
  const athletes = [
    { id: "a1", prenom: "Marc", nom: "Roy", numero: "16", cote: "A" as const },
    { id: "a2", prenom: "Jean", nom: "Tremblay", numero: "4", cote: "A" as const },
    { id: "a3", prenom: "Luc", nom: "Gagnon", numero: "16", cote: "B" as const },
  ];
  const cartes = [
    { id: "c1", prenom: "Zack", nom: "B", numero: "16", teamId: "t-autre", equipe: "Ailleurs", schoolId: "e-autre" },
    { id: "c2", prenom: "Paul", nom: "A", numero: "16", teamId: "t-A", equipe: "Cougars", schoolId: "e-A" },
    { id: "c3", prenom: "Jeannot", nom: "C", numero: "7", teamId: "t-A", equipe: "Cougars", schoolId: "e-A" },
    { id: "c4", prenom: "Rémi", nom: "D", numero: "9", teamId: "t-A", equipe: "Cougars", schoolId: "e-A" },
    { id: "c5", prenom: "Jean", nom: "E", numero: "16", teamId: "t-A-juvenile", equipe: "Cougars juvénile", schoolId: "e-A" },
  ];
  // BP 2026-10-19 : école, équipe, nom, puis numéro ; jamais une autre école.
  const s = suggestionsTri({ cote: "A", numero: "16", prenom: "Jean" }, athletes, cartes, "t-A", "e-A");
  assert.deepEqual(s.map((x) => `${x.type}:${x.id}`), ["athlete:a2", "carte:c3", "athlete:a1", "carte:c2", "carte:c5"]);
  assert.equal(s[0].raison, "nom");
  assert.equal(s[2].raison, "numero");
  assert.equal(s[4].memeEquipe, false, "même école, autre équipe : après l'équipe du match");
  assert.ok(!s.some((x) => x.id === "c1"), "même numéro dans une autre école : jamais proposé");
  assert.ok(!s.some((x) => x.id === "a3"), "l'autre côté du match n'est pas proposé");
  assert.ok(!s.some((x) => x.id === "c4"), "même équipe, ni numéro ni nom : pas proposé");
  assert.deepEqual(suggestionsTri({ cote: "B", numero: null, prenom: null }, athletes, cartes, null), []);
});

test("créer une carte : deux boutons, courriel facultatif, prérempli depuis le côté du match", () => {
  assert.deepEqual(boutonsCreation("", ""), { creer: true, inviter: false });
  assert.deepEqual(boutonsCreation(" a@b.ca ", ""), { creer: false, inviter: true });
  assert.deepEqual(boutonsCreation("", "4385550123"), { creer: false, inviter: true });
  const mobile = lire("components/shared/CreerProspectMobile.tsx");
  assert.ok(!mobile.includes("equipeOk && aContact"), "le courriel n'est plus obligatoire (appli)");
  assert.ok(mobile.includes('data-testid="prospect-creer-inviter"') && mobile.includes('data-testid="prospect-creer"'));
  const web = lire("components/recruteur/cartes/CreerCarteModal.tsx");
  assert.ok(web.includes('data-testid="carte-creer-inviter"') && web.includes('data-testid="carte-creer"'));
  assert.ok(web.includes("export interface PrerempliCarte"));
  const ui = lire("components/game-on/GameOn.tsx");
  assert.ok(ui.includes("etablissement: e?.etablissement ?? null, sportAthleteId: e?.sportId ?? null, teamId: e?.teamId ?? null"));
});
