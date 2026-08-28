/* Suite — lib/push/pushIntent.ts.

   Ne couvre que les fonctions PURES et resolveDestination, qui reçoit un
   faux client Supabase (aucun réseau). savePendingIntent/takePendingIntent
   ne sont pas testés ici : ils passent par @capacitor/preferences, dont le
   comportement natif est justement ce que la passe simulateur mesure.

   Ce que ces cas verrouillent, et qui n'est pas rejouable à la main sans
   un appareil : la règle « tout ce qui n'est pas reconnu ne fait RIEN »
   (garantie de non-régression du tap) et le repli sur l'inbox quand
   l'usager n'est pas participant du fil.

   Lancement (le glob de `npm test` ne couvre que lib/evaluations) :
     node --experimental-strip-types \
       --import ./lib/evaluations/__tests__/register-alias.mjs \
       --test "lib/push/__tests__/*.test.ts"
*/

import test from "node:test";
import assert from "node:assert/strict";
import { parsePushData, resolveDestination, type PushIntent } from "@/lib/push/pushIntent";

const CONV = "47d6dd39-83b6-4990-a8a3-cba6e5db567e"; // uuid réel d'un fil de prod

/* ── Faux client Supabase ────────────────────────────────────────────
   Reproduit la chaîne exacte utilisée : from().select().eq().maybeSingle().
   `participant` décide de ce que la RLS aurait renvoyé. */
function fakeSupabase(participant: boolean) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: participant ? { id: CONV } : null }),
        }),
      }),
    }),
  } as never;
}

const MESSAGE: PushIntent = { kind: "message", conversationId: CONV, ts: Date.now() };
const ANNONCE: PushIntent = { kind: "announcement", ts: Date.now() };

/* ═══ parsePushData ═══════════════════════════════════════════════ */

test("parsePushData — un message avec un uuid donne une intention", () => {
  const i = parsePushData({ type: "message", conversation_id: CONV });
  assert.deepEqual(i?.kind, "message");
  assert.equal((i as { conversationId: string }).conversationId, CONV);
});

test("parsePushData — une annonce donne une intention sans id", () => {
  const i = parsePushData({ type: "announcement", announcement_id: CONV });
  assert.equal(i?.kind, "announcement");
});

test("parsePushData — data absent, vide ou inconnu ne donne RIEN", () => {
  // La garantie « rien ne casse » : sans intention, aucun chemin nouveau.
  assert.equal(parsePushData(undefined), null);
  assert.equal(parsePushData(null), null);
  assert.equal(parsePushData({}), null);
  assert.equal(parsePushData({ type: "autre_chose", id: CONV }), null);
  assert.equal(parsePushData("message"), null);
});

test("parsePushData — un conversation_id qui n'est pas un uuid est refusé", () => {
  // Un id bidon naviguerait vers un fil inexistant : on refuse en amont.
  assert.equal(parsePushData({ type: "message", conversation_id: "42" }), null);
  assert.equal(parsePushData({ type: "message", conversation_id: "" }), null);
  assert.equal(parsePushData({ type: "message" }), null);
});

/* ═══ resolveDestination ══════════════════════════════════════════ */

test("resolveDestination — participant : le fil, par query-param", async () => {
  assert.equal(
    await resolveDestination(fakeSupabase(true), "ATHLETE", MESSAGE),
    `/athlete/messages?id=${CONV}`,
  );
  assert.equal(
    await resolveDestination(fakeSupabase(true), "COACH", MESSAGE),
    `/coach/demandes?id=${CONV}`,
  );
  assert.equal(
    await resolveDestination(fakeSupabase(true), "RECRUTEUR", MESSAGE),
    `/recruteur/messages?id=${CONV}`,
  );
});

test("resolveDestination — PAS participant : l'inbox, jamais une erreur", async () => {
  // Vieux jeton, autre compte sur le même téléphone, fil supprimé.
  assert.equal(await resolveDestination(fakeSupabase(false), "ATHLETE", MESSAGE), "/athlete/messages");
  assert.equal(await resolveDestination(fakeSupabase(false), "COACH", MESSAGE), "/coach/demandes");
  assert.equal(await resolveDestination(fakeSupabase(false), "RECRUTEUR", MESSAGE), "/recruteur/messages");
});

test("resolveDestination — une annonce va à l'accueil du portail", async () => {
  assert.equal(await resolveDestination(fakeSupabase(true), "ATHLETE", ANNONCE), "/athlete");
  assert.equal(await resolveDestination(fakeSupabase(true), "COACH", ANNONCE), "/coach");
  assert.equal(await resolveDestination(fakeSupabase(true), "RECRUTEUR", ANNONCE), "/recruteur");
  assert.equal(await resolveDestination(fakeSupabase(true), "ADMIN", ANNONCE), "/admin");
  assert.equal(await resolveDestination(fakeSupabase(true), "PARTNER", ANNONCE), "/partenaire");
});

test("resolveDestination — ADMIN/PARTNER n'ont pas de fil : accueil, pas d'URL inventée", async () => {
  assert.equal(await resolveDestination(fakeSupabase(true), "ADMIN", MESSAGE), "/admin");
  assert.equal(await resolveDestination(fakeSupabase(true), "PARTNER", MESSAGE), "/partenaire");
});

test("resolveDestination — rôle inconnu : null, l'appelant garde sa destination", async () => {
  assert.equal(await resolveDestination(fakeSupabase(true), "", MESSAGE), null);
  assert.equal(await resolveDestination(fakeSupabase(true), "SUPER_ADMIN", ANNONCE), null);
});
