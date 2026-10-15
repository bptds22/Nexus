// Captures D1 — base LOCALE, navigateur SANS INTERFACE (jamais l'écran de BP).
//   cd C:\tmp\nexus-w4bc ; APP=http://localhost:3011 node docs/doublons-d1/outils/captures-d1.mjs
// Crée des comptes et fiches JETABLES (courriels @exemple.test, préfixe d1.), les retire à la fin.
// Coach : marc.desrosiers@exemple.test (fixture locale). Rien n'est écrit sur ses athlètes.
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
const OUT = path.resolve("docs/doublons-d1/captures");
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
  const r = await fetch(`${API}/auth/v1/admin/users`, { method: "POST", headers: H,
    body: JSON.stringify({ email, password: "Banc-D1-2026!x", email_confirm: true, user_metadata: meta }) });
  const j = await r.json();
  if (!j.id) throw new Error("compte " + email + " : " + JSON.stringify(j));
  return j.id;
}
/** DatePicker du portail coach : années → mois → jour. */
async function choisirDate(page, iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const MOIS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jui", "Jui", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  await page.getByRole("button", { name: /Sélectionner une date/ }).first().click();
  const cal = page.locator("div.absolute.z-50").first();
  await cal.locator("div.border-b button").nth(1).click(); // jours → mois
  await cal.locator("div.border-b button").nth(1).click(); // mois → années
  await cal.getByRole("button", { name: String(y), exact: true }).click();
  await cal.locator("div.grid button").nth(m - 1).click(); // MOIS[m-1] (deux « Jui »)
  void MOIS;
  await cal.getByRole("button", { name: String(d), exact: true }).first().click();
}
async function nxChoisir(page, libelle, option) {
  await page.locator("label", { hasText: libelle }).first().locator("xpath=..").locator("button").first().click();
  await page.locator("[data-option]", { hasText: option }).first().click();
}

const EXISTANT = "d1.existant@exemple.test";
const INSCRIT = "d1.inscription@exemple.test";
const ORPHELIN = "d1.orphelin@exemple.test";
const COACH = "marc.desrosiers@exemple.test";
const temp = { users: [], athletes: [] };
const nav = await chromium.launch(); // headless
const erreurs = [];

