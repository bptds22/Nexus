// Export LECTURE SEULE (GET) des tables publiques RSEQ de la prod vers des .ndjson, pour la base jetable nexus_b2.
// Aucune table personnelle (athletes, users, cartes…). Usage : node export-prod.mjs <dossier_sortie>
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

const OUT = process.argv[2];
mkdirSync(OUT, { recursive: true });
const env = Object.fromEntries(readFileSync("C:/Users/bptds/Documents/Nexus/.env.local.prod", "utf8")
  .split(/\r?\n/).map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)).filter(Boolean)
  .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]));
const URL = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (URL !== "https://nrloizyemulbhujrqhgx.supabase.co" || !KEY) { console.error("ABORT cible"); process.exit(1); }

const TOUTES = ["sports", "schools", "teams", "games", "rseq_sync_runs", "rseq_sync_alerts", "rseq_watch_leagues",
                "rseq_standings", "lieux_geocodes", "rseq_ligues_publiees"];
// node export-prod.mjs <dossier> [table…] : sans liste, toutes.
const TABLES = process.argv.length > 3 ? process.argv.slice(3) : TOUTES;
const PAGE = 1000;
for (const t of TABLES) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const r = await fetch(`${URL}/rest/v1/${t}?select=*&order=${t === "lieux_geocodes" ? "nom_normalise" : t === "rseq_ligues_publiees" ? "rseq_league_id,saison" : "id"}`, {
      method: "GET",
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${from + PAGE - 1}`, "Range-Unit": "items" },
    });
    if (!r.ok) { console.error(t, r.status, await r.text()); process.exit(1); }
    const page = await r.json();
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  writeFileSync(path.join(OUT, `${t}.ndjson`), rows.map((x) => JSON.stringify(x)).join("\n") + "\n", "utf8");
  console.log(t, rows.length);
}
