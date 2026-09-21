/* ═══════════════════════════════════════════════════════════════
   Le jeton de désabonnement : signé par la fonction d'envoi (Deno),
   vérifié par la route /api/desabonnement (Node). Deux fichiers, un seul
   algorithme — ce test est ce qui les tient ensemble.
═══════════════════════════════════════════════════════════════ */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { signerJetonDesabonnement, verifierJetonDesabonnement } from "@/lib/courriel/jetonDesabonnement";
// @ts-ignore TS5097 — node --experimental-strip-types EXIGE l'extension .ts.
import * as jumeauDeno from "../../../supabase/functions/_shared/jetonDesabonnement.ts";

const SECRET = "secret-de-test-assez-long-pour-passer-la-garde-32";
const UID = "ce7c8339-b28b-49b5-8ba4-f1621a2a1dde";

test("un jeton signé se vérifie et rend le user_id", async () => {
  const j = await signerJetonDesabonnement(UID, SECRET);
  assert.equal(await verifierJetonDesabonnement(j, SECRET), UID);
});

test("le jumeau Deno produit EXACTEMENT le même jeton", async () => {
  assert.equal(
    await jumeauDeno.signerJetonDesabonnement(UID, SECRET),
    await signerJetonDesabonnement(UID, SECRET),
  );
});

test("les deux fichiers portent le même algorithme sous leur en-tête", () => {
  const corps = (p: string) => {
    const t = readFileSync(join(process.cwd(), p), "utf8");
    return t.slice(t.indexOf("const PREFIXE"));
  };
  assert.equal(
    corps("supabase/functions/_shared/jetonDesabonnement.ts"),
    corps("lib/courriel/jetonDesabonnement.ts"),
  );
});

test("un jeton falsifié, tronqué, d'un autre compte ou d'un autre secret est refusé", async () => {
  const j = await signerJetonDesabonnement(UID, SECRET);
  const [uid, sig] = j.split(".");
  const autre = "11111111-2222-3333-4444-555555555555";
  assert.equal(await verifierJetonDesabonnement(`${autre}.${sig}`, SECRET), null);
  assert.equal(await verifierJetonDesabonnement(`${uid}.${sig.slice(0, -2)}`, SECRET), null);
  assert.equal(await verifierJetonDesabonnement(`${uid}.${sig}x`, SECRET), null);
  assert.equal(await verifierJetonDesabonnement(j, SECRET + "-autre"), null);
  assert.equal(await verifierJetonDesabonnement(uid, SECRET), null);
  assert.equal(await verifierJetonDesabonnement("", SECRET), null);
  assert.equal(await verifierJetonDesabonnement(null, SECRET), null);
  assert.equal(await verifierJetonDesabonnement("pas-un-uuid.abc", SECRET), null);
});

test("la casse du user_id ne change pas le jeton", async () => {
  assert.equal(
    await signerJetonDesabonnement(UID.toUpperCase(), SECRET),
    await signerJetonDesabonnement(UID, SECRET),
  );
});

test("un secret absent ou court refuse de signer", async () => {
  await assert.rejects(() => signerJetonDesabonnement(UID, ""));
  await assert.rejects(() => signerJetonDesabonnement(UID, "court"));
});
