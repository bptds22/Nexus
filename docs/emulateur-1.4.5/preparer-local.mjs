// Données de la vérification émulateur 1.4.5 — base LOCALE seulement (jamais le cloud).
//   cd C:\tmp\nexus-145
//   node docs/emulateur-1.4.5/preparer-local.mjs            → crée (idempotent : refuse si déjà là)
//   node docs/emulateur-1.4.5/preparer-local.mjs --retirer  → retire TOUT ce que le script a créé
// Clés : lues par `npx supabase status -o env` dans le projet Supabase (C:\Users\bptds\Documents\Nexus),
// ou LOCAL_SUPABASE_URL / LOCAL_SERVICE_KEY / LOCAL_ANON_KEY. Refus si l'URL n'est pas 127.0.0.1.
// Comptes : *@emulateur.local, mot de passe commun MOT_DE_PASSE ci-dessous.
// Tout passe par les VRAIES portes là où elles existent (RPC partenaire, insert de carte sous la
// session du recruteur, triggers de rapprochement et de nom Google) — rien n'est forcé à la main
// qu'un flag d'onboarding et les lignes de fixture (partenaire, abonnement, rattachements).
import { execSync } from "node:child_process";
import path from "node:path";
import { createRequire } from "node:module";

const req = createRequire(path.resolve("package.json"));
const { createClient } = req("@supabase/supabase-js");

const MOT_DE_PASSE = "Emul-145-2026!x";
const DOM = "@emulateur.local";
const retirer = process.argv.includes("--retirer");

function cles() {
  if (process.env.LOCAL_SUPABASE_URL) {
    return { API: process.env.LOCAL_SUPABASE_URL, SERVICE: process.env.LOCAL_SERVICE_KEY, ANON: process.env.LOCAL_ANON_KEY };
  }
  const sortie = execSync("npx supabase status -o env", { cwd: "C:\\Users\\bptds\\Documents\\Nexus", encoding: "utf8" });
  const v = Object.fromEntries(sortie.split(/\r?\n/).filter((l) => l.includes("=")).map((l) => {
    const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")];
  }));
  return { API: v.API_URL, SERVICE: v.SERVICE_ROLE_KEY, ANON: v.ANON_KEY };
}
const { API, SERVICE, ANON } = cles();
if (!/^http:\/\/127\.0\.0\.1/.test(API ?? "")) throw new Error("PAS LOCAL — arrêt : " + API);
const svc = createClient(API, SERVICE, { auth: { persistSession: false } });
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const note = (...a) => console.log(...a);

// Repères locaux relevés le 2026-10-16.
const CEGEP_UNITE = "dfad9036-0d54-4304-906f-91f19542a882";   // Cégep de Saint-Hyacinthe (952 cartes Football)
const ECOLE_COACH = "d3a00000-0000-4000-8000-0000000c0001";   // École secondaire des Érables (1 équipe)

