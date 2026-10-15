// Captures « grades D+ et E » — base LOCALE, navigateur SANS INTERFACE.
//   cd C:\tmp\nexus-laureats ; APP=http://localhost:3012 node docs/import-laureats/outils/captures-grades.mjs
// 9 cartes JETABLES (une par grade, prénom « Grade ») créées sous l'identité du recruteur de preuve
// (chemin de l'appli : le trigger fixe l'unité), retirées à la fin.
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
const GRADES = ["A+", "A", "B+", "B", "C+", "C", "D+", "D", "E"];
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

const ids = [];
const nav = await chromium.launch(); // headless
try {
  const s = await session(RECRUTEUR);
  const moi = createClient(API, ANON, { auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${s.access_token}` } } });
  const { data: equipe } = await svc.from("teams").select("id, name, sports!sport_id(nom)").eq("sports.nom", "Football").not("sports", "is", null).limit(1).single();
  for (const [i, g] of GRADES.entries()) {
    const { data, error } = await moi.from("cartes_prospect")
      .insert({ prenom: "Grade", nom: g, team_id: equipe.id, promotion: 2027, etape: "IDENTIFIE", grade: g, numero: String(i + 1) })
      .select("id, grade").single();
    if (error) throw new Error(`carte ${g} : ${error.message}`);
    ids.push(data.id);
  }
  note(`cartes jetables créées : ${ids.length} (${GRADES.join(" ")}), équipe ${equipe.name}`);
  const { error: eF } = await moi.from("cartes_prospect").insert({ prenom: "Grade", nom: "F", team_id: equipe.id, promotion: 2027, etape: "IDENTIFIE", grade: "F" });
  note(`grade « F » refusé par la base : ${eF ? "oui — " + eF.message.slice(0, 80) : "NON"}`);

  const ctx = await nav.newContext({ viewport: { width: 1440, height: 1000 }, locale: "fr-CA" });
  await ctx.addCookies(cookies(s));
  const p = await ctx.newPage();
  const erreurs = [];
  p.on("pageerror", (e) => erreurs.push(e.message));
  await p.goto(`${APP}/recruteur/pipeline`, { waitUntil: "networkidle" });
  await p.getByText("GRADE E", { exact: false }).first().waitFor({ timeout: 20000 }).catch(() => {});
  await p.waitForTimeout(1500);
  const puces = await p.locator('span[title^="Ton grade"]:visible').allTextContents();
  note(`puces de grade rendues sur le pipeline : ${puces.join(" ")}`);
  await p.screenshot({ path: path.join(OUT, "01-pipeline-9-grades.png"), fullPage: false });

  // Gros plan sur les cartes D+ et E (la puce VISIBLE ; une seconde copie est masquée)
  for (const g of ["D+", "E"]) {
    const puce = p.locator('span[title="Ton grade : ' + g + '"]:visible').first();
    await puce.scrollIntoViewIfNeeded();
    const boite = await puce.evaluate((el) => {
      let n = el; while (n && n.getBoundingClientRect().height < 150) n = n.parentElement;
      const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    await p.screenshot({ path: path.join(OUT, `02-carte-${g === "D+" ? "D-plus" : "E"}.png`),
      clip: { x: Math.max(0, boite.x - 8), y: Math.max(0, boite.y - 8), width: boite.width + 16, height: boite.height + 16 } });
    note(`gros plan carte ${g} : ok (${Math.round(boite.width)}×${Math.round(boite.height)})`);
  }

  // Le picker à 9 crans, dans le panneau de la carte E
  await p.locator('span[title="Ton grade : E"]:visible').first().click();
  await p.locator('button[aria-label="Grade E"]:visible').first().waitFor({ timeout: 10000 });
  const boutons = await p.locator('button[aria-label^="Grade "]:visible').evaluateAll((bs) => bs.map((b) => b.getAttribute("aria-label").slice(6) + (b.getAttribute("aria-pressed") === "true" ? "*" : "")));
  note(`picker : ${boutons.join(" ")}   (* = sélectionné)`);
  await p.waitForTimeout(1200); // fin de l'animation slideIn
  await p.screenshot({ path: path.join(OUT, "03-panneau-picker-9-grades.png"), clip: { x: 1020, y: 0, width: 420, height: 420 } });
  note(`erreurs de page : ${erreurs.length ? erreurs.join(" | ") : "aucune"}`);
} finally {
  if (ids.length) {
    const { error } = await svc.from("cartes_prospect").delete().in("id", ids);
    note(`cartes jetables retirées : ${error ? "ÉCHEC " + error.message : ids.length}`);
  }
  await nav.close();
  fs.writeFileSync(path.resolve("docs/import-laureats/captures-resultats.txt"), journal.join("\n") + "\n");
}
