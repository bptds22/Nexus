// Test de bout en bout du lot D (recruteur universitaire) — base LOCALE seulement (jamais le cloud).
//   cd C:\tmp\nexus-cegep-d
//   node docs/cegep-lot-d/tests/preparer-e2e-local.mjs            → interrupteurs ON + crée les 4 comptes (refuse s'ils existent)
//   node docs/cegep-lot-d/tests/preparer-e2e-local.mjs --retirer  → retire TOUT ce que le script a créé
//   node docs/cegep-lot-d/tests/preparer-e2e-local.mjs --off      → lancement_collegial et lancement_universitaire OFF
// Comptes *@d.local, mot de passe commun MOT_DE_PASSE. Refus si l'URL n'est pas 127.0.0.1.
import { execSync } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";

const req = createRequire(path.resolve("package.json"));
const { createClient } = req("@supabase/supabase-js");

const MOT_DE_PASSE = "NexusLotD-2026!";
const DOM = "@d.local";
const SPORT = "Basketball";               // le Cégep de Jonquière n'a que du basketball en local
const UNIVERSITE = "Université Laval";
const CEGEP = "Cégep de Jonquière";

const sortie = execSync("npx supabase status -o env", { cwd: "C:\\Users\\bptds\\Documents\\Nexus", encoding: "utf8" });
const v = Object.fromEntries(sortie.split(/\r?\n/).filter((l) => l.includes("=")).map((l) => {
  const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
}));
const API = v.API_URL, SERVICE = v.SERVICE_ROLE_KEY;
if (!/^http:\/\/127\.0\.0\.1/.test(API ?? "")) throw new Error("PAS LOCAL — arrêt : " + API);
const svc = createClient(API, SERVICE, { auth: { persistSession: false } });
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const note = (...a) => console.log(...a);
const sql = (q) => execSync("docker exec -i supabase_db_Nexus psql -U postgres -X -At -v ON_ERROR_STOP=1", { input: q, encoding: "utf8" }).trim();
const un = async (q) => { const { data, error } = await q; if (error) throw new Error(error.message); return data; };
const consentement = { consent_privacy_policy: new Date().toISOString(), consent_data_collection: new Date().toISOString() };

async function compte(email, role, prenom, nom, naissance) {
  const r = await (await fetch(`${API}/auth/v1/admin/users`, {
    method: "POST", headers: H,
    body: JSON.stringify({ email, password: MOT_DE_PASSE, email_confirm: true,
      user_metadata: { role, first_name: prenom, last_name: nom, date_naissance: naissance, ...consentement } }),
  })).json();
  if (!r.id) throw new Error("compte " + email + " : " + JSON.stringify(r));
  await un(svc.from("users").update({ privacy_preferences: consentement, onboarding_complete: true, role_claimed_at: new Date().toISOString() }).eq("id", r.id));
  return r.id;
}

