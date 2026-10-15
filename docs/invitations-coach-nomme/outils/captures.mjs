// Captures : coach nommé SEULEMENT s'il est du secondaire ou du civil — base LOCALE, navigateur SANS INTERFACE.
//   cd C:\tmp\nexus-w4bc ; APP=http://localhost:3011 node --experimental-strip-types docs/invitations-coach-nomme/outils/captures.mjs
// Courriels : les VRAIS gabarits des fonctions d'envoi (Deno simulé, aucune clé).
// /claim et carte « Invitations en attente » : fiches et invitations JETABLES (aucun secret d'envoi en
// local : rien ne part), un coach secondaire (Marc) et un coach collégial (Luc) ; tout est retiré à la fin.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

globalThis.Deno = { env: { get: () => undefined } };
const req = createRequire(path.resolve("package.json"));
const { createClient } = req("@supabase/supabase-js");
const { chromium } = req("playwright");
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split(/\r?\n/)
  .filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const API = env.NEXT_PUBLIC_SUPABASE_URL;
if (!/^http:\/\/127\.0\.0\.1/.test(API)) throw new Error("pas local : " + API);
const svc = createClient(API, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const APP = process.env.APP ?? "http://localhost:3011";
const OUT = path.resolve("docs/invitations-coach-nomme/apercus");
fs.mkdirSync(OUT, { recursive: true });
const journal = [];
const note = (...a) => { const l = a.join(" "); journal.push(l); console.log(l); };

// ── Courriels ────────────────────────────────────────────────────────────────
const rec = await import(pathToFileURL(path.resolve("supabase/functions/send-invitation/email.ts")).href);
const eq = await import(pathToFileURL(path.resolve("supabase/functions/send-team-invitation/email.ts")).href);
const D = "https://nexussports.ca/desabonnement?t=EXEMPLE";
const courriels = {
  "courriel-reclamation-coach-secondaire": rec.buildBody(2, "https://nexussports.ca/claim?token=EXEMPLE", D, { nom: "Marc Desrosiers", ecole: "École secondaire des Érables" }),
  "courriel-reclamation-coach-civil": rec.buildBody(0, "https://nexussports.ca/claim?token=EXEMPLE", D, { nom: "Martin Bélanger", ecole: "Club de soccer Les Lions" }),
  "courriel-reclamation-coach-collegial": rec.buildBody(1, "https://nexussports.ca/claim?token=EXEMPLE", D),
  "courriel-equipe-coach-secondaire": eq.buildBody("Les Dragons", "École secondaire des Érables",
    { sport: "Football", ageGroup: "Juvénile", division: "D2", gender: "Masculin" }, "https://nexussports.ca/athlete/transfert?t=EXEMPLE", D, "Marc Desrosiers"),
};
const nav = await chromium.launch(); // headless
for (const [nom, { html, text }] of Object.entries(courriels)) {
  fs.writeFileSync(path.join(OUT, `${nom}.html`), html);
  fs.writeFileSync(path.join(OUT, `${nom}.txt`), `${text}\n`);
  const c = await nav.newContext({ viewport: { width: 390, height: 900 }, deviceScaleFactor: 2 });
  const p = await c.newPage();
  await p.goto(pathToFileURL(path.join(OUT, `${nom}.html`)).href);
  await p.screenshot({ path: path.join(OUT, `${nom}-mobile.png`), fullPage: true });
  await c.close();
}
note("courriels rendus :", Object.keys(courriels).join(", "));

// ── /claim et carte ─────────────────────────────────────────────────────────
const erreurs = [];
const ids = { athletes: [], invitations: [] };
try {
  const coach = async (email) => (await svc.from("users").select("id, school_id, first_name, last_name").eq("email", email).single()).data;
  const marc = await coach("marc.desrosiers@exemple.test");
  const luc = await coach("luc.arsenault@exemple.test");
  for (const [etiquette, co] of [["coach-secondaire", marc], ["coach-collegial", luc]]) {
    const { data: a, error } = await svc.from("athletes").insert({
      first_name: "Inès", last_name: "Capture-" + etiquette, date_naissance: "2007-04-04", coach_id: co.id, school_id: co.school_id,
      email: `ines.${etiquette}@exemple.test`, status: "ACTIF", verified: false, annee_diplomation: 2025,
    }).select("id").single();
    if (error) throw error;
    ids.athletes.push(a.id);
    const token = `capture-cn-${etiquette}-${Date.now()}`;
    const { error: ei } = await svc.from("athlete_invitations").insert({ token, athlete_id: a.id, created_by: co.id });
    if (ei) throw ei;
    const c = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "fr-CA" });
    const p = await c.newPage();
    p.on("pageerror", (e) => erreurs.push(e.message));
    await p.goto(`${APP}/claim?token=${encodeURIComponent(token)}`, { waitUntil: "networkidle" });
    await p.waitForSelector("[data-phrase-recruteurs]", { timeout: 30000 });
    const corps = await p.locator("body").innerText();
    const ligne = (await p.locator("[data-phrase-coach]").count()) ? await p.locator("[data-phrase-coach]").innerText() : "(aucune)";
    note(`/claim ${etiquette} : ligne coach = ${JSON.stringify(ligne)} | « ${co.first_name} ${co.last_name} » dans la page : ${corps.includes(`${co.first_name} ${co.last_name}`)}`);
    await p.screenshot({ path: path.join(OUT, `claim-${etiquette}-mobile.png`), fullPage: true });
    await c.close();
  }

  // Carte : Mathis (démo locale) reçoit 3 invitations — secondaire par Marc, secondaire par Luc, collégiale par Marc.
  const courriel = "mathis.demo@exemple.test";
  const { data: ath } = await svc.from("athletes").select("id").eq("email", courriel).single();
  const { data: eqS } = await svc.from("teams").select("id, name, schools!inner(type)").eq("schools.type", "SECONDAIRE").neq("name", "").order("name").limit(2);
  const { data: eqC } = await svc.from("teams").select("id, name, schools!inner(name, type)").eq("schools.type", "CEGEP").neq("name", "").limit(1).single();
  for (const [team, co, jeton] of [[eqS[0], marc, "CAPCN1"], [eqS[1], luc, "CAPCN2"], [eqC, marc, "CAPCN3"]]) {
    const { data: inv, error } = await svc.from("team_invitations").insert({
      team_id: team.id, athlete_id: ath.id, invited_by_coach_id: co.id, status: "PENDING",
      transfer_token: jeton, expires_at: new Date(Date.now() + 14 * 864e5).toISOString(),
    }).select("id").single();
    if (error) throw error;
    ids.invitations.push(inv.id);
  }
  const h = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
  const g = await (await fetch(`${API}/auth/v1/admin/generate_link`, { method: "POST", headers: h, body: JSON.stringify({ type: "magiclink", email: courriel }) })).json();
  const sess = await (await fetch(`${API}/auth/v1/verify`, { method: "POST", headers: h, body: JSON.stringify({ type: "magiclink", email: courriel, token: g.email_otp ?? g.properties?.email_otp }) })).json();
  const v = "base64-" + Buffer.from(JSON.stringify(sess)).toString("base64url");
  const morceaux = v.match(/.{1,3180}/g);
  const c = await nav.newContext({ viewport: { width: 1280, height: 900 }, locale: "fr-CA" });
  await c.addCookies((morceaux.length === 1 ? [{ name: "sb-127-auth-token", value: v }] : morceaux.map((x, i) => ({ name: `sb-127-auth-token.${i}`, value: x })))
    .map((k) => ({ ...k, domain: "localhost", path: "/" })));
  const p = await c.newPage();
  p.on("pageerror", (e) => erreurs.push(e.message));
  await p.goto(`${APP}/athlete/notifications`, { waitUntil: "networkidle" });
  await p.waitForSelector("[data-titre-invitation]", { timeout: 30000 });
  await p.waitForTimeout(1500);
  const section = p.locator("section", { has: p.locator("[data-titre-invitation]") }).first();
  const texte = await section.innerText();
  note("carte : « Invité par » :", JSON.stringify(await p.locator("[data-coach-invitation]").allInnerTexts()));
  note("| Luc (collégial) nommé :", texte.includes(luc.last_name), "| équipe collégiale nommée :", texte.includes(eqC.name), "| cégep nommé :", texte.includes(eqC.schools.name));
  const titres = await p.locator("[data-titre-invitation]").allInnerTexts();
  note("| titres :", JSON.stringify(titres));
  await section.screenshot({ path: path.join(OUT, "carte-invitations-bureau.png") });
  await c.close();
} finally {
  if (ids.invitations.length) {
    await svc.from("athlete_notifications").delete().eq("type", "TEAM_INVITATION").in("metadata->>invitation_id", ids.invitations);
    const { error } = await svc.from("team_invitations").delete().in("id", ids.invitations);
    note("remise en état : invitations d'équipe retirées :", error ? "ERREUR " + error.message : "oui");
  }
  if (ids.athletes.length) {
    await svc.from("athlete_invitations").delete().in("athlete_id", ids.athletes);
    const { error } = await svc.from("athletes").delete().in("id", ids.athletes);
    note("remise en état : fiches jetables retirées :", error ? "ERREUR " + error.message : "oui");
  }
  note("erreurs JavaScript :", erreurs.length ? JSON.stringify(erreurs) : "aucune");
  fs.writeFileSync(path.resolve("docs/invitations-coach-nomme/captures-resultats.txt"), journal.join("\n") + "\n");
  await nav.close();
}