async function sql1(table, filtre) {
  const { data, error } = await filtre(svc.from(table));
  if (error) throw new Error(`${table} : ${error.message}`);
  return data;
}
async function compte(email, { role, prenom = "", nom = "", meta = {}, app = {} }) {
  const r = await (await fetch(`${API}/auth/v1/admin/users`, {
    method: "POST", headers: H,
    body: JSON.stringify({ email, password: MOT_DE_PASSE, email_confirm: true,
      user_metadata: { role, first_name: prenom, last_name: nom, ...meta }, app_metadata: app }),
  })).json();
  if (!r.id) throw new Error("compte " + email + " : " + JSON.stringify(r));
  return r.id;
}
async function session(email) {
  const c = createClient(API, ANON, { auth: { persistSession: false } });
  const { data, error } = await c.auth.signInWithPassword({ email, password: MOT_DE_PASSE });
  if (error) throw new Error("session " + email + " : " + error.message);
  return createClient(API, ANON, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${data.session.access_token}` } } });
}

async function retirerTout() {
  const { data: liste } = await svc.from("users").select("id, email").like("email", `%${DOM}`);
  const ids = (liste ?? []).map((u) => u.id);
  if (ids.length === 0) { note("rien à retirer"); return; }
  // Cartes du recruteur de test (volume + rapprochement), cartes partenaire, fiches, fixtures.
  await svc.from("rapprochements").delete().in("carte_id",
    ((await svc.from("cartes_prospect").select("id").in("cree_par", ids)).data ?? []).map((c) => c.id));
  await svc.from("cartes_prospect").delete().in("cree_par", ids);
  const { data: mps } = await svc.from("media_partners").select("id").in("user_id", ids);
  const mpIds = (mps ?? []).map((m) => m.id);
  if (mpIds.length) {
    await svc.from("partenaire_prospects").delete().in("partner_id", mpIds).then(() => {}, () => {});
    await svc.from("partenaire_sports_permis").delete().in("partner_id", mpIds);
    await svc.from("media_partners").delete().in("id", mpIds);
  }
  await svc.from("athletes").delete().like("email", `%${DOM}`);
  await svc.from("athletes").delete().in("user_id", ids);
  await svc.from("athletes").delete().eq("first_name", "Noah").eq("last_name", "Orphelin-Emul");
  await svc.from("team_coaches").delete().in("coach_id", ids);
  for (const id of ids) await fetch(`${API}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: H });
  const { count } = await svc.from("users").select("id", { count: "exact", head: true }).like("email", `%${DOM}`);
  note(`retiré : ${ids.length} comptes ; restants : ${count}`);
}

