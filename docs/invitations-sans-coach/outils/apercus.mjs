// Aperçus des messages d'invitation (courriels + page /claim) — base LOCALE, navigateur SANS INTERFACE.
//   cd C:\tmp\nexus-w4bc ; APP=http://localhost:3011 node --experimental-strip-types docs/invitations-sans-coach/outils/apercus.mjs
// Les courriels sont rendus par les VRAIS gabarits des fonctions d'envoi (Deno simulé, aucune clé).
// /claim : une fiche orpheline et une invitation JETABLES (aucun secret d'envoi en local : rien ne
// part), d'abord sans suivi, puis suivie par 2 recruteurs ; tout est retiré à la fin.
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
const OUT = path.resolve("docs/invitations-sans-coach/apercus");
fs.mkdirSync(OUT, { recursive: true });
const journal = [];
const note = (...a) => { const l = a.join(" "); journal.push(l); console.log(l); };

const reclamation = await import(pathToFileURL(path.resolve("supabase/functions/send-invitation/email.ts")).href);
const equipe = await import(pathToFileURL(path.resolve("supabase/functions/send-team-invitation/email.ts")).href);
const fichiers = [];
for (const n of [0, 1, 4]) {
  const { html, text } = reclamation.buildBody(n, "https://nexussports.ca/claim?token=EXEMPLE");
  const nom = `courriel-reclamation-${n}-recruteur${n > 1 ? "s" : ""}`;
  fs.writeFileSync(path.join(OUT, `${nom}.html`), html);
  fs.writeFileSync(path.join(OUT, `${nom}.txt`), `Objet : ${reclamation.SUJET}\nDe : Nexus <info@nexussports.ca>\n\n${text}\n`);
  fichiers.push(nom);
}
{
  const { html, text } = equipe.buildBody("Les Dragons", "École secondaire des Érables",
    { sport: "Football", ageGroup: "Juvénile", division: "D2", gender: "Masculin" },
    "https://nexussports.ca/athlete/transfert?t=EXEMPLE");
  fs.writeFileSync(path.join(OUT, "courriel-equipe.html"), html);
  fs.writeFileSync(path.join(OUT, "courriel-equipe.txt"), `Objet : ${equipe.SUJET}\nDe : Nexus <info@nexussports.ca>\n\n${text}\n`);
  fichiers.push("courriel-equipe");
}

const nav = await chromium.launch(); // headless
const erreurs = [];
const ids = { athlete: null, token: "apercu-claim-" + Date.now(), recruteurs: [] };
try {
  for (const f of fichiers) {
    for (const [suffixe, vp] of [["bureau", { width: 720, height: 1100 }], ["mobile", { width: 390, height: 900 }]]) {
      const c = await nav.newContext({ viewport: vp, deviceScaleFactor: suffixe === "mobile" ? 2 : 1 });
      const p = await c.newPage();
      await p.goto(pathToFileURL(path.join(OUT, `${f}.html`)).href);
      await p.screenshot({ path: path.join(OUT, `${f}-${suffixe}.png`), fullPage: true });
      await c.close();
    }
  }
  note("courriels rendus :", fichiers.join(", "));

  // ── /claim : fiche orpheline jetable ────────────────────────────────────────
  const { data: coach } = await svc.from("users").select("id, school_id").eq("email", "marc.desrosiers@exemple.test").single();
  const { data: a, error: ea } = await svc.from("athletes").insert({
    first_name: "Inès", last_name: "Aperçu", date_naissance: "2007-04-04", coach_id: coach.id, school_id: coach.school_id,
    email: "ines.apercu.claim@exemple.test", status: "ACTIF", verified: false, annee_diplomation: 2025,
  }).select("id").single();
  if (ea) throw ea;
  ids.athlete = a.id;
  const { error: ei } = await svc.from("athlete_invitations").insert({ token: ids.token, athlete_id: a.id, created_by: coach.id });
  if (ei) throw ei;
  async function capturer(etiquette) {
    for (const [suffixe, ctx] of [["bureau", { viewport: { width: 1280, height: 900 } }], ["mobile", { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]]) {
      const c = await nav.newContext({ ...ctx, locale: "fr-CA" });
      const p = await c.newPage();
      p.on("pageerror", (e) => erreurs.push(e.message));
      await p.goto(`${APP}/claim?token=${encodeURIComponent(ids.token)}`, { waitUntil: "networkidle" });
      await p.waitForSelector("[data-phrase-recruteurs]", { timeout: 30000 });
      if (suffixe === "bureau") note(`/claim (${etiquette}) :`, JSON.stringify(await p.locator("[data-phrase-recruteurs]").innerText()),
        "| « entraîneur » ou « coach » dans la page :", /entra[iî]neur|coach/i.test(await p.locator("body").innerText()));
      await p.screenshot({ path: path.join(OUT, `claim-${etiquette}-${suffixe}.png`), fullPage: true });
      await c.close();
    }
  }
  await capturer("0-recruteur");
  const { data: recs } = await svc.from("users").select("id").eq("role", "RECRUTEUR").eq("status", "ACTIF").limit(2);
  for (const r of recs) {
    await svc.from("recruiter_favorites").insert({ recruiter_id: r.id, athlete_id: a.id });
    ids.recruteurs.push(r.id);
  }
  await capturer("2-recruteurs");
} finally {
  if (ids.athlete) {
    await svc.from("recruiter_favorites").delete().eq("athlete_id", ids.athlete);
    await svc.from("recruiter_pipeline").delete().eq("athlete_id", ids.athlete);
    await svc.from("athlete_invitations").delete().eq("athlete_id", ids.athlete);
    const { error } = await svc.from("athletes").delete().eq("id", ids.athlete);
    note("remise en état : fiche jetable retirée :", error ? "ERREUR " + error.message : "oui");
  }
  note("erreurs JavaScript :", erreurs.length ? JSON.stringify(erreurs) : "aucune");
  fs.writeFileSync(path.resolve("docs/invitations-sans-coach/apercus-resultats.txt"), journal.join("\n") + "\n");
  await nav.close();
}
