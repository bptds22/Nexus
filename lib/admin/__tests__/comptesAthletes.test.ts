/* ═══════════════════════════════════════════════════════════════
   Comptes athlètes — le total que /admin/athletes ET /admin/dashboard
   affichent. En prod (2026-09-23) le total annonçait 190 pour 189
   comptes de rôle ATHLETE : une fiche était rattachée à un compte
   ADMIN. Elle reste visible, comptée à part, hors total.
   ═══════════════════════════════════════════════════════════════ */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  datesCreationComptes,
  inscriptionDeFiche,
  repartitionComptesAthletes,
} from "@/lib/admin/comptesAthletes";

const fiche = (user_id: string | null, compte: Record<string, unknown> | null) => ({ user_id, compte });

test("classement : complète, commencée, sans compte, compte non athlète", () => {
  assert.equal(inscriptionDeFiche(fiche("u1", { role: "ATHLETE", onboarding_complete: true })), "complete");
  assert.equal(inscriptionDeFiche(fiche("u2", { role: "ATHLETE", onboarding_complete: false })), "commencee");
  assert.equal(inscriptionDeFiche(fiche(null, null)), "sans_compte");
  assert.equal(inscriptionDeFiche(fiche("u3", { role: "ADMIN", onboarding_complete: true })), "compte_non_athlete");
  // L'embed PostgREST peut arriver en tableau.
  assert.equal(inscriptionDeFiche(fiche("u4", [{ role: "COACH" }] as unknown as Record<string, unknown>)), "compte_non_athlete");
});

test("rôle inconnu : on garde l'ancien classement, on n'exclut pas en silence", () => {
  assert.equal(inscriptionDeFiche(fiche("u5", { onboarding_complete: true })), "complete");
  assert.equal(inscriptionDeFiche(fiche("u6", null)), "commencee");
});

test("le total exclut les fiches sans compte ET celles d'un autre rôle", () => {
  const r = repartitionComptesAthletes(["complete", "complete", "commencee", "sans_compte", "compte_non_athlete"], 3);
  assert.deepEqual(r, { complete: 2, commencee: 1, sansFiche: 3, sansCompte: 1, compteNonAthlete: 1, comptes: 6 });
});

test("les dates de création couvrent exactement le périmètre du total", () => {
  const dates = datesCreationComptes(
    [
      fiche("u1", { role: "ATHLETE", onboarding_complete: true, created_at: "2026-09-01T00:00:00Z" }),
      fiche("u2", { role: "ATHLETE", onboarding_complete: false, created_at: "2026-09-02T00:00:00Z" }),
      fiche("u3", { role: "ADMIN", onboarding_complete: true, created_at: "2026-09-03T00:00:00Z" }),
      fiche(null, null),
    ],
    [{ inscrit_le: "2026-09-04T00:00:00Z" }],
  );
  assert.deepEqual(dates, ["2026-09-01T00:00:00Z", "2026-09-02T00:00:00Z", "2026-09-04T00:00:00Z"]);
});
