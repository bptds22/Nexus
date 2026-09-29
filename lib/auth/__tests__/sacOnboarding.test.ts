import { test } from "node:test";
import assert from "node:assert/strict";
import { sacPerime } from "@/lib/auth/sacOnboarding";

const sac = (email: string) => JSON.stringify({ firstName: "Pierre", lastName: "Dufour", email });

test("le sac d'un AUTRE compte est périmé", () => {
  assert.equal(sacPerime(sac("pierre@garneau.qc.ca"), { email: "bptds22@gmail.com" }), true);
});

test("le sac de la session, onboarding en cours, est gardé (casse ignorée)", () => {
  assert.equal(sacPerime(sac("BPtds22@gmail.com "), { email: "bptds22@gmail.com", onboardingComplete: false }), false);
});

test("onboarding terminé : le sac part, même s'il est à la session", () => {
  assert.equal(sacPerime(sac("bptds22@gmail.com"), { email: "bptds22@gmail.com", onboardingComplete: true }), true);
});

test("illisible ou sans adresse : périmé ; absent : rien à purger", () => {
  assert.equal(sacPerime("{pas du json", { email: "a@b.c" }), true);
  assert.equal(sacPerime(JSON.stringify({ firstName: "X" }), { email: "a@b.c" }), true);
  assert.equal(sacPerime(null, { email: "a@b.c" }), false);
});
