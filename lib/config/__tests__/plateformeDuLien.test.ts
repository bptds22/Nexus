/* Icône d'un lien de la fiche : le DOMAINE d'abord, la colonne en repli
   (retour BP 2026-10-03). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { plateformeDuLien } from "@/lib/config/plateformesLien";

test("le domaine décide, même dans une colonne nommée", () => {
  assert.equal(plateformeDuLien("https://x.com/athlete/status/1", "instagram_url")?.cle, "x");
  assert.equal(plateformeDuLien("https://twitter.com/athlete")?.cle, "x");
  assert.equal(plateformeDuLien("https://www.facebook.com/watch?v=1")?.cle, "facebook");
  assert.equal(plateformeDuLien("https://fb.watch/abc")?.cle, "facebook");
  assert.equal(plateformeDuLien("https://www.instagram.com/athlete", "instagram_url")?.cle, "instagram");
});

test("la colonne sert de repli quand le lien ne dit rien", () => {
  assert.equal(plateformeDuLien("nicho_hebert", "instagram_url")?.cle, "instagram");
  assert.equal(plateformeDuLien("https://exemple.ca/video", "hudl_url")?.cle, "hudl");
  assert.equal(plateformeDuLien("https://exemple.ca/video")?.cle, "autre");
  assert.equal(plateformeDuLien("   ", "instagram_url"), null);
  assert.equal(plateformeDuLien(null), null);
});
