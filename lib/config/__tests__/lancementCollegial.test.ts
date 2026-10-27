/* Suite — lib/config/lancementCollegial.ts (interrupteur du lancement collégial, lot C1 cégep) et
   optionsAnneeCegep() de lib/config/gradYears.ts.

   Lancement :
     node --experimental-strip-types \
       --import ./lib/evaluations/__tests__/register-alias.mjs \
       --test "lib/config/__tests__/lancementCollegial.test.ts"
*/

import test from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CLE_LANCEMENT_COLLEGIAL, lancementCollegialDepuisValeur, lireLancementCollegial } from "@/lib/config/lancementCollegial";
import { optionsAnneeCegep, LIBELLE_ANNEE_CEGEP } from "@/lib/config/gradYears";

test("valeur : ON seulement pour « true », casse et espaces ignorés", () => {
  for (const v of ["true", "TRUE", " True "]) assert.equal(lancementCollegialDepuisValeur(v), true, v);
  for (const v of ["false", "", "oui", "1", "t", null, undefined]) assert.equal(lancementCollegialDepuisValeur(v), false, String(v));
});

/** Faux client : rend `reponse` à la fin de la chaîne, ou lève si `reponse` est une Error. Note la clé lue. */
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

test("lecture : ligne true → ON ; absente, false, erreur ou exception → OFF", async () => {
  const cles: string[] = [];
  assert.equal(await lireLancementCollegial(client({ data: { value: "true" }, error: null }, cles)), true);
  assert.deepEqual(cles, [CLE_LANCEMENT_COLLEGIAL]);
  assert.equal(CLE_LANCEMENT_COLLEGIAL, "lancement_collegial");
  assert.equal(await lireLancementCollegial(client({ data: { value: "false" }, error: null })), false);
  assert.equal(await lireLancementCollegial(client({ data: null, error: null })), false);
  assert.equal(await lireLancementCollegial(client({ data: null, error: { message: "boom" } })), false);
  assert.equal(await lireLancementCollegial(client(new Error("réseau"))), false);
});

test("rattachement refusé par le verrou collégial : la phrase de la base, sans le préfixe NEXUS", async () => {
  const { attachmentErrorMessage } = await import("@/lib/queries/shared/attachmentErrors");
  const msg = "NEXUS: Les cégeps ne sont pas encore ouverts sur Nexus. Ça arrive bientôt.";
  assert.equal(attachmentErrorMessage({ message: msg }), "Les cégeps ne sont pas encore ouverts sur Nexus. Ça arrive bientôt.");
});

const le = (a: number, m: number, j: number) => new Date(a, m - 1, j, 12);
const valeurs = (d: Date, garder?: string | null) => optionsAnneeCegep(d, garder).map((o) => o.value);

test("année de fin de cégep : de la fin de la saison courante à +3, sans présélection", () => {
  assert.equal(LIBELLE_ANNEE_CEGEP, "Année où tu finis ton cégep");
  assert.deepEqual(valeurs(le(2026, 10, 27)), ["2027", "2028", "2029", "2030"]);
  assert.deepEqual(valeurs(le(2027, 6, 30)), ["2027", "2028", "2029", "2030"]);
  assert.deepEqual(valeurs(le(2027, 7, 1)), ["2028", "2029", "2030", "2031"]);
});

test("année de fin de cégep : une année déjà enregistrée hors fenêtre reste offerte, une seule fois", () => {
  assert.deepEqual(valeurs(le(2026, 10, 27), "2031"), ["2027", "2028", "2029", "2030", "2031"]);
  assert.deepEqual(valeurs(le(2026, 10, 27), "2028"), ["2027", "2028", "2029", "2030"]);
  assert.deepEqual(valeurs(le(2026, 10, 27), ""), ["2027", "2028", "2029", "2030"]);
});
