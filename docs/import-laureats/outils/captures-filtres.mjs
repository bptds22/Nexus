// Captures « filtres Mon processus » (pilule École / Club + pastille Type) — base LOCALE, navigateur SANS INTERFACE.
//   cd C:\tmp\nexus-laureats ; APP=http://localhost:3012 node docs/import-laureats/outils/captures-filtres.mjs
// 6 cartes JETABLES (prénom « Jetable ») dans 3 équipes, dont un club civil, créées sous l'identité du recruteur de
// preuve (chemin de l'appli : le trigger fixe l'unité), retirées à la fin. Ses vrais athlètes de test restent.
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
// Collège de Lévis, Saint-Jean-Eudes (écoles) et Grizzlis de Boucherville (club civil) — Juvénile / Midget AAA 2026-2027.
const EQUIPES = ["f7fe9a38-7192-4081-8744-fbfb238aadff", "ffcad021-cb9b-4286-bdfb-7528494040e0", "c46a1a7e-f937-4229-a2f6-dee6b07d161d"];
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
const barre = async (p) => {
  const b = await p.locator('button:has-text("Toutes les écoles et clubs"), button:has-text("École / Club")').first().boundingBox();
  return { x: 0, y: Math.max(0, b.y - 140), width: 1440, height: 330 };
};
const compteur = async (p) => (await p.locator("span.text-\\[12px\\].text-\\[\\#9CA3AF\\]").allTextContents()).find((t) => / sur /.test(t)) ?? "(pas de bandeau)";

const ids = [];
const nav = await chromium.launch(); // headless
try {
  const s = await session(RECRUTEUR);
  const moi = createClient(API, ANON, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${s.access_token}` } } });
  for (const [i, team] of EQUIPES.entries()) {
    for (const k of [1, 2]) {
      const { data, error } = await moi.from("cartes_prospect")
        .insert({ prenom: "Jetable", nom: `École${i + 1}-${k}`, team_id: team, promotion: 2027, etape: "IDENTIFIE", numero: String(10 * (i + 1) + k) })
        .select("id").single();
      if (error) throw new Error(`carte ${i}/${k} : ${error.message}`);
      ids.push(data.id);
    }
  }
  note(`cartes jetables créées : ${ids.length} (2 par équipe : Collège de Lévis, Saint-Jean-Eudes, Grizzlis [club civil])`);

  const ctx = await nav.newContext({ viewport: { width: 1440, height: 1000 }, locale: "fr-CA" });
  await ctx.addCookies(cookies(s));
  const p = await ctx.newPage();
  const erreurs = [];
  p.on("pageerror", (e) => erreurs.push(e.message));
  await p.goto(`${APP}/recruteur/pipeline`, { waitUntil: "networkidle" });
  await p.getByText("Jetable", { exact: false }).locator("visible=true").first().waitFor({ timeout: 20000 });
  await p.waitForTimeout(1200);
  const kanbanAvant = await p.getByText("Jetable", { exact: false }).locator("visible=true").count();
  note(`cartes « Jetable » visibles au kanban, sans filtre : ${kanbanAvant}`);
  await p.screenshot({ path: path.join(OUT, "filtres-01-barre-pilule-ecole.png"), clip: await barre(p) });

  // Menu ouvert + recherche (accents ignorés : « levis » trouve « Collège de Lévis »)
  await p.locator('button:has-text("Toutes les écoles et clubs")').first().click();
  const champ = p.getByPlaceholder("Chercher : école / club…");
  const optionsAvant = await p.locator("div.absolute.z-\\[61\\] button").allTextContents();
  note(`menu École / Club, sans recherche : ${optionsAvant.join(" | ")}`);
  await p.screenshot({ path: path.join(OUT, "filtres-02a-menu-ouvert.png"), clip: { x: 0, y: 0, width: 1440, height: 760 } });
  await champ.fill("levis");
  await p.waitForTimeout(300);
  const optionsLevis = await p.locator("div.absolute.z-\\[61\\] button").allTextContents();
  note(`menu, recherche « levis » : ${optionsLevis.join(" | ")}`);
  await champ.fill("GRIZZ");
  await p.waitForTimeout(300);
  note(`menu, recherche « GRIZZ » : ${(await p.locator("div.absolute.z-\\[61\\] button").allTextContents()).join(" | ")}`);
  await p.screenshot({ path: path.join(OUT, "filtres-02b-menu-recherche.png"), clip: { x: 0, y: 0, width: 1440, height: 760 } });

  // Filtre appliqué : coche le club civil (Grizzlis · ligue)
  await p.locator("div.absolute.z-\\[61\\] button", { hasText: "Grizzlis" }).first().click();
  // Ferme le menu par un clic dans le coin : au centre, la souris resterait sur une chip (survol trompeur).
  await p.locator("div.fixed.inset-0.z-\\[60\\]").click({ position: { x: 10, y: 10 } });
  await p.waitForTimeout(500);
  const kanbanFiltre = await p.getByText("Jetable", { exact: false }).locator("visible=true").count();
  note(`filtre Grizzlis appliqué — kanban : ${kanbanFiltre} carte(s) « Jetable » visibles ; bandeau : ${await compteur(p)}`);
  await p.screenshot({ path: path.join(OUT, "filtres-03-filtre-applique-kanban.png"), fullPage: false });
  await p.locator('button[title="Vue tableau"]').click();
  await p.waitForTimeout(800);
  const lignes = await p.locator("tbody tr:visible").count();
  note(`même filtre — vue tableau : ${lignes} ligne(s)`);
  await p.screenshot({ path: path.join(OUT, "filtres-04-filtre-applique-tableau.png"), fullPage: false });

  // Réinitialiser puis pastille Prospects
  await p.getByRole("button", { name: "Réinitialiser" }).click();
  await p.waitForTimeout(400);
  const lignesTout = await p.locator("tbody tr:visible").count();
  await p.getByRole("button", { name: "Prospects", exact: true }).click();
  await p.waitForTimeout(500);
  const lignesProspects = await p.locator("tbody tr:visible").count();
  note(`pastille Prospects — tableau : ${lignesProspects} ligne(s) sur ${lignesTout} ; bandeau : ${await compteur(p)}`);
  await p.locator('button[title="Vue kanban"]').click();
  await p.waitForTimeout(600);
  await p.screenshot({ path: path.join(OUT, "filtres-05-pastille-prospects.png"), fullPage: false });
  await p.getByRole("button", { name: "Sur Nexus", exact: true }).click();
  await p.waitForTimeout(500);
  note(`pastille Sur Nexus — kanban : ${await p.getByText("Jetable", { exact: false }).locator("visible=true").count()} carte(s) « Jetable » visibles ; bandeau : ${await compteur(p)}`);
  note(`erreurs de page : ${erreurs.length ? erreurs.join(" | ") : "aucune"}`);
} finally {
  if (ids.length) {
    const { error } = await svc.from("cartes_prospect").delete().in("id", ids);
    note(`cartes jetables retirées : ${error ? "ÉCHEC " + error.message : ids.length}`);
  }
  await nav.close();
  fs.writeFileSync(path.resolve("docs/import-laureats/captures-filtres-resultats.txt"), journal.join("\n") + "\n");
}
