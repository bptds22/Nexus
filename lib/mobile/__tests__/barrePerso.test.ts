/* Barre du bas personnalisable (BP 2026-10-19). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { avecChoixBarre, lireChoixBarre, resoudreBarre, MAX_ONGLETS } from "@/lib/mobile/barrePerso";

const pool = ["accueil", "calendrier", "direct", "messages", "recherche", "processus"].map((key) => ({ key }));
const defaut = pool.slice(0, 4);

test("le choix, dans l'ordre, 4 au plus ; inconnus et doublons ignorés ; rien → défaut", () => {
  assert.deepEqual(resoudreBarre(["recherche", "processus", "direct"], pool, defaut).map((t) => t.key), ["recherche", "processus", "direct"]);
  assert.deepEqual(resoudreBarre(["x", "recherche", "recherche", "accueil", "direct", "messages", "processus"], pool, defaut).map((t) => t.key),
    ["recherche", "accueil", "direct", "messages"]);
  assert.equal(resoudreBarre(["a", "b", "c", "d", "e"].map((k) => k), pool, defaut).length, defaut.length, "aucune clé connue → défaut");
  assert.deepEqual(resoudreBarre(null, pool, defaut), defaut);
  assert.equal(MAX_ONGLETS, 4);
});

test("métadonnées : lire, écrire un rôle sans toucher l'autre, revenir au défaut", () => {
  const m = avecChoixBarre({ autre: 1, barre_nav: { partenaire: ["a"] } }, "recruteur", ["recherche", "processus"]);
  assert.deepEqual(lireChoixBarre(m, "recruteur"), ["recherche", "processus"]);
  assert.deepEqual(lireChoixBarre(m, "partenaire"), ["a"]);
  assert.equal(lireChoixBarre(avecChoixBarre(m, "recruteur", null), "recruteur"), null);
  assert.equal(lireChoixBarre({ barre_nav: { recruteur: "pas un tableau" } }, "recruteur"), null);
});