async function retirerTout() {
  const liste = await un(svc.from("users").select("id").like("email", `%${DOM}`));
  const ids = liste.map((u) => u.id);
  if (ids.length === 0) { note("rien à retirer"); return; }
  const idl = ids.map((i) => `'${i}'`).join(",");
  sql(`begin;
    delete from public.messages where conversation_id in (select id from public.conversations where recruiter_id in (${idl}) or coach_id in (${idl})
      or athlete_id in (select id from public.athletes where user_id in (${idl})));
    delete from public.conversations where recruiter_id in (${idl}) or athlete_id in (select id from public.athletes where user_id in (${idl}));
    delete from public.recruiter_favorites where recruiter_id in (${idl}) or athlete_id in (select id from public.athletes where user_id in (${idl}));
    delete from public.recruiter_pipeline where recruiter_id in (${idl}) or athlete_id in (select id from public.athletes where user_id in (${idl}));
    delete from public.recruiter_activity_log where recruiter_id in (${idl}) or athlete_id in (select id from public.athletes where user_id in (${idl}));
    delete from public.recruiter_athlete_views where recruiter_id in (${idl}) or athlete_id in (select id from public.athletes where user_id in (${idl}));
    delete from public.admin_claims where user_id in (${idl});
    delete from public.team_athletes where athlete_id in (select id from public.athletes where user_id in (${idl}));
    delete from public.athletes where user_id in (${idl});
    delete from public.subscriptions where user_id in (${idl});
    commit;`);
  for (const id of ids) await fetch(`${API}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: H });
  const { count } = await svc.from("users").select("id", { count: "exact", head: true }).like("email", `%${DOM}`);
  note(`retiré : ${ids.length} comptes ; restants : ${count}`);
}

async function athlete(email, prenom, nom, ecole, equipe, sport, verifie) {
  const uid = await compte(email, "ATHLETE", prenom, nom, "2006-03-15");
  await un(svc.from("users").update({ context: "scolaire" }).eq("id", uid));
  const a = await un(svc.from("athletes").insert({
    user_id: uid, first_name: prenom, last_name: nom, date_naissance: "2006-03-15", status: "ACTIF",
    sport_id: sport, school_id: ecole, annee_diplomation: 2027, genre: "M",
  }).select("id").single());
  await un(svc.from("team_athletes").insert({ team_id: equipe, athlete_id: a.id, sport_id: sport }));
  if (verifie) await un(svc.from("athletes").update({ verified: true, last_profile_validation: new Date().toISOString() }).eq("id", a.id));
  return a.id;
}

async function preparer() {
  const { count: deja } = await svc.from("users").select("id", { count: "exact", head: true }).like("email", `%${DOM}`);
  if (deja) throw new Error(`${deja} comptes ${DOM} déjà présents — lancer --retirer d'abord`);
  note("interrupteurs : " + sql(`update public.app_settings set value = 'true' where key in ('lancement_collegial', 'lancement_universitaire') returning key || '=' || value;`).replace(/\n/g, ", "));
  const sport = (await un(svc.from("sports").select("id").eq("nom", SPORT).single())).id;
  const equipe = (ecole) => sql(`select t.id from public.teams t where t.school_id = '${ecole}' and t.sport_id = '${sport}' order by t.gender, t.name limit 1`);
  const univ = sql(`select id from public.schools where name = '${UNIVERSITE}' and type = 'UNIVERSITE'`);
  const cegep = sql(`select id from public.schools where name = '${CEGEP}' and type = 'CEGEP'`);
  const sec = sql(`select s.id from public.schools s join public.teams t on t.school_id = s.id where s.type = 'SECONDAIRE' and t.sport_id = '${sport}' group by s.id, s.name order by s.name limit 1`);
  const coll = sql(`select s.id from public.schools s join public.teams t on t.school_id = s.id where s.type = 'CEGEP' and t.sport_id = '${sport}' and s.id <> '${cegep}' group by s.id, s.name order by s.name limit 1`);
  if (!univ || !cegep || !sec || !coll) throw new Error("une école manque en local (D1 appliqué ?)");

  // 1. Recruteur universitaire validé : responsable de son unité (Université Laval × basketball), All Star.
  const uUni = await compte(`uni${DOM}`, "RECRUTEUR", "Camille", "Universitaire", "1988-05-12");
  await un(svc.from("users").update({ context: "universitaire", school_id: univ, primary_team_id: equipe(univ), sport: SPORT, sport_id: sport,
    is_school_admin: true, profile_data: { admin_type: "owner", rprp_accepted_at: new Date().toISOString() } }).eq("id", uUni));
  await un(svc.from("admin_claims").insert({ user_id: uUni, school_id: univ, claim_type: "DIRECTEUR", status: "APPROVED" }));
  await un(svc.from("subscriptions").update({ tier: "all_star", status: "active" }).eq("user_id", uUni));

  // 2. Recruteur collégial pour comparer (autre cégep, basketball, All Star).
  const uCol = await compte(`collegial${DOM}`, "RECRUTEUR", "Alex", "Collégial", "1985-02-02");
  await un(svc.from("users").update({ context: "collegial", school_id: coll, sport: SPORT, sport_id: sport }).eq("id", uCol));
  await un(svc.from("subscriptions").update({ tier: "all_star", status: "active" }).eq("user_id", uCol));

  // 3. Athlète cégépien vérifié (crochet bleu) et 4. athlète du secondaire.
  await athlete(`cegep${DOM}`, "Jordan", "Cégépien", cegep, equipe(cegep), sport, true);
  await athlete(`secondaire${DOM}`, "Sam", "Secondaire", sec, equipe(sec), sport, true);

  note("écoles : université " + sql(`select name from public.schools where id='${univ}'`) + " · cégep " + CEGEP +
       " · secondaire " + sql(`select name from public.schools where id='${sec}'`) + " · cégep du recruteur collégial " + sql(`select name from public.schools where id='${coll}'`));
  note("mot de passe commun : " + MOT_DE_PASSE);
}

if (process.argv.includes("--retirer")) await retirerTout();
else if (process.argv.includes("--off")) {
  note("interrupteurs : " + sql(`update public.app_settings set value = 'false' where key in ('lancement_collegial', 'lancement_universitaire') returning key || '=' || value;`).replace(/\n/g, ", "));
} else await preparer();
