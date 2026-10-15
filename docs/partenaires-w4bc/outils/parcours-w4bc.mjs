// Parcours W4b + W4c — base LOCALE seulement, navigateur SANS INTERFACE (headless).
//   cd C:\tmp\nexus-w4bc   (worktree, .env.local = copie de .env.local.docker)
//   APP=http://localhost:3011 node C:\Users\bptds\Documents\Nexus\docs\partenaires-w4bc\outils\parcours-w4bc.mjs
//
// Parcours :
//   A. partenaire : page vide, création d'une carte (formulaire réel), lien (affiché une fois) ;
//   B. jeune non inscrit : /p/<jeton> (desktop, mobile), robot d'aperçu filtré ;
//   C. inscription RÉELLE par /auth (19 ans : pas d'écran parental) ; l'onboarding est
//      SIMULÉ par la base (fiche athlète + onboarding_complete) ; retour automatique vers
//      /p/<jeton> ; « C'est moi » sans opt-in → attente ; bandeau ; activation de la
//      visibilité partenaire → transfert ; évaluation et badges visibles sur son profil ;
//   D. « Ce n'est pas moi » par le lien (Mathis) ;
//   E. proposition de Nexus : notification PARTENAIRE_EVALUATION → page de réponse ;
//   F. partenaire : « Terminées », version mobile, envoi par texto (mobile).
// Préparation et remise en état par service_role ; refuse toute URL non locale.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const req = createRequire(path.resolve("package.json"));
const { createClient } = req("@supabase/supabase-js");
const { chromium } = req("playwright");
const fichierEnv = fs.existsSync(".env.local.docker") ? ".env.local.docker" : ".env.local";
const env = Object.fromEntries(fs.readFileSync(fichierEnv, "utf8").split(/\r?\n/)
  .filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const API = env.NEXT_PUBLIC_SUPABASE_URL;
if (!/^http:\/\/127\.0\.0\.1/.test(API)) throw new Error("pas local : " + API);
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP = process.env.APP ?? "http://localhost:3011";
if (!/^http:\/\/localhost/.test(APP)) throw new Error("APP pas local");
const OUT = "C:/Users/bptds/Documents/Nexus/docs/partenaires-w4bc/captures";
fs.mkdirSync(OUT, { recursive: true });
const svc = createClient(API, SERVICE, { auth: { persistSession: false } });
const journal = [];
const note = (...a) => { const l = a.join(" "); journal.push(l); console.log(l); };

async function session(email) {
  const h = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
  const g = await (await fetch(`${API}/auth/v1/admin/generate_link`, { method: "POST", headers: h, body: JSON.stringify({ type: "magiclink", email }) })).json();
  const s = await (await fetch(`${API}/auth/v1/verify`, { method: "POST", headers: h, body: JSON.stringify({ type: "magiclink", email, token: g.email_otp ?? g.properties?.email_otp }) })).json();
  if (!s.access_token) throw new Error(`session ${email} : ` + JSON.stringify(s).slice(0, 200));
  return s;
}
function cookies(s) {
  const v = "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url");
  const m = v.match(/.{1,3180}/g);
  return (m.length === 1 ? [{ name: "sb-127-auth-token", value: v }] : m.map((x, i) => ({ name: `sb-127-auth-token.${i}`, value: x })))
    .map((c) => ({ ...c, domain: "localhost", path: "/" }));
}
const DESKTOP = { viewport: { width: 1440, height: 1000 }, locale: "fr-CA", deviceScaleFactor: 1 };
const MOBILE = { viewport: { width: 390, height: 844 }, locale: "fr-CA", deviceScaleFactor: 2, isMobile: true, hasTouch: true,
  userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1" };

const nav = await chromium.launch(); // headless
const erreursPage = [];
async function contexte(opts, email) {
  const ctx = await nav.newContext(opts);
  if (email) await ctx.addCookies(cookies(await session(email)));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => erreursPage.push(`${email ?? "anon"} : ${e.message}`));
  // Une boîte native ne se capture pas : on l'intercepte et on la journalise.
  await page.addInitScript(() => { window.alert = (m) => console.log("ALERT:", m); window.confirm = () => true; });
  page.on("console", (m) => { if (m.text().startsWith("ALERT:")) note("  ⚠", m.text()); });
  return { ctx, page };
}
async function clientDe(email) {
  const s = await session(email);
  return createClient(API, ANON, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${s.access_token}` } } });
}
const pause = (p, ms = 1500) => p.waitForTimeout(ms);
async function cliche(p, nom, opts = {}) {
  await p.screenshot({ path: path.join(OUT, nom), fullPage: opts.full ?? true });
  note("capture", nom);
}

const uid = async (email) => (await svc.from("users").select("id").eq("email", email).single()).data?.id;
const P1 = await uid("p1.partenaire@preuve.local");
const MATHIS_U = await uid("mathis.demo@exemple.test");
const mp1 = (await svc.from("media_partners").select("id, organization_name, peut_evaluer").eq("user_id", P1).single()).data;
const foot = (await svc.from("sports").select("id").eq("nom", "Football").single()).data.id;
const mathis = (await svc.from("athletes").select("id, school_id, partner_visibility_opt_in").eq("user_id", MATHIS_U).single()).data;
const equipe = (await svc.from("team_athletes").select("team_id").eq("athlete_id", mathis.id).limit(1).single()).data.team_id;
const debut = new Date(Date.now() - 1000).toISOString();
const COURRIEL_LEO = `w4c.leo.${Date.now()}@exemple.test`;
let badgePropre = null;
let permisAjoute = false;
let leoUser = null;

try {
  // ── Préparation (temporaire, remise en état à la fin) ──────────────────────
  await svc.from("media_partners").update({ peut_evaluer: true }).eq("id", mp1.id);
  const { error: ePermis } = await svc.from("partenaire_sports_permis").insert({ partner_id: mp1.id, sport_id: foot });
  permisAjoute = !ePermis;
  badgePropre = (await svc.from("partner_badges").insert({ partner_id: mp1.id, libelle: "Esprit sportif", icone_path: null, actif: true, ordre: 0 }).select("id").single()).data.id;
  note("préparation : Média Preuve évaluateur en football, badge propre « Esprit sportif »");

  // ── A. Partenaire (desktop) ─────────────────────────────────────────────────
  const part = await contexte(DESKTOP, "p1.partenaire@preuve.local");
  await part.page.goto(`${APP}/partenaire/prospects`, { waitUntil: "networkidle" });
  await part.page.waitForSelector("[data-page-prospects]");
  await pause(part.page);
  await cliche(part.page, "01-partenaire-mes-prospects-vide-desktop.png", { full: false });

  await part.page.getByRole("button", { name: "+ Nouvelle carte" }).click();
  const f = part.page.locator("[data-formulaire-carte]");
  await f.waitFor();
  await f.locator("#prospect-prenom").fill("Léo");
  await f.locator("#prospect-nom").fill("Fortin");
  await pause(part.page, 800);
  await f.locator("#prospect-position").selectOption({ index: 1 });
  await f.getByPlaceholder("Nom de l'école (2 lettres minimum)").fill("erables levis");
  await f.getByRole("option").filter({ hasText: "des Érables" }).first().click();
  await pause(part.page, 1200);
  await f.locator("#prospect-equipe").selectOption({ index: 1 }).catch(() => note("  (aucune équipe proposée)"));
  await f.locator("#prospect-promotion").selectOption("2026");
  await f.locator("[data-case-14-ans] input").check();
  await f.getByText("Ajouter une évaluation").click();
  await pause(part.page, 800);
  await f.getByRole("button", { name: "4 étoiles", exact: true }).first().click();
  await f.locator("[data-choix-badges-carte] button").filter({ hasText: "Esprit sportif" }).click();
  await f.locator("[data-choix-badges-carte] button").filter({ hasText: "Vitesse" }).click();
  await pause(part.page, 600);
  await part.page.evaluate(() => document.querySelector("[role=dialog]")?.scrollTo(0, 0));
  await pause(part.page, 400);
  await cliche(part.page, "02a-partenaire-formulaire-haut-desktop.png", { full: false });
  await part.page.evaluate(() => { const d = document.querySelector("[role=dialog]"); d?.scrollTo(0, d.scrollHeight); });
  await pause(part.page, 400);
  await cliche(part.page, "02b-partenaire-formulaire-bas-desktop.png", { full: false });
  await f.getByRole("button", { name: "Créer la carte" }).click();
  await part.page.waitForSelector("[data-carte-prospect]");
  await pause(part.page);
  await cliche(part.page, "03-partenaire-carte-creee-desktop.png", { full: false });

  await part.page.locator("[data-carte-prospect] [data-action='envoyer']").first().click();
  await part.page.waitForSelector("[data-envoyer-lien]");
  await pause(part.page, 800);
  await cliche(part.page, "04-partenaire-lien-une-fois-desktop.png", { full: false });
  const message = await part.page.locator("[data-message-texto]").innerText();
  const lien = message.match(/http:\/\/localhost:\d+\/p\/[0-9a-f]{64}/)[0];
  note("message texto :", JSON.stringify(message));
  await part.page.getByRole("button", { name: "J'ai envoyé le lien" }).click();
  await pause(part.page);
  note("statut vu par le partenaire :", await part.page.locator("[data-carte-prospect] [data-statut]").first().innerText());

  // ── B. Jeune non inscrit ────────────────────────────────────────────────────
  const anonD = await contexte(DESKTOP, null);
  await anonD.page.goto(lien, { waitUntil: "networkidle" });
  await anonD.page.waitForSelector("[data-invitation-partenaire]");
  await cliche(anonD.page, "05-jeune-lien-sans-connexion-desktop.png", { full: false });
  note("texte sans connexion :", JSON.stringify(await anonD.page.locator("[data-invitation-partenaire]").innerText()));
  await anonD.ctx.close();

  // Robot d'aperçu : la page ne doit contenir ni le nom du partenaire ni rien de la carte.
  const htmlRobot = await (await fetch(lien, { headers: { "User-Agent": "WhatsApp/2.23.20.0 A" } })).text();
  note("robot d'aperçu : nom du partenaire présent ?", htmlRobot.includes(mp1.organization_name), "| « Léo » présent ?", htmlRobot.includes("Léo"));

  // C. Inscription réelle, sur mobile, dans le navigateur qui a ouvert le lien.
  const leo = await contexte(MOBILE, null);
  await leo.page.goto(lien, { waitUntil: "networkidle" });
  await leo.page.waitForSelector("[data-invitation-partenaire]");
  await cliche(leo.page, "06-jeune-lien-sans-connexion-mobile.png", { full: false });
  note("jeton mémorisé :", (await leo.page.evaluate(() => localStorage.getItem("nexus_carte_partenaire"))) ? "oui" : "NON");
  await leo.page.getByRole("link", { name: "S'inscrire" }).click();
  await leo.page.waitForURL(/\/auth/);
  await pause(leo.page);
  await leo.page.getByText("Athlète", { exact: true }).click();
  await leo.page.locator("input[type=email]").fill(COURRIEL_LEO);
  await leo.page.locator("input[type=password]").nth(0).fill("Preuve-W4c-2026!");
  await leo.page.locator("input[type=password]").nth(1).fill("Preuve-W4c-2026!");
  await leo.page.getByRole("button", { name: "Continuer", exact: true }).click();
  await pause(leo.page, 800);
  const champsTexte = leo.page.locator("input[type=text]");
  await champsTexte.nth(0).fill("Léo");
  await champsTexte.nth(1).fill("Fortin");
  await leo.page.locator("input[type=date]").fill("2007-06-01");
  await leo.page.getByRole("button").filter({ hasText: /scolaire/i }).first().click();
  for (const t of ["Politique de confidentialité", "collecte et le traitement de mes données"]) {
    await leo.page.locator("label").filter({ hasText: t }).locator("input[type=checkbox]").check({ force: true });
  }
  await pause(leo.page, 500);
  await leo.page.getByRole("button", { name: "Créer mon compte" }).click();
  await leo.page.waitForURL(/\/athlete\/onboarding/, { timeout: 60000 });
  note("inscription réelle : OK, arrivé sur", new URL(leo.page.url()).pathname);
  note("jeton toujours mémorisé après l'inscription :", (await leo.page.evaluate(() => localStorage.getItem("nexus_carte_partenaire"))) ? "oui" : "NON");

  // Onboarding SIMULÉ par la base (l'assistant complet n'est pas l'objet de W4c).
  leoUser = await uid(COURRIEL_LEO);
  const ecole = (await svc.from("schools").select("id").eq("name", "École secondaire des Érables").single()).data.id;
  const deja = (await svc.from("athletes").select("id").eq("user_id", leoUser).maybeSingle()).data;
  const fiche = { first_name: "Léo", last_name: "Fortin", sport_id: foot, school_id: ecole, date_naissance: "2007-06-01", status: "ACTIF", email: COURRIEL_LEO, annee_diplomation: 2026 };
  if (deja) await svc.from("athletes").update(fiche).eq("id", deja.id);
  else await svc.from("athletes").insert({ ...fiche, user_id: leoUser });
  await svc.from("users").update({ onboarding_complete: true }).eq("id", leoUser);
  note("onboarding simulé : fiche athlète Léo Fortin (19 ans, football), onboarding_complete = vrai");

  await leo.page.goto(`${APP}/athlete/dashboard`, { waitUntil: "networkidle" });
  await leo.page.waitForURL(/\/p\/[0-9a-f]{64}/, { timeout: 30000 });
  await leo.page.waitForSelector("[data-carte-jeune]", { timeout: 30000 });
  note("retour automatique vers le lien après l'onboarding : OK ; jeton oublié :",
    (await leo.page.evaluate(() => localStorage.getItem("nexus_carte_partenaire"))) ? "NON" : "oui");
  await pause(leo.page);
  await cliche(leo.page, "07-jeune-carte-connecte-mobile.png");
  note("partenaire voit encore :", await (async () => { await part.page.reload({ waitUntil: "networkidle" }); await pause(part.page); return part.page.locator("[data-carte-prospect] [data-statut]").first().innerText(); })());

  await leo.page.locator("[data-action='c-est-moi']").click();
  await leo.page.waitForSelector("text=Il reste une étape");
  await pause(leo.page);
  await cliche(leo.page, "08-jeune-attente-optin-mobile.png");

  await leo.page.goto(`${APP}/athlete/dashboard`, { waitUntil: "networkidle" });
  await leo.page.waitForSelector("[data-bandeau-cartes-partenaires]", { timeout: 30000 });
  await pause(leo.page);
  await cliche(leo.page, "09-jeune-bandeau-rappel-mobile.png", { full: false });
  await leo.page.locator("[data-bandeau-cartes-partenaires] a").click();
  await leo.page.waitForSelector("[data-page-cartes-partenaires] [data-carte-jeune]");
  await leo.page.locator("[data-action='activer-visibilite']").click();
  await leo.page.waitForSelector("[data-carte-issue='transferee']", { timeout: 30000 });
  await pause(leo.page);
  await cliche(leo.page, "10-jeune-transfert-fait-mobile.png", { full: false });

  const leoAth = (await svc.from("athletes").select("id, partner_visibility_opt_in").eq("user_id", leoUser).single()).data;
  const ev = (await svc.from("partner_evaluations").select("cote_globale").eq("athlete_id", leoAth.id).eq("partner_id", mp1.id)).data;
  const pb = (await svc.from("partner_athlete_badges").select("badge_id, partner_badge_id").eq("athlete_id", leoAth.id)).data;
  note("base : opt-in", leoAth.partner_visibility_opt_in, "| évaluation", JSON.stringify(ev), "| badges posés", pb.length);

  const leoD = await contexte(DESKTOP, COURRIEL_LEO);
  await leoD.page.goto(`${APP}/athlete/profil`, { waitUntil: "networkidle" });
  await leoD.page.waitForSelector("[data-evaluation-partenaire]", { timeout: 60000 });
  await pause(leoD.page, 2500);
  const sec = leoD.page.locator("[data-evaluation-partenaire]").first();
  await sec.scrollIntoViewIfNeeded();
  await cliche(leoD.page, "11-jeune-profil-evaluation-partenaire-desktop.png", { full: false });
  note("profil : section évaluation partenaire :", JSON.stringify((await sec.innerText()).replace(/\s+/g, " ").slice(0, 160)));
  const rangee = leoD.page.locator("[data-badge-partenaire]");
  note("profil : badges partenaire affichés :", await rangee.count());
  if (await rangee.count()) {
    await rangee.first().scrollIntoViewIfNeeded();
    await pause(leoD.page, 800);
    await cliche(leoD.page, "12-jeune-profil-badges-desktop.png", { full: false });
  }
  await leoD.ctx.close();
  await leo.ctx.close();

  // ── D. « Ce n'est pas moi » par le lien (Mathis) ────────────────────────────
  const p1c = await clientDe("p1.partenaire@preuve.local");
  const { data: zoe, error: eZoe } = await p1c.rpc("partenaire_prospect_enregistrer", {
    p_carte: null, p_prenom: "Zoé", p_nom: "Martel", p_sport_id: foot, p_position_id: null, p_school_id: null,
    p_team_id: null, p_promotion: 2027, p_atteste_14_ans: true, p_cote_globale: 3, p_traits: {}, p_badges_partenaire: [], p_badges_nexus: [],
  });
  if (eZoe) throw eZoe;
  const { data: jetonZoe } = await p1c.rpc("partenaire_prospect_lien", { p_carte: zoe });
  const math = await contexte(MOBILE, "mathis.demo@exemple.test");
  await math.page.goto(`${APP}/p/${jetonZoe}`, { waitUntil: "networkidle" });
  await math.page.waitForSelector("[data-carte-jeune]");
  await math.page.locator("[data-action='pas-moi']").click();
  await pause(math.page, 600);
  await cliche(math.page, "13-jeune-pas-moi-confirmation-mobile.png");
  await math.page.getByRole("button", { name: "Oui, ce n'est pas moi" }).click();
  await math.page.waitForSelector("[data-carte-issue='pas-moi']");
  await cliche(math.page, "14-jeune-pas-moi-fait-mobile.png", { full: false });
  const zoeApres = (await svc.from("partenaire_prospects").select("id").eq("id", zoe)).data;
  note("« pas moi » par le lien : carte supprimée ?", zoeApres.length === 0);

  // ── E. Proposition de Nexus → notification → réponse ───────────────────────
  const { data: carteMathis, error: eM } = await p1c.rpc("partenaire_prospect_enregistrer", {
    p_carte: null, p_prenom: "Mathis", p_nom: "Lavoie", p_sport_id: foot, p_position_id: null, p_school_id: null,
    p_team_id: equipe, p_promotion: null, p_atteste_14_ans: true, p_cote_globale: 4, p_traits: {}, p_badges_partenaire: [], p_badges_nexus: [],
  });
  if (eM) throw eM;
  const adminC = await clientDe("admin@demo.local");
  const { error: eP } = await adminC.rpc("admin_prospect_proposer", { p_carte: carteMathis, p_athlete: mathis.id });
  note("proposition de l'admin à Mathis :", eP ? "ERREUR " + eP.message : "OK");
  await math.page.goto(`${APP}/athlete/notifications`, { waitUntil: "networkidle" });
  await pause(math.page, 2000);
  await cliche(math.page, "15-jeune-notification-proposition-mobile.png", { full: false });
  await math.page.getByText("t'a évalué. C'est toi ?").first().click();
  await math.page.waitForURL(/cartes-partenaires/, { timeout: 30000 });
  await math.page.waitForSelector("[data-carte-jeune]");
  await pause(math.page);
  await cliche(math.page, "16-jeune-proposition-reponse-mobile.png");
  await math.ctx.close();

  // Desktop de la page de réponse (même proposition).
  const mathD = await contexte(DESKTOP, "mathis.demo@exemple.test");
  await mathD.page.goto(`${APP}/athlete/cartes-partenaires`, { waitUntil: "networkidle" });
  await mathD.page.waitForSelector("[data-carte-jeune]");
  await pause(mathD.page);
  await cliche(mathD.page, "17-jeune-proposition-reponse-desktop.png", { full: false });
  await mathD.ctx.close();

  // ── F. Partenaire : « Terminées », mobile, texto ───────────────────────────
  await part.page.reload({ waitUntil: "networkidle" });
  await pause(part.page, 2000);
  note("statuts vus par le partenaire :", JSON.stringify(await part.page.locator("[data-carte-prospect] [data-statut]").allInnerTexts()));
  note("terminées :", JSON.stringify((await part.page.locator("[data-section-terminees] li").allInnerTexts()).map((t) => t.replace(/\s+/g, " "))));
  await part.page.locator("[data-section-terminees]").scrollIntoViewIfNeeded();
  await cliche(part.page, "18-partenaire-liste-et-terminees-desktop.png", { full: true });
  await part.ctx.close();

  // Navigateur NEUF : après plusieurs contextes, l'émulation tactile de Chromium headless
  // se perd (maxTouchPoints 0, pointer fine) — vérifié à part, ce n'est pas l'application.
  const nav2 = await chromium.launch();
  const ctxM = await nav2.newContext(MOBILE);
  await ctxM.addCookies(cookies(await session("p1.partenaire@preuve.local")));
  const partM = { ctx: ctxM, page: await ctxM.newPage() };
  partM.page.on("pageerror", (e) => erreursPage.push(`partenaire mobile : ${e.message}`));
  await partM.page.goto(`${APP}/partenaire/prospects`, { waitUntil: "networkidle" });
  note("mobile (arrivée) :", JSON.stringify(await partM.page.evaluate(() => ({ mtp: navigator.maxTouchPoints, coarse: matchMedia("(pointer: coarse)").matches, ua: navigator.userAgent.slice(0, 40) }))), "| options :", JSON.stringify({ isMobile: MOBILE.isMobile, hasTouch: MOBILE.hasTouch }));
  await partM.page.waitForSelector("[data-carte-prospect]");
  await pause(partM.page);
  await cliche(partM.page, "19-partenaire-mes-prospects-mobile.png", { full: false });
  // (La capture d'un élément plus haut que l'écran fait perdre l'émulation tactile à
  //  Chromium headless : l'étape texto passe donc AVANT la capture du formulaire.)
  // Nouveau lien sur la carte « Mathis Lavoie » (proposée : le partenaire ne le voit pas).
  const carteM = partM.page.locator(`[data-carte-prospect='${carteMathis}']`);
  await carteM.locator("[data-action='envoyer']").click();
  await partM.page.waitForSelector("[data-envoyer-lien]", { timeout: 15000 }).catch(async (e) => {
    await partM.page.screenshot({ path: path.join(OUT, "zz-echec-envoyer-mobile.png") });
    note("  échec ouverture du lien mobile ; texte de la carte :", JSON.stringify(await carteM.innerText().catch(() => "?")));
    throw e;
  });
  await pause(partM.page, 800);
  note("mobile : pointer coarse ?", await partM.page.evaluate(() => matchMedia("(pointer: coarse)").matches),
    "| boutons du panneau :", JSON.stringify(await partM.page.locator("[data-envoyer-lien] a, [data-envoyer-lien] button").allInnerTexts()));
  note("mobile : bouton « Envoyer par texto » :", await partM.page.getByRole("link", { name: "Envoyer par texto" }).count(),
    "| href commence par sms:?&body= :", ((await partM.page.getByRole("link", { name: "Envoyer par texto" }).getAttribute("href", { timeout: 3000 }).catch(() => null)) ?? "").startsWith("sms:?&body="));
  await cliche(partM.page, "21-partenaire-envoyer-texto-mobile.png", { full: false });
  await partM.page.getByRole("button", { name: "J'ai envoyé le lien" }).click();
  await pause(partM.page, 800);
  await partM.page.getByRole("button", { name: "+ Nouvelle carte" }).click();
  await partM.page.waitForSelector("[data-formulaire-carte]");
  await pause(partM.page);
  // Deux vues de l'écran : le haut de la fenêtre, puis le bas (elle défile dans son calque).
  await partM.page.evaluate(() => document.querySelector("[role=dialog]")?.scrollTo(0, 0));
  await pause(partM.page, 400);
  await cliche(partM.page, "20a-partenaire-formulaire-haut-mobile.png", { full: false });
  await partM.page.evaluate(() => { const d = document.querySelector("[role=dialog]"); d?.scrollTo(0, d.scrollHeight); });
  await pause(partM.page, 400);
  await cliche(partM.page, "20b-partenaire-formulaire-bas-mobile.png", { full: false });
  note("formulaire mobile : titre visible en haut ?", await partM.page.locator("#titre-carte-prospect").isVisible());
  await partM.page.locator("[data-formulaire-carte]").getByRole("button", { name: "Annuler" }).click();
  await partM.page.waitForSelector("[data-formulaire-carte]", { state: "detached" });
  await partM.ctx.close();
  await nav2.close();
} finally {
  // ── Remise en état ─────────────────────────────────────────────────────────
  const { data: cartes } = await svc.from("partenaire_prospects").select("id").eq("partner_id", mp1.id).gte("created_at", debut);
  for (const c of cartes ?? []) await svc.from("partenaire_prospects").delete().eq("id", c.id);
  await svc.from("partenaire_prospects_issues").delete().eq("partner_id", mp1.id).gte("terminee_le", debut);
  await svc.from("partenaire_prospects_journal").delete().gte("created_at", debut);
  await svc.from("athlete_notifications").delete().eq("type", "PARTENAIRE_EVALUATION").gte("created_at", debut);
  if (leoUser) {
    const a = (await svc.from("athletes").select("id").eq("user_id", leoUser).maybeSingle()).data;
    if (a) {
      await svc.from("partner_athlete_badges").delete().eq("athlete_id", a.id);
      await svc.from("partner_evaluations").delete().eq("athlete_id", a.id);
      await svc.from("consent_audit_trail").delete().eq("athlete_id", a.id);
      const { error } = await svc.from("athletes").delete().eq("id", a.id);
      if (error) note("  remise en état : athlète Léo NON supprimé :", error.message);
    }
    const r = await fetch(`${API}/auth/v1/admin/users/${leoUser}`, { method: "DELETE", headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` } });
    note("remise en état : compte Léo supprimé :", r.status);
  }
  if (badgePropre) await svc.from("partner_badges").delete().eq("id", badgePropre);
  if (permisAjoute) await svc.from("partenaire_sports_permis").delete().eq("partner_id", mp1.id).eq("sport_id", foot);
  await svc.from("media_partners").update({ peut_evaluer: mp1.peut_evaluer }).eq("id", mp1.id);
  await svc.from("athletes").update({ partner_visibility_opt_in: mathis.partner_visibility_opt_in }).eq("id", mathis.id);
  note("remise en état : partenaire, badge, sport permis, cartes, journal, notifications");
  note("erreurs JavaScript des pages :", erreursPage.length ? JSON.stringify(erreursPage) : "aucune");
  fs.writeFileSync("C:/Users/bptds/Documents/Nexus/docs/partenaires-w4bc/parcours-resultats-local.txt", journal.join("\n") + "\n");
  await nav.close();
}
