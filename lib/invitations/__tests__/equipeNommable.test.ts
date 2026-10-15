/* RÈGLE RSEQ (décision BP du 2026-10-15) : un écran destiné à un athlète ne nomme jamais un coach,
   ni une équipe ou une école collégiale. « Invitation de {Équipe} — {École} » seulement pour une
   équipe secondaire ou civile. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { equipeNommable, titreInvitation } from "@/lib/invitations/equipeNommable";

const GENERIQUE = "Invitation à rejoindre une équipe";

test("seules les équipes secondaires et civiles sont nommables", () => {
  assert.equal(equipeNommable("SECONDAIRE"), true);
  assert.equal(equipeNommable("LIGUE_CIVILE"), true);
  assert.equal(equipeNommable("secondaire"), true);
  for (const t of ["CEGEP", "cegep", "UNIVERSITE", "", null, undefined, 3, {}]) {
    assert.equal(equipeNommable(t), false, String(t));
  }
});

test("équipe secondaire ou civile : « Invitation de {Équipe} — {École} »", () => {
  assert.equal(titreInvitation({ typeEcole: "SECONDAIRE", equipe: "Dragons Juvénile", ecole: "École Saint-Jean-Eudes" }),
    "Invitation de Dragons Juvénile — École Saint-Jean-Eudes");
  assert.equal(titreInvitation({ typeEcole: "LIGUE_CIVILE", equipe: "Lions M18 AAA", ecole: null }),
    "Invitation de Lions M18 AAA");
});

test("équipe ou école collégiale (ou inconnue) : JAMAIS nommée", () => {
  for (const typeEcole of ["CEGEP", null, undefined, "AUTRE"]) {
    const t = titreInvitation({ typeEcole, equipe: "Nordiques Football D1", ecole: "Cégep de Lévis" });
    assert.equal(t, GENERIQUE, String(typeEcole));
    assert.doesNotMatch(t, /Nordiques|Lévis|C[ée]gep/);
  }
  // Sans nom d'équipe, même une équipe secondaire reste générique.
  assert.equal(titreInvitation({ typeEcole: "SECONDAIRE", equipe: "  ", ecole: "École X" }), GENERIQUE);
});

/* Les écrans web de l'athlète : plus de « Créé par ton coach » ni « ton entraîneur » génériques ;
   « Invité par {coach} » SEULEMENT derrière la règle (équipe nommable ET coach nommable en base). */
const ECRANS = [
  "app/athlete/notifications/_components/PendingInvitations.tsx",
  "components/auth/ClaimProfileModal.tsx",
  "components/athlete/JoinCodeField.tsx",
  "app/join/[code]/page.tsx",
];

/** Le texte visible : on retire les commentaires (blocs, lignes et JSX). */
function sansCommentaires(src: string): string {
  return src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

test("écrans athlète (web) : aucun coach ni entraîneur dans le texte affiché", () => {
  for (const f of ECRANS) {
    const src = sansCommentaires(fs.readFileSync(path.resolve(f), "utf8"));
    assert.doesNotMatch(src, /Créé par ton coach|entra[iî]neur|un coach|ton coach|coach \$\{/i, f);
    // Aucun nom de coach lu directement côté client : seulement par la règle en base.
    assert.doesNotMatch(src, /invited_by_coach:|users:coach_id|users!invited_by_coach_id/, f);
    const invitePar = src.match(/Invité par/g) ?? [];
    if (f.endsWith("PendingInvitations.tsx")) {
      assert.equal(invitePar.length, 1, f);
      assert.match(src, /\{nommable && inv\.coachNom && \(\s*<p[^>]*data-coach-invitation>Invité par \{inv\.coachNom\}/, f);
      assert.match(src, /rpc\("invitation_equipe_coach"/, f);
    } else {
      assert.equal(invitePar.length, 0, f);
    }
  }
});

test("écrans athlète (web) : la règle de nommage est branchée partout où une équipe s'affiche", () => {
  for (const f of ECRANS) {
    const src = fs.readFileSync(path.resolve(f), "utf8");
    assert.match(src, /equipeNommable\(/, f);
  }
  const carte = fs.readFileSync(path.resolve(ECRANS[0]), "utf8");
  assert.match(carte, /schools!school_id\(name, type\)/);
  assert.match(carte, /titreInvitation\(/);
});
