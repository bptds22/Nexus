// Preuve SIGNATAIRE + ORDRE DE DÉPLOIEMENT (lot 1 cartes), base LOCALE.
// Écritures de cartes par PostgREST sous vrai JWT ; envoi par traiterInvitation
// (le cœur de send-invitation-carte) avec un client service_role réel et un
// Resend SIMULÉ (aucun courriel ne part).
//
//   node --experimental-strip-types 7-preuve-signataire.mjs creer <suffixe> ajout|creation
//   node --experimental-strip-types 7-preuve-signataire.mjs envoyer <chemin traiter.ts>
//   node --experimental-strip-types 7-preuve-signataire.mjs reclamation-naive
//   node --experimental-strip-types 7-preuve-signataire.mjs etat
// Exige SUPABASE_ANON_KEY et SUPABASE_SERVICE_ROLE_KEY (npx supabase status -o env).
import crypto from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient } from "@supabase/supabase-js";

globalThis.Deno ??= { env: { get: () => undefined } };
const API = "http://127.0.0.1:54321";
const ANON = process.env.SUPABASE_ANON_KEY;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SECRET = "super-secret-jwt-token-with-at-least-32-characters-long";
const T = "81e7d45a-e178-421d-82bb-60ffc8049109";
const CREATEUR = "22222222-0000-0000-0000-00000000003a"; // Rémi Collègue
const COLLEGUE = "22222222-0000-0000-0000-00000000000a"; // Robin Admin
const nom = (id) => ({ [CREATEUR]: "créateur …03a", [COLLEGUE]: "collègue …00a" }[id] ?? String(id));

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
function jwt(sub) {
  const now = Math.floor(Date.now() / 1000);
  const h = b64({ alg: "HS256", typ: "JWT" });
  const p = b64({ sub, role: "authenticated", aud: "authenticated", iat: now, exp: now + 3600 });
  return `${h}.${p}.${crypto.createHmac("sha256", SECRET).update(`${h}.${p}`).digest("base64url")}`;
}
async function rest(sub, method, url, body) {
  const r = await fetch(`${API}/rest/v1/${url}`, {
    method,
    headers: { apikey: ANON, Authorization: `Bearer ${jwt(sub)}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => null) };
}
const svc = createClient(API, SERVICE, { auth: { persistSession: false } });

const [etape, a1, a2] = process.argv.slice(2);
if (etape === "creer") {
  const courriel = `sig.${a1}@preuve.local`;
  if (a2 === "creation") {
    const r = await rest(CREATEUR, "POST", "cartes_prospect?select=id,nom", { team_id: T, prenom: "Sig", nom: `${a1}preuve`, courriel });
    console.log(`INSERT par créateur avec courriel → HTTP ${r.status}`, JSON.stringify(r.body));
  } else {
    const r = await rest(CREATEUR, "POST", "cartes_prospect?select=id,nom", { team_id: T, prenom: "Sig", nom: `${a1}preuve` });
    console.log(`INSERT par créateur sans courriel → HTTP ${r.status}`, JSON.stringify(r.body));
    const p = await rest(COLLEGUE, "PATCH", `cartes_prospect?id=eq.${r.body[0].id}&select=id,courriel,modifie_par`, { courriel });
    console.log(`PATCH courriel par le collègue → HTTP ${p.status}`, JSON.stringify(p.body));
  }
} else if (etape === "envoyer") {
  const { traiterInvitation } = await import(pathToFileURL(path.resolve(a1)).href);
  const { data: invs, error } = await svc.from("cartes_prospect_invitations")
    .select("id, carte_id").eq("statut", "A_ENVOYER").like("empreinte", "%");
  if (error) throw error;
  const { data: cartes } = await svc.from("cartes_prospect").select("id, nom").like("nom", "%preuve");
  const miennes = new Map((cartes ?? []).map((c) => [c.id, c.nom]));
  for (const inv of invs.filter((i) => miennes.has(i.carte_id))) {
    let texte = "";
    const fetchFaux = async (_u, init) => { texte = JSON.parse(init.body).text; return new Response('{"id":"re_simule"}', { status: 200 }); };
    const r = await traiterInvitation({ supabase: svc, fetch: fetchFaux, resendApiKey: "simule", desabonnementSecret: "s".repeat(40) }, inv.id);
    const ligne = (texte.match(/^.*recruteur au .*$/m) ?? ["(aucun texte)"])[0];
    console.log(`${miennes.get(inv.carte_id)} → ${r.statut} | « ${ligne.slice(0, 60)}… »`);
  }
} else if (etape === "reclamation-naive") {
  // Ce que ferait une edge function qui lirait signataire DANS la réclamation.
  const { data: invs } = await svc.from("cartes_prospect_invitations").select("id, carte_id, statut").eq("statut", "A_ENVOYER");
  const { data: cartes } = await svc.from("cartes_prospect").select("id, nom").like("nom", "%preuve");
  const ids = new Set((cartes ?? []).map((c) => c.id));
  const inv = invs.find((i) => ids.has(i.carte_id));
  const r = await svc.from("cartes_prospect_invitations").update({ statut: "EN_COURS" })
    .eq("id", inv.id).eq("statut", "A_ENVOYER").select("id, carte_id, unite_cegep_id, signataire").maybeSingle();
  console.log("réclamation naïve → erreur :", r.error ? `${r.error.code} ${r.error.message}` : "aucune", "| data :", JSON.stringify(r.data));
  const { data: apres } = await svc.from("cartes_prospect_invitations").select("statut").eq("id", inv.id).single();
  console.log("statut de la ligne après la réclamation naïve :", apres.statut);
} else if (etape === "etat") {
  const { data: cartes } = await svc.from("cartes_prospect").select("id, nom, cree_par, modifie_par, invitee_le").like("nom", "%preuve").order("created_at");
  for (const c of cartes) {
    const inv = await svc.from("cartes_prospect_invitations").select("*").eq("carte_id", c.id).maybeSingle();
    const { data: j } = await svc.from("cartes_prospect_journal").select("action, acteur").eq("carte_id", c.id).eq("action", "INVITATION");
    const sig = inv.error ? `(colonne illisible : ${inv.error.code})` : nom(inv.data?.signataire ?? null);
    console.log(`${c.nom} | invitation ${inv.data?.statut ?? "—"} | signataire ${sig} | journal INVITATION par ${(j ?? []).map((x) => nom(x.acteur)).join(",") || "—"}`);
  }
}
