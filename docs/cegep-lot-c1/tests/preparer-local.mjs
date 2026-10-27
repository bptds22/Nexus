// Comptes de test du lot C1 cégep — base LOCALE seulement (jamais le cloud).
//   cd C:\tmp\nexus-cegep-c1
//   node docs/cegep-lot-c1/tests/preparer-local.mjs            → crée (refuse si déjà là)
//   node docs/cegep-lot-c1/tests/preparer-local.mjs --retirer  → retire TOUT ce que le script a créé
//   node docs/cegep-lot-c1/tests/preparer-local.mjs --on|--off → bascule l'interrupteur lancement_collegial
// Clés : `npx supabase status -o env` dans le projet Supabase (C:\Users\bptds\Documents\Nexus). Refus si
// l'URL n'est pas 127.0.0.1. Comptes : *@c1.local, mot de passe commun MOT_DE_PASSE ci-dessous.
// Même méthode que docs/emulateur-1.4.5/preparer-local.mjs.
import { execSync } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";

const req = createRequire(path.resolve("package.json"));
const { createClient } = req("@supabase/supabase-js");

const MOT_DE_PASSE = "Cegep-C1-2026!x";
const DOM = "@c1.local";
const CEGEP = "Cégep de Saint-Jérôme";  // a des équipes de Basketball en local
const SPORT = "Basketball";

const sortie = execSync("npx supabase status -o env", { cwd: "C:\\Users\\bptds\\Documents\\Nexus", encoding: "utf8" });
const v = Object.fromEntries(sortie.split(/\r?\n/).filter((l) => l.includes("=")).map((l) => {
  const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
}));
const API = v.API_URL, SERVICE = v.SERVICE_ROLE_KEY;
if (!/^http:\/\/127\.0\.0\.1/.test(API ?? "")) throw new Error("PAS LOCAL — arrêt : " + API);
const DB = v.DB_URL;
if (!/@127\.0\.0\.1:/.test(DB ?? "")) throw new Error("BASE PAS LOCALE — arrêt");
const svc = createClient(API, SERVICE, { auth: { persistSession: false } });
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const note = (...a) => console.log(...a);
const PSQL = `"${process.env.USERPROFILE}\\scoop\\apps\\postgresql\\current\\bin\\psql.exe"`;
const sql = (q) => execSync(`${PSQL} "${DB}" -X -At -v ON_ERROR_STOP=1`, { input: q, encoding: "utf8" }).trim();

async function compte(email, { role, prenom = "", nom = "", meta = {} }) {
  const r = await (await fetch(`${API}/auth/v1/admin/users`, {
    method: "POST", headers: H,
    body: JSON.stringify({ email, password: MOT_DE_PASSE, email_confirm: true,
      user_metadata: { role, first_name: prenom, last_name: nom, ...meta } }),
  })).json();
  if (!r.id) throw new Error("compte " + email + " : " + JSON.stringify(r));
  return r.id;
}
const un = async (q) => { const { data, error } = await q; if (error) throw new Error(error.message); return data; };

