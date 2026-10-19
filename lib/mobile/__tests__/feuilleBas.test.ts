/* ═══════════════════════════════════════════════════════════════
   FeuilleBas — la fenêtre du bas partagée (BP, nuit du 2026-10-18) :
   clavier, zone sûre de l'encoche, superposition (portail, z-80).
   ═══════════════════════════════════════════════════════════════ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { champSousClavier, hauteurMaxFeuille } from "@/lib/mobile/feuilleBas";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8").replace(/\r\n/g, "\n");

test("hauteur max : jamais sous l'encoche, clavier ouvert ou fermé", () => {
  assert.equal(hauteurMaxFeuille(0), "min(92dvh, calc(100dvh - env(safe-area-inset-top) - 12px))");
  assert.equal(hauteurMaxFeuille(0, "90vh"), "min(90vh, calc(100dvh - env(safe-area-inset-top) - 12px))");
  assert.equal(hauteurMaxFeuille(336), "calc(100vh - 336px - env(safe-area-inset-top) - 8px)");
  // Le hook des feuilles existantes suit la même règle.
  const hook = lire("lib/hooks/useSheetKeyboardGeometry.ts");
  assert.ok(hook.includes("calc(100vh - ${kbdH}px - env(safe-area-inset-top) - 8px)"));
  assert.ok(hook.includes("min(${hauteurFermee}, calc(100dvh - env(safe-area-inset-top) - 12px))"));
});

test("le composant : portail, z-80, au-dessus du clavier, zone défilante qui rétrécit, pied fixe", () => {
  const src = lire("components/mobile/FeuilleBas.tsx");
  assert.ok(src.includes("createPortal("));
  assert.ok(src.includes("document.body"));
  assert.ok((src.match(/z-\[80\]/g) ?? []).length >= 3);
  assert.ok(src.includes("bottom: clavier,"));
  // Cause du « Créer » caché : flex-1 sans min-h-0 ne rétrécit pas sous son contenu.
  assert.ok(src.includes("min-h-0 flex-1 overflow-y-auto"));
  assert.ok(src.includes('{pied && <div className="shrink-0'));
});

test("les écrans signalés par BP passent par FeuilleBas", () => {
  for (const f of [
    "components/game-on/GameOn.tsx",
    "components/shared/CreerProspectMobile.tsx",
    "components/recruteur/cartes/ModifierCarte.tsx",
    "components/recruteur/visites/DetailsVisite.tsx",
    "components/recruteur/unite/useBasculeFavori.tsx",
  ]) {
    assert.ok(lire(f).includes('import { FeuilleBas } from "@/components/mobile/FeuilleBas";'), f);
    assert.ok(lire(f).includes("<FeuilleBas"), f);
  }
  // Game On : la note, le pavé et les couleurs.
  const go = lire("components/game-on/GameOn.tsx");
  for (const id of ['testId="game-on-note"', 'testId="game-on-pave"', 'testId="game-on-couleurs"']) assert.ok(go.includes(id), id);
  // La fenêtre « Retirer … des favoris ? » n'est plus rendue dans l'arbre de la page.
  assert.ok(!lire("components/recruteur/unite/useBasculeFavori.tsx").includes('className="fixed inset-0 z-[90]'));
  assert.ok(!lire("components/recruteur/cartes/ModifierCarte.tsx").includes('className="fixed inset-0 z-[90]'));
});

test("champ dans la page : ramené seulement s'il est sous le clavier", () => {
  assert.equal(champSousClavier(700, 852, 336), true);
  assert.equal(champSousClavier(400, 852, 336), false);
  assert.equal(champSousClavier(840, 852, 0), false);
  const css = lire("app/globals.css");
  assert.ok(css.includes("html.is-capacitor.nx-clavier-ouvert main::after"));
  assert.ok(lire("components/mobile/KeyboardInset.tsx").includes('racine.classList.toggle("nx-clavier-ouvert", px > 0);'));
});
