// Captures D1b — base LOCALE, navigateur SANS INTERFACE.
//   cd C:\tmp\nexus-w4bc ; APP=http://localhost:3011 node docs/noms-d1b/outils/captures-d1b.mjs
// Comptes et fiches JETABLES (d1b.*@exemple.test), retirés à la fin.
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
const APP = process.env.APP ?? "http://localhost:3011";
const OUT = path.resolve("docs/noms-d1b/captures");
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
function cookies(s) {
  const v = "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url");
  const m = v.match(/.{1,3180}/g);
  return (m.length === 1 ? [{ name: "sb-127-auth-token", value: v }] : m.map((x, i) => ({ name: `sb-127-auth-token.${i}`, value: x })))
    .map((c) => ({ ...c, domain: "localhost", path: "/" }));
}
async function creerCompte(email, meta) {
  const j = await (await fetch(`${API}/auth/v1/admin/users`, { method: "POST", headers: H,
    body: JSON.stringify({ email, password: "Banc-D1b-2026!x", email_confirm: true, user_metadata: meta }) })).json();
  if (!j.id) throw new Error("compte " + email + " : " + JSON.stringify(j));
  return j.id;
}

const COACH = "marc.desrosiers@exemple.test";
const A_CONFIRMER = "d1b.aconfirmer@exemple.test";
const SANS_NOM = "d1b.sansnom@exemple.test";
const temp = { users: [], athletes: [] };
const nav = await chromium.launch(); // headless
const erreurs = [];

