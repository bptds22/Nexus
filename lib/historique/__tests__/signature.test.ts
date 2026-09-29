import { test } from "node:test";
import assert from "node:assert/strict";
import { ligneSignee } from "@/lib/historique/signature";

test("l'auteur lui-même : « Tu as … », jamais « Toi a … »", () => {
  assert.deepEqual(ligneSignee(true, "Rémi Collègue", "a invité l'athlète par courriel"), { sujet: "Tu", phrase: "as invité l'athlète par courriel" });
  assert.deepEqual(ligneSignee(true, "X", "a déplacé le dossier vers Contacté"), { sujet: "Tu", phrase: "as déplacé le dossier vers Contacté" });
});

test("un collègue : son nom, la phrase telle quelle", () => {
  assert.deepEqual(ligneSignee(false, "Robin Admin", "a ajouté une note de suivi"), { sujet: "Robin Admin", phrase: "a ajouté une note de suivi" });
});
