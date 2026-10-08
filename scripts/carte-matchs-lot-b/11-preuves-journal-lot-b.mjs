// Preuves par rôle de la migration 4 (journal MATCH_AJOUTE / MATCH_RETIRE),
// base LOCALE, VRAIS JWT (HS256, secret local) contre PostgREST — comme l'écran.
//   SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… node 11-preuves-journal-lot-b.mjs
// Laisse la base comme il l'a trouvée (ses lignes de journal et de matchs_ajoutes
// sont retirées à la fin, par le service_role).
import crypto from "node:crypto";

const API = "http://127.0.0.1:54321";
const SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";
const ANON = process.env.SUPABASE_ANON_KEY, SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (sub) => {
  const now = Math.floor(Date.now() / 1000);
  const h = b64({ alg: "HS256", typ: "JWT" }), p = b64({ sub, role: "authenticated", aud: "authenticated", iat: now, exp: now + 3600 });
  return `${h}.${p}.${crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url")}`;
};
const R = {
  r3: "22222222-0000-0000-0000-00000000003a",          // Cégep Preuve Lot1 × Football, Pro
  r4: "22222222-0000-0000-0000-00000000004a",          // autre cégep × Football, Pro
  r5: "22222222-0000-0000-0000-00000000005a",          // même cégep × Basketball, Pro
  r1: "22222222-0000-0000-0000-00000000000a",          // admin cégep du même cégep
  r6: "a6000000-0000-0000-0000-0000000000b6",          // même unité, gratuit
  coach: "22222222-0000-0000-0000-00000000000c",
  athlete: "ffffffff-0000-0000-0000-000000000005",
  admin: "eeeeeeee-0000-0000-0000-0000000000aa",
};
const CEGEP_R3 = "11111111-0000-0000-0000-000000000001", CEGEP_R4 = "442b3b2a-fe74-4443-ad92-feb9988c39b5";
const FOOT = "4b859bf1-5832-4258-897c-e094062926af";
const MATCH = "7f74ad65-7785-47bd-8482-e60628d54c1b";     // Collège Laval vs Amitié, 10 oct.
const MATCH2 = "da5c330a-770b-4306-9916-17dc362916ec";    // Benoit-Vachon vs Poly. Abénaquis

