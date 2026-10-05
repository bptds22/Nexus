import { test } from "node:test";
import assert from "node:assert/strict";
import { estLienHudl, estLisible, hudlEnPlus } from "@/lib/video/apercuHudl";

test("estLienHudl : le domaine racine, pas un faux-semblant", () => {
  assert.equal(estLienHudl("https://www.hudl.com/v/2QYfwB"), true);
  assert.equal(estLienHudl("http://hudl.com/profile/1"), true);
  assert.equal(estLienHudl("https://www.hudl.com.exemple.net/v/x"), false);
  assert.equal(estLienHudl("https://youtu.be/abc"), false);
  assert.equal(estLienHudl(""), false);
  assert.equal(estLienHudl(null), false);
});

test("estLisible : un lecteur seulement pour une vidéo confirmée", () => {
  assert.equal(estLisible({ genre: "video", embedUrl: "https://www.hudl.com/embed/video/3/1/abc", vignette: null, titre: null }), true);
  assert.equal(estLisible({ genre: "video", embedUrl: "https://ailleurs.com/embed/video/3/1/abc", vignette: null, titre: null }), false);
  assert.equal(estLisible({ genre: "profil", vignette: null, titre: null }), false);
  assert.equal(estLisible({ genre: "introuvable" }), false);
  assert.equal(estLisible(null), false);
});

test("hudlEnPlus : écarte le doublon d'une vidéo déjà affichée", () => {
  assert.equal(hudlEnPlus("https://www.hudl.com/profile/1"), "https://www.hudl.com/profile/1");
  assert.equal(hudlEnPlus("http://hudl.com/v/X/", "https://www.hudl.com/v/X"), null);
  assert.equal(hudlEnPlus("https://www.hudl.com/v/X", "https://www.hudl.com/v/Y"), "https://www.hudl.com/v/X");
  assert.equal(hudlEnPlus("https://youtu.be/abc"), null);
  assert.equal(hudlEnPlus("  "), null);
});