try {
  const { data: coach } = await svc.from("users").select("id, school_id").eq("email", COACH).single();
  const consent = { consent_privacy_policy: new Date().toISOString(), role: "ATHLETE" };
  // 1. Compte au nom recopié de Google (simulé : nom posé + drapeau, comme le fait trg_users_nom_google)
  const idA = await creerCompte(A_CONFIRMER, { ...consent, full_name: "Gabrielle Banc-Essai" });
  temp.users.push(idA);
  await svc.from("users").update({ first_name: "Gabrielle", last_name: "Banc-Essai", nom_a_confirmer: true, onboarding_complete: true }).eq("id", idA);
  const { data: fA, error: eA } = await svc.from("athletes").insert({
    user_id: idA, first_name: "Gabrielle", last_name: "Banc-Essai", date_naissance: "2007-03-03", status: "ACTIF",
    verified: false, annee_diplomation: 2026, coach_id: coach.id, school_id: coach.school_id,
  }).select("id, nom_a_confirmer").single();
  if (eA) throw eA;
  temp.athletes.push(fA.id);
  note("fiche « à confirmer » créée — drapeau posé par le trigger :", fA.nom_a_confirmer);
  // 2. Compte comme « les 9 » : nom du compte vide, fiche sans nom, nom complet Google dans le compte
  const idB = await creerCompte(SANS_NOM, { ...consent, full_name: "Neuf Sansnom" });
  temp.users.push(idB);
  await svc.from("users").update({ onboarding_complete: true }).eq("id", idB);
  const { data: fB, error: eB } = await svc.from("athletes").insert({
    user_id: idB, first_name: "", last_name: "", date_naissance: "2008-04-04", status: "ACTIF", verified: false, annee_diplomation: 2026,
  }).select("id").single();
  if (eB) throw eB;
  temp.athletes.push(fB.id);

  // ── Coach : la fiche à confirmer est retirée de sa liste ──────────────────
  const sC = await session(COACH);
  {
    const c = await nav.newContext(DESKTOP);
    await c.addCookies(cookies(sC));
    const p = await c.newPage();
    p.on("pageerror", (e) => erreurs.push("coach : " + e.message));
    await p.goto(`${APP}/coach/athletes`, { waitUntil: "networkidle" });
    await p.waitForSelector("[data-noms-en-attente]", { timeout: 30000 });
    note("coach : ligne :", JSON.stringify(await p.locator("[data-noms-en-attente]").innerText()),
      "| « Banc-Essai » dans la liste :", await p.locator("text=Banc-Essai").count());
    await p.screenshot({ path: path.join(OUT, "01-coach-fiche-masquee.png") });
    await c.close();
  }

  // ── Athlète : « Est-ce bien toi ? », bureau et mobile ───────────────────────
  const sA = await session(A_CONFIRMER);
  for (const [nom, ctx] of [["bureau", DESKTOP], ["mobile", MOBILE]]) {
    const c = await nav.newContext(ctx);
    await c.addCookies(cookies(sA));
    const p = await c.newPage();
    p.on("pageerror", (e) => erreurs.push("athlète : " + e.message));
    await p.goto(`${APP}/athlete/dashboard`, { waitUntil: "networkidle" });
    await p.waitForSelector("[data-bandeau-nom='A_CONFIRMER']", { timeout: 30000 });
    note(`athlète (${nom}) :`, JSON.stringify((await p.locator("[data-bandeau-nom]").innerText()).replace(/\s+/g, " ")));
    await p.screenshot({ path: path.join(OUT, `02-bandeau-est-ce-bien-toi-${nom}.png`) });
    if (nom === "bureau") {
      await p.getByRole("button", { name: "Corriger" }).click();
      await p.screenshot({ path: path.join(OUT, "03-bandeau-corriger-bureau.png") });
      await p.getByRole("button", { name: "Enregistrer" }).waitFor();
    }
    await c.close();
  }
  // « Oui »
  {
    const c = await nav.newContext(DESKTOP);
    await c.addCookies(cookies(sA));
    const p = await c.newPage();
    await p.goto(`${APP}/athlete/dashboard`, { waitUntil: "networkidle" });
    await p.waitForSelector("[data-bandeau-nom='A_CONFIRMER']");
    await p.getByRole("button", { name: "Oui", exact: true }).click();
    await p.waitForLoadState("networkidle");
    await p.waitForTimeout(2500);
    const { data: apres } = await svc.from("athletes").select("nom_a_confirmer").eq("id", fA.id).single();
    note("« Oui » : bandeau encore là :", await p.locator("[data-bandeau-nom]").count(), "| drapeau de la fiche :", apres.nom_a_confirmer);
    await p.screenshot({ path: path.join(OUT, "04-apres-oui.png") });
    await c.close();
  }
  // Le coach la revoit
  {
    const c = await nav.newContext(DESKTOP);
    await c.addCookies(cookies(sC));
    const p = await c.newPage();
    await p.goto(`${APP}/coach/athletes`, { waitUntil: "networkidle" });
    await p.waitForTimeout(3000);
    note("coach après confirmation : ligne « masquée » :", await p.locator("[data-noms-en-attente]").count(),
      "| « Banc-Essai » dans la liste :", await p.locator("text=Banc-Essai").count());
    await c.close();
  }

  // ── Fiche sans nom (cas des 9) : champs pré-remplis du nom complet Google ───
  const sB = await session(SANS_NOM);
  {
    const c = await nav.newContext(MOBILE);
    await c.addCookies(cookies(sB));
    const p = await c.newPage();
    p.on("pageerror", (e) => erreurs.push("sans nom : " + e.message));
    await p.goto(`${APP}/athlete/dashboard`, { waitUntil: "networkidle" });
    await p.waitForSelector("[data-bandeau-nom='MANQUANT']", { timeout: 30000 });
    note("sans nom : prénom / nom proposés :", await p.getByLabel("Prénom").inputValue(), "/", await p.getByLabel("Nom", { exact: true }).inputValue());
    await p.screenshot({ path: path.join(OUT, "05-bandeau-sans-nom-mobile.png") });
    await p.getByLabel("Nom", { exact: true }).fill("Sansnom-Corrigé");
    await p.getByRole("button", { name: "Enregistrer" }).click();
    await p.waitForTimeout(2500);
    const { data: b } = await svc.from("athletes").select("first_name, last_name, nom_a_confirmer").eq("id", fB.id).single();
    note("sans nom : après « Enregistrer » :", JSON.stringify(b));
    await c.close();
  }
} finally {
  for (const id of temp.athletes) {
    const { error } = await svc.from("athletes").delete().eq("id", id);
    note("remise en état : fiche jetable retirée :", error ? "ERREUR " + error.message : "oui");
  }
  for (const id of temp.users) {
    const r = await fetch(`${API}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: H });
    note("remise en état : compte jetable supprimé :", r.status);
  }
  note("erreurs JavaScript des pages :", erreurs.length ? JSON.stringify(erreurs) : "aucune");
  fs.writeFileSync(path.resolve("docs/noms-d1b/captures-resultats.txt"), journal.join("\n") + "\n");
  await nav.close();
}
