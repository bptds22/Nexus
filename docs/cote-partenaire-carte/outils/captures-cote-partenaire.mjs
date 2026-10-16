// Captures — cote partenaire sur la carte + filtres « Mes athlètes ». Base LOCALE, navigateur SANS
// INTERFACE (jamais l'écran de BP).
//   cd C:\tmp\nexus-cote ; APP=http://localhost:3013 node docs/cote-partenaire-carte/outils/captures-cote-partenaire.mjs
// Partenaire p1.partenaire@preuve.local, recruteur julie.lambert@exemple.test, coach marc.desrosiers@exemple.test.
// Trois athlètes ADULTES jetables (cote.*@exemple.test) — jamais Félix ni Mathis (mineurs : le parent
// serait avisé). Évaluations et badges par les VRAIES fonctions W2/W3/W3b, sous la vraie session du
// partenaire. Tout est remis exactement comme avant à la fin.
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
async function page(s, url, ctx) {
  const c = await nav.newContext(ctx);
  await c.addCookies(cookies(s));
  const p = await c.newPage();
  p.on("pageerror", (e) => erreurs.push(`${url} : ${e.message}`));
  await p.goto(`${APP}${url}`, { waitUntil: "networkidle" });
  return { c, p };
}
async function capture(s, url, fichier, ctx, attendre, action) {
  const { c, p } = await page(s, url, ctx);
  await p.waitForSelector(attendre, { timeout: 45000 });
  await p.waitForTimeout(1500);
  if (action) await action(p);
  await p.screenshot({ path: path.join(OUT, fichier), fullPage: false });
  const texte = await p.locator("body").innerText().catch(() => "");
  await c.close();
  return texte;
}

const P1 = "p1.partenaire@preuve.local";
const REC = "julie.lambert@exemple.test";
const COACH = "marc.desrosiers@exemple.test";
const temp = { users: [], athletes: [] };
let mp1 = null, rec = null;

