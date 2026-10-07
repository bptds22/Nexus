// Preuves lot 1 cartes — écritures par PostgREST sous un vrai JWT signé (HS256, secret local).
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DIR = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
const ANON = (process.env.SUPABASE_ANON_KEY ?? fs.readFileSync(path.join(DIR, "anon.txt"), "utf8")).trim(); // npx supabase status -o env
const SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";
const API = "http://127.0.0.1:54321/rest/v1";
const T = "81e7d45a-e178-421d-82bb-60ffc8049109";
const R3 = "22222222-0000-0000-0000-00000000003a"; // recruteur Pro, unité cégep 1 × football (créateur)
const R1 = "22222222-0000-0000-0000-00000000000a"; // collègue de la même unité (All Star)

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function jwt(sub) {
  const now = Math.floor(Date.now() / 1000);
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64({ sub, role: "authenticated", aud: "authenticated", iat: now, exp: now + 3600 });
  const s = crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url");
  return `${h}.${p}.${s}`;
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
const ids = {};
async function creer(cle, champs) {
  const r = await rest(R3, "POST", "cartes_prospect?select=id,prenom,nom,courriel,parent_courriel,sport_athlete_id", { team_id: T, ...champs });
  console.log(`INSERT ${cle} → HTTP ${r.status}`, JSON.stringify(r.body));
  ids[cle] = r.body?.[0]?.id;
}
async function maj(cle, sub, champs) {
  const r = await rest(sub, "PATCH", `cartes_prospect?id=eq.${ids[cle]}&select=id,courriel,invitation_etat,modifie_par`, champs);
  console.log(`PATCH ${cle} ${JSON.stringify(champs)} par ${sub.slice(-3)} → HTTP ${r.status}`, JSON.stringify(r.body));
}

const etape = process.argv[2];
if (etape === "creer") {
  // Rapprochement
  await creer("C1_mathis_prevost", { prenom: "Mathis", nom: "Prevost" });
  await creer("C2_leo_gagnon", { prenom: "Leo", nom: "Gagnonpreuve" });
  await creer("C3_alex_roy", { prenom: "Alex", nom: "Royepreuve" });
  await creer("C4_jacob_parent", { prenom: "Jacob", nom: "Martelpreuve", parent_courriel: "parent.martel@preuve.local" });
  await creer("C5_zoe_parent", { prenom: "Zoe", nom: "Martelpreuve", parent_courriel: "parent.martel@preuve.local" });
  await creer("C6_mathys_fratrie", { prenom: "Mathys", nom: "Lavoiepreuve", parent_courriel: "parent.lavoie@preuve.local" });
  // Invitation
  await creer("C7_ajout", { prenom: "Felix", nom: "Ajoutpreuve" });
  await creer("C8_inscrit", { prenom: "Emile", nom: "Inscritcartepreuve" });
  await creer("C9_insert_direct", { prenom: "Olivier", nom: "Directpreuve", courriel: "insert.direct@preuve.local" });
  await creer("C10_fusionnee", { prenom: "Hugo", nom: "Fusionpreuve" });
  await creer("C11_efface_remis", { prenom: "Louis", nom: "Effacepreuve" });
  fs.writeFileSync(path.join(DIR, "ids.json"), JSON.stringify(ids, null, 1));
} else if (etape === "invitations") {
  Object.assign(ids, JSON.parse(fs.readFileSync(path.join(DIR, "ids.json"), "utf8")));
  console.log("— Ajout de courriel par un COLLÈGUE (r1) sur une carte créée par r3");
  await maj("C7_ajout", R1, { courriel: "nouveau.prospect@preuve.local" });
  console.log("— Courriel CHANGÉ après invitation");
  await maj("C7_ajout", R3, { courriel: "autre.adresse@preuve.local" });
  console.log("— Ajout d'un courriel déjà inscrit");
  await maj("C8_inscrit", R3, { courriel: "deja.inscrit@preuve.local" });
  console.log("— Carte créée AVEC courriel, puis courriel changé");
  await maj("C9_insert_direct", R3, { courriel: "insert.change@preuve.local" });
  console.log("— Carte fusionnée : ajout de courriel");
  await maj("C10_fusionnee", R3, { courriel: "fusion.tente@preuve.local" });
  console.log("— Courriel ajouté, effacé, remis");
  await maj("C11_efface_remis", R3, { courriel: "efface.un@preuve.local" });
  await maj("C11_efface_remis", R3, { courriel: null });
  await maj("C11_efface_remis", R3, { courriel: "efface.deux@preuve.local" });
}
