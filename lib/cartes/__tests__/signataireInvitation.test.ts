/* send-invitation-carte : au nom de QUI part l'invitation (décision BP
   2026-10-07, 15 h 23). Le signataire est figé par la base sur la ligne
   d'invitation ; l'edge function le lit À PART et retombe sur le créateur
   s'il est NULL ou si la colonne n'existe pas (fenêtre de déploiement). */
import { test } from "node:test";
import assert from "node:assert/strict";

// emailLayout.ts lit Deno.env au chargement : un Deno minimal suffit ici.
(globalThis as unknown as { Deno: unknown }).Deno ??= { env: { get: () => undefined } };
// @ts-ignore TS5097 — node --experimental-strip-types EXIGE l'extension .ts.
const { traiterInvitation } = await import("../../../supabase/functions/send-invitation-carte/traiter.ts");

const CREATEUR = "00000000-0000-0000-0000-0000000000c1";
const COLLEGUE = "00000000-0000-0000-0000-0000000000c2";
const USERS: Record<string, { first_name: string; last_name: string }> = {
  [CREATEUR]: { first_name: "Rémi", last_name: "Créateur" },
  [COLLEGUE]: { first_name: "Julie", last_name: "Collègue" },
};

type Rep = { data: unknown; error: { message: string; code?: string } | null };

/** Client minimal : seules les requêtes de traiterInvitation sont servies. */
function faux(o: { signataire: string | null; colonneAbsente?: boolean }) {
  const ecritures: { table: string; patch: unknown }[] = [];
  const from = (table: string) => {
    const q = { op: "select", cols: "", patch: null as unknown, f: {} as Record<string, unknown> };
    const repondre = (): Rep => {
      if (q.op === "update") {
        ecritures.push({ table, patch: q.patch });
        if (table === "cartes_prospect_invitations" && q.f.statut === "A_ENVOYER") {
          // La réclamation : PostgREST rejette TOUTE la requête si une colonne du select manque.
          if (o.colonneAbsente && q.cols.includes("signataire")) {
            return { data: null, error: { message: 'column "signataire" does not exist', code: "42703" } };
          }
          return { data: { id: "00000000-0000-0000-0000-0000000000a1", carte_id: "carte-1", unite_cegep_id: "cegep-1" }, error: null };
        }
        return { data: null, error: null };
      }
      if (table === "cartes_prospect_invitations") {
        if (o.colonneAbsente) return { data: null, error: { message: 'column "signataire" does not exist', code: "42703" } };
        return { data: { signataire: o.signataire }, error: null };
      }
      if (table === "cartes_prospect") return { data: { id: "carte-1", prenom: "Xavier", courriel: "x@exemple.test", cree_par: CREATEUR }, error: null };
      if (table === "users") return { data: USERS[q.f.id as string] ?? null, error: null };
      if (table === "schools") return { data: { name: "Cégep de Saint-Jérôme" }, error: null };
      return { data: null, error: null };
    };
    const b = {
      update(p: unknown) { q.op = "update"; q.patch = p; return b; },
      select(c: string) { q.cols = c; return b; },
      eq(k: string, v: unknown) { q.f[k] = v; return b; },
      maybeSingle: async () => repondre(),
      then(ok: (r: Rep) => unknown, ko?: (e: unknown) => unknown) { return Promise.resolve(repondre()).then(ok, ko); },
    };
    return b;
  };
  return { client: { from }, ecritures };
}

async function envoyer(o: { signataire: string | null; colonneAbsente?: boolean }) {
  const { client, ecritures } = faux(o);
  let corps: { text: string } | null = null;
  const fetchFaux = (async (_url: string, init: { body: string }) => {
    corps = JSON.parse(init.body);
    return new Response(JSON.stringify({ id: "re_1" }), { status: 200 });
  }) as unknown as typeof fetch;
  const r = await traiterInvitation(
    { supabase: client, fetch: fetchFaux, resendApiKey: "k", desabonnementSecret: "s".repeat(40) },
    "00000000-0000-0000-0000-0000000000a1",
  );
  return { r, texte: (corps as { text: string } | null)?.text ?? "", ecritures };
}

test("signataire = le collègue qui a ajouté le courriel → son nom dans l'invitation", async () => {
  const { r, texte } = await envoyer({ signataire: COLLEGUE });
  assert.equal(r.statut, "ENVOYE");
  assert.match(texte, /Julie Collègue, recruteur au Cégep de Saint-Jérôme/);
  assert.doesNotMatch(texte, /Rémi Créateur/);
});

test("signataire = le créateur (carte créée avec courriel) → le nom du créateur", async () => {
  const { texte } = await envoyer({ signataire: CREATEUR });
  assert.match(texte, /Rémi Créateur, recruteur au Cégep de Saint-Jérôme/);
});

test("signataire NULL (invitation née avant la migration) → le nom du créateur", async () => {
  const { r, texte } = await envoyer({ signataire: null });
  assert.equal(r.statut, "ENVOYE");
  assert.match(texte, /Rémi Créateur, recruteur au Cégep de Saint-Jérôme/);
});

test("colonne absente (edge function déployée AVANT la migration) → l'envoi part quand même, au nom du créateur", async () => {
  const { r, texte, ecritures } = await envoyer({ signataire: null, colonneAbsente: true });
  assert.equal(r.statut, "ENVOYE");
  assert.match(texte, /Rémi Créateur, recruteur au Cégep de Saint-Jérôme/);
  assert.ok(ecritures.some((e) => e.table === "cartes_prospect_invitations" && (e.patch as { statut?: string }).statut === "ENVOYE"));
});