try {
  const { data: p1 } = await svc.from("users").select("id").eq("email", P1).single();
  ({ data: mp1 } = await svc.from("media_partners").select("id, peut_evaluer, status").eq("user_id", p1.id).single());
  if (mp1.peut_evaluer || mp1.status !== "APPROVED") throw new Error("état de départ inattendu pour p1 : " + JSON.stringify(mp1));
  ({ data: rec } = await svc.from("users").select("id").eq("email", REC).single());
  const { data: coach } = await svc.from("users").select("id, school_id").eq("email", COACH).single();
  const { data: foot } = await svc.from("sports").select("id").eq("nom", "Football").single();
  const { data: qb } = await svc.from("positions").select("id").eq("sport_id", foot.id).eq("abreviation", "QB").single();
  const { data: vitesse } = await svc.from("badges").select("id").eq("code", "vitesse").single();

  await svc.from("media_partners").update({ peut_evaluer: true }).eq("id", mp1.id);
  await svc.from("partenaire_sports_permis").insert({ partner_id: mp1.id, sport_id: foot.id });
  const { data: pb } = await svc.from("partner_badges").insert({ partner_id: mp1.id, libelle: "Esprit sportif", icone_path: null, actif: true, ordre: 0 }).select("id").single();
  async function athlete(email, prenom, nom, position) {
    const j = await (await fetch(`${API}/auth/v1/admin/users`, { method: "POST", headers: H,
      body: JSON.stringify({ email, password: "Banc-Cote-2026!x", email_confirm: true,
        user_metadata: { role: "ATHLETE", first_name: prenom, last_name: nom, consent_privacy_policy: new Date().toISOString() } }) })).json();
    if (!j.id) throw new Error("compte " + email + " : " + JSON.stringify(j));
    temp.users.push(j.id);
    await svc.from("users").update({ onboarding_complete: true }).eq("id", j.id);
    const { data: f, error } = await svc.from("athletes").insert({
      user_id: j.id, first_name: prenom, last_name: nom, date_naissance: "2006-05-05", status: "ACTIF", verified: false,
      annee_diplomation: 2025, sport_id: foot.id, position_id: position, school_id: coach.school_id, coach_id: coach.id,
      partner_visibility_opt_in: true, partner_visibility_opted_in_at: new Date().toISOString(),
    }).select("id").single();
    if (error) throw error;
    temp.athletes.push(f.id);
    return { email, userId: j.id, athleteId: f.id };
  }
  const alex = await athlete("cote.alex@exemple.test", "Alex", "Démo-Partenaire", qb.id);   // aucune cote de coach
  const sam = await athlete("cote.sam@exemple.test", "Sam", "Démo-Coach", null);            // cote de coach 5
  const zoe = await athlete("cote.zoe@exemple.test", "Zoé", "Démo-Rien", null);             // rien du tout
  const { error: eErr } = await svc.from("evaluations").insert({ coach_id: coach.id, athlete_id: sam.athleteId, cote_globale: 5 });
  if (eErr) throw eErr;
  const { data: samApres } = await svc.from("athletes").select("cote_globale_entraineur").eq("id", sam.athleteId).single();
  note("préparation : p1 évaluateur (football, 1 badge propre) ; Alex (sans coach), Sam (coach", samApres.cote_globale_entraineur, "), Zoé (rien) — adultes jetables");

  const sP = await session(P1), cP = client(sP);
  await rpc(cP, "partenaire_evaluer_athlete", { p_athlete_id: alex.athleteId, p_cote_globale: 4, p_traits: {} });
  await rpc(cP, "partenaire_evaluer_athlete", { p_athlete_id: sam.athleteId, p_cote_globale: 2, p_traits: {} });
  await rpc(cP, "partenaire_attribuer_badge", { p_athlete_id: alex.athleteId, p_badge_id: pb.id });
  await rpc(cP, "partenaire_attribuer_badge_nexus", { p_athlete_id: alex.athleteId, p_badge_id: vitesse.id });
  await rpc(cP, "partenaire_attribuer_badge_nexus", { p_athlete_id: sam.athleteId, p_badge_id: vitesse.id });
  note("p1 : Alex 4/5 + « Esprit sportif » + Vitesse ; Sam 2/5 + Vitesse");
  for (const a of [alex, sam, zoe]) await svc.from("recruiter_favorites").insert({ recruiter_id: rec.id, athlete_id: a.athleteId });

  const sR = await session(REC);
  const lot = await rpc(client(sR), "cotes_partenaires_athletes", { p_athlete_ids: [alex.athleteId, sam.athleteId, zoe.athleteId] });
  note("recruteur, lot :", JSON.stringify(lot.map((r) => [r.athlete_id === alex.athleteId ? "Alex" : r.athlete_id === sam.athleteId ? "Sam" : "Zoé", r.organisation, Number(r.cote_globale)])));

  // 1. Recherche recruteur, grille et ligne.
  for (const [nom, ctx] of [["bureau", DESKTOP], ["mobile", MOBILE]]) {
    const t = await capture(sR, "/recruteur/recherche?q=D%C3%A9mo", `01-recherche-grille-${nom}.png`, ctx, "[data-cote-partenaire]");
    if (nom === "bureau") note("recherche grille : « Évaluation Média Preuve » :", /Évaluation Média Preuve/i.test(t),
      "| une seule fois (Alex, pas Sam) :", (t.match(/Évaluation Média Preuve/gi) ?? []).length);
  }
  {
    const t = await capture(sR, "/recruteur/recherche?q=D%C3%A9mo", "02-recherche-ligne-bureau.png", DESKTOP, "[data-cote-partenaire]", async (p) => {
      await p.locator('button[title*="iste" i], button[aria-label*="iste" i]').first().click().catch(() => {});
      await p.waitForTimeout(1200);
    });
    note("recherche ligne : libellé présent :", /Évaluation Média Preuve/i.test(t));
  }
  // 2. Favoris.
  for (const [nom, ctx] of [["bureau", DESKTOP], ["mobile", MOBILE]]) {
    const t = await capture(sR, "/recruteur/favoris", `03-favoris-${nom}.png`, ctx, "[data-cote-partenaire]");
    if (nom === "bureau") note("favoris : libellé :", /Évaluation Média Preuve/i.test(t), "| occurrences :", (t.match(/Évaluation Média Preuve/gi) ?? []).length);
  }
  // 3. Fiche recruteur : Alex (partenaire) et Sam (coach gagne).
  for (const [nom, ctx] of [["bureau", DESKTOP], ["mobile", MOBILE]]) {
    const t = await capture(sR, `/recruteur/athletes/${alex.athleteId}`, `04-fiche-alex-partenaire-${nom}.png`, ctx, "[data-cote-partenaire]");
    if (nom === "bureau") note("fiche Alex : libellé sur la carte :", /Évaluation Média Preuve/i.test(t));
  }
  {
    const { c, p } = await page(sR, `/recruteur/athletes/${sam.athleteId}`, DESKTOP);
    await p.waitForSelector(".nx-v30-ticket", { timeout: 45000 });
    await p.waitForTimeout(2500);
    await p.screenshot({ path: path.join(OUT, "05-fiche-sam-coach-bureau.png") });
    note("fiche Sam (coach 5) : aucun libellé partenaire sur la carte :", (await p.locator(".nx-v30-ticket [data-cote-partenaire]").count()) === 0,
      "| ligne partenaire dans le bloc du coach :", (await p.locator("[data-evaluation-partenaire-ligne]").count()) > 0);
    await c.close();
  }
  // 4. Aperçu : ce que l'athlète voit de sa propre fiche (iframe ?preview=true).
  {
    const sA = await session(alex.email);
    const t = await capture(sA, `/recruteur/athletes/${alex.athleteId}?preview=true`, "06-apercu-alex-bureau.png", DESKTOP, "[data-cote-partenaire]");
    note("aperçu (Alex lui-même) : libellé :", /Évaluation Média Preuve/i.test(t));
  }
  // 5. Mes athlètes du partenaire : filtres.
  for (const [nom, ctx] of [["bureau", DESKTOP], ["mobile", MOBILE]]) {
    const t = await capture(sP, "/partenaire/mes-athletes", `07-mes-athletes-filtres-${nom}.png`, ctx, "[data-filtres-mes-athletes]");
    if (nom === "bureau") note("Mes athlètes : compte :", (t.match(/\d+ athlètes?/) ?? [""])[0]);
  }
  {
    const t = await capture(sP, "/partenaire/mes-athletes", "08-mes-athletes-recherche-quart-bureau.png", DESKTOP, "[data-filtres-mes-athletes]", async (p) => {
      await p.fill('input[type="search"]', "quart");
      await p.waitForTimeout(500);
    });
    note("recherche « quart » : Alex :", /Alex Démo-Partenaire/.test(t), "| Sam absent :", !/Sam Démo-Coach/.test(t), "|", (t.match(/\d+ sur \d+/) ?? [""])[0]);
  }
  {
    const t = await capture(sP, "/partenaire/mes-athletes", "09-mes-athletes-distinctions-bureau.png", DESKTOP, "[data-filtres-mes-athletes]", async (p) => {
      await p.click("[data-filtre-distinctions] > button");
      await p.waitForTimeout(300);
      await p.getByLabel("Esprit sportif", { exact: false }).first().check().catch(async () => {
        await p.locator("[data-filtre-distinctions] label", { hasText: "Esprit sportif" }).click();
      });
      await p.waitForTimeout(500);
    });
    note("Distinctions = Esprit sportif : Alex :", /Alex Démo-Partenaire/.test(t), "| Sam absent :", !/Sam Démo-Coach/.test(t), "|", (t.match(/\d+ sur \d+/) ?? [""])[0]);
  }
  {
    const t = await capture(sP, "/partenaire/mes-athletes", "10-mes-athletes-tout-bureau.png", DESKTOP, "[data-filtres-mes-athletes]", async (p) => {
      await p.click("[data-filtre-distinctions] > button");
      await p.getByRole("button", { name: "Tout", exact: true }).click();
      await p.waitForTimeout(500);
    });
    note("« Tout » : bouton =", /Toutes les distinctions/.test(t), "| compte :", (t.match(/\d+ (sur \d+|athlètes?)/) ?? [""])[0]);
  }
  {
    const t = await capture(sP, "/partenaire/mes-athletes", "11-mes-athletes-combines-bureau.png", DESKTOP, "[data-filtres-mes-athletes]", async (p) => {
      await p.fill('input[type="search"]', "sam");
      await p.click("[data-filtre-distinctions] > button");
      await p.locator("[data-filtre-distinctions] label", { hasText: "Esprit sportif" }).click();
      await p.keyboard.press("Escape");
      await p.waitForTimeout(500);
    });
    note("combinés « sam » + Esprit sportif : aucun :", /Aucun athlète ne correspond/.test(t));
  }
} finally {
  if (rec) await svc.from("recruiter_favorites").delete().eq("recruiter_id", rec.id).in("athlete_id", temp.athletes.length ? temp.athletes : ["00000000-0000-0000-0000-000000000000"]);
  if (temp.athletes.length) await svc.from("evaluations").delete().in("athlete_id", temp.athletes);
  if (mp1) {
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
  const { data: apres } = await svc.from("media_partners").select("peut_evaluer, status").eq("id", mp1?.id ?? "").maybeSingle();
  const { count: ne } = await svc.from("partner_evaluations").select("id", { count: "exact", head: true });
  const { count: nb } = await svc.from("partner_athlete_badges").select("id", { count: "exact", head: true });
  const { count: nf } = await svc.from("recruiter_favorites").select("id", { count: "exact", head: true }).in("athlete_id", temp.athletes.length ? temp.athletes : ["00000000-0000-0000-0000-000000000000"]);
  note("remise en état : p1", JSON.stringify(apres), "| évaluations partenaires", ne, "| badges partenaires", nb, "| favoris jetables", nf);
  note("erreurs JavaScript des pages :", erreurs.length ? JSON.stringify(erreurs) : "aucune");
  fs.writeFileSync(path.resolve("docs/cote-partenaire-carte/captures-resultats.txt"), journal.join("\n") + "\n");
  await nav.close();
}
