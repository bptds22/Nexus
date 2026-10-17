/* Page équipe, boîte besoins sans ouverture : la même phrase sur le web et dans
   l'appli — « les recruteurs voient qui les cible » (la cible se pose sur le
   cégep). L'appli disait encore « les coachs voient qui les suit ». */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PHRASE_SANS_OUVERTURE } from "@/lib/cibles/divulgation";

const lire = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

test("phrase : les recruteurs, la cible", () => {
  assert.equal(PHRASE_SANS_OUVERTURE,
    "Pas d'ouverture à ton poste pour l'instant — mais montre ton intérêt : les recruteurs voient qui les cible.");
});

test("web et appli lisent la même source ; l'ancienne phrase a disparu", () => {
  for (const f of ["components/team-page/BesoinsWidget.tsx", "components/team-page/TeamPageMobile.tsx"]) {
    const src = lire(f);
    assert.match(src, /<div className="nb-l">\{PHRASE_SANS_OUVERTURE\}<\/div>/, f);
    assert.ok(!src.includes("les coachs voient qui les suit."), f);
  }
});
