/* Lot 1.4.5 — export de carte : une photo injoignable est sautée, l'export
   réussit (les trois exports passent le pixel transparent à html-to-image). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { IMAGE_INJOIGNABLE, OPTIONS_IMAGE_INJOIGNABLE } from "@/lib/partage/imageInjoignable";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

test("le remplaçant est une image PNG valide (data URL), passée en imagePlaceholder", () => {
  assert.match(IMAGE_INJOIGNABLE, /^data:image\/png;base64,[A-Za-z0-9+/=]+$/);
  const png = Buffer.from(IMAGE_INJOIGNABLE.split(",")[1], "base64");
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(OPTIONS_IMAGE_INJOIGNABLE.imagePlaceholder, IMAGE_INJOIGNABLE);
});

test("les trois exports (Mon parcours web et appli, fiche partenaire) l'étalent dans leurs options", () => {
  for (const f of ["app/athlete/mon-parcours/page.tsx", "components/shared/MonParcoursMobile.tsx", "app/partenaire/athletes/[id]/PageClient.tsx"]) {
    const src = lire(f);
    assert.match(src, /import \{ OPTIONS_IMAGE_INJOIGNABLE \} from "@\/lib\/partage\/imageInjoignable";/, f);
    assert.match(src, /\.\.\.OPTIONS_IMAGE_INJOIGNABLE, \/\/ photo injoignable : sautée, l'export réussit/, f);
  }
});

test("appli : « Accepter » la demande de visibilité, comme le web (plus de renvoi au site)", () => {
  const src = lire("app/athlete/notifications/page.tsx");
  assert.ok(!src.includes("Réponds sur nexussports.ca."));
  assert.match(src, /onClick=\{\(\) => void accepterDemande\(n\)\}/);
});

test("appli : nom à confirmer porté jusqu'à la fiche d'équipe du coach", () => {
  const q = lire("lib/queries/coach/useCoachTeamDetail.ts");
  assert.match(q, /nom_a_confirmer\n?\s*\)/);
  assert.match(q, /nomAConfirmer: ath\?\.nom_a_confirmer === true,/);
  assert.match(lire("components/shared/CoachEquipeDetailMobile.tsx"), /nomAConfirmer: a\.nomAConfirmer,/);
});
