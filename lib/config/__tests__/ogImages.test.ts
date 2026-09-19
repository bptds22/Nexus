/* ═══════════════════════════════════════════════════════════════
   Les images Open Graph existent, sont des PNG, et mesurent VRAIMENT
   1200×630 — pas seulement dans leur déclaration. Voir lib/config/og.ts
   pour le défaut qui a motivé ce test (1579×552 déclaré 1200×630).
   ═══════════════════════════════════════════════════════════════ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { OG_APP, OG_DEFAUT } from "@/lib/config/og";

const racine = join(import.meta.dirname, "..", "..", "..", "public");

for (const img of [OG_DEFAUT, OG_APP]) {
  test(`og — ${img.url} existe, est un PNG de ${img.width}×${img.height}`, () => {
    const chemin = join(racine, img.url);
    assert.ok(existsSync(chemin), `fichier absent : public${img.url}`);

    const b = readFileSync(chemin);
    const signature = b.subarray(0, 8).toString("hex");
    assert.equal(signature, "89504e470d0a1a0a", `public${img.url} n'est pas un PNG`);

    // En-tête IHDR : largeur et hauteur en big-endian aux octets 16 et 20.
    const largeur = b.readUInt32BE(16);
    const hauteur = b.readUInt32BE(20);
    assert.deepEqual([largeur, hauteur], [img.width, img.height],
      `public${img.url} mesure ${largeur}×${hauteur}, déclaré ${img.width}×${img.height}`);
  });
}