async function preparer() {
  const { count: deja } = await svc.from("users").select("id", { count: "exact", head: true }).like("email", `%${DOM}`);
  if (deja) throw new Error(`${deja} comptes ${DOM} déjà présents — lancer --retirer d'abord`);
  const football = (await sql1("sports", (q) => q.select("id").eq("nom", "Football").single())).id;
  const equipeCoach = (await sql1("teams", (q) => q.select("id, sport_id").eq("school_id", ECOLE_COACH).limit(1).single()));

  // ── Partenaires ─────────────────────────────────────────────────────────────
  const maintenant = new Date().toISOString();
  async function partenaire(email, org, statut, conditions) {
    const uid = await compte(email, { role: "PARTNER" });
    await svc.from("users").update({ role: "PARTNER", onboarding_complete: true }).eq("id", uid);
    const { data, error } = await svc.from("media_partners").insert({
      user_id: uid, organization_name: org, contact_name: "Test Émulateur", contact_email: email,
      status: statut, approved_at: statut === "APPROVED" ? maintenant : null, peut_evaluer: true,
      terms_accepted_at: conditions ? maintenant : null, terms_version: conditions ? "v1" : null,
      password_reset_completed_at: conditions ? maintenant : null,
    }).select("id").single();
    if (error) throw new Error("media_partners " + email + " : " + error.message);
    await svc.from("partenaire_sports_permis").insert([{ partner_id: data.id, sport_id: football },
      ...(equipeCoach.sport_id !== football ? [{ partner_id: data.id, sport_id: equipeCoach.sport_id }] : [])]);
    return data.id;
  }
  await partenaire(`e.partenaire${DOM}`, "Média Émulateur", "APPROVED", true);
  await partenaire(`e.partenaire.bienvenue${DOM}`, "Média Bienvenue", "APPROVED", false);
  await partenaire(`e.partenaire.suspendu${DOM}`, "Média Suspendu", "SUSPENDED", true);
  note("partenaires : 3 (approuvé peut_evaluer, sans conditions, suspendu)");

  // 48 cartes prospect partenaire : à 2 de la limite de 50.
  const p = await session(`e.partenaire${DOM}`);
  for (let i = 1; i <= 48; i++) {
    const { error } = await p.rpc("partenaire_prospect_enregistrer", {
      p_carte: null, p_prenom: "Prospect", p_nom: `Émul ${String(i).padStart(2, "0")}`,
      p_sport_id: equipeCoach.sport_id, p_position_id: null, p_school_id: ECOLE_COACH, p_team_id: equipeCoach.id,
      p_promotion: 2028, p_atteste_14_ans: true, p_cote_globale: i % 2 ? 4 : null, p_traits: null,
      p_badges_partenaire: null, p_badges_nexus: null,
    });
    if (error) throw new Error(`carte partenaire ${i} : ${error.message}`);
  }
  note("cartes partenaire : 48 (limite 50 atteinte après 2 créations)");

  // ── Recruteurs de l'unité Saint-Hyacinthe × Football ────────────────────────
  async function recruteur(email, tier) {
    const uid = await compte(email, { role: "RECRUTEUR", prenom: "Rec", nom: tier === "pro" ? "Émulateur" : "Gratuit" });
    await svc.from("users").update({ role: "RECRUTEUR", school_id: CEGEP_UNITE, sport_id: football, onboarding_complete: true }).eq("id", uid);
    await svc.from("subscriptions").update({ tier, status: "active" }).eq("user_id", uid);
    return uid;
  }
  await recruteur(`e.recruteur${DOM}`, "pro");
  await recruteur(`e.recruteur.gratuit${DOM}`, "free");
  const r = await session(`e.recruteur${DOM}`);
  const { data: eqFoot } = await svc.from("teams").select("id").eq("sport_id", football).limit(1).single();
  const lot = Array.from({ length: 60 }, (_, i) => ({ prenom: "Volume", nom: `Émul ${String(i + 1).padStart(3, "0")}`, team_id: eqFoot.id, promotion: 2027 + (i % 3) }));
  for (let i = 0; i < lot.length; i += 20) {
    const { error } = await r.from("cartes_prospect").insert(lot.slice(i, i + 20));
    if (error) throw new Error("cartes volume : " + error.message);
  }
  const { count: nUnite } = await svc.from("cartes_prospect").select("id", { count: "exact", head: true })
    .eq("unite_cegep_id", CEGEP_UNITE).eq("unite_sport_id", football);
  note(`cartes de l'unité : ${nUnite} (≥ 1000 voulu)`);

  // Proposition de rapprochement : une carte au même nom et à la même équipe qu'un athlète ACTIF.
  const { data: candidats } = await svc.from("team_athletes")
    .select("team_id, athletes!inner(id, first_name, last_name, status), teams!inner(sport_id)")
    .eq("athletes.status", "ACTIF").eq("teams.sport_id", football).limit(20);
  let propose = false;
  for (const c of candidats ?? []) {
    const a = Array.isArray(c.athletes) ? c.athletes[0] : c.athletes;
    if (!a?.first_name || !a?.last_name) continue;
    const { data: carte, error } = await r.from("cartes_prospect").insert({ prenom: a.first_name, nom: a.last_name, team_id: c.team_id }).select("id").single();
    if (error) continue;
    // La carte est mise en FILE (rapprochement_enfiler) ; pg_cron la traite chaque minute.
    // On fait le passage tout de suite, par la même fonction que le cron.
    const { error: errEval } = await svc.rpc("evaluer_rapprochements", { p_max: 500 });
    if (errEval) note("evaluer_rapprochements : " + errEval.message);
    const { data: vues } = await r.rpc("rapprochements_unite");
    if ((vues ?? []).some((v) => v.carte_id === carte.id)) { note(`rapprochement : carte « ${a.first_name} ${a.last_name} » ↔ profil ${a.id}`); propose = true; break; }
    await svc.from("cartes_prospect").delete().eq("id", carte.id);
  }
  if (!propose) note("⚠ rapprochement : aucun candidat visible n'a produit de proposition — à créer à la main");

  // ── Coachs, athlètes ────────────────────────────────────────────────────────
  async function coach(email, nom) {
    const uid = await compte(email, { role: "COACH", prenom: "Coach", nom });
    await svc.from("users").update({ role: "COACH", school_id: ECOLE_COACH, context: "scolaire", onboarding_complete: true }).eq("id", uid);
    await svc.from("team_coaches").insert({ team_id: equipeCoach.id, coach_id: uid, role: "assistant" });
    return uid;
  }
  const coachA = await coach(`e.coach${DOM}`, "Émulateur");
  const coachB = await coach(`e.coach.autre${DOM}`, "Autre");

  // D1b — un compte « Google ». L'API d'administration force provider = email : le trigger
  // trg_users_nom_google ne peut donc pas jouer ici. On pose EXACTEMENT ce qu'il aurait posé
  // (couper_nom_complet, nom_a_confirmer) et on marque le compte google côté auth.
  async function commeGoogle(uid, complet) {
    const { data: c, error } = await svc.rpc("couper_nom_complet", { p: complet });
    if (error) throw new Error("couper_nom_complet : " + error.message);
    const { prenom, nom } = (c ?? [])[0] ?? {};
    const { error: e2 } = await svc.from("users").update({ first_name: prenom, last_name: nom, nom_a_confirmer: true }).eq("id", uid);
    if (e2) throw new Error("users nom_a_confirmer : " + e2.message);
    await fetch(`${API}/auth/v1/admin/users/${uid}`, { method: "PUT", headers: H,
      body: JSON.stringify({ app_metadata: { provider: "google", providers: ["google"] }, user_metadata: { full_name: complet } }) });
    return { prenom, nom };
  }
  // Compte « Google » neuf : onboarding avec Prénom / Nom pré-remplis à confirmer.
  const g1 = await compte(`e.athlete.google${DOM}`, { role: "ATHLETE", meta: { date_naissance: "2008-06-06" } });
  await commeGoogle(g1, "Léa-Rose Tremblay Roy");
  const { data: u1 } = await svc.from("users").select("first_name, last_name, nom_a_confirmer").eq("id", g1).single();
  note(`compte Google neuf : ${u1.first_name} / ${u1.last_name} — à confirmer : ${u1.nom_a_confirmer}`);

  // D1b — fiche au nom à confirmer, onboarding fini, dans l'effectif de coachA (bandeau + étiquette).
  async function ficheAConfirmer(email, complet, coachId) {
    const uid = await compte(email, { role: "ATHLETE" });
    const u = await commeGoogle(uid, complet);
    await svc.from("athletes").insert({ user_id: uid, first_name: u.prenom, last_name: u.nom, email,
      school_id: ECOLE_COACH, coach_id: coachId, sport_id: equipeCoach.sport_id, status: "ACTIF", annee_diplomation: 2027, date_naissance: "2007-02-02" });
    await svc.from("users").update({ onboarding_complete: true }).eq("id", uid);
    const { data: a } = await svc.from("athletes").select("nom_a_confirmer").eq("user_id", uid).single();
    note(`fiche ${email} : nom à confirmer = ${a?.nom_a_confirmer}`);
  }
  await ficheAConfirmer(`e.athlete.aconfirmer${DOM}`, "Maxime Bélanger Côté", coachA);
  await ficheAConfirmer(`e.athlete.aconfirmer.autre${DOM}`, "Zoé Gagnon", coachB); // masquée chez coachA (ligne « 1 fiche masquée »)

  // D1 — doublon à l'inscription : fiche existante « Félix Doublon-Emul » né le 2008-03-03.
  const ex = await compte(`e.athlete.existant${DOM}`, { role: "ATHLETE", prenom: "Félix", nom: "Doublon-Emul" });
  await svc.from("athletes").insert({ user_id: ex, first_name: "Félix", last_name: "Doublon-Emul", email: `e.athlete.existant${DOM}`,
    school_id: ECOLE_COACH, coach_id: coachA, sport_id: equipeCoach.sport_id, status: "ACTIF", annee_diplomation: 2026, date_naissance: "2008-03-03" });
  await svc.from("users").update({ onboarding_complete: true }).eq("id", ex);
  // D1 — assistant coach : fiche sans compte du même coach (« Déjà dans ton effectif »).
  await svc.from("athletes").insert({ first_name: "Noah", last_name: "Orphelin-Emul", school_id: ECOLE_COACH, coach_id: coachA,
    sport_id: equipeCoach.sport_id, status: "ACTIF", annee_diplomation: 2027, date_naissance: "2008-04-04" });
  note("doublons : Félix Doublon-Emul (2008-03-03, compte) ; Noah Orphelin-Emul (2008-04-04, sans compte, effectif de e.coach)");
  note(`\nOK — mot de passe de tous les comptes ${DOM} : ${MOT_DE_PASSE}`);
}

if (retirer) await retirerTout(); else await preparer();
