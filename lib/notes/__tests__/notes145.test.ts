/* Notes plus faciles (1.4.5, option C du R6) : brouillon, gabarits, dictée, et le champ
   unique branché partout (fiche, liste, processus ; web et appli). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cleBrouillon, ecrireBrouillon, lireBrouillon, viderBrouillon, DUREE_BROUILLON_MS, type StockageLocal } from "@/lib/notes/brouillon";
import { GABARITS_NOTE, insererGabarit, ajouterDictee } from "@/lib/notes/gabarits";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");
function faux(): StockageLocal & { m: Map<string, string> } {
  const m = new Map<string, string>();
  return { m, getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
}

test("brouillon : écrit, relu, effacé quand vide ou posté", () => {
  const s = faux();
  ecrireBrouillon("athlete:1", "Très bon départ", 1000, s);
  assert.equal(lireBrouillon("athlete:1", 2000, s), "Très bon départ");
  ecrireBrouillon("athlete:1", "   ", 3000, s);
  assert.equal(lireBrouillon("athlete:1", 3000, s), "");
  assert.equal(s.m.size, 0);
  ecrireBrouillon("liste:9", "À voir", 1000, s);
  viderBrouillon("liste:9", s);
  assert.equal(lireBrouillon("liste:9", 1500, s), "");
});

test("brouillon : une clé par SUJET (le même fil partout), et un vieux brouillon est écarté", () => {
  const s = faux();
  ecrireBrouillon("athlete:1", "a", 0, s);
  assert.ok(s.m.has(cleBrouillon("athlete:1")));
  assert.equal(lireBrouillon("athlete:2", 1, s), "");
  assert.equal(lireBrouillon("athlete:1", DUREE_BROUILLON_MS + 1, s), "");
  assert.equal(s.m.size, 0);
});

test("brouillon : un stockage absent ou qui lève ne casse rien", () => {
  assert.equal(lireBrouillon("x", 0, null), "");
  assert.doesNotThrow(() => ecrireBrouillon("x", "t", 0, null));
  const casse: StockageLocal = { getItem() { throw new Error("bloqué"); }, setItem() { throw new Error("quota"); }, removeItem() { throw new Error("bloqué"); } };
  assert.equal(lireBrouillon("x", 0, casse), "");
  assert.doesNotThrow(() => ecrireBrouillon("x", "t", 0, casse));
  const corrompu = faux();
  corrompu.m.set(cleBrouillon("x"), "pas du json");
  assert.equal(lireBrouillon("x", 0, corrompu), "");
});

test("gabarits : courts, optionnels, insérés sur leur propre ligne ; dictée ajoutée avec une espace", () => {
  assert.ok(GABARITS_NOTE.length >= 4 && GABARITS_NOTE.every((g) => g.length <= 32));
  assert.equal(insererGabarit("", "À suivre de près"), "À suivre de près — ");
  assert.equal(insererGabarit("Bon match", "Parler au parent"), "Bon match\nParler au parent — ");
  assert.equal(insererGabarit("Bon match\n", "Parler au parent"), "Bon match\nParler au parent — ");
  assert.equal(ajouterDictee("", " vitesse élevée "), "vitesse élevée");
  assert.equal(ajouterDictee("Bon départ", "et bon passeur"), "Bon départ et bon passeur");
  assert.equal(ajouterDictee("Bon départ ", "bon passeur"), "Bon départ bon passeur");
  assert.equal(ajouterDictee("texte", "   "), "texte");
});

test("le champ unique est branché partout : fiche, liste, processus — web et appli", () => {
  const surfaces: [string, RegExp][] = [
    ["components/recruteur/notes/FilNotesSuivi.tsx", /<ChampNote/],
    ["components/shared/FilNotesSuiviMobile.tsx", /<ChampNote/],
    ["app/recruteur/athletes/[id]/_components/NotesListsPanel.tsx", /<ChampNote/],
    ["app/recruteur/listes/page.tsx", /<ChampNote/],
    ["components/shared/RecruteurListeDetailMobile.tsx", /<ChampNote/],
  ];
  for (const [f, re] of surfaces) assert.match(lire(f), re, f);
  // Plus de champ de note « à la main » : l'ancien <input> d'une ligne de l'appli est parti.
  assert.doesNotMatch(lire("components/shared/FilNotesSuiviMobile.tsx"), /placeholder="Ajouter une note…"\s*\n\s*aria-label="Ajouter une note de suivi"\s*\n\s*className="flex-1 px-3/);
  // Le brouillon suit le SUJET : le fil d'un joueur est le même partout.
  assert.ok(/sujet=\{`\$\{carte \? "carte" : "athlete"\}:\$\{sujet\.id\}`\}/.test(lire("components/recruteur/notes/FilNotesSuivi.tsx")));
  assert.ok(/sujet=\{`\$\{carteId \? "carte" : "athlete"\}:/.test(lire("components/shared/FilNotesSuiviMobile.tsx")));
  assert.ok(/sujet=\{`athlete:\$\{athleteId\}`\}/.test(lire("app/recruteur/athletes/[id]/_components/NotesListsPanel.tsx")));
});

test("le bouton Dicter est visible et la dictée a un repli sur le micro du clavier", () => {
  const c = lire("components/shared/ChampNote.tsx");
  assert.match(c, /data-testid="champ-note-dicter"/);
  assert.match(c, /webkitSpeechRecognition/);
  assert.match(c, /Touche le micro de ton clavier pour dicter ta note\./);
  assert.match(c, /fr-CA/);
  assert.match(c, /Brouillon enregistré/);
});
