// scripts/compile-cegep-programs-prives.mjs
// ============================================================================
// Compilation ASSISTÉE + CURÉE des programmes des collèges privés absents de
// lecegep.ca (portail Fédération des cégeps = publics only).
//
// Extraction par liens-texte (sites bespoke) PUIS curation :
//   - canonicalisation : variantes (PLUS/Xtra/BI) et profils (« – Psychologie »,
//     « profil X », « : option X », « générales/distinction/Bilingue ») fusionnés
//     avec le programme DEC parent ;
//   - denylist des parasites (« Lire plus », centres de recherche, « Double DEC »,
//     « École de musique », headers de catégorie) ;
//   - type préuni/technique corrigé par mots-clés ;
//   - cross-ref CODE DEC depuis data/import/cegep_programs.json (lecegep) : si le
//     nom canonique matche (normalisé) un programme public, on hérite son code
//     (le code valide le nom).
//
// Sortie : data/import/cegep_programs_prives.json — MÊME FORMAT que lecegep.
// Sites résistants (JS/injoignables) rapportés, NON inventés.
// Node 18+. Délai 0.8s. Exit 1 si vide. JSON ONLY.
// ============================================================================
import { writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const UA = "Mozilla/5.0 (compatible; Nexus-Research/1.0; research scrape for nexussports.ca)";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "data/import/cegep_programs_prives.json");
const LECEGEP = path.join(ROOT, "data/import/cegep_programs.json");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const SITES = [
  { institution: "Collège André-Grasset", region: "Montréal", url: "https://www.grasset.qc.ca/programmes" },
  { institution: "Collège Jean-de-Brébeuf", region: "Montréal", url: "https://www.brebeuf.qc.ca/" },
  { institution: "Collège Marianopolis", region: "Montréal", url: "https://www.marianopolis.edu/fr/" },
  { institution: "Collège Laflèche", region: "Mauricie", url: "https://clafleche.qc.ca/" },
  { institution: "Séminaire de Sherbrooke", region: "Estrie", url: "https://www.seminaire-sherbrooke.qc.ca/collegial/" },
  { institution: "Campus Notre-Dame-de-Foy", region: "Capitale-Nationale", url: "https://www.cndf.ca/programmes/" },
];

