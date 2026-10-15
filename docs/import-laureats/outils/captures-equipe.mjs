// Captures « filtre Équipe » de Mon processus — base LOCALE, navigateur SANS INTERFACE.
//   cd C:\tmp\nexus-laureats ; APP=http://localhost:3012 node docs/import-laureats/outils/captures-equipe.mjs
// JETABLES, tous retirés à la fin : 5 cartes prospect (Collège de Lévis Juvénile ×2 + Cadet ×1, Saint-Jean-Eudes
// Juvénile ×1, Grizzlis [club civil] ×1) créées sous l'identité du recruteur de preuve, et 1 VRAI athlète
// (fiche + équipe Saint-Jean-Eudes Juvénile + dossier dans le processus du recruteur), écrit par service_role.
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
const APP = process.env.APP ?? "http://localhost:3012";
const OUT = path.resolve("docs/import-laureats/captures");
fs.mkdirSync(OUT, { recursive: true });
const H = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const svc = createClient(API, SERVICE, { auth: { persistSession: false } });
const RECRUTEUR = "r1.avec.cegep@preuve.local";
const LEVIS_JUV = "f7fe9a38-7192-4081-8744-fbfb238aadff";
const LEVIS_CAD = "87742731-f29a-46c4-a0b7-1b0204d30e77";
const SJE_JUV = "ffcad021-cb9b-4286-bdfb-7528494040e0";
const SJE_ECOLE = "4f0e52ad-e9c7-4797-9b7b-92b25ed1307b";
const GRIZZLIS = "c46a1a7e-f937-4229-a2f6-dee6b07d161d";
const ATHLETE = "7e570000-0000-4000-8000-0000000e7e01";
const journal = [];
const note = (...a) => { const l = a.join(" "); journal.push(l); console.log(l); };

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
const menu = (p) => p.locator("div.absolute.z-\\[61\\] button");
const fermer = (p) => p.locator("div.fixed.inset-0.z-\\[60\\]").click({ position: { x: 10, y: 10 } });
const bandeau = async (p) => (await p.locator("span.text-\\[12px\\].text-\\[\\#9CA3AF\\]").allTextContents()).find((t) => / sur /.test(t)) ?? "(pas de bandeau)";
const visibles = (p) => p.getByText("Jetable", { exact: false }).locator("visible=true").count();

