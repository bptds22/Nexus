// Preuves par rôle du lot B (carte des matchs), base LOCALE, VRAIS JWT (HS256,
// secret local) contre PostgREST — comme l'écran.
//   SUPABASE_ANON_KEY=… SUPABASE_SERVICE_ROLE_KEY=… node 8-preuves-rpc-lot-b.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { lieuNormalise } from "./normalise.mjs";

const ICI = path.dirname(fileURLToPath(import.meta.url));
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
  pro: "22222222-0000-0000-0000-00000000003a",          // r3 — Cégep Preuve Lot1 × Football, Pro
  autreUnite: null,                                      // r4 — autre cégep × Football, Pro (résolu plus bas)
  autreSport: null,                                      // r5 — même cégep × Basketball, Pro
  adminCegep: null,                                      // r1 — admin cégep du même cégep, All Star
  gratuit: "a6000000-0000-0000-0000-0000000000b6",       // r6 — même unité, gratuit
  coach: "22222222-0000-0000-0000-00000000000c",
  athlete: "ffffffff-0000-0000-0000-000000000005",
  admin: "eeeeeeee-0000-0000-0000-0000000000aa",
};
const svcH = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
async function idDe(email) {
  const r = await fetch(`${API}/rest/v1/users?select=id&email=eq.${encodeURIComponent(email)}`, { headers: svcH });
  return (await r.json())[0]?.id;
}
R.autreUnite = await idDe("r4.autre.cegep@preuve.local");
R.autreSport = await idDe("r5.basket@preuve.local");
R.adminCegep = await idDe("r1.avec.cegep@preuve.local");