// VOCABULAIRE CANONIQUE : chaque candidat (même noyé dans du bruit de menu) est
// mappé vers son programme DEC standard. Élimine variantes/profils/parasites en
// une passe (on n'émet QUE des entrées reconnues — pas d'invention).
const VOCAB = [
  // préuniversitaires
  [/sciences,?\s+informatique et math/i, "Sciences, informatique et mathématiques", "P"],
  [/sciences,?\s+lettres et arts/i, "Sciences, lettres et arts", "P"],
  [/sciences de la nature/i, "Sciences de la nature", "P"],
  [/sciences humaines/i, "Sciences humaines", "P"],
  [/arts,?\s+lettres et communication/i, "Arts, lettres et communication", "P"],
  [/arts visuels/i, "Arts visuels", "P"],
  [/histoire et civilisation/i, "Histoire et civilisation", "P"],
  [/danse/i, "Danse", "P"],
  [/professionnelles? de musique|musique et chanson/i, "Techniques professionnelles de musique et chanson", "T"],
  [/\bmusique\b/i, "Musique", "P"],
  [/tremplin dec/i, "Tremplin DEC", "P"],
  // techniques
  [/techniques? de tourisme/i, "Techniques de tourisme", "T"],
  [/commercialisation de la mode/i, "Techniques de commercialisation de la mode", "T"],
  [/gestion h[oô]teli[eè]re/i, "Techniques de gestion hôtelière", "T"],
  [/[ée]ducation [aà] l['’ ]enfance/i, "Techniques d'éducation à l'enfance", "T"],
  [/[ée]ducation sp[ée]cialis/i, "Techniques d'éducation spécialisée", "T"],
  [/archives m[ée]dicales/i, "Techniques d'archives médicales", "T"],
  [/sant[ée] animale/i, "Techniques de santé animale", "T"],
  [/radiodiagnostic|radiologie/i, "Technologie de radiodiagnostic", "T"],
  [/intervention en criminologie/i, "Techniques d'intervention en criminologie", "T"],
  [/juridiques/i, "Techniques juridiques", "T"],
  [/s[ée]curit[ée] incendie/i, "Techniques de sécurité incendie", "T"],
  [/thanatolog/i, "Techniques de thanatologie", "T"],
  [/polici[eè]res/i, "Techniques policières", "T"],
  [/intervention en milieu correctionnel/i, "Techniques d'intervention en milieu correctionnel", "T"],
  [/s[ée]curit[ée] civile/i, "Techniques de sécurité civile", "T"],
  [/soins infirmiers/i, "Soins infirmiers", "T"],
];
const norm = (s) => s.normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** noyau DEC dans une chaîne (menu concaténé inclus) → {name, type} canonique, ou null */
function canonProgram(raw) {
  for (const [re, name, t] of VOCAB) if (re.test(raw)) return { name, type: t === "T" ? "technique" : "préuniversitaire" };
  return null;
}

async function loadLecegepCodes() {
  const arr = JSON.parse(await readFile(LECEGEP, "utf-8"));
  const map = new Map(); // norm(canonical name) -> code DEC
  for (const inst of arr) for (const p of inst.programs) {
    const cp = canonProgram(p.name.replace(/^DEC\s+/i, ""));
    if (cp && p.code && !map.has(norm(cp.name))) map.set(norm(cp.name), p.code);
  }
  return map;
}

async function scrape(url) {
  await sleep(800);
  const html = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow", signal: AbortSignal.timeout(20000) }).then((r) => r.text());
  return [...html.matchAll(/<a[^>]*>(.*?)<\/a>/gis)].map((m) =>
    m[1].replace(/<[^>]+>/g, "").replace(/&#8217;|&rsquo;|&#039;|&#39;/g, "'").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim(),
  );
}

async function main() {
  const codes = await loadLecegepCodes();
  const result = [];
  for (const s of SITES) {
    let links = [];
    try { links = await scrape(s.url); } catch (e) { console.error(`  ${s.institution} FETCH FAIL: ${e.message}`); }
    const seen = new Set(), programs = [];
    for (const raw of links) {
      if (!raw || raw.length < 5 || raw.length > 130) continue;
      const cp = canonProgram(raw);
      if (!cp) continue;
      const k = norm(cp.name);
      if (seen.has(k)) continue;
      seen.add(k);
      programs.push({ name: cp.name, code: codes.get(k) ?? null, type: cp.type });
    }
    programs.sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name, "fr"));
    console.log(`${programs.length ? "✅" : "⚠️ "} ${s.institution} — ${programs.length} programmes (${programs.filter((p) => p.code).length} avec code)`);
    programs.forEach((p) => console.log(`     [${p.type[0].toUpperCase()}] ${p.name}${p.code ? " — " + p.code : ""}`));
    if (programs.length) result.push({ institution: s.institution, region: s.region, programs });
  }
  const total = result.reduce((n, r) => n + r.programs.length, 0);
  if (total === 0) { console.error("Zéro programme — fichier NON écrit."); process.exit(1); }
  await writeFile(OUT, JSON.stringify(result, null, 1) + "\n", "utf-8");
  const withCode = result.reduce((n, r) => n + r.programs.filter((p) => p.code).length, 0);
  console.log(`\n=== ${OUT} écrit ===`);
  console.log(`établissements: ${result.length} | programmes: ${total} | avec code DEC (cross-ref lecegep): ${withCode}`);
  console.log(`RÉSISTENT (à faire au navigateur, non inventés): Collège Stanislas · Collégial international Sainte-Anne · Mérici Collégial Privé.`);
}
main().catch((e) => { console.error("FATAL:", e.message); process.exit(1); });
