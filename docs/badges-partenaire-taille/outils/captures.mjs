// Section badges de la fiche athlète — captures AVANT / APRÈS, base LOCALE, navigateur SANS INTERFACE.
//   cd C:\tmp\nexus-w4bc ; APP=http://localhost:3011 node docs/badges-partenaire-taille/outils/captures.mjs avant|apres|corrige
// Préparation TEMPORAIRE par service_role (refuse toute URL non locale), sur Félix Gauthier (fictif) :
//   - deux badges PROPRES au partenaire « Média Preuve » : un LARGE (« ES », 2,3:1) et un carré ;
//   - un badge NEXUS (« vitesse ») posé par le même partenaire (W3b) ;
// puis tout est retiré (poses, badges, icônes) et l'opt-in partenaire de Félix est remis.
// Sessions réelles par lien magique (aucun mot de passe touché).
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
if (!/^http:\/\/localhost/.test(APP)) throw new Error("APP pas local");
const ETAPE = ["apres", "corrige"].includes(process.argv[2]) ? process.argv[2] : "avant";
const OUT = path.resolve("docs/badges-partenaire-taille/captures");
fs.mkdirSync(OUT, { recursive: true });
const svc = createClient(API, SERVICE, { auth: { persistSession: false } });
const journal = [];
const note = (...a) => { const l = a.join(" "); journal.push(l); console.log(l); };

async function cookies(email) {
  const h = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
  const g = await (await fetch(`${API}/auth/v1/admin/generate_link`, { method: "POST", headers: h, body: JSON.stringify({ type: "magiclink", email }) })).json();
  const s = await (await fetch(`${API}/auth/v1/verify`, { method: "POST", headers: h, body: JSON.stringify({ type: "magiclink", email, token: g.email_otp ?? g.properties?.email_otp }) })).json();
  if (!s.access_token) throw new Error(`session ${email}`);
  const v = "base64-" + Buffer.from(JSON.stringify(s)).toString("base64url");
  const m = v.match(/.{1,3180}/g);
  return (m.length === 1 ? [{ name: "sb-127-auth-token", value: v }] : m.map((x, i) => ({ name: `sb-127-auth-token.${i}`, value: x })))
    .map((c) => ({ ...c, domain: "localhost", path: "/" }));
}

const uid = async (email) => (await svc.from("users").select("id").eq("email", email).single()).data.id;
const P1 = await uid("p1.partenaire@preuve.local");
const FELIX_U = await uid("felix.gauthier@exemple.test");
const felix = (await svc.from("athletes").select("id, partner_visibility_opt_in").eq("user_id", FELIX_U).single()).data;
const mp1 = (await svc.from("media_partners").select("id").eq("user_id", P1).single()).data;
const vitesse = (await svc.from("badges").select("id").eq("code", "vitesse").single()).data;
const nav = await chromium.launch(); // headless
const crees = { badges: [], poses: [], icones: [] };

// Icônes générées dans le navigateur (PNG transparents).
async function icone(largeur, hauteur, dessin) {
  const p = await nav.newPage();
  const b64 = await p.evaluate(([w, h, d]) => {
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const g = c.getContext("2d");
    new Function("g", "w", "h", d)(g, w, h);
    return c.toDataURL("image/png").split(",")[1];
  }, [largeur, hauteur, dessin]);
  await p.close();
  return Buffer.from(b64, "base64");
}
const LARGE = await icone(460, 200, `
  g.fillStyle = "#E63946"; g.beginPath(); g.roundRect(4, 4, w - 8, h - 8, 40); g.fill();
  g.fillStyle = "#FFFFFF"; g.font = "900 150px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("ES", w / 2, h / 2 + 8);`);
const CARRE = await icone(256, 256, `
  g.fillStyle = "#F59E0B"; g.beginPath(); g.moveTo(128, 12); g.lineTo(232, 58); g.lineTo(214, 172); g.lineTo(128, 244); g.lineTo(42, 172); g.lineTo(24, 58); g.closePath(); g.fill();
  g.fillStyle = "#111317"; g.font = "bold 96px sans-serif"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText("MP", 128, 128);`);

