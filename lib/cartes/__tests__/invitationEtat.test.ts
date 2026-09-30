import { test } from "node:test";
import assert from "node:assert/strict";
import { mentionInvitation, MENTION_INVITATION_NON_ENVOYEE } from "@/lib/cartes/invitationEtat";

test("mention neutre, mot pour mot (décision BP 2026-09-30)", () => {
  assert.equal(
    MENTION_INVITATION_NON_ENVOYEE,
    "Aucune invitation envoyée depuis cette carte : cette adresse a déjà reçu une invitation Nexus récemment, ou ne peut pas en recevoir.",
  );
});

test("écartée → la mention neutre", () => {
  assert.deepEqual(mentionInvitation(null, "NON_ENVOYEE"), { type: "NON_ENVOYEE", texte: MENTION_INVITATION_NON_ENVOYEE });
});

test("envoyée → la date, même si l'état tarde", () => {
  assert.deepEqual(mentionInvitation("2026-09-30T19:32:35Z", null), { type: "ENVOYEE", le: "2026-09-30T19:32:35Z" });
  assert.deepEqual(mentionInvitation("2026-09-30T19:32:35Z", "ENVOYEE"), { type: "ENVOYEE", le: "2026-09-30T19:32:35Z" });
});

test("pas d'adresse, en attente ou en échec → rien", () => {
  assert.equal(mentionInvitation(null, null), null);
  assert.equal(mentionInvitation(undefined, undefined), null);
});

test("la mention ne nomme jamais la raison", () => {
  assert.doesNotMatch(MENTION_INVITATION_NON_ENVOYEE, /compte|désabonn|autre (unité|cégep)|inscrit/i);
});
