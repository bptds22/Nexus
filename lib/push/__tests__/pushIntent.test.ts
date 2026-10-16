/* Suite — lib/push/pushIntent.ts.

   Ne couvre que les fonctions PURES et resolveDestination, qui reçoit un
   faux client Supabase (aucun réseau). savePendingIntent/takePendingIntent
   ne sont pas testés ici : ils passent par @capacitor/preferences, dont le
   comportement natif est justement ce que la passe simulateur mesure.

   Ce que ces cas verrouillent, et qui n'est pas rejouable à la main sans
   un appareil : un data sans type ne fait RIEN, un type inconnu ouvre les
   notifications (A5), une route hors liste blanche n'est jamais suivie, et
   le repli sur l'inbox quand
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

test("parsePushData — data absent, vide ou sans type ne donne RIEN", () => {
  // Pas un push Nexus : aucun chemin ne s'active.
  assert.equal(parsePushData(undefined), null);
  assert.equal(parsePushData(null), null);
  assert.equal(parsePushData({}), null);
  assert.equal(parsePushData("message"), null);
});

test("parsePushData — A5 : un type inconnu ouvre les notifications", () => {
  assert.equal(parsePushData({ type: "autre_chose", id: CONV })?.kind, "notifications");
});

/* ═══ A5 : nx_type + route, liste blanche ════════════════════════ */

const route = (d: unknown) => (parsePushData(d) as { route?: string } | null)?.route;

test("parsePushData — A5 : chaque type A4a donne son écran", () => {
  const base = { type: "announcement", categorie: "BADGES_EVALUATIONS", envoi_id: "12" };
  assert.equal(route({ ...base, nx_type: "BADGE_COACH" }), "/athlete/profil/apercu?section=badges");
  assert.equal(route({ ...base, nx_type: "BADGE_PARTENAIRE" }), "/athlete/profil/apercu?section=badges");
  assert.equal(route({ ...base, nx_type: "EVALUATION_COACH" }), "/athlete/profil/apercu?section=evaluation");
  assert.equal(route({ ...base, nx_type: "EVALUATION_PARTENAIRE" }), "/athlete/profil/apercu?section=evaluation");
  assert.equal(route({ ...base, nx_type: "CARTE_PARTENAIRE" }), "/athlete/cartes-partenaires");
  assert.equal(route({ type: "announcement", nx_type: "TEAM_INVITATION" }), "/athlete/notifications?section=invitations");
});

test("parsePushData — A5 : une route reçue hors liste blanche n'est JAMAIS suivie", () => {
  assert.equal(route({ type: "announcement", nx_type: "BADGE_COACH", route: "https://exemple.com" }),
    "/athlete/profil/apercu?section=badges");
  assert.equal(route({ type: "announcement", nx_type: "BADGE_COACH", route: "/admin" }),
    "/athlete/profil/apercu?section=badges");
  // Route permise, même si elle diffère du type : gardée (le serveur décide dans la liste).
  assert.equal(route({ type: "announcement", nx_type: "BADGE_COACH", route: "/athlete/cartes-partenaires" }),
    "/athlete/cartes-partenaires");
});

test("parsePushData — A5 : nx_type inconnu → notifications ; sans nx_type → accueil comme en 1.4.4", () => {
  assert.equal(parsePushData({ type: "announcement", nx_type: "NOUVEAU_GENRE" })?.kind, "notifications");
  assert.equal(parsePushData({ type: "announcement", nx_type: "NOUVEAU_GENRE", route: "/x" })?.kind, "notifications");
  assert.equal(parsePushData({ type: "announcement", athlete_id: CONV })?.kind, "announcement");
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

test("resolveDestination — A5 : l'écran du jeune pour un ATHLETE, l'accueil pour les autres", async () => {
  const r: PushIntent = { kind: "route", route: "/athlete/cartes-partenaires", ts: Date.now() };
  assert.equal(await resolveDestination(fakeSupabase(true), "ATHLETE", r), "/athlete/cartes-partenaires");
  assert.equal(await resolveDestination(fakeSupabase(true), "COACH", r), "/coach");
  assert.equal(await resolveDestination(fakeSupabase(true), "", r), null);
});

test("resolveDestination — A5 : notifications du jeune ; accueil pour les rôles sans écran", async () => {
  const n: PushIntent = { kind: "notifications", ts: Date.now() };
  assert.equal(await resolveDestination(fakeSupabase(true), "ATHLETE", n), "/athlete/notifications");
  assert.equal(await resolveDestination(fakeSupabase(true), "COACH", n), "/coach");
  assert.equal(await resolveDestination(fakeSupabase(true), "RECRUTEUR", n), "/recruteur");
});
