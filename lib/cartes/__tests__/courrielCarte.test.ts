import { test } from "node:test";
import assert from "node:assert/strict";
import {
  gesteCourriel, texteConfirmation, messageApresAjout, messageCreationCarte, AIDE_COURRIEL_CHANGE, TITRE_CONFIRMATION,
} from "@/lib/cartes/courrielCarte";
import { MENTION_INVITATION_NON_ENVOYEE } from "@/lib/cartes/invitationEtat";

test("geste : ajout, changement, retrait, inchangé (casse et espaces ignorés)", () => {
  assert.equal(gesteCourriel(null, "a@b.ca"), "AJOUT");
  assert.equal(gesteCourriel("  ", "a@b.ca"), "AJOUT");
  assert.equal(gesteCourriel("a@b.ca", "c@d.ca"), "CHANGEMENT");
  assert.equal(gesteCourriel("a@b.ca", null), "RETRAIT");
  assert.equal(gesteCourriel("A@B.ca ", "a@b.ca"), "INCHANGE");
  assert.equal(gesteCourriel(null, ""), "INCHANGE");
});

test("fenêtre « Envoyer l'invitation ? » : le texte de BP, mot pour mot", () => {
  assert.equal(TITRE_CONFIRMATION, "Envoyer l'invitation ?");
  assert.equal(texteConfirmation(" x@y.ca "),
    "Nexus enverra automatiquement à x@y.ca un courriel l'invitant à s'inscrire, à ton nom et à celui de ton cégep. Une seule fois.");
});

test("après l'ajout : « Nexus envoie l'invitation à … », ou la mention neutre — jamais le motif", () => {
  assert.deepEqual(messageApresAjout("x@y.ca", null), { ton: "ok", texte: "Nexus envoie l'invitation à x@y.ca." });
  const n = messageApresAjout("x@y.ca", "NON_ENVOYEE");
  assert.equal(n.texte, MENTION_INVITATION_NON_ENVOYEE);
  assert.doesNotMatch(n.texte, /compte|désabonn|x@y\.ca/i);
});

test("changement : la ligne d'aide de BP", () => {
  assert.equal(AIDE_COURRIEL_CHANGE, "Aucune nouvelle invitation n'est envoyée. Tu peux copier le texte pour l'envoyer toi-même.");
});

test("message de création web (BP 2026-10-07, 16 h 05) : aligné sur l'app, jamais le motif", () => {
  assert.equal(messageCreationCarte(" Léa Gagnon ", "lea@x.ca", null),
    "Carte prospect créée : Léa Gagnon. Nexus envoie l'invitation à lea@x.ca.");
  assert.equal(messageCreationCarte("Léa Gagnon", "lea@x.ca", "NON_ENVOYEE"),
    `Carte prospect créée : Léa Gagnon. ${MENTION_INVITATION_NON_ENVOYEE}`);
  assert.doesNotMatch(messageCreationCarte("Léa Gagnon", "lea@x.ca", "NON_ENVOYEE"), /lea@x\.ca|compte|désabonn/i);
  // Sans courriel : le message d'avant, tel quel.
  assert.equal(messageCreationCarte("Léa Gagnon", null, null), "Carte prospect créée : Léa Gagnon");
  assert.equal(messageCreationCarte("Léa Gagnon", "  ", "NON_ENVOYEE"), "Carte prospect créée : Léa Gagnon");
});
