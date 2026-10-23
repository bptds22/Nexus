// QG admin, lot 1 — preuves d'API sur la base LOCALE.
//   node preuves-api.mjs <port ancien code> <port nouveau code> <dossier de sortie>
// 1. /api/admin/ecran : ancien code (main) vs nouveau, mêmes données, au même
//    moment → identiques, sauf calcule_le / fenetres (l'heure) et la tuile v2.
// 2. /api/admin/qg?periode=jour|semaine|mois (admin) → reponse-qg-<g>.json.
// 3. 401 (anonyme) et 403 (coach) avec le corps exact, sur les deux routes.
import { writeFileSync } from "node:fs";
import { cookiesSession, enTete, ENV } from "./session-locale.mjs";

const [, , portAncien, portNouveau, sortie] = process.argv;
const journal = [];
const note = (l) => { journal.push(l); console.log(l); };

const admin = enTete(await cookiesSession("admin@demo.local"));
// Un coach local, trouvé par requête (son adresse ne sort pas d'ici).
const coachs = await fetch(`${ENV.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/users?role=eq.COACH&select=email&order=created_at.asc&limit=1`, {
  headers: { apikey: ENV.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${ENV.SUPABASE_SERVICE_ROLE_KEY}` },
}).then((r) => r.json());
const coach = enTete(await cookiesSession(coachs[0].email));

const lire = async (port, chemin, cookie) => {
  const r = await fetch(`http://localhost:${port}${chemin}`, { headers: cookie ? { cookie } : {} });
  return { status: r.status, texte: await r.text() };
};

// ── 1. Identité de /api/admin/ecran ──
const [ancien, nouveau] = await Promise.all([lire(portAncien, "/api/admin/ecran", admin), lire(portNouveau, "/api/admin/ecran", admin)]);
const a = JSON.parse(ancien.texte);
const n = JSON.parse(nouveau.texte);
const sansHeure = (x) => { const c = structuredClone(x); delete c.calcule_le; delete c.fenetres; delete c.files.consentements_v2; return c; };
const identique = JSON.stringify(sansHeure(a)) === JSON.stringify(sansHeure(n));
note(`ecran : ancien ${ancien.status}, nouveau ${nouveau.status}`);
note(`ecran : réponses identiques hors calcule_le, fenetres et files.consentements_v2 → ${identique ? "OUI" : "NON"}`);
note(`ecran : consentements_v2 ancien  = ${JSON.stringify(a.files.consentements_v2)}`);
note(`ecran : consentements_v2 nouveau = ${JSON.stringify(n.files.consentements_v2)}`);
note(`ecran : clés de premier niveau identiques → ${JSON.stringify(Object.keys(a)) === JSON.stringify(Object.keys(n)) ? "OUI" : "NON"}`);
writeFileSync(`${sortie}/ecran-ancien.json`, JSON.stringify(a, null, 2));
writeFileSync(`${sortie}/ecran-nouveau.json`, JSON.stringify(n, null, 2));

// ── 2. Le QG, trois périodes ──
for (const g of ["jour", "semaine", "mois"]) {
  const r = await lire(portNouveau, `/api/admin/qg?periode=${g}`, admin);
  note(`qg ${g} : ${r.status}, ${r.texte.length} octets`);
  writeFileSync(`${sortie}/reponse-qg-${g}.json`, JSON.stringify(JSON.parse(r.texte), null, 2));
}

// ── 3. Refus, corps exact ──
for (const chemin of ["/api/admin/qg?periode=jour", "/api/admin/ecran"]) {
  const anon = await lire(portNouveau, chemin);
  note(`anonyme : GET ${chemin} → ${anon.status} ${anon.texte}`);
  const c = await lire(portNouveau, chemin, coach);
  note(`coach : GET ${chemin} → ${c.status} ${c.texte}`);
}
writeFileSync(`${sortie}/preuves-api.txt`, journal.join("\n") + "\n");