const svcH = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
async function rest(sub, chemin, { method = "GET", body, prefer, service = false } = {}) {
  const auth = service ? svcH : { apikey: ANON, ...(sub ? { Authorization: `Bearer ${jwt(sub)}` } : {}), "Content-Type": "application/json" };
  const r = await fetch(`${API}/rest/v1/${chemin}`, {
    method, headers: { ...auth, ...(prefer ? { Prefer: prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const t = await r.text();
  let corps; try { corps = t ? JSON.parse(t) : null; } catch { corps = t; }
  return { status: r.status, corps };
}
const res = ({ status, corps }) => Array.isArray(corps) ? `HTTP ${status} · ${corps.length} ligne(s)` : `HTTP ${status} · ${corps?.code ?? ""} · ${corps?.message ?? JSON.stringify(corps)}`;
const JOURNAL = "recruiter_activity_log?action_type=in.(MATCH_AJOUTE,MATCH_RETIRE)&select=id,recruiter_id,athlete_id,action_type,details,unite_cegep_id,unite_sport_id&order=created_at";
const journalSvc = async () => (await rest(null, JOURNAL, { service: true })).corps;
const court = (l) => `${l.action_type} · signé ${l.recruiter_id.slice(-4)} · athlète ${l.athlete_id} · unité ${l.unite_cegep_id?.slice(-4)}×${l.unite_sport_id?.slice(-4)}`;

console.log(`── départ : journal MATCH_* = ${(await journalSvc()).length} · matchs_ajoutes = ${(await rest(null, "matchs_ajoutes?select=id", { service: true })).corps.length}`);

console.log("── 1. r3 ajoute un match → une ligne MATCH_AJOUTE signée r3, unité r3, sans athlète ──");
console.log(`r3 POST matchs_ajoutes         → ${res(await rest(R.r3, "matchs_ajoutes", { method: "POST", body: { game_id: MATCH }, prefer: "return=representation" }))}`);
let j = await journalSvc();
console.log(`journal : ${j.map(court).join(" | ")}`);
console.log(`details : ${JSON.stringify(j[0]?.details)}`);

console.log("── 2. lecture de cette ligne par rôle ──");
const lecture = async (sub) => res(await rest(sub, `recruiter_activity_log?id=eq.${j[0].id}&select=id`));
for (const [nom, sub] of [["r3 (auteur)", R.r3], ["r1 admin cégep", R.r1], ["admin plateforme", R.admin], ["r4 autre unité", R.r4], ["r5 même cégep, Basketball", R.r5], ["r6 même unité, gratuit", R.r6], ["coach", R.coach], ["athlète", R.athlete], ["anon", null]]) {
  console.log(`${nom.padEnd(28)} → ${await lecture(sub)}`);
}

console.log("── 3. doublon refusé → aucune ligne de journal en plus ──");
console.log(`r3 POST même match            → ${res(await rest(R.r3, "matchs_ajoutes", { method: "POST", body: { game_id: MATCH } }))}`);
console.log(`journal MATCH_* = ${(await journalSvc()).length}`);

console.log("── 4. refusés : aucune ligne de journal ──");
for (const [nom, sub] of [["r6 gratuit", R.r6], ["coach", R.coach], ["athlète", R.athlete], ["anon", null]]) {
  console.log(`${nom.padEnd(12)} POST            → ${res(await rest(sub, "matchs_ajoutes", { method: "POST", body: { game_id: MATCH2 } }))}`);
}
console.log(`journal MATCH_* = ${(await journalSvc()).length}`);

console.log("── 5. r4 force l'unité de r3 → ligne et journal dans l'unité de r4 ; r3 n'en voit rien ──");
console.log(`r4 POST (unité r3 forcée)      → ${res(await rest(R.r4, "matchs_ajoutes", { method: "POST", body: { game_id: MATCH, unite_cegep_id: CEGEP_R3, unite_sport_id: FOOT, ajoute_par: R.r3 } }))}`);
j = await journalSvc();
const ligneR4 = j.find((l) => l.recruiter_id === R.r4);
console.log(`journal : ${court(ligneR4)} · unité r4 : ${ligneR4.unite_cegep_id === CEGEP_R4}`);
console.log(`r3 lit la ligne de r4         → ${res(await rest(R.r3, `recruiter_activity_log?id=eq.${ligneR4.id}&select=id`))}`);
console.log(`r4 lit la ligne de r3         → ${res(await rest(R.r4, `recruiter_activity_log?id=eq.${j[0].id}&select=id`))}`);

console.log("── 6. retraits ──");
console.log(`r4 DELETE la ligne de r3      → ${res(await rest(R.r4, `matchs_ajoutes?game_id=eq.${MATCH}&unite_cegep_id=eq.${CEGEP_R3}`, { method: "DELETE", prefer: "return=representation" }))}`);
console.log(`r6 DELETE la ligne de r3      → ${res(await rest(R.r6, `matchs_ajoutes?game_id=eq.${MATCH}&unite_cegep_id=eq.${CEGEP_R3}`, { method: "DELETE", prefer: "return=representation" }))}`);
console.log(`journal MATCH_* = ${(await journalSvc()).length} (inchangé)`);
console.log(`r3 DELETE sa ligne            → ${res(await rest(R.r3, `matchs_ajoutes?game_id=eq.${MATCH}`, { method: "DELETE", prefer: "return=representation" }))}`);
j = await journalSvc();
const retrait = j.find((l) => l.action_type === "MATCH_RETIRE");
console.log(`journal : ${court(retrait)} · details.game_id = ${retrait.details.game_id === MATCH}`);
console.log(`r1 admin cégep lit le retrait → ${res(await rest(R.r1, `recruiter_activity_log?id=eq.${retrait.id}&select=id`))}`);
console.log(`r4 lit le retrait             → ${res(await rest(R.r4, `recruiter_activity_log?id=eq.${retrait.id}&select=id`))}`);

console.log("── 7. retrait sans recruteur (service_role, comme une cascade) → rien au journal ──");
const avant = (await journalSvc()).length;
console.log(`service_role DELETE (r4)      → ${res(await rest(null, `matchs_ajoutes?unite_cegep_id=eq.${CEGEP_R4}`, { method: "DELETE", prefer: "return=representation", service: true }))}`);
console.log(`journal MATCH_* : ${avant} → ${(await journalSvc()).length}`);

console.log("── 8. le client ne déplace pas une ligne du journal dans une autre unité ──");
console.log(`r3 PATCH unite → r4           → ${res(await rest(R.r3, `recruiter_activity_log?id=eq.${j[0].id}`, { method: "PATCH", body: { unite_cegep_id: CEGEP_R4 }, prefer: "return=representation" }))}`);
const apres = (await rest(null, `recruiter_activity_log?id=eq.${j[0].id}&select=unite_cegep_id`, { service: true })).corps[0];
console.log(`unité après PATCH : r3 ${apres.unite_cegep_id === CEGEP_R3}`);

console.log("── 9. écriture directe par le client (chemin préexistant, tous types) ──");
const forge = await rest(R.r3, "recruiter_activity_log", { method: "POST", body: { recruiter_id: R.r3, action_type: "MATCH_AJOUTE", details: { game_id: MATCH2 }, unite_cegep_id: CEGEP_R4, unite_sport_id: FOOT }, prefer: "return=representation" });
console.log(`r3 POST MATCH_AJOUTE, unité r4 → ${res(forge)} · unité posée : ${Array.isArray(forge.corps) ? (forge.corps[0].unite_cegep_id === CEGEP_R3 ? "r3 (la sienne)" : forge.corps[0].unite_cegep_id) : "—"}`);
const forgeAutre = await rest(R.r3, "recruiter_activity_log", { method: "POST", body: { recruiter_id: R.r4, action_type: "MATCH_AJOUTE", details: {} } });
console.log(`r3 POST au nom de r4           → ${res(forgeAutre)}`);

// Nettoyage
await rest(null, "recruiter_activity_log?action_type=in.(MATCH_AJOUTE,MATCH_RETIRE)", { method: "DELETE", service: true });
await rest(null, `matchs_ajoutes?game_id=in.(${MATCH},${MATCH2})`, { method: "DELETE", service: true });
console.log(`── fin : journal MATCH_* = ${(await journalSvc()).length} · matchs_ajoutes = ${(await rest(null, "matchs_ajoutes?select=id", { service: true })).corps.length}`);
