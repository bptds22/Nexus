/* Miniatures des photos d'athlètes (BP 2026-10-19). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { eteindreMiniatures, urlMiniature } from "@/lib/storage/miniature";

const PHOTO = "https://x.supabase.co/storage/v1/object/public/avatars/a1/photo.jpg";

test("une URL publique Supabase devient une miniature au double de la largeur", () => {
  assert.equal(urlMiniature(PHOTO, 48), "https://x.supabase.co/storage/v1/render/image/public/avatars/a1/photo.jpg?width=96&quality=70");
  assert.equal(urlMiniature(`${PHOTO}?t=1`, 2000), "https://x.supabase.co/storage/v1/render/image/public/avatars/a1/photo.jpg?t=1&width=1200&quality=70");
  assert.equal(urlMiniature("https://ailleurs.ca/p.jpg", 48), "https://ailleurs.ca/p.jpg");
  assert.equal(urlMiniature(null, 48), null);
});

test("éteintes pour la session : l'URL d'origine", () => {
  eteindreMiniatures();
  assert.equal(urlMiniature(PHOTO, 48), PHOTO);
});