async function retirerTout() {
  const liste = await un(svc.from("users").select("id").like("email", `%${DOM}`));
  const ids = liste.map((u) => u.id);
  if (ids.length === 0) { note("rien à retirer"); return; }
  const mps = await un(svc.from("media_partners").select("id").in("user_id", ids));
  if (mps.length) {
    await svc.from("partenaire_sports_permis").delete().in("partner_id", mps.map((m) => m.id));
    await svc.from("media_partners").delete().in("id", mps.map((m) => m.id));
  }
  const ath = await un(svc.from("athletes").select("id").in("user_id", ids));
  if (ath.length) await svc.from("team_athletes").delete().in("athlete_id", ath.map((a) => a.id));
  await svc.from("athletes").delete().in("user_id", ids);
  for (const id of ids) await fetch(`${API}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: H });
  const { count } = await svc.from("users").select("id", { count: "exact", head: true }).like("email", `%${DOM}`);
  note(`retiré : ${ids.length} comptes ; restants : ${count}`);
}

async function preparer() {
  const { count: deja } = await svc.from("users").select("id", { count: "exact", head: true }).like("email", `%${DOM}`);
  if (deja) throw new Error(`${deja} comptes ${DOM} déjà présents — lancer --retirer d'abord`);
  const sport = (await un(svc.from("sports").select("id").eq("nom", SPORT).single())).id;
  const cegep = (await un(svc.from("schools").select("id").eq("name", CEGEP).eq("type", "CEGEP").single())).id;
  const secondaire = (await un(svc.from("schools").select("id").eq("type", "SECONDAIRE").order("name").limit(1).single())).id;

  // Inscriptions neuves : l'onboarding se fait à l'écran.
  // 20 ans : consentement Loi 25 déjà donné (l'onboarding s'ouvre directement) ; 17 ans : parcours réel,
  // /consentements d'abord.
  await compte(`c1.athlete18${DOM}`, { role: "ATHLETE", meta: { date_naissance: "2006-04-12", consent_privacy_policy: new Date().toISOString() } });
  await compte(`c1.athlete17${DOM}`, { role: "ATHLETE", meta: { date_naissance: "2009-03-03" } });
  note("athlètes neufs : 20 ans (consentement posé) et 17 ans (parcours réel), onboarding à faire");

  // Bandeau (point 5) : un cégep tapé à la main, sans école.
  const uTexte = await compte(`c1.bandeau.texte${DOM}`, { role: "ATHLETE", prenom: "Texte", nom: "Bandeau-C1", meta: { date_naissance: "2006-01-20" } });
  await un(svc.from("users").update({ onboarding_complete: true, context: "scolaire" }).eq("id", uTexte));
  await un(svc.from("athletes").insert({ user_id: uTexte, first_name: "Texte", last_name: "Bandeau-C1", date_naissance: "2006-01-20",
    status: "ACTIF", sport_id: sport, annee_diplomation: 2027, ecole_non_listee: `${CEGEP}, Saint-Jérôme` }));
  // Bandeau (point 5) : ancré à un cégep, sans équipe — comme le témoin prod, ancré AVANT C0 : le verrou
  // et la vérification automatique ne s'appliquent pas à ce montage (triggers coupés le temps de l'UPDATE).
  const uAncre = await compte(`c1.bandeau.ancre${DOM}`, { role: "ATHLETE", prenom: "Ancre", nom: "Bandeau-C1", meta: { date_naissance: "2005-09-09" } });
  await un(svc.from("users").update({ onboarding_complete: true, context: "scolaire" }).eq("id", uAncre));
  const ancre = await un(svc.from("athletes").insert({ user_id: uAncre, first_name: "Ancre", last_name: "Bandeau-C1", date_naissance: "2005-09-09",
    status: "ACTIF", sport_id: sport, annee_diplomation: 2027, school_id: secondaire }).select("id").single());
  sql(`begin; set local session_replication_role = replica; update public.athletes set school_id = '${cegep}' where id = '${ancre.id}'; commit;`);
  note("bandeau : 1 cégep tapé à la main, 1 ancré à un cégep sans équipe (non vérifié)");

  const uRec = await compte(`c1.recruteur${DOM}`, { role: "RECRUTEUR", prenom: "Rec", nom: "Collégial-C1" });
  await un(svc.from("users").update({ role: "RECRUTEUR", school_id: cegep, sport_id: sport, onboarding_complete: true }).eq("id", uRec));
  await svc.from("subscriptions").update({ tier: "pro", status: "active" }).eq("user_id", uRec);

  const uPart = await compte(`c1.partenaire${DOM}`, { role: "PARTNER" });
  await un(svc.from("users").update({ role: "PARTNER", onboarding_complete: true }).eq("id", uPart));
  const maintenant = new Date().toISOString();
  const mp = await un(svc.from("media_partners").insert({
    user_id: uPart, organization_name: "Média C1", contact_name: "Test C1", contact_email: `c1.partenaire${DOM}`,
    status: "APPROVED", approved_at: maintenant, peut_evaluer: true,
    terms_accepted_at: maintenant, terms_version: "v1", password_reset_completed_at: maintenant,
  }).select("id").single());
  await un(svc.from("partenaire_sports_permis").insert([{ partner_id: mp.id, sport_id: sport }]));

  const uAdm = await compte(`c1.admin${DOM}`, { role: "ADMIN", prenom: "Admin", nom: "C1" });
  // is_platform_admin : c'est LUI que lit la garde de /admin (is_platform_admin(uid)), pas le rôle.
  await un(svc.from("users").update({ role: "ADMIN", is_platform_admin: true, onboarding_complete: true }).eq("id", uAdm));
  note("recruteur collégial (Pro, " + CEGEP + ", " + SPORT + "), partenaire approuvé, admin");
  note("mot de passe commun : " + MOT_DE_PASSE);
}

if (process.argv.includes("--retirer")) await retirerTout();
else if (process.argv.includes("--on") || process.argv.includes("--off")) {
  const val = process.argv.includes("--on") ? "true" : "false";
  note("lancement_collegial = " + sql(`update public.app_settings set value = '${val}' where key = 'lancement_collegial' returning value;`));
} else await preparer();
