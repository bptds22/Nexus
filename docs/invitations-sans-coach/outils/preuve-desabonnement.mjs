// Preuve locale du lien « Ne plus recevoir ces courriels » du courriel de RÉCLAMATION (jeton « a. »).
//   cd C:\tmp\nexus-w4bc ; DESABONNEMENT_SECRET=<le même que le serveur 3011> APP=http://localhost:3011 node --experimental-strip-types docs/invitations-sans-coach/outils/preuve-desabonnement.mjs
// Fiche + invitation JETABLES ; le jeton est signé par le VRAI module des fonctions d'envoi ; la page
// de confirmation l'accepte, le POST inscrit l'empreinte de l'adresse, et une nouvelle invitation vers
// cette adresse ne part plus (file pg_net lue par service). Tout est retiré à la fin.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const req = createRequire(path.resolve("package.json"));
const { createClient } = req("@supabase/supabase-js");
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
  .filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const API = env.NEXT_PUBLIC_SUPABASE_URL;
if (!/^http:\/\/127\.0\.0\.1/.test(API)) throw new Error("pas local : " + API);
const svc = createClient(API, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const APP = process.env.APP ?? "http://localhost:3011";
const { signerJetonInvitationAthlete } = await import(pathToFileURL(path.resolve("supabase/functions/_shared/jetonDesabonnement.ts")).href);

const journal = [];
const note = (...a) => { const l = a.join(" "); journal.push(l); console.log(l); };
const ADRESSE = "preuve.desabo.inv@exemple.test";
let athleteId = null;
try {
  const { data: coach } = await svc.from("users").select("id, school_id").eq("email", "marc.desrosiers@exemple.test").single();
  const { data: a, error: ea } = await svc.from("athletes").insert({
    first_name: "Preuve", last_name: "Désabonnement", date_naissance: "2007-05-05", coach_id: coach.id, school_id: coach.school_id,
    email: ADRESSE, status: "ACTIF", verified: false, annee_diplomation: 2025,
  }).select("id").single();
  if (ea) throw ea;
  athleteId = a.id;
  const { data: inv, error: ei } = await svc.from("athlete_invitations")
    .insert({ token: "preuve-desabo-" + Date.now(), athlete_id: a.id, created_by: coach.id, email: ADRESSE }).select("id").single();
  if (ei) throw ei;

  const jeton = await signerJetonInvitationAthlete(inv.id, process.env.DESABONNEMENT_SECRET ?? env.DESABONNEMENT_SECRET);
  const page = await (await fetch(`${APP}/desabonnement?t=${encodeURIComponent(jeton)}`)).text();
  note("page /desabonnement accepte le jeton « a. » (bouton de confirmation présent) :", /Me désabonner/.test(page));
  const faux = await (await fetch(`${APP}/desabonnement?t=${encodeURIComponent(jeton.slice(0, -3) + "xyz")}`)).text();
  note("jeton falsifié → pas de bouton :", !/Me désabonner/.test(faux));

  const r = await fetch(`${APP}/api/desabonnement?t=${encodeURIComponent(jeton)}`, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: "List-Unsubscribe=One-Click",
  });
  note("POST un clic (RFC 8058) :", r.status, await r.text());
  const { data: emp } = await svc.rpc("empreinte_courriel", { p: ADRESSE.toUpperCase() });
  const { data: reg } = await svc.from("courriel_desabonnements_adresses").select("source").eq("empreinte", emp);
  note("adresse inscrite au registre :", JSON.stringify(reg));
} finally {
  if (athleteId) {
    const { data: emp } = await svc.rpc("empreinte_courriel", { p: ADRESSE });
    await svc.from("courriel_desabonnements_adresses").delete().eq("empreinte", emp);
    await svc.from("athlete_invitations").delete().eq("athlete_id", athleteId);
    const { error } = await svc.from("athletes").delete().eq("id", athleteId);
    note("remise en état :", error ? "ERREUR " + error.message : "fiche, invitation et inscription retirées");
  }
  fs.writeFileSync(path.resolve("docs/invitations-sans-coach/preuve-desabonnement-resultats.txt"), journal.join("\n") + "\n");
}
