import { test } from "node:test";
import assert from "node:assert/strict";
import { etatRappel, libelleRappelIndisponible, messageReponse, TEXTE_IMPOSSIBLE } from "@/lib/cartes/rappelInvitation";

const partie = { courriel: "a@b.ca", invitationEtat: "ENVOYEE" as const, inviteeLe: "2026-09-01T12:00:00Z", renvoisInvitation: 0, dernierRenvoiLe: null };
const le = (iso: string) => new Date(iso);

test("sans courriel : rien", () => {
  assert.equal(etatRappel({ ...partie, courriel: null }), null);
  assert.equal(etatRappel({ ...partie, courriel: "  " }), null);
});

test("téléphone sans courriel : COPIE_SEULE — « Copier le texte » sans bouton d'envoi (lot 2)", () => {
  const e = etatRappel({ ...partie, courriel: null, invitationEtat: null, inviteeLe: null, telephone: "4385550199" })!;
  assert.equal(e.type, "COPIE_SEULE");
  assert.equal(libelleRappelIndisponible(e), null, "aucun libellé d'indisponibilité");
  assert.equal(etatRappel({ ...partie, courriel: null, telephone: "  " }), null, "téléphone vide : rien");
  // Un courriel l'emporte : le téléphone ne change rien à l'état d'une carte qui en a un.
  assert.equal(etatRappel({ ...partie, telephone: "4385550199" }, le("2026-09-20T00:00:00Z"))!.type, "DISPONIBLE");
});

test("invitation écartée : « Impossible d'envoyer à cette adresse », sans raison", () => {
  const e = etatRappel({ ...partie, invitationEtat: "NON_ENVOYEE", inviteeLe: null })!;
  assert.equal(e.type, "IMPOSSIBLE");
  assert.equal(libelleRappelIndisponible(e), "Impossible d'envoyer à cette adresse");
  assert.doesNotMatch(TEXTE_IMPOSSIBLE, /compte|désabonn|déjà invit/i);
});

test("invitation en attente ou en échec : pas de rappel Nexus", () => {
  assert.equal(etatRappel({ ...partie, invitationEtat: null, inviteeLe: null })!.type, "AUCUN");
});

test("l'invitation automatique compte comme le premier envoi : 7 jours avant le premier rappel", () => {
  const e = etatRappel(partie, le("2026-09-05T12:00:00Z"))!;
  assert.equal(e.type, "ATTENTE");
  assert.equal(libelleRappelIndisponible(e), "Rappel possible le 8 septembre 2026");
  assert.equal(etatRappel(partie, le("2026-09-08T12:00:01Z"))!.type, "DISPONIBLE");
});

test("après un rappel : « Renvoyé le … — disponible à nouveau le … »", () => {
  const e = etatRappel({ ...partie, renvoisInvitation: 1, dernierRenvoiLe: "2026-09-20T15:00:00Z" }, le("2026-09-22T00:00:00Z"))!;
  assert.equal(libelleRappelIndisponible(e), "Renvoyé le 20 septembre 2026 — disponible à nouveau le 27 septembre 2026");
});

test("au plus 3 rappels", () => {
  const e = etatRappel({ ...partie, renvoisInvitation: 3, dernierRenvoiLe: "2026-01-01T00:00:00Z" }, le("2026-12-01T00:00:00Z"))!;
  assert.equal(e.type, "LIMITE");
  assert.equal(libelleRappelIndisponible(e), "3 rappels envoyés — plus de renvoi possible");
});

test("les réponses de la base se lisent sans raison", () => {
  assert.equal(messageReponse({ etat: "IMPOSSIBLE" }).texte, "Impossible d'envoyer à cette adresse");
  assert.equal(messageReponse({ etat: "TROP_TOT", dernier_le: "2026-09-20T15:00:00Z", disponible_le: "2026-09-27T15:00:00Z" }).texte,
    "Renvoyé le 20 septembre 2026 — disponible à nouveau le 27 septembre 2026");
  assert.equal(messageReponse({ etat: "ENVOI_LANCE" }).ton, "ok");
});
