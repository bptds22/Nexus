/* Suite — lib/config/lancementCivil.ts (interrupteur du lancement civil, lot 7).

   Lancement :
     node --experimental-strip-types \
       --import ./lib/evaluations/__tests__/register-alias.mjs \
       --test "lib/config/__tests__/lancementCivil.test.ts"
*/

import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lancementCivilDepuisValeur, lireLancementCivil } from "@/lib/config/lancementCivil";

test("valeur : ON seulement pour « true », casse et espaces ignorés", () => {
  for (const v of ["true", "TRUE", " True "]) assert.equal(lancementCivilDepuisValeur(v), true, v);
  for (const v of ["false", "", "oui", "1", "t", null, undefined]) assert.equal(lancementCivilDepuisValeur(v), false, String(v));
});

/** Faux client : rend `reponse` à la fin de la chaîne, ou lève si `reponse` est une Error. */
function client(reponse: unknown): SupabaseClient {
  const chaine = {
    select: () => chaine,
    eq: () => chaine,
    maybeSingle: async () => {
      if (reponse instanceof Error) throw reponse;
      return reponse;
    },
  };
  return { from: () => chaine } as unknown as SupabaseClient;
}

test("lecture : ligne true → ON ; absente, false, erreur ou exception → OFF", async () => {
  assert.equal(await lireLancementCivil(client({ data: { value: "true" }, error: null })), true);
  assert.equal(await lireLancementCivil(client({ data: { value: "false" }, error: null })), false);
  assert.equal(await lireLancementCivil(client({ data: null, error: null })), false);
  assert.equal(await lireLancementCivil(client({ data: null, error: { message: "boom" } })), false);
  assert.equal(await lireLancementCivil(client(new Error("réseau"))), false);
});

test("rattachement refusé par le verrou : la phrase de la base, sans le préfixe NEXUS", async () => {
  const { attachmentErrorMessage, ATTACHMENT_FALLBACK } = await import("@/lib/queries/shared/attachmentErrors");
  const msg = "NEXUS: Cette équipe sera ouverte au lancement des ligues civiles sur Nexus. Réessaie bientôt.";
  assert.equal(attachmentErrorMessage({ message: msg }),
    "Cette équipe sera ouverte au lancement des ligues civiles sur Nexus. Réessaie bientôt.");
  assert.equal(attachmentErrorMessage({ message: "NEXUS: autre refus" }), ATTACHMENT_FALLBACK);
  assert.equal(attachmentErrorMessage({ message: "P0001: ATHLETE_UNDER_14" }).startsWith("Tu dois avoir 14 ans"), true);
});
