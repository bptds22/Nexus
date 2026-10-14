// Parcours navigateur W2b + W3 + C — base LOCALE seulement, captures web.
//   APP=http://localhost:3005 OUT=docs/partenaires-w3/captures node docs/partenaires-w3/parcours-captures-w3.mjs
// Sessions RÉELLES (lien magique admin → /verify, aucun mot de passe touché).
// Préparation et remise en état par service_role ; refuse toute URL non locale.
// Athlète : Félix Gauthier (fictif). Organisation « Média Preuve » renommée
// « L'Esprit Sportif » le temps des captures, puis remise.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { chromium } from "playwright";

const req = createRequire(path.resolve("package.json"));
const { createClient } = req("@supabase/supabase-js");
const env = Object.fromEntries(fs.readFileSync(".env.local.docker", "utf8").split(/\r?\n/)
  .filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const API = env.NEXT_PUBLIC_SUPABASE_URL;
if (!/^http:\/\/127\.0\.0\.1/.test(API)) throw new Error("pas local");
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const APP = process.env.APP ?? "http://localhost:3005";
if (!/^http:\/\/localhost/.test(APP)) throw new Error("APP pas local");
const OUT = process.env.OUT ?? "docs/partenaires-w3/captures";
fs.mkdirSync(OUT, { recursive: true });
const svc = createClient(API, SERVICE, { auth: { persistSession: false } });

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
const nav = await chromium.launch();
async function ouvrir(email) {
  const s = await session(email);
  const ctx = await nav.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addCookies(cookies(s));
  const page = await ctx.newPage();
  const client = createClient(API, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${s.access_token}` } },
  });
  return { page, client, ctx };
}
const pause = (p, ms = 2500) => p.waitForTimeout(ms);
async function cliche(p, nom, cible) {
  const f = path.join(OUT, nom);
  if (cible) await cible.screenshot({ path: f });
  else await p.screenshot({ path: f, fullPage: false });
  console.log("capture", f);
}

const uid = async (email) => (await svc.from("users").select("id").eq("email", email).single()).data.id;
const P1 = await uid("p1.partenaire@preuve.local");
const ATH = await uid("felix.gauthier@exemple.test");
const COACH = await uid("marc.desrosiers@exemple.test");
const felix = (await svc.from("athletes").select("id, partner_visibility_opt_in").eq("user_id", ATH).single()).data;
const mp1 = (await svc.from("media_partners").select("id, organization_name, peut_evaluer").eq("user_id", P1).single()).data;
const foot = (await svc.from("sports").select("id").eq("nom", "Football").single()).data.id;
const debut = new Date().toISOString();
let objetIcone = null;

try {
  // ── Préparation (temporaire) ──────────────────────────────────────────────
  await svc.from("athletes").update({ partner_visibility_opt_in: true }).eq("id", felix.id);
  await svc.from("media_partners").update({ peut_evaluer: true, organization_name: "L'Esprit Sportif" }).eq("id", mp1.id);
  await svc.from("partenaire_sports_permis").insert({ partner_id: mp1.id, sport_id: foot });

  // ── 01 Admin : créer un badge pour le partenaire, avec son icône ──────────
  const admin = await ouvrir("admin@demo.local");
  await admin.page.goto(`${APP}/admin/partenaires`, { waitUntil: "networkidle" });
  await pause(admin.page);
  const ligne = admin.page.locator("div").filter({ has: admin.page.getByText("L'Esprit Sportif", { exact: true }) })
    .filter({ has: admin.page.getByRole("button", { name: "Présentation" }) }).last();
  await ligne.getByRole("button", { name: "Présentation" }).click();
  const bloc = admin.page.locator("[data-admin-badges-partenaire]");
  await bloc.waitFor();
  // Icône générée dans la page (PNG transparent) : un écusson doré.
  const png = await admin.page.evaluate(() => {
    const c = document.createElement("canvas"); c.width = 256; c.height = 256;
    const g = c.getContext("2d");
    g.fillStyle = "#F59E0B"; g.beginPath(); g.moveTo(128, 16); g.lineTo(228, 60); g.lineTo(212, 170); g.lineTo(128, 240); g.lineTo(44, 170); g.lineTo(28, 60); g.closePath(); g.fill();
    g.fillStyle = "#111317"; g.font = "bold 92px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("ES", 128, 124);
    return c.toDataURL("image/png").split(",")[1];
  });
  await bloc.getByPlaceholder("Nom du nouveau badge").fill("Esprit sportif");
  await bloc.locator('input[type="file"]').last().setInputFiles({ name: "esprit.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
  await bloc.getByRole("button", { name: "Créer le badge" }).click();
  await bloc.getByText("0 posé").waitFor();
  await pause(admin.page, 1200);
  await bloc.scrollIntoViewIfNeeded();
  await cliche(admin.page, "01-admin-badges-du-partenaire.png", bloc);
  objetIcone = (await svc.from("partner_badges").select("icone_path").eq("partner_id", mp1.id).single()).data.icone_path;

  // ── 02-03 Partenaire : « Attribuer un badge » ─────────────────────────────
  const part = await ouvrir("p1.partenaire@preuve.local");
  // Évaluation détaillée saisie par la RPC de l'écran (4,6/5).
  const ev = await part.client.rpc("partenaire_evaluer_athlete", {
    p_athlete_id: felix.id, p_cote_globale: null,
    p_traits: { leadership: 5, discipline: 5, coachabilite: 4, competitivite: 5, resilience: 4 },
  });
  if (ev.error) throw ev.error;
  await part.page.goto(`${APP}/partenaire/athletes/${felix.id}`, { waitUntil: "networkidle" });
  await pause(part.page, 3500);
  const actions = part.page.locator("[data-actions-partenaire]");
  await actions.getByRole("button", { name: "Attribuer un badge" }).click();
  await pause(part.page, 600);
  await cliche(part.page, "02-partenaire-attribuer-un-badge.png");
  await actions.getByRole("button", { name: "Esprit sportif" }).click();
  await part.page.locator("[data-badge-partenaire]").first().waitFor();
  await pause(part.page, 1200);
  await part.page.locator("[data-badge-partenaire]").first().scrollIntoViewIfNeeded();
  await cliche(part.page, "03-partenaire-badge-pose-retirer.png");

  // ── 04 Recruteur, le coach n'a PAS évalué : section complète + badge ─────
  const rec = await ouvrir("julie.lambert@exemple.test");
  await rec.page.goto(`${APP}/recruteur/athletes/${felix.id}`, { waitUntil: "networkidle" });
  await pause(rec.page, 3500);
  await rec.page.locator("[data-evaluation-partenaire]").first().scrollIntoViewIfNeeded();
  await cliche(rec.page, "04-recruteur-sans-coach-section-complete.png");
  await rec.page.locator("[data-badge-partenaire]").first().scrollIntoViewIfNeeded();
  await cliche(rec.page, "05-recruteur-badge-fin-des-distinctions.png");

  // ── Le coach évalue (temporaire) ──────────────────────────────────────────
  const ins = await svc.from("evaluations").insert({
    coach_id: COACH, athlete_id: felix.id, cote_globale: 3.5,
    leadership: 4, discipline: 3, coachabilite: 4, competitivite: 3,
  });
  if (ins.error) throw ins.error;

  // ── 06 Recruteur, coach évalué : UNE ligne sous « Moyenne des traits » ───
  await rec.page.reload({ waitUntil: "networkidle" });
  await pause(rec.page, 3500);
  const ligneRec = rec.page.locator("[data-evaluation-partenaire-ligne]").first();
  await ligneRec.scrollIntoViewIfNeeded();
  await rec.page.evaluate(() => window.scrollBy(0, 250));
  await cliche(rec.page, "06-recruteur-coach-evalue-ligne-partenaire.png");
  console.log("section complète encore présente :", await rec.page.locator("[data-evaluation-partenaire]").count());

  // ── 07 Profil de l'athlète : la ligne + le badge ──────────────────────────
  const ath = await ouvrir("felix.gauthier@exemple.test");
  await ath.page.goto(`${APP}/athlete/profil`, { waitUntil: "networkidle" });
  await pause(ath.page, 3500);
  await ath.page.locator("[data-evaluation-partenaire-ligne]").first().scrollIntoViewIfNeeded();
  await cliche(ath.page, "07-athlete-profil-ligne-et-badge.png");

  // ── 08-09 Coach : ligne, puis badge masqué ────────────────────────────────
  const coach = await ouvrir("marc.desrosiers@exemple.test");
  await coach.page.goto(`${APP}/coach/athletes/${felix.id}`, { waitUntil: "networkidle" });
  await pause(coach.page, 3500);
  await coach.page.locator("[data-evaluation-partenaire-ligne]").first().scrollIntoViewIfNeeded();
  await coach.page.evaluate(() => window.scrollBy(0, 200));
  await cliche(coach.page, "08-coach-ligne-partenaire-et-masquer.png");
  await coach.page.locator("[data-badge-partenaire]").last().getByRole("button", { name: "Masquer" }).click();
  await coach.page.locator("[data-badge-partenaire]").last().getByRole("button", { name: "Réafficher" }).waitFor();
  await pause(coach.page, 800);
  await cliche(coach.page, "09-coach-badge-masque.png");
  await rec.page.reload({ waitUntil: "networkidle" });
  await pause(rec.page, 3000);
  console.log("badges partenaire vus par le recruteur après masquage :", await rec.page.locator("[data-badge-partenaire]").count());

  // ── 10-11 Partenaire : « Retirer mon évaluation » ─────────────────────────
  await part.page.reload({ waitUntil: "networkidle" });
  await pause(part.page, 3500);
  await actions.getByRole("button", { name: "Retirer mon évaluation" }).click();
  await pause(part.page, 500);
  await cliche(part.page, "10-partenaire-retirer-mon-evaluation-confirmation.png");
  await actions.getByRole("button", { name: "Confirmer le retrait" }).click();
  await part.page.getByText("Évaluation retirée.").waitFor();
  await pause(part.page, 1500);
  await cliche(part.page, "11-partenaire-evaluation-retiree.png");
  await rec.page.reload({ waitUntil: "networkidle" });
  await pause(rec.page, 3000);
  console.log("après retrait, recruteur — lignes :", await rec.page.locator("[data-evaluation-partenaire-ligne]").count(),
    "sections :", await rec.page.locator("[data-evaluation-partenaire]").count());
} finally {
  // ── Remise en état (service_role) ─────────────────────────────────────────
  await svc.from("partner_athlete_badges").delete().eq("athlete_id", felix.id);
  await svc.from("partner_badges").delete().eq("partner_id", mp1.id);
  await svc.from("partner_evaluation_retraits").delete().eq("athlete_id", felix.id);
  await svc.from("partner_evaluations").delete().eq("athlete_id", felix.id);
  await svc.from("evaluations").delete().eq("athlete_id", felix.id).eq("coach_id", COACH).gte("created_at", debut);
  // Le trigger de cote ne remet pas la cote à NULL quand l'évaluation part.
  await svc.from("athletes").update({ cote_globale_entraineur: null }).eq("id", felix.id);
  // Traces de consultation et d'activité laissées par le parcours lui-même.
  await svc.from("partner_profile_views").delete().gte("viewed_at", debut);
  await svc.from("recruiter_athlete_views").delete().gte("viewed_at", debut);
  await svc.from("recruiter_activity_log").delete().gte("created_at", debut);
  await svc.from("activities").delete().gte("created_at", debut);
  await svc.from("partenaire_sports_permis").delete().eq("partner_id", mp1.id);
  await svc.from("media_partners").update({ peut_evaluer: mp1.peut_evaluer, organization_name: mp1.organization_name }).eq("id", mp1.id);
  await svc.from("athletes").update({ partner_visibility_opt_in: felix.partner_visibility_opt_in }).eq("id", felix.id);
  if (objetIcone) await svc.storage.from("partner-badges").remove([objetIcone]);
  console.log("remise en état faite ; début du parcours :", debut);
  await nav.close();
}
