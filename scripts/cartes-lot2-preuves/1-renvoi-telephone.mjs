// Preuve — journaliser_renvoi_invitation accepte « courriel OU téléphone »
// (migration 20261007201544), sous vrais JWT, base LOCALE.
//   node 1-renvoi-telephone.mjs        (SUPABASE_ANON_KEY exigé)
// Crée 3 cartes « …preuve2 » (supprimées par 9-nettoyer.sql).
import crypto from "node:crypto";

const API = "http://127.0.0.1:54321/rest/v1";
const ANON = process.env.SUPABASE_ANON_KEY;
const SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";
const T = "81e7d45a-e178-421d-82bb-60ffc8049109";
const R3 = "22222222-0000-0000-0000-00000000003a"; // Pro, unité cégep 1 × football
const R4 = "22222222-0000-0000-0000-00000000004a"; // Pro, AUTRE cégep × football

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function jwt(sub) {
  const now = Math.floor(Date.now() / 1000);
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64({ sub, role: "authenticated", aud: "authenticated", iat: now, exp: now + 3600 });
  return `${h}.${p}.${crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url")}`;
}
async function rest(sub, method, url, body) {
  const r = await fetch(`${API}/${url}`, {
    method,
    headers: { apikey: ANON, Authorization: `Bearer ${jwt(sub)}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const t = await r.text();
  return { status: r.status, body: t ? JSON.parse(t) : null };
}
const creer = async (champs) => (await rest(R3, "POST", "cartes_prospect?select=id,nom,courriel,telephone", { team_id: T, prenom: "Tel", ...champs })).body[0];
const journaliser = (sub, id) => rest(sub, "POST", "rpc/journaliser_renvoi_invitation", { p_carte: id });
const lignes = async (id) => (await rest(R3, "GET", `cartes_prospect_journal?carte_id=eq.${id}&action=eq.INVITATION_RENVOYEE&select=action,acteur`)).body;

const tel = await creer({ nom: "Telseulpreuve2", telephone: "438 555-0199" });
const rien = await creer({ nom: "Rienpreuve2" });
const avec = await creer({ nom: "Courrielpreuve2", courriel: "courriel.lot2@preuve.local" });
console.log("cartes :", JSON.stringify([tel, rien, avec]));

for (const [quoi, sub, carte] of [
  ["téléphone seulement, recruteur de l'unité", R3, tel],
  ["ni courriel ni téléphone, recruteur de l'unité", R3, rien],
  ["téléphone seulement, recruteur d'une AUTRE unité", R4, tel],
  ["avec courriel (non-régression), recruteur de l'unité", R3, avec],
]) {
  const r = await journaliser(sub, carte.id);
  console.log(`${quoi} → HTTP ${r.status}${r.body ? " " + JSON.stringify({ code: r.body.code, message: r.body.message }) : ""}`);
}
console.log("journal INVITATION_RENVOYEE — téléphone seul :", JSON.stringify(await lignes(tel.id)));
console.log("journal INVITATION_RENVOYEE — sans rien     :", JSON.stringify(await lignes(rien.id)));
console.log("journal INVITATION_RENVOYEE — avec courriel :", JSON.stringify(await lignes(avec.id)));
