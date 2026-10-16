/* Registre §93 — règle RSEQ (BP 2026-10-15) côté mobile : l'aperçu d'un code
   d'équipe et la réclamation d'une fiche ne nomment ni coach, ni équipe ou école
   collégiale. Même règle que le web (equipeNommable). */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { apercuCodeEquipe, orphelinPourReclamation, TITRE_CODE_NON_NOMMABLE } from "@/lib/invitations/apercuCodeEquipe";

const details = { essentiel: "Basketball · Juvénile D1", contexte: "Masculin" };
const code = (schoolType: string) => ({ teamName: "Dragons", schoolName: "École X", schoolType, details });

test("secondaire : équipe, école, détails et coachs visibles", () => {
  const a = apercuCodeEquipe(code("SECONDAIRE"));
  assert.deepEqual(a, {
    nommable: true, titre: "Dragons", details, organisation: "École X", motOrganisation: "école", coachsVisibles: true,
  });
});

test("civil : équipe et club nommés, pas de liste de coachs", () => {
  const a = apercuCodeEquipe(code("LIGUE_CIVILE"));
  assert.equal(a.titre, "Dragons");
  assert.equal(a.organisation, "École X");
  assert.equal(a.motOrganisation, "club");
  assert.equal(a.coachsVisibles, false);
});

for (const t of ["CEGEP", "UNIVERSITE", "", "inconnu"]) {
  test(`type « ${t} » : rien n'est nommé (ni équipe, ni école, ni coach)`, () => {
    const a = apercuCodeEquipe(code(t));
    assert.equal(a.nommable, false);
    assert.equal(a.titre, TITRE_CODE_NON_NOMMABLE);
    assert.equal(a.details, null);
    assert.equal(a.organisation, null);
    assert.equal(a.coachsVisibles, false);
    assert.doesNotMatch(JSON.stringify(a), /Dragons|École X|Juvénile/);
  });
}

test("réclamation de fiche : jamais de coach, le type d'école voyage", () => {
  const o = orphelinPourReclamation({
    id: "a1", first_name: "Léa", last_name: "Roy", sport: { nom: "Soccer" },
    ecole: { name: "Cégep Y", type: "CEGEP" },
    // un appelant fautif qui passerait encore un coach :
    ...({ coach: { first_name: "Marc" } } as object),
  } as Parameters<typeof orphelinPourReclamation>[0]);
  assert.equal(o.school_type, "CEGEP");
  assert.equal("coach_name" in o, false);
  assert.doesNotMatch(JSON.stringify(o), /Marc/);
});

test("sans école : type null, la modale ne nommera rien", () => {
  const o = orphelinPourReclamation({ id: "a2" });
  assert.equal(o.school_name, null);
  assert.equal(o.school_type, null);
});

test("onboarding mobile : plus d'entraîneur évoqué pour le code, plus de coach lu pour la réclamation", () => {
  const src = fs.readFileSync(path.join(process.cwd(), "components/shared/AthleteOnboardingMobile.tsx"), "utf8");
  assert.doesNotMatch(src, /entraîneur t(&apos;|')a donné un code/i);
  assert.doesNotMatch(src, /entraîneur t(&apos;|')en a donné/i);
  assert.doesNotMatch(src, /coach_name/);
  assert.doesNotMatch(src, /users:coach_id/);
  assert.match(src, /Tu as un code d&apos;équipe \?/);
  assert.match(src, /apercuCodeEquipe\(/);
  assert.match(src, /orphelinPourReclamation\(/);
});
