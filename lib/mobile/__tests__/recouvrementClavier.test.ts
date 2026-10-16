/* Clavier natif : on remonte du RECOUVREMENT, pas de la hauteur brute.
   Relevé émulateur 1.4.5 (Android 15, targetSdk 36) : la WebView passe de
   914 à 530 px sous un clavier de 336 px — elle a déjà fait la place. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { calculerRecouvrement } from "@/lib/mobile/recouvrementClavier";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

test("Android 15+ : WebView déjà rétrécie → plus rien à remonter", () => {
  assert.equal(calculerRecouvrement(336, 914, 530), 0);
});

test("iOS (KeyboardResize.None) : WebView inchangée → hauteur du clavier", () => {
  assert.equal(calculerRecouvrement(336, 852, 852), 336);
});

test("rétrécissement partiel → la différence ; clavier fermé → 0", () => {
  assert.equal(calculerRecouvrement(336, 914, 800), 222);
  assert.equal(calculerRecouvrement(0, 914, 530), 0);
});

test("le hook et --kbd-h passent tous deux par le recouvrement", () => {
  assert.match(lire("lib/hooks/useKeyboardHeight.ts"), /ecouterRecouvrementClavier\(setKbdH\)/);
  const inset = lire("components/mobile/KeyboardInset.tsx");
  assert.match(inset, /ecouterRecouvrementClavier\(/);
  assert.doesNotMatch(inset, /info\.keyboardHeight/);
});