async function rest(sub, chemin, { method = "GET", body, prefer } = {}) {
  const r = await fetch(`${API}/rest/v1/${chemin}`, {
    method,
    headers: { apikey: ANON, ...(sub ? { Authorization: `Bearer ${jwt(sub)}` } : {}), "Content-Type": "application/json", ...(prefer ? { Prefer: prefer } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const t = await r.text();
  let corps; try { corps = t ? JSON.parse(t) : null; } catch { corps = t; }
  return { status: r.status, corps };
}
const rpc = (sub, f, args) => rest(sub, `rpc/${f}`, { method: "POST", body: args });
const res = ({ status, corps }) => Array.isArray(corps) ? `HTTP ${status} · ${corps.length} ligne(s)` : `HTTP ${status} · ${corps?.code ?? ""} · ${corps?.message ?? JSON.stringify(corps)}`;

const JOUR = "2026-10-10";
const MATCH_SUIVI = "3f927293-e070-457a-b489-b320878a0f6c";   // Laval Cad — « Majeur Cprofils » suivi par r3
const CIVIL = "77770000-0000-0000-0000-0000000000f1";
const FAUX = "77770000-0000-0000-0000-0000000000f2";
const base = { p_debut: JOUR, p_fin: JOUR, p_sport: "Football", p_types: ["SECONDAIRE", "CIVIL"], p_texte: null };

console.log("── matchs_recherche : rôles ──");
for (const [nom, sub] of [["recruteur Pro (r3)", R.pro], ["Pro autre unité (r4)", R.autreUnite], ["recruteur gratuit (r6)", R.gratuit], ["coach", R.coach], ["athlète", R.athlete], ["anon", null]]) {
  console.log(`${nom.padEnd(24)} → ${res(await rpc(sub, "matchs_recherche", base))}`);
}
const r3 = (await rpc(R.pro, "matchs_recherche", base)).corps;
console.log(`   colonnes : ${Object.keys(r3[0]).join(", ")}`);

console.log("── plage ──");
console.log(`7 jours (10 → 16)       → ${res(await rpc(R.pro, "matchs_recherche", { ...base, p_fin: "2026-10-16" }))}`);
console.log(`8 jours (10 → 17)       → ${res(await rpc(R.pro, "matchs_recherche", { ...base, p_fin: "2026-10-17" }))}`);
console.log(`fin avant début         → ${res(await rpc(R.pro, "matchs_recherche", { ...base, p_fin: "2026-10-09" }))}`);

console.log("── filtres ──");
const tousSports = (await rpc(R.pro, "matchs_recherche", { ...base, p_sport: null, p_types: null })).corps;
const compte = (xs, cle) => Object.entries(xs.reduce((a, x) => ((a[x[cle] ?? "null"] = (a[x[cle] ?? "null"] ?? 0) + 1), a), {})).map(([k, v]) => `${k} ${v}`).join(", ");
console.log(`tous sports, tous types : ${tousSports.length} matchs · sports : ${compte(tousSports, "sport")} · types : ${compte(tousSports, "type")}`);
console.log(`Football, Secondaire+Civil (défaut) : ${r3.length} matchs · sports : ${compte(r3, "sport")} · types : ${compte(r3, "type")}`);
const coll = (await rpc(R.pro, "matchs_recherche", { ...base, p_sport: null, p_types: ["COLLEGIAL"] })).corps;
console.log(`Collégial seul : ${coll.length} matchs · types : ${compte(coll, "type")}`);
const basket = (await rpc(R.pro, "matchs_recherche", { ...base, p_sport: "basketball", p_types: null })).corps;
console.log(`sport « basketball » (casse) : ${basket.length} matchs · sports : ${compte(basket, "sport")}`);
const txt = (await rpc(R.pro, "matchs_recherche", { ...base, p_texte: "laval college" })).corps;
console.log(`texte « laval college » : ${txt.length} → ${txt.map((m) => `${m.domicile} vs ${m.visiteur} @ ${m.terrain}`).join(" | ")}`);
const acc = (await rpc(R.pro, "matchs_recherche", { ...base, p_texte: "BENEVOLES" })).corps;
console.log(`texte « BENEVOLES » (sans accent, majuscules) : ${acc.map((m) => `${m.domicile} @ ${m.terrain}`).join(" | ")}`);

console.log("── lieux ──");
const civ = r3.find((m) => m.id === CIVIL), faux = r3.find((m) => m.id === FAUX);
console.log(`civil (LFMM, aucun GPS dans games) : type ${civ?.type} · terrain « ${civ?.terrain} » · lat/lon ${civ?.lat}, ${civ?.lon} (lieux_geocodes)`);
console.log(`RSEQ aux coordonnées 0,0 : type ${faux?.type} · lat/lon ${faux?.lat}, ${faux?.lon}`);
const gps = r3.find((m) => m.id === MATCH_SUIVI);
console.log(`RSEQ au GPS valide : lat/lon ${gps?.lat}, ${gps?.lon}`);

console.log("── Loi 25 : nb_profils ──");
const nb = async () => (await rpc(R.pro, "matchs_recherche", base)).corps.find((m) => m.id === MATCH_SUIVI)?.nb_profils;
const MINEUR = "77770000-0000-0000-0000-0000000000e1";
const poser = (v) => fetch(`${API}/rest/v1/athletes?id=eq.${MINEUR}`, { method: "PATCH", headers: svcH, body: JSON.stringify({ consentement_parental: v }) });
console.log(`mineur sans consentement : nb_profils = ${await nb()}`);
await poser(true);
console.log(`même mineur, consentement donné : nb_profils = ${await nb()}`);
await poser(false);
console.log(`consentement retiré : nb_profils = ${await nb()}`);

console.log("── cible (étoile) ──");
const cibleDe = async (sub) => (await rpc(sub, "matchs_recherche", base)).corps.find((m) => m.id === MATCH_SUIVI)?.cible;
console.log(`match de « Majeur Cprofils » (suivi par l'unité de r3) : cible pour r3 = ${await cibleDe(R.pro)} · pour r4 (autre unité) = ${await cibleDe(R.autreUnite)}`);
console.log(`matchs cible pour r3 ce jour-là : ${r3.filter((m) => m.cible).length} sur ${r3.length}`);

console.log("── matchs_ajoutes ──");
const LIBRE = r3.find((m) => !m.cible && m.id !== CIVIL && m.id !== FAUX).id;
const ins = await rest(R.pro, "matchs_ajoutes?select=game_id,unite_cegep_id,unite_sport_id,ajoute_par",
  { method: "POST", prefer: "return=representation", body: { game_id: LIBRE, unite_cegep_id: "442b3b2a-fe74-4443-ad92-feb9988c39b5", ajoute_par: R.autreUnite } });
console.log(`r3 ajoute (en forgeant unité ET auteur) → HTTP ${ins.status} · ${JSON.stringify(ins.corps)}`);
console.log(`r3 ajoute le même match → ${res(await rest(R.pro, "matchs_ajoutes", { method: "POST", body: { game_id: LIBRE } }))}`);
for (const [nom, sub] of [["gratuit (r6)", R.gratuit], ["coach", R.coach], ["athlète", R.athlete], ["anon", null]]) {
  const r = await rest(sub, "matchs_ajoutes", { method: "POST", body: { game_id: CIVIL } });
  console.log(`${nom.padEnd(22)} ajoute → ${res(r)}`);
}
const insR4 = await rest(R.autreUnite, "matchs_ajoutes?select=game_id,unite_cegep_id,unite_sport_id,ajoute_par",
  { method: "POST", prefer: "return=representation", body: { game_id: CIVIL, unite_cegep_id: "11111111-0000-0000-0000-000000000001", unite_sport_id: "4b859bf1-5832-4258-897c-e094062926af" } });
console.log(`r4 (autre unité) ajoute en forgeant l'unité de r3 → HTTP ${insR4.status} · atterrit dans : ${insR4.corps?.[0]?.unite_cegep_id} (cégep de r4 = 442b3b2a-…) · r3 le voit-il ? ${(await rest(R.pro, `matchs_ajoutes?select=id&game_id=eq.${CIVIL}`)).corps.length} ligne(s)`);
await rest(R.autreUnite, `matchs_ajoutes?game_id=eq.${CIVIL}`, { method: "DELETE" });
const lire = async (sub) => (await rest(sub, `matchs_ajoutes?select=game_id,unite_sport_id&game_id=eq.${LIBRE}`)).corps;
for (const [nom, sub] of [["r3 (l'unité)", R.pro], ["r4 (autre cégep)", R.autreUnite], ["r5 (même cégep, Basketball)", R.autreSport], ["r1 (admin cégep)", R.adminCegep], ["admin plateforme", R.admin], ["gratuit (r6)", R.gratuit], ["coach", R.coach], ["anon", null]]) {
  const l = await lire(sub);
  console.log(`${nom.padEnd(30)} lit → ${Array.isArray(l) ? `${l.length} ligne(s)` : JSON.stringify(l)}`);
}
console.log(`ajoute=true dans la recherche : r3 ${(await rpc(R.pro, "matchs_recherche", base)).corps.find((m) => m.id === LIBRE)?.ajoute} · r4 ${(await rpc(R.autreUnite, "matchs_recherche", base)).corps.find((m) => m.id === LIBRE)?.ajoute}`);
const delR4 = await rest(R.autreUnite, `matchs_ajoutes?game_id=eq.${LIBRE}`, { method: "DELETE", prefer: "return=representation" });
console.log(`r4 (autre unité) retire → HTTP ${delR4.status} · ${Array.isArray(delR4.corps) ? delR4.corps.length : "?"} ligne(s) retirée(s) · toujours là pour r3 : ${(await lire(R.pro)).length}`);
const delR6 = await rest(R.gratuit, `matchs_ajoutes?game_id=eq.${LIBRE}`, { method: "DELETE", prefer: "return=representation" });
console.log(`r6 (gratuit, même unité) retire → HTTP ${delR6.status} · ${Array.isArray(delR6.corps) ? delR6.corps.length : "?"} ligne(s) · toujours là : ${(await lire(R.pro)).length}`);
const majR3 = await rest(R.pro, `matchs_ajoutes?game_id=eq.${LIBRE}`, { method: "PATCH", body: { game_id: CIVIL } });
console.log(`r3 modifie la ligne (aucune mise à jour permise) → ${res(majR3)}`);
const delR3 = await rest(R.pro, `matchs_ajoutes?game_id=eq.${LIBRE}`, { method: "DELETE", prefer: "return=representation" });
console.log(`r3 retire → HTTP ${delR3.status} · ${delR3.corps.length} ligne(s) retirée(s) · reste : ${(await lire(R.pro)).length}`);

console.log("── lieux_geocodes ──");
console.log(`r3 lit → ${res(await rest(R.pro, "lieux_geocodes?select=nom_normalise,lat,lon"))}`);
console.log(`r3 écrit → ${res(await rest(R.pro, "lieux_geocodes", { method: "POST", body: { nom_normalise: "test", nom_affiche: "Test", lat: 45, lon: -73, source: "manuel" } }))}`);
console.log(`anon lit → ${res(await rest(null, "lieux_geocodes?select=nom_normalise"))}`);

console.log("── lieu_normalise : script = base ──");
const terrains = JSON.parse(fs.readFileSync(path.join(ICI, "terrains-civils.json"), "utf8"));
let egaux = 0;
for (const t of terrains) {
  const sql = (await rpc(R.pro, "lieu_normalise", { p_nom: t.venue })).corps;
  if (sql === lieuNormalise(t.venue)) egaux++; else console.log(`   ÉCART « ${t.venue} » : base « ${sql} » ≠ script « ${lieuNormalise(t.venue)} »`);
}
console.log(`${egaux} / ${terrains.length} libellés : même clé dans le script et dans la base`);
