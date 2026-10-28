/* Suite — lib/auth/recruteurUniversitaire.ts (lot D2b cégep) et lib/config/lancementUniversitaire.ts.

   Lancement :
     node --experimental-strip-types \
       --import ./lib/evaluations/__tests__/register-alias.mjs \
       --test "lib/auth/__tests__/recruteurUniversitaire.test.ts"
*/

import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  contexteRecruteurDemande, destinationRecruteur, messageFinRecruteur, MESSAGE_UNIVERSITES_FERMEES,
} from "@/lib/auth/recruteurUniversitaire";
import { CLE_LANCEMENT_UNIVERSITAIRE, lireLancementUniversitaire } from "@/lib/config/lancementUniversitaire";

test("contexte demandé : universitaire seulement sous ON, sinon collégial", () => {
  assert.equal(contexteRecruteurDemande("universitaire", true), "universitaire");
  assert.equal(contexteRecruteurDemande("universitaire", false), "collegial");
  assert.equal(contexteRecruteurDemande("collegial", true), "collegial");
  assert.equal(contexteRecruteurDemande(null, true), "collegial");
  assert.equal(contexteRecruteurDemande("ADMIN", true), "collegial");
});

test("destination : attente pour l'universitaire, portail pour le collégial", () => {
  assert.equal(destinationRecruteur("universitaire"), "/universitaire/en-validation");
  assert.equal(destinationRecruteur("collegial"), "/recruteur/tableau-de-bord");
  assert.equal(destinationRecruteur(null), "/recruteur/tableau-de-bord");
});

test("refus de la fin d'inscription : un message par code, selon la branche", () => {
  assert.equal(messageFinRecruteur("NEXUS: Les universités ne sont pas encore ouvertes sur Nexus. Ça arrive bientôt.", true), MESSAGE_UNIVERSITES_FERMEES);
  assert.match(messageFinRecruteur("SCHOOL_REQUIRES_RESPONSABLE", true), /^Cette université n'a pas encore de responsable/);
  assert.match(messageFinRecruteur("SCHOOL_REQUIRES_RESPONSABLE", false), /^Ce CÉGEP n'a pas encore de responsable/);
  assert.equal(messageFinRecruteur("INVALID_UNIVERSITE", true), "Université invalide — réessaye.");
  assert.match(messageFinRecruteur("INVALID_TEAM", true), /n'appartient pas à ton université/);
  assert.equal(messageFinRecruteur("WRONG_ROLE_OR_CONTEXT", true), "Ce flux est réservé aux recruteurs universitaires.");
  assert.equal(messageFinRecruteur("WRONG_ROLE_OR_CONTEXT", false), "Ce flux est réservé aux recruteurs CÉGEP.");
  assert.equal(messageFinRecruteur("boom", true), "Erreur lors de la finalisation — réessaye.");
});

function client(reponse: unknown, cles: string[] = []): SupabaseClient {
  const chaine = {
    select: () => chaine,
    eq: (_col: string, v: string) => { cles.push(v); return chaine; },
    maybeSingle: async () => {
      if (reponse instanceof Error) throw reponse;
      return reponse;
    },
  };
  return { from: () => chaine } as unknown as SupabaseClient;
}

test("interrupteur universitaire : ligne true → ON ; absente, false, erreur ou exception → OFF", async () => {
  const cles: string[] = [];
  assert.equal(await lireLancementUniversitaire(client({ data: { value: "true" }, error: null }, cles)), true);
  assert.deepEqual(cles, [CLE_LANCEMENT_UNIVERSITAIRE]);
  assert.equal(CLE_LANCEMENT_UNIVERSITAIRE, "lancement_universitaire");
  assert.equal(await lireLancementUniversitaire(client({ data: { value: "false" }, error: null })), false);
  assert.equal(await lireLancementUniversitaire(client({ data: null, error: null })), false);
  assert.equal(await lireLancementUniversitaire(client({ data: null, error: { message: "boom" } })), false);
  assert.equal(await lireLancementUniversitaire(client(new Error("réseau"))), false);
});
