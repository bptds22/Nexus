// Captures W4d — base LOCALE, navigateur SANS INTERFACE (jamais l'écran de BP).
//   cd C:\tmp\nexus-w4bc ; APP=http://localhost:3011 node docs/partenaires-w4d/outils/captures-w4d.mjs
// Partenaire p1.partenaire@preuve.local, admin admin@demo.local (fixtures locales).
// Deux athlètes ADULTES jetables (d1w4d.*@exemple.test) — jamais Félix ni Mathis (mineurs : le
// parent serait avisé). Cartes, transfert, refus et rapprochement passent par les VRAIES fonctions
// W4a, sous les vraies sessions. Tout est remis exactement comme avant à la fin.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const req = createRequire(path.resolve("package.json"));
const { createClient } = req("@supabase/supabase-js");
const { chromium } = req("playwright");
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
  .filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const API = env.NEXT_PUBLIC_SUPABASE_URL;
if (!/^http:\/\/127\.0\.0\.1/.test(API)) throw new Error("pas local : " + API);
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP = process.env.APP ?? "http://localhost:3011";
const OUT = path.resolve("docs/partenaires-w4d/captures");
fs.mkdirSync(OUT, { recursive: true });
const svc = createClient(API, SERVICE, { auth: { persistSession: false } });
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const journal = [];
const note = (...a) => { const l = a.join(" "); journal.push(l); console.log(l); };
const DESKTOP = { viewport: { width: 1440, height: 1000 }, locale: "fr-CA" };
const MOBILE = { viewport: { width: 390, height: 844 }, locale: "fr-CA", deviceScaleFactor: 2, isMobile: true, hasTouch: true };

