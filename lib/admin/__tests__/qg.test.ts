/* ═══════════════════════════════════════════════════════════════
   QG admin — échéances Loi 25, point de départ des lectures et forme
   de la réponse (des nombres, aucun identifiant).
   ═══════════════════════════════════════════════════════════════ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { construireQg, echeancesLoi25, jourMontreal, lectureDepuis, lireGranularite, plusJours } from "@/lib/admin/qg";
import type { Lignes } from "@/lib/admin/indicateurs";

test("jour à Montréal et calendrier : 22 h à Montréal = encore le même jour", () => {
  assert.equal(jourMontreal(new Date("2026-10-23T02:00:00Z")), "2026-10-22");
  assert.equal(plusJours("2026-02-20", 10), "2026-03-02");
  assert.equal(plusJours("2028-02-20", 10), "2028-03-01"); // 2028 : 29 février
});

test("Loi 25 : en retard, sous 7 jours, prochaine échéance ; suppression = dépôt + 30 jours", () => {
  const maintenant = new Date("2026-10-22T16:00:00Z");
  const e = echeancesLoi25(maintenant, ["2026-10-20", "2026-10-29", "2026-11-30", ""], ["2026-09-25T15:00:00Z"]);
  // Suppression déposée le 25 sept. → échéance le 25 oct. (sous 7 jours).
  assert.deepEqual(e, { ouvertes: 4, portabilite: 3, suppression: 1, en_retard: 1, sous_7_jours: 2, prochaine: "2026-10-20" });
  assert.deepEqual(echeancesLoi25(maintenant, [], []),
    { ouvertes: 0, portabilite: 0, suppression: 0, en_retard: 0, sous_7_jours: 0, prochaine: null });
});

test("lectures : depuis le début de la série (12 mois) ou la période d'avant, le plus ancien", () => {
  const t = new Date("2026-10-22T19:00:00Z");
  assert.equal(lectureDepuis(t, "mois").toISOString(), "2025-11-01T04:00:00.000Z");
  assert.equal(lectureDepuis(t, "jour").toISOString(), "2026-09-23T04:00:00.000Z");
  assert.equal(lireGranularite("mois"), "mois");
  assert.equal(lireGranularite("n'importe quoi"), "jour");
  assert.equal(lireGranularite(null), "jour");
});

test("construireQg : séries de la bonne longueur, la dernière en cours, aucun identifiant dans la réponse", () => {
  const l: Lignes = {
    fiches: [{ id: "11111111-1111-4111-8111-111111111111", user_id: "u1", compte: { onboarding_complete: true, created_at: "2026-10-22T13:00:00Z", role: "ATHLETE" }, profile_completion: 90, verified: true }],
    sansFiche: [],
    comptes: [
      { id: "u1", role: "ATHLETE", created_at: "2026-10-22T13:00:00Z" },
      { id: "r1", role: "RECRUTEUR", created_at: "2026-10-21T13:00:00Z" },
    ],
    vues: [{ recruiter_id: "r1", viewed_at: "2026-10-22T14:00:00Z" }],
    vuesAthletes: [{ athlete_id: "11111111-1111-4111-8111-111111111111" }],
    favoris: [], journalProcessus: [], messages: [], suivis: [], journalCartes: [], notesMatch: [],
    ecolesNonListees: 0, loi25Portabilite: 0, loi25Suppression: 0, reclamations: 0,
    statsV2: { accepte_v2: 1, refuse_v2: 0, en_attente: 2, jamais_demande: 3 },
    invReclamees: 0, invEnAttente: 0, invExpirees: 0, athletesActifs: 1,
  };
  const x = { connectes: { courant: { total: 2, par_role: { ATHLETE: 2 } }, precedent: { total: 1, par_role: { COACH: 1 } } }, echeancesPortabilite: [], suppressionsDeposees: [] };
  const maintenant = new Date("2026-10-22T19:00:00Z");
  const j = construireQg(l, x, maintenant, "jour");
  assert.equal(j.croissance.serie.length, 30);
  assert.equal(j.croissance.serie[29].en_cours, true);
  assert.equal(j.croissance.serie[29].athletes, 1);
  assert.deepEqual(j.croissance.nouveaux.athletes, { courant: 1, precedent: 0 });
  assert.deepEqual(j.croissance.nouveaux.par_role.RECRUTEUR, { courant: 0, precedent: 1 });
  assert.deepEqual(j.recruteurs.tuiles.recruteurs_actifs, { courant: 1, precedent: 0 });
  assert.deepEqual(j.aujourdhui.consentements_v2, { acceptes: 1, refuses: 0, en_attente: 2, jamais_demande: 3 });
  assert.equal(construireQg(l, x, maintenant, "semaine").recruteurs.serie.length, 12);
  assert.equal(construireQg(l, x, maintenant, "mois").croissance.serie.length, 12);
  const texte = JSON.stringify(j);
  assert.doesNotMatch(texte, /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
  assert.doesNotMatch(texte, /"(u1|r1)"/);
});
