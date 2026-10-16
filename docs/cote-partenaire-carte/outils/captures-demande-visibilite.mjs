// Captures — demande de visibilité (cloche jeune, « Accepter », demande au parent) et Loi 25 (retrait
// d'opt-in). Base LOCALE, navigateur SANS INTERFACE (jamais l'écran de BP).
//   cd C:\tmp\nexus-cote ; APP=http://localhost:3013 node docs/cote-partenaire-carte/outils/captures-demande-visibilite.mjs
// Comptes jetables (cote.demande.*@exemple.test) : Alex, adulte ; Noa, 13 ans, relié au parent fixture
// local parent.b1@preuve.local. Cartes, confirmation et acceptation par les VRAIES fonctions sous les
// vraies sessions. Tout est remis exactement comme avant à la fin.
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
const APP = process.env.APP ?? "http://localhost:3013";
const OUT = path.resolve("docs/cote-partenaire-carte/captures");
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
const nav = await chromium.launch(); // headless
const erreurs = [];
async function ouvrir(s, url, ctx) {
  const c = await nav.newContext(ctx);
  await c.addCookies(cookies(s));
  const p = await c.newPage();
  p.on("pageerror", (e) => erreurs.push(`${url} : ${e.message}`));
  await p.goto(`${APP}${url}`, { waitUntil: "networkidle" });
  return { c, p };
}
const photo = (p, fichier) => p.screenshot({ path: path.join(OUT, fichier) });

const P1 = "p1.partenaire@preuve.local";
const REC = "julie.lambert@exemple.test";
const PARENT = "parent.b1@preuve.local";
const temp = { users: [], athletes: [] };
let mp1 = null;
const POL = "2026-10-v1";