async function session(email) {
  const g = await (await fetch(`${API}/auth/v1/admin/generate_link`, { method: "POST", headers: H, body: JSON.stringify({ type: "magiclink", email }) })).json();
  const s = await (await fetch(`${API}/auth/v1/verify`, { method: "POST", headers: H, body: JSON.stringify({ type: "magiclink", email, token: g.email_otp ?? g.properties?.email_otp }) })).json();
  if (!s.access_token) throw new Error("session impossible : " + email);
  return s;
}
const client = (s) => createClient(API, ANON, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${s.access_token}` } } });
function cookies(s) {
  const v = "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url");
  const m = v.match(/.{1,3180}/g);
  return (m.length === 1 ? [{ name: "sb-127-auth-token", value: v }] : m.map((x, i) => ({ name: `sb-127-auth-token.${i}`, value: x })))
    .map((c) => ({ ...c, domain: "localhost", path: "/" }));
}
async function rpc(c, f, args) {
  const { data, error } = await c.rpc(f, args);
  if (error) throw new Error(`${f} : ${error.message}`);
  return data;
}
async function capture(s, url, fichier, ctx, attendre, defiler) {
  const c = await nav.newContext(ctx);
  await c.addCookies(cookies(s));
  const p = await c.newPage();
  p.on("pageerror", (e) => erreurs.push(`${fichier} : ${e.message}`));
  await p.goto(`${APP}${url}`, { waitUntil: "networkidle" });
  await p.waitForSelector(attendre, { timeout: 30000 });
  await p.waitForTimeout(1500);
  if (defiler) await p.locator(defiler).first().scrollIntoViewIfNeeded();
  await p.screenshot({ path: path.join(OUT, fichier), fullPage: !defiler });
  const texte = await p.locator(defiler ?? "main").first().innerText().catch(() => "");
  await c.close();
  return texte;
}

const P1 = "p1.partenaire@preuve.local";
const ADMIN = "admin@demo.local";
const A_VISIBLE = "d1w4d.alex@exemple.test";
const B_CACHE = "d1w4d.sam@exemple.test";
const nav = await chromium.launch(); // headless
const erreurs = [];
const temp = { users: [] };
let mp1 = null;

try {
  const { data: p1 } = await svc.from("users").select("id").eq("email", P1).single();
  ({ data: mp1 } = await svc.from("media_partners").select("id, peut_evaluer, status").eq("user_id", p1.id).single());
  const avant = JSON.stringify(mp1);
  if (mp1.peut_evaluer || mp1.status !== "APPROVED") throw new Error("état de départ inattendu pour p1 : " + avant);
  const { data: foot } = await svc.from("sports").select("id").eq("nom", "Football").single();
  const { data: coach } = await svc.from("users").select("school_id").eq("email", "marc.desrosiers@exemple.test").single();
  const { data: vitesse } = await svc.from("badges").select("id").eq("code", "vitesse").single();

  // ── Préparation : p1 évaluateur en football, un badge propre ; deux athlètes adultes jetables ──
  await svc.from("media_partners").update({ peut_evaluer: true }).eq("id", mp1.id);
  await svc.from("partenaire_sports_permis").insert({ partner_id: mp1.id, sport_id: foot.id });
  const { data: pb } = await svc.from("partner_badges").insert({ partner_id: mp1.id, libelle: "Esprit sportif", icone_path: null, actif: true, ordre: 0 }).select("id").single();
  async function athlete(email, prenom, nom, optin) {
    const j = await (await fetch(`${API}/auth/v1/admin/users`, { method: "POST", headers: H,
      body: JSON.stringify({ email, password: "Banc-W4d-2026!x", email_confirm: true,
        user_metadata: { role: "ATHLETE", first_name: prenom, last_name: nom, consent_privacy_policy: new Date().toISOString() } }) })).json();
    if (!j.id) throw new Error("compte " + email + " : " + JSON.stringify(j));
    temp.users.push(j.id);
    await svc.from("users").update({ onboarding_complete: true }).eq("id", j.id);
    const { data: f, error } = await svc.from("athletes").insert({
      user_id: j.id, first_name: prenom, last_name: nom, date_naissance: "2006-05-05", status: "ACTIF", verified: false,
      annee_diplomation: 2025, sport_id: foot.id, school_id: coach.school_id,
      partner_visibility_opt_in: optin, partner_visibility_opted_in_at: optin ? new Date().toISOString() : null,
    }).select("id").single();
    if (error) throw error;
    return { userId: j.id, athleteId: f.id };
  }
  const alex = await athlete(A_VISIBLE, "Alex", "Démo-Visible", true);
  const sam = await athlete(B_CACHE, "Sam", "Démo-Cache", false);
  note("préparation : p1 évaluateur (football, 1 badge), 2 athlètes adultes jetables");

  // ── Cartes par les vraies fonctions, sous les vraies sessions ───────────────
  const sP = await session(P1), cP = client(sP);
  const sA = await session(A_VISIBLE), cA = client(sA);
  const sB = await session(B_CACHE), cB = client(sB);
  const creer = (prenom, nom, cote, badgesP, badgesN) => rpc(cP, "partenaire_prospect_enregistrer", {
    p_carte: null, p_prenom: prenom, p_nom: nom, p_sport_id: foot.id, p_position_id: null, p_school_id: coach.school_id,
    p_team_id: null, p_promotion: 2027, p_atteste_14_ans: true, p_cote_globale: cote, p_traits: {},
    p_badges_partenaire: badgesP, p_badges_nexus: badgesN });
  const c1 = await creer("Noé", "Essai", 4.5, [pb.id], [vitesse.id]);
  const j1 = await rpc(cP, "partenaire_prospect_lien", { p_carte: c1 });
  await rpc(cA, "prospect_partenaire_ouvrir", { p_jeton: j1 });
  const t1 = await rpc(cA, "prospect_partenaire_confirmer", { p_carte: c1 });
  note("c1 réclamée par Alex (visible) :", t1.statut, "| évaluation :", t1.evaluation);
  const c2 = await creer("Jade", "Essai", null, [], []);
  const j2 = await rpc(cP, "partenaire_prospect_lien", { p_carte: c2 });
  await rpc(cB, "prospect_partenaire_ouvrir", { p_jeton: j2 });
  await rpc(cB, "prospect_partenaire_infirmer", { p_carte: c2 });
  note("c2 refusée par Sam");
  await creer("Sam", "Démo-Cache", 3, [], []);   // c3 : candidat MOYENNE (même école, même sport, nom exact) — Sam non visible
  await creer("Zoé", "Exemple", null, [], []);   // c4 : carte simple, à envoyer
  note("c3 : rapprochement avec Sam (non visible) ; c4 : à envoyer");

  // ── Captures ────────────────────────────────────────────────────────────────
  const sAd = await session(ADMIN);
  for (const [nom, ctx] of [["bureau", DESKTOP], ["mobile", MOBILE]]) {
    const t = await capture(sAd, "/admin/prospects-partenaires", `01-admin-prospects-${nom}.png`, ctx, "[data-section-candidats]");
    if (nom === "bureau") note("admin : candidat Sam affiché :", /Sam Démo-Cache/.test(t), "| « Non visible du partenaire » :", /Non visible du partenaire/.test(t),
      "| « Annuler la réclamation » :", /Annuler la réclamation/.test(t));
  }
  for (const [nom, ctx] of [["bureau", DESKTOP], ["mobile", MOBILE]]) {
    const t = await capture(sP, "/partenaire/prospects", `02-terminees-reclamee-visible-${nom}.png`, ctx, "[data-section-terminees]", "[data-section-terminees]");
    if (nom === "bureau") note("p1 Terminées : Alex nommé :", /Alex Démo-Visible/i.test(t), "| Sam (refus, non visible) jamais nommé dans Terminées :", !/sam/i.test(t));
  }
  for (const [nom, ctx] of [["bureau", DESKTOP], ["mobile", MOBILE]]) {
    const t = await capture(sP, "/partenaire/mes-athletes", `03-mes-athletes-${nom}.png`, ctx, "[data-mon-athlete]");
    if (nom === "bureau") note("p1 Mes athlètes : Alex :", /Alex Démo-Visible/.test(t), "| Sam absent :", !/Démo-Cache/.test(t));
  }

  // ── Alex retire sa visibilité ───────────────────────────────────────────────
  await rpc(cA, "set_my_partner_visibility", { p_granted: false, p_policy_version: "2026-08-v1" });
  {
    const t = await capture(sP, "/partenaire/prospects", "04-terminees-profil-non-visible-bureau.png", DESKTOP, "[data-section-terminees]", "[data-section-terminees]");
    note("après retrait : « Réclamée — profil non visible » :", /Réclamée — profil non visible/.test(t), "| Alex encore nommé :", /Alex/.test(t));
  }
  {
    const t = await capture(sP, "/partenaire/mes-athletes", "05-mes-athletes-vide-bureau.png", DESKTOP, "[data-page-mes-athletes]");
    note("après retrait : Mes athlètes vide :", /Aucun athlète/.test(t));
  }
  const { count: evals } = await svc.from("partner_evaluations").select("id", { count: "exact", head: true }).eq("athlete_id", alex.athleteId);
  note("après retrait : évaluation toujours en base (rien d'effacé) :", evals);
} finally {
  // ── Remise en état exacte ───────────────────────────────────────────────────
  if (mp1) {
    const { data: cartes } = await svc.from("partenaire_prospects").select("id").eq("partner_id", mp1.id);
    const { data: issues } = await svc.from("partenaire_prospects_issues").select("carte_id").eq("partner_id", mp1.id);
    const ids = [...(cartes ?? []).map((c) => c.id), ...(issues ?? []).map((i) => i.carte_id)];
    if (ids.length) {
      await svc.from("partenaire_prospects_journal").delete().in("carte_id", ids);
      await svc.from("partenaire_prospects_rapprochements").delete().in("carte_id", ids);
    }
    await svc.from("partenaire_prospects").delete().eq("partner_id", mp1.id);
    await svc.from("partenaire_prospects_issues").delete().eq("partner_id", mp1.id);
    await svc.from("partner_athlete_badges").delete().eq("partner_id", mp1.id);
    await svc.from("partner_evaluation_retraits").delete().eq("partner_id", mp1.id);
    await svc.from("partner_evaluations").delete().eq("partner_id", mp1.id);
    await svc.from("partner_badges").delete().eq("partner_id", mp1.id);
    await svc.from("partenaire_sports_permis").delete().eq("partner_id", mp1.id);
    await svc.from("media_partners").update({ peut_evaluer: false }).eq("id", mp1.id);
  }
  for (const id of temp.users) {
    await svc.from("athletes").delete().eq("user_id", id);
    const r = await fetch(`${API}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: H });
    note("remise en état : compte jetable supprimé :", r.status);
  }
  const { data: apres } = await svc.from("media_partners").select("id, peut_evaluer, status").eq("id", mp1?.id ?? "").maybeSingle();
  const { count: nc } = await svc.from("partenaire_prospects").select("id", { count: "exact", head: true });
  const { count: ni } = await svc.from("partenaire_prospects_issues").select("id", { count: "exact", head: true });
  note("remise en état : p1", JSON.stringify(apres), "| cartes", nc, "| issues", ni);
  note("erreurs JavaScript des pages :", erreurs.length ? JSON.stringify(erreurs) : "aucune");
  fs.writeFileSync(path.resolve("docs/partenaires-w4d/captures-resultats.txt"), journal.join("\n") + "\n");
  await nav.close();
}