try {
  // ── Fixtures jetables ────────────────────────────────────────────────────
  const consent = new Date().toISOString();
  const meta = { role: "ATHLETE", first_name: "Gabriel", last_name: "Banc-Essai", date_naissance: "2007-01-15", consent_privacy_policy: consent };
  const idExistant = await creerCompte(EXISTANT, meta);
  temp.users.push(idExistant);
  await svc.from("users").update({ onboarding_complete: true }).eq("id", idExistant);
  const { data: fiche, error: e1 } = await svc.from("athletes").insert({
    user_id: idExistant, first_name: "Gabriel", last_name: "Banc-Essai", date_naissance: "2007-01-15",
    email: EXISTANT, status: "ACTIF", verified: false, annee_diplomation: 2025,
  }).select("id").single();
  if (e1) throw e1;
  temp.athletes.push(fiche.id);
  const idInscrit = await creerCompte(INSCRIT, meta);
  temp.users.push(idInscrit);
  const { data: coach } = await svc.from("users").select("id, school_id").eq("email", COACH).single();
  const { data: orph, error: e2 } = await svc.from("athletes").insert({
    first_name: "Olivia", last_name: "Banc-Essai", date_naissance: "2009-02-02", email: ORPHELIN,
    coach_id: coach.id, school_id: coach.school_id, status: "ACTIF", verified: false, annee_diplomation: 2027,
  }).select("id").single();
  if (e2) throw e2;
  temp.athletes.push(orph.id);
  note("fixtures jetables créées : 2 comptes, 2 fiches");

  // ── 1. Inscription : courriel mal écrit ─────────────────────────────────
  for (const [nom, ctx] of [["bureau", DESKTOP], ["mobile", MOBILE]]) {
    const c = await nav.newContext(ctx);
    const p = await c.newPage();
    p.on("pageerror", (e) => erreurs.push("inscription : " + e.message));
    await p.goto(`${APP}/auth?mode=signup`, { waitUntil: "networkidle" });
    await p.getByText("Athlète", { exact: true }).first().click();
    const champ = p.locator("input[type=email]").first();
    await champ.fill("jeune.tremblay@gmail.con");
    await p.locator("input[type=password]").first().click(); // quitter le champ
    await p.waitForSelector("[data-suggestion-courriel]");
    note(`1 (${nom}) suggestion :`, JSON.stringify((await p.locator("[data-suggestion-courriel]").innerText()).replace(/\s+/g, " ")));
    await p.locator("[data-suggestion-courriel]").scrollIntoViewIfNeeded();
    await p.screenshot({ path: path.join(OUT, `01-inscription-courriel-${nom}.png`) });
    await p.getByRole("button", { name: "Oui, corriger" }).click();
    note(`1 (${nom}) après « Oui, corriger » :`, await champ.inputValue(),
      "| encadré :", await p.locator("[data-suggestion-courriel]").count());
    await c.close();
  }

  // ── 2. Onboarding athlète : avertissement + « plusieurs sports » ───────
  const sI = await session(INSCRIT);
  for (const [nom, ctx] of [["bureau", DESKTOP], ["mobile", MOBILE]]) {
    const c = await nav.newContext(ctx);
    await c.addCookies(cookies(sI));
    const p = await c.newPage();
    p.on("pageerror", (e) => erreurs.push("onboarding : " + e.message));
    await p.goto(`${APP}/athlete/onboarding`, { waitUntil: "networkidle" });
    await p.getByText("Ligue civile / Club").click();
    await p.waitForSelector("[data-plusieurs-sports]");
    await p.getByRole("button", { name: "Football", exact: true }).first().click();
    await p.locator("select[title=Graduation]").selectOption({ index: 1 });
    await p.locator("[data-plusieurs-sports]").scrollIntoViewIfNeeded();
    await p.screenshot({ path: path.join(OUT, `02-onboarding-plusieurs-sports-${nom}.png`) });
    await p.getByRole("button", { name: "Suivant" }).click();
    await p.waitForSelector("[data-avertissement-doublon]", { timeout: 15000 });
    note(`2 (${nom}) avertissement :`, JSON.stringify((await p.locator("[data-avertissement-doublon]").innerText()).replace(/\s+/g, " ")));
    await p.locator("[data-avertissement-doublon]").scrollIntoViewIfNeeded();
    await p.screenshot({ path: path.join(OUT, `03-onboarding-avertissement-${nom}.png`) });
    const html = await p.content();
    note(`2 (${nom}) rien de l'autre fiche dans la page :`, !html.includes(EXISTANT) ? "oui (courriel absent)" : "NON");
    await c.close();
  }
  const { count: avantSuite } = await svc.from("athletes").select("id", { count: "exact", head: true }).eq("user_id", idInscrit);
  note("2 fiche créée pour le compte en inscription (avant « Continuer ») :", avantSuite);

  // « Continuer » enregistre normalement ; la paire part dans la file
  {
    const c = await nav.newContext(DESKTOP);
    await c.addCookies(cookies(sI));
    const p = await c.newPage();
    await p.goto(`${APP}/athlete/onboarding`, { waitUntil: "networkidle" });
    await p.getByText("Ligue civile / Club").click();
    await p.getByRole("button", { name: "Football", exact: true }).first().click();
    await p.locator("select[title=Graduation]").selectOption({ index: 1 });
    await p.getByRole("button", { name: "Suivant" }).click();
    await p.waitForSelector("[data-avertissement-doublon]");
    await p.locator("[data-avertissement-doublon]").getByRole("button", { name: "Continuer" }).click();
    await p.waitForSelector("text=Académique", { timeout: 15000 });
    await p.waitForTimeout(1500);
    const { data: ficheI } = await svc.from("athletes").select("id").eq("user_id", idInscrit).maybeSingle();
    if (ficheI) temp.athletes.push(ficheI.id);
    const { data: file } = await svc.from("doublons_probables").select("source, operation").eq("athlete_id", ficheI?.id ?? "00000000-0000-0000-0000-000000000000");
    note("2 après « Continuer » : étape 2 atteinte, fiche créée :", !!ficheI, "| file admin :", JSON.stringify(file));
    await c.close();
  }

  // ── 3. Assistant coach ───────────────────────────────────────────────────
  const sC = await session(COACH);
  const { count: nAvant } = await svc.from("athletes").select("id", { count: "exact", head: true }).eq("coach_id", coach.id);
  async function etape1(p, prenom, nomFam, iso) {
    await p.goto(`${APP}/coach/athletes/create`, { waitUntil: "networkidle" });
    await p.getByPlaceholder("Prénom").first().fill(prenom);
    await p.getByPlaceholder("Nom de famille").fill(nomFam);
    await choisirDate(p, iso);
    await nxChoisir(p, "Promotion", "2028");
    await nxChoisir(p, "Genre", "Masculin");
  }
  for (const [nom, ctx] of [["bureau", DESKTOP], ["mobile", MOBILE]]) {
    const c = await nav.newContext(ctx);
    await c.addCookies(cookies(sC));
    const p = await c.newPage();
    p.on("pageerror", (e) => erreurs.push("coach : " + e.message));
    // 3a. Son propre athlète (visible) : « Cet athlète existe déjà »
    await etape1(p, "Emile", "Gagnon", "2009-11-17");
    await p.getByRole("button", { name: "Suivant" }).click();
    await p.waitForSelector("[data-meme-identite]", { timeout: 15000 });
    note(`3a (${nom}) :`, JSON.stringify((await p.locator("[data-meme-identite]").innerText()).replace(/\s+/g, " ")));
    await p.locator("[data-meme-identite]").scrollIntoViewIfNeeded();
    await p.screenshot({ path: path.join(OUT, `04-coach-existe-deja-${nom}.png`) });
    await c.close();
  }
  {
    const c = await nav.newContext(DESKTOP);
    await c.addCookies(cookies(sC));
    const p = await c.newPage();
    // 3b. LOI 25 : mineur d'une autre école (invisible) → rien n'est dit, étape 2
    await etape1(p, "Jérémy", "Pelletier", "2009-01-30");
    await p.getByRole("button", { name: "Suivant" }).click();
    await p.waitForTimeout(2500);
    const bandeau = await p.locator("[data-meme-identite]").count();
    // L'autre fiche est dans une autre école : son nom d'école ne doit apparaître nulle part.
    const { data: autre } = await svc.from("athletes").select("schools!school_id(name)")
      .eq("first_name", "Jérémy").eq("last_name", "Pelletier").eq("date_naissance", "2009-01-30").single();
    const ecoleAutre = autre?.schools?.name ?? "(?)";
    note("3b LOI 25 (mineur caché) : encadré :", bandeau,
      "| école de l'autre fiche dans la page :", (await p.content()).includes(ecoleAutre) ? "PRÉSENTE — FUITE" : "absente",
      "| étape :", (await p.locator("text=Étape").first().innerText().catch(() => "?")).replace(/\s+/g, " "));
    await p.screenshot({ path: path.join(OUT, `05-coach-mineur-cache-rien-dit.png`) });

    // 3c. Courriel EXACT d'un invitable tapé sans cliquer → bascule vers l'invitation
    await etape1(p, "Olivia", "Banc", "2009-03-03");
    await p.locator("input[type=email]").fill(ORPHELIN);
    await p.waitForTimeout(1200); // délai de la recherche
    await p.screenshot({ path: path.join(OUT, `06a-coach-courriel-exact-avant.png`) });
    await p.getByRole("button", { name: "Suivant" }).click();
    await p.waitForTimeout(2000);
    note("3c courriel exact sans clic : « Lié au compte » :", await p.locator("text=Lié au compte de").count(),
      "| carte d'invitation :", await p.locator("text=/invitation/i").count() > 0 ? "oui" : "non");
    await p.screenshot({ path: path.join(OUT, `06b-coach-courriel-exact-bascule.png`), fullPage: true });
    await c.close();
  }
  const { count: nApres } = await svc.from("athletes").select("id", { count: "exact", head: true }).eq("coach_id", coach.id);
  note("3 fiches du coach avant / après les captures :", nAvant, "/", nApres, "(aucune création attendue)");
} finally {
  // ── Remise en état ───────────────────────────────────────────────────────
  for (const id of temp.athletes) {
    const { error } = await svc.from("athletes").delete().eq("id", id);
    note("remise en état : fiche jetable retirée :", error ? "ERREUR " + error.message : "oui");
  }
  for (const id of temp.users) {
    const r = await fetch(`${API}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: H });
    note("remise en état : compte jetable supprimé :", r.status);
  }
  const { count: reste } = await svc.from("doublons_probables").select("id", { count: "exact", head: true });
  note("file doublons_probables après remise en état :", reste);
  note("erreurs JavaScript des pages :", erreurs.length ? JSON.stringify(erreurs) : "aucune");
  fs.writeFileSync(path.resolve("docs/doublons-d1/captures-resultats.txt"), journal.join("\n") + "\n");
  await nav.close();
}