try {
  await svc.from("athletes").update({ partner_visibility_opt_in: true }).eq("id", felix.id);
  for (const [libelle, png, nom] of [["Esprit sportif", LARGE, "large"], ["Coup de cœur", CARRE, "carre"]]) {
    const chemin = `${mp1.id}/capture-${nom}-${Date.now()}.png`;
    const { error: eu } = await svc.storage.from("partner-badges").upload(chemin, png, { contentType: "image/png" });
    if (eu) throw eu;
    crees.icones.push(chemin);
    const { data: pb, error } = await svc.from("partner_badges")
      .insert({ partner_id: mp1.id, libelle, icone_path: chemin, actif: true, ordre: crees.badges.length, cree_par: P1 }).select("id").single();
    if (error) throw error;
    crees.badges.push(pb.id);
    const { data: pose, error: ep } = await svc.from("partner_athlete_badges")
      .insert({ partner_badge_id: pb.id, athlete_id: felix.id, attribue_par: P1, partner_id: mp1.id }).select("id").single();
    if (ep) throw ep;
    crees.poses.push(pose.id);
  }
  const { data: poseN, error: en } = await svc.from("partner_athlete_badges")
    .insert({ badge_id: vitesse.id, athlete_id: felix.id, attribue_par: P1, partner_id: mp1.id }).select("id").single();
  if (en) throw en;
  crees.poses.push(poseN.id);

  const vues = [
    ["recruteur", "test1@preuve.local", `/recruteur/athletes/${felix.id}`],
    ["coach", "marc.desrosiers@exemple.test", `/coach/athletes/${felix.id}`],
    ["partenaire", "p1.partenaire@preuve.local", `/partenaire/athletes/${felix.id}`],
    ["athlete-profil", "felix.gauthier@exemple.test", `/athlete/profil`],
    ["athlete-apercu", "felix.gauthier@exemple.test", `/athlete/profil/apercu`],
  ];
  const formats = [["bureau", { width: 1440, height: 1000 }], ["tablette", { width: 820, height: 1180 }], ["mobile", { width: 390, height: 844 }]];
  for (const [nom, email, route] of vues) {
    const ck = await cookies(email);
    for (const [fmt, vp] of formats) {
      const c = await nav.newContext({ viewport: vp, deviceScaleFactor: fmt === "mobile" ? 2 : 1, isMobile: fmt === "mobile", hasTouch: fmt === "mobile", locale: "fr-CA" });
      await c.addCookies(ck);
      const p = await c.newPage();
      const erreurs = [];
      p.on("pageerror", (e) => erreurs.push(e.message));
      await p.goto(`${APP}${route}`, { waitUntil: "networkidle" });
      const badge = p.locator("[data-badge-partenaire]").first();
      try { await badge.waitFor({ timeout: 20000 }); } catch { note(`${ETAPE} ${nom} ${fmt} : AUCUN badge partenaire visible`); await c.close(); continue; }
      await p.waitForTimeout(1200);
      // La rangée = le parent commun des badges ; on la fait défiler à l'écran puis on la photographie.
      const rangee = badge.locator("xpath=..");
      await rangee.scrollIntoViewIfNeeded();
      const mesure = await p.evaluate(() => {
        const vs = [...document.querySelectorAll("[data-badge-partenaire]")].filter((e) => e.offsetParent);
        const r = vs[0]?.parentElement?.getBoundingClientRect();
        return {
          page: document.documentElement.scrollWidth, ecran: document.documentElement.clientWidth,
          rangee: r ? Math.round(r.width) : null,
          boites: vs.map((v) => { const i = v.querySelector(".nx-badge"); const b = i?.getBoundingClientRect(); return b ? `${Math.round(b.width)}×${Math.round(b.height)}` : "?"; }),
          lignes: vs.map((v) => v.innerText.replace(/\s+/g, " ").trim()),
        };
      });
      note(`${ETAPE} ${nom} ${fmt} : page ${mesure.page}/${mesure.ecran}${mesure.page > mesure.ecran ? " ← DÉBORDE" : ""} | boîtes ${mesure.boites.join(", ")} | textes ${JSON.stringify(mesure.lignes)}${erreurs.length ? " | ERREURS JS " + JSON.stringify(erreurs) : ""}`);
      await rangee.screenshot({ path: path.join(OUT, `${ETAPE}-${nom}-${fmt}.png`) });
      await c.close();
    }
  }
} finally {
  if (crees.poses.length) await svc.from("partner_athlete_badges").delete().in("id", crees.poses);
  if (crees.badges.length) await svc.from("partner_badges").delete().in("id", crees.badges);
  if (crees.icones.length) await svc.storage.from("partner-badges").remove(crees.icones);
  await svc.from("athletes").update({ partner_visibility_opt_in: felix.partner_visibility_opt_in }).eq("id", felix.id);
  note(`${ETAPE} remise en état : ${crees.poses.length} poses, ${crees.badges.length} badges, ${crees.icones.length} icônes retirés ; opt-in remis à ${felix.partner_visibility_opt_in}`);
  fs.appendFileSync(path.resolve("docs/badges-partenaire-taille/captures-resultats.txt"), journal.join("\n") + "\n");
  await nav.close();
}