const cartes = [];
let athleteCree = false;
let recruteurId = null;
const nav = await chromium.launch(); // headless
try {
  const s = await session(RECRUTEUR);
  recruteurId = s.user.id;
  const moi = createClient(API, ANON, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${s.access_token}` } } });
  for (const [team, nom, num] of [[LEVIS_JUV, "Lévis-Juv-1", "11"], [LEVIS_JUV, "Lévis-Juv-2", "12"], [LEVIS_CAD, "Lévis-Cadet", "21"], [SJE_JUV, "SJE-Juv", "31"], [GRIZZLIS, "Grizzlis", "41"]]) {
    const { data, error } = await moi.from("cartes_prospect")
      .insert({ prenom: "Jetable", nom, team_id: team, promotion: 2027, etape: "IDENTIFIE", numero: num }).select("id").single();
    if (error) throw new Error(`carte ${nom} : ${error.message}`);
    cartes.push(data.id);
  }
  // Le vrai athlète jetable : majeur (aucun circuit parental), actif, dans l'équipe Juvénile de Saint-Jean-Eudes.
  const { data: fb } = await svc.from("sports").select("id").eq("nom", "Football").single();
  let r = await svc.from("athletes").insert({ id: ATHLETE, first_name: "Jetable", last_name: "Athlète-SJE", school_id: SJE_ECOLE,
    sport_id: fb.id, status: "ACTIF", date_naissance: "2007-01-01", annee_diplomation: 2027, genre: "M" });
  if (r.error) throw new Error("athlète : " + r.error.message);
  athleteCree = true;
  r = await svc.from("team_athletes").insert({ team_id: SJE_JUV, athlete_id: ATHLETE, sport_id: fb.id });
  if (r.error) throw new Error("team_athletes : " + r.error.message);
  r = await svc.from("recruiter_pipeline").insert({ recruiter_id: recruteurId, athlete_id: ATHLETE, stage: "IDENTIFIE" });
  if (r.error) throw new Error("recruiter_pipeline : " + r.error.message);
  note(`jetables créés : ${cartes.length} cartes (Lévis Juvénile ×2, Lévis Cadet ×1, Saint-Jean-Eudes Juvénile ×1, Grizzlis ×1) + 1 vrai athlète (Saint-Jean-Eudes Juvénile, dans le processus)`);

  const ctx = await nav.newContext({ viewport: { width: 1440, height: 1000 }, locale: "fr-CA" });
  await ctx.addCookies(cookies(s));
  const p = await ctx.newPage();
  const erreurs = [];
  p.on("pageerror", (e) => erreurs.push(e.message));
  await p.goto(`${APP}/recruteur/pipeline`, { waitUntil: "networkidle" });
  await p.getByText("Jetable", { exact: false }).locator("visible=true").first().waitFor({ timeout: 20000 });
  await p.waitForTimeout(1200);
  note(`sans filtre : ${await visibles(p)} éléments « Jetable » visibles au kanban`);

  // 1. Menu Équipe sans école cochée
  await p.locator('button:has-text("Toutes les équipes")').first().click();
  await p.waitForTimeout(300);
  note(`01 menu Équipe, aucune école cochée : ${(await menu(p).allTextContents()).join(" | ")}`);
  await p.screenshot({ path: path.join(OUT, "equipe-01-menu-sans-ecole.png"), clip: { x: 0, y: 0, width: 1440, height: 820 } });
  await fermer(p);

  // 2. École Collège de Lévis cochée → ses 2 équipes, pilule « Toutes les équipes »
  await p.locator('button:has-text("Toutes les écoles et clubs")').first().click();
  await menu(p).filter({ hasText: "Collège de Lévis" }).first().click();
  await fermer(p);
  await p.waitForTimeout(300);
  const pilule = await p.locator('button:has-text("Toutes les équipes")').count();
  note(`02 Collège de Lévis coché — pilule « Toutes les équipes » : ${pilule ? "oui" : "NON"} ; bandeau : ${await bandeau(p)} ; Jetable visibles : ${await visibles(p)}`);
  await p.locator('button:has-text("Toutes les équipes")').first().click();
  await p.waitForTimeout(300);
  note(`02 menu Équipe, Lévis coché : ${(await menu(p).allTextContents()).join(" | ")}`);
  await p.screenshot({ path: path.join(OUT, "equipe-02-ecole-cochee-menu.png"), clip: { x: 0, y: 0, width: 1440, height: 820 } });

  // Tout cocher / Tout décocher
  await menu(p).filter({ hasText: "Tout cocher" }).first().click();
  await p.waitForTimeout(200);
  note(`   Tout cocher → bouton devient : ${(await menu(p).first().textContent())} ; bandeau : ${await bandeau(p)}`);
  await menu(p).filter({ hasText: "Tout décocher" }).first().click();
  await p.waitForTimeout(200);

  // 3. Une seule équipe cochée (Juvénile) → kanban et tableau filtrés
  await menu(p).filter({ hasText: "Juvénile" }).first().click();
  await fermer(p);
  await p.waitForTimeout(400);
  note(`03 équipe Juvénile de Lévis cochée — kanban : ${await visibles(p)} carte(s) « Jetable » ; bandeau : ${await bandeau(p)}`);
  await p.screenshot({ path: path.join(OUT, "equipe-03-une-equipe-kanban.png"), fullPage: false });
  await p.locator('button[title="Vue tableau"]').click();
  await p.waitForTimeout(800);
  note(`03 même filtre — vue tableau : ${await p.locator("tbody tr:visible").count()} ligne(s)`);
  await p.screenshot({ path: path.join(OUT, "equipe-04-une-equipe-tableau.png"), fullPage: false });

  // Nettoyage : décocher Lévis retire l'équipe cochée
  await p.locator('button.nx-filter-active:has-text("Collège de Lévis")').first().click();
  await menu(p).filter({ hasText: "Collège de Lévis" }).first().click();
  await fermer(p);
  await p.waitForTimeout(300);
  note(`   Lévis décoché → pilule Équipe : « ${(await p.locator('button:has-text("Toutes les équipes")').count()) ? "Toutes les équipes" : "équipe encore cochée (ÉCHEC)"} » ; bandeau : ${await bandeau(p)}`);

  // Le vrai athlète jetable sous son équipe
  await p.locator('button:has-text("Toutes les équipes")').first().click();
  await menu(p).filter({ hasText: "Saint-Jean-Eudes" }).first().click();
  await fermer(p);
  await p.waitForTimeout(400);
  note(`   équipe Saint-Jean-Eudes Juvénile cochée — tableau : ${await p.locator("tbody tr:visible").count()} ligne(s) (1 carte prospect + 1 vrai athlète attendus) ; bandeau : ${await bandeau(p)}`);
  note(`erreurs de page : ${erreurs.length ? erreurs.join(" | ") : "aucune"}`);
} finally {
  if (cartes.length) {
    const { error } = await svc.from("cartes_prospect").delete().in("id", cartes);
    note(`cartes jetables retirées : ${error ? "ÉCHEC " + error.message : cartes.length}`);
  }
  if (athleteCree) {
    const a = await svc.from("recruiter_pipeline").delete().eq("athlete_id", ATHLETE);
    const b = await svc.from("team_athletes").delete().eq("athlete_id", ATHLETE);
    const c = await svc.from("athletes").delete().eq("id", ATHLETE);
    note(`vrai athlète jetable retiré : ${[a, b, c].some((x) => x.error) ? "ÉCHEC " + [a, b, c].map((x) => x.error?.message).join(" / ") : "dossier + équipe + fiche"}`);
  }
  await nav.close();
  fs.writeFileSync(path.resolve("docs/import-laureats/captures-equipe-resultats.txt"), journal.join("\n") + "\n");
}
