/* ═══════════════════════════════════════════════════════════════
   Indicateurs admin partagés (écran mural + QG) — les définitions,
   sur un petit jeu de lignes écrit à la main.
   ═══════════════════════════════════════════════════════════════ */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activiteRecruteurs,
  consentementsV2,
  datesActivite,
  filesAttente,
  parcoursInscription,
  recruteursActifs,
  type Lignes,
} from "@/lib/admin/indicateurs";

const fen = { de: new Date("2026-10-15T00:00:00Z"), a: new Date("2026-10-22T00:00:00Z") };
const dans = "2026-10-20T12:00:00Z";
const hors = "2026-10-10T12:00:00Z";

function lignes(p: Partial<Lignes> = {}): Lignes {
  return {
    fiches: [], sansFiche: [], comptes: [], vues: [], vuesAthletes: [], favoris: [], journalProcessus: [],
    messages: [], suivis: [], journalCartes: [], notesMatch: [], ecolesNonListees: 0, loi25Portabilite: 0,
    loi25Suppression: 0, reclamations: 0, statsV2: {}, invReclamees: 0, invEnAttente: 0, invExpirees: 0,
    athletesActifs: 0, ...p,
  };
}

test("recruteurs actifs : chaque action compte une fois par recruteur ; messages et notes d'un non-recruteur exclus", () => {
  const l = lignes({
    comptes: [
      { id: "r1", role: "RECRUTEUR", created_at: null },
      { id: "r2", role: "RECRUTEUR", created_at: null },
      { id: "r3", role: "RECRUTEUR", created_at: null },
      { id: "c1", role: "COACH", created_at: null },
    ],
    vues: [{ recruiter_id: "r1", viewed_at: dans }, { recruiter_id: "r1", viewed_at: dans }],
    favoris: [{ recruiter_id: "r2", created_at: hors }],
    messages: [{ sender_id: "c1", created_at: dans }, { sender_id: "r2", created_at: dans }],
    notesMatch: [{ auteur: "c1", note_le: dans }],
    journalCartes: [{ acteur: "r3", created_at: dans }, { acteur: "c1", created_at: dans }, { acteur: null, created_at: dans }],
  });
  const a = activiteRecruteurs(l);
  assert.equal(recruteursActifs(l, a, fen), 3); // r1 (vues), r2 (message), r3 (carte)
  assert.equal(a.messagesRecruteurs.length, 1);
  assert.equal(a.notesRecruteurs.length, 0);
  const d = datesActivite(l, a);
  assert.equal(d.messages.length, 1);
  assert.equal(d.notes_match.length, 0);
  assert.equal(d.suivi_cartes.length, 3); // le suivi des cartes compte toutes les actions retenues
});

test("parcours : 5 étapes sur les fiches complètes ou commencées", () => {
  const compte = { onboarding_complete: true, created_at: dans, role: "ATHLETE" };
  const l = lignes({
    fiches: [
      { id: "a1", user_id: "u1", compte, profile_completion: 90, verified: true },
      { id: "a2", user_id: "u2", compte, profile_completion: 50, verified: false },
      { id: "a3", user_id: null, compte: null, profile_completion: 100, verified: true }, // sans compte
    ],
    sansFiche: [{ inscrit_le: dans }],
    vuesAthletes: [{ athlete_id: "a1" }, { athlete_id: "a3" }],
    suivis: [{ athlete_id: "a2" }],
  });
  assert.deepEqual(parcoursInscription(l), {
    inscrits: 3, profil_80: 1, valide_coach: 1, vu_recruteur: 1, suivi_recruteur: 1,
  });
});

test("consentements v2 : 4 cases lues dans les nouvelles clés ; absentes = 0", () => {
  assert.deepEqual(consentementsV2({ accepte_v2: 9, refuse_v2: 1, en_attente: 3, jamais_demande: 164, pas_repondu: 167 }),
    { acceptes: 9, refuses: 1, en_attente: 3, jamais_demande: 164 });
  assert.deepEqual(consentementsV2({}), { acceptes: 0, refuses: 0, en_attente: 0, jamais_demande: 0 });
});

test("files d'attente : Loi 25 = portabilité + suppression", () => {
  const f = filesAttente(lignes({ loi25Portabilite: 2, loi25Suppression: 1, invReclamees: 4, invEnAttente: 2, invExpirees: 1, ecolesNonListees: 5, reclamations: 1 }));
  assert.equal(f.loi25_ouvertes, 3);
  assert.deepEqual(f.invitations_parent, { reclamees: 4, en_attente: 2, expirees: 1 });
  assert.equal(f.ecoles_non_listees, 5);
});