try {
  const { data: p1 } = await svc.from("users").select("id").eq("email", P1).single();
  ({ data: mp1 } = await svc.from("media_partners").select("id, peut_evaluer, status").eq("user_id", p1.id).single());
  if (mp1.peut_evaluer || mp1.status !== "APPROVED") throw new Error("état de départ inattendu pour p1 : " + JSON.stringify(mp1));
  const { data: parent } = await svc.from("users").select("id").eq("email", PARENT).single();
  const { data: coach } = await svc.from("users").select("id, school_id").eq("email", "marc.desrosiers@exemple.test").single();
  const { data: foot } = await svc.from("sports").select("id").eq("nom", "Football").single();
  await svc.from("media_partners").update({ peut_evaluer: true }).eq("id", mp1.id);
  await svc.from("partenaire_sports_permis").insert({ partner_id: mp1.id, sport_id: foot.id });

  async function athlete(email, prenom, nom, naissance) {
    const j = await (await fetch(`${API}/auth/v1/admin/users`, { method: "POST", headers: H,
      body: JSON.stringify({ email, password: "Banc-Demande-2026!x", email_confirm: true,
        user_metadata: { role: "ATHLETE", first_name: prenom, last_name: nom, consent_privacy_policy: new Date().toISOString() } }) })).json();
    if (!j.id) throw new Error("compte " + email + " : " + JSON.stringify(j));
    temp.users.push(j.id);
    await svc.from("users").update({ onboarding_complete: true }).eq("id", j.id);
    const { data: f, error } = await svc.from("athletes").insert({
      user_id: j.id, first_name: prenom, last_name: nom, date_naissance: naissance, status: "ACTIF", verified: false,
      annee_diplomation: 2027, sport_id: foot.id, school_id: coach.school_id, coach_id: coach.id,
      partner_visibility_opt_in: false,
    }).select("id").single();
    if (error) throw error;
    temp.athletes.push(f.id);
    return { email, userId: j.id, athleteId: f.id };
  }
  const treize = new Date(); treize.setFullYear(treize.getFullYear() - 13); treize.setMonth(treize.getMonth() - 2);
  const alex = await athlete("cote.demande.a@exemple.test", "Alex", "Démo-Demande", "2006-05-05");
  const noa = await athlete("cote.demande.b@exemple.test", "Noa", "Démo-Parent", treize.toISOString().slice(0, 10));
  await svc.from("parent_athletes").insert({ parent_user_id: parent.id, athlete_id: noa.athleteId });
  note("préparation : p1 évaluateur ; Alex (adulte) et Noa (13 ans, parent lié) sans opt-in — jetables");

  const sP = await session(P1), cP = client(sP);
  const sR = await session(REC), cR = client(sR);
  async function carteConfirmee(a, prenom, cote) {
    const carte = await rpc(cP, "partenaire_prospect_enregistrer", {
      p_carte: null, p_prenom: prenom, p_nom: "Essai", p_sport_id: foot.id, p_position_id: null, p_school_id: coach.school_id,
      p_team_id: null, p_promotion: 2027, p_atteste_14_ans: true, p_cote_globale: cote, p_traits: {},
      p_badges_partenaire: [], p_badges_nexus: [] });
    const jeton = await rpc(cP, "partenaire_prospect_lien", { p_carte: carte });
    const sA = await session(a.email), cA = client(sA);
    await rpc(cA, "prospect_partenaire_ouvrir", { p_jeton: jeton });
    const r = await rpc(cA, "prospect_partenaire_confirmer", { p_carte: carte });
    return { sA, cA, statut: r.statut };
  }

  // 1. Alex confirme une carte évaluée sans opt-in : la demande arrive dans sa cloche.
  const A = await carteConfirmee(alex, "Alex", 4);
  note("Alex confirme la carte :", A.statut);
  note("recruteur, AVANT acceptation : évaluations partenaires d'Alex :", (await rpc(cR, "evaluations_partenaires_athlete", { p_athlete_id: alex.athleteId })).length);
  for (const [nom, ctx] of [["bureau", DESKTOP], ["mobile", MOBILE]]) {
    const { c, p } = await ouvrir(A.sA, "/athlete/notifications", ctx);
    await p.waitForSelector("[data-demande-visibilite]", { timeout: 45000 });
    await p.waitForTimeout(800);
    await photo(p, `12-demande-cloche-${nom}.png`);
    if (nom === "bureau") {
      const t = await p.locator("[data-demande-visibilite]").innerText();
      note("cloche : texte =", JSON.stringify(t.split("\n").slice(0, 2)), "| aucun chiffre de cote :", !/[0-9],[0-9]|[0-9]\.[0-9]|\/5/.test(t));
      await p.getByRole("button", { name: "Accepter" }).click();
      await p.waitForSelector('[data-demande-visibilite="ACCEPTEE"]', { timeout: 20000 });
      await p.waitForTimeout(600);
      await photo(p, "13-demande-acceptee-bureau.png");
      note("après « Accepter » :", (await p.locator('[data-demande-visibilite="ACCEPTEE"]').innerText()).split("\n").slice(2, 3).join(" "));
    }
    await c.close();
  }
  note("recruteur, APRÈS acceptation : évaluations partenaires d'Alex :", (await rpc(cR, "evaluations_partenaires_athlete", { p_athlete_id: alex.athleteId })).length);

  // 2. Loi 25 : Alex retire son opt-in → la fiche recruteur ne montre plus rien du partenaire.
  {
    const { c, p } = await ouvrir(sR, `/recruteur/athletes/${alex.athleteId}`, DESKTOP);
    await p.waitForSelector("[data-cote-partenaire]", { timeout: 45000 });
    await p.waitForTimeout(1200);
    await photo(p, "14-fiche-alex-opt-in-actif-bureau.png");
    await c.close();
  }
  await rpc(A.cA, "set_my_partner_visibility", { p_granted: false, p_policy_version: POL });
  {
    const { c, p } = await ouvrir(sR, `/recruteur/athletes/${alex.athleteId}`, DESKTOP);
    await p.waitForSelector(".nx-v30-ticket", { timeout: 45000 });
    await p.waitForTimeout(2500);
    await photo(p, "15-fiche-alex-opt-in-retire-bureau.png");
    note("après RETRAIT : libellé partenaire sur la carte :", await p.locator("[data-cote-partenaire]").count(),
      "| section partenaire :", await p.locator("[data-evaluation-partenaire]").count(),
      "| lecture W2 recruteur :", (await rpc(cR, "evaluations_partenaires_athlete", { p_athlete_id: alex.athleteId })).length);
    await c.close();
  }
  const sAd = await session("admin@demo.local");
  note("après RETRAIT : lecture W2 admin :", (await rpc(client(sAd), "evaluations_partenaires_athlete", { p_athlete_id: alex.athleteId })).length);

  // 3. Noa (13 ans) : « Accepter » envoie la demande au parent ; le parent est mené à Consentements.
  const B = await carteConfirmee(noa, "Noa", 3.5);
  note("Noa confirme la carte :", B.statut);
  {
    const { c, p } = await ouvrir(B.sA, "/athlete/notifications", DESKTOP);
    await p.waitForSelector("[data-demande-visibilite]", { timeout: 45000 });
    await p.getByRole("button", { name: "Accepter" }).click();
    await p.waitForSelector('[data-demande-visibilite="DEMANDE_PARENT"]', { timeout: 20000 });
    await p.waitForTimeout(600);
    await photo(p, "16-demande-envoyee-au-parent-bureau.png");
    note("Noa après « Accepter » :", (await p.locator('[data-demande-visibilite="DEMANDE_PARENT"]').innerText()).split("\n").slice(2, 3).join(" "));
    await c.close();
  }
  const { data: noaApres } = await svc.from("athletes").select("partner_visibility_opt_in").eq("id", noa.athleteId).single();
  note("Noa : opt-in activé directement ?", noaApres.partner_visibility_opt_in, "(attendu false : c'est au parent)");
  {
    const sPa = await session(PARENT);
    const { c, p } = await ouvrir(sPa, "/parent/notifications", DESKTOP);
    await p.waitForSelector('[data-type="CHILD_PARTNER_VISIBILITY_REQUEST"]', { timeout: 45000 });
    await p.waitForTimeout(600);
    await photo(p, "17-parent-demande-bureau.png");
    const t = await p.locator('[data-type="CHILD_PARTNER_VISIBILITY_REQUEST"]').innerText();
    note("parent : demande =", JSON.stringify(t.split("\n").slice(0, 2)), "| sans cote :", !/[0-9],[0-9]|[0-9]\.[0-9]|\/5/.test(t));
    await p.locator('[data-type="CHILD_PARTNER_VISIBILITY_REQUEST"]').click();
    await p.waitForURL("**/parent/consentements", { timeout: 20000 });
    note("parent : clic → ", new URL(p.url()).pathname);
    await c.close();
  }
} finally {
  if (temp.athletes.length) {
    await svc.from("parent_notifications").delete().in("athlete_id", temp.athletes);
    await svc.from("parent_athletes").delete().in("athlete_id", temp.athletes);
    await svc.from("athlete_notifications").delete().in("athlete_id", temp.athletes);
  }
  if (temp.users.length) await svc.from("push_file").delete().in("user_id", temp.users);
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
    await svc.from("partner_evaluations").delete().eq("partner_id", mp1.id);
    await svc.from("partenaire_sports_permis").delete().eq("partner_id", mp1.id);
    await svc.from("media_partners").update({ peut_evaluer: false }).eq("id", mp1.id);
  }
  for (const id of temp.users) {
    await svc.from("athletes").delete().eq("user_id", id);
    const r = await fetch(`${API}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: H });
    note("remise en état : compte jetable supprimé :", r.status);
  }
  const { data: apres } = await svc.from("media_partners").select("peut_evaluer, status").eq("id", mp1?.id ?? "").maybeSingle();
  const { count: ne } = await svc.from("partner_evaluations").select("id", { count: "exact", head: true });
  const { count: nc } = await svc.from("partenaire_prospects").select("id", { count: "exact", head: true }).eq("partner_id", mp1?.id ?? "");
  const { count: nd } = await svc.from("athlete_notifications").select("id", { count: "exact", head: true }).eq("type", "PARTENAIRE_VISIBILITE_DEMANDE");
  note("remise en état : p1", JSON.stringify(apres), "| évaluations partenaires", ne, "| cartes p1", nc, "| demandes", nd);
  note("erreurs JavaScript des pages :", erreurs.length ? JSON.stringify(erreurs) : "aucune");
  fs.writeFileSync(path.resolve("docs/cote-partenaire-carte/captures-demande-resultats.txt"), journal.join("\n") + "\n");
  await nav.close();
}
