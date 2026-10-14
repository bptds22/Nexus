// scripts/nls-basketball/geocoder-gymnases.mjs
// ============================================================================
// Géocodage des gymnases NLS pour la carte des matchs — MÊME chaîne que les
// terrains civils (scripts/carte-matchs-lot-b/) : Nominatim → CSV de revue
// pour BP → ecrire-lieux.mjs (transaction gardée vers lieux_geocodes).
// HORS APP, aucune écriture en base.
//
// La carte place un match sans GPS par public.lieu_normalise(games.venue) =
// lieux_geocodes.nom_normalise. Le lieu NLS garde son terrain dans `venue`
// (« École secondaire Dalbé-Viau (Court 1) » — pratique du football civil,
// field_number reste vide) : la clé porte donc le court, et chaque court
// d'un même gymnase reçoit LES MÊMES coordonnées (un seul bâtiment).
//
// Repères RSEQ : le point que le RSEQ publie déjà pour ce bâtiment
// (games.venue_lat / venue_lon, relevé local = prod le 2026-10-14), pour que
// BP compare. L'écart est donné en mètres.
//
//   node scripts/nls-basketball/geocoder-gymnases.mjs data/nls/matchs-AAAA-MM-JJ.json [sortie.csv]
//   → BP remplit valide_par_bp (oui | manuel), puis :
//   node scripts/carte-matchs-lot-b/ecrire-lieux.mjs <revue.csv> <sortie.sql>
// ============================================================================
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lieuNormalise } from "../carte-matchs-lot-b/normalise.mjs";

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const ENTREE = process.argv[2];
if (!ENTREE) { console.error("usage : geocoder-gymnases.mjs <matchs.json> [sortie.csv]"); process.exit(1); }
const SORTIE = process.argv[3] ?? path.join(RACINE, "data", "nls", "gymnases-revue.csv");
const UA = "Nexus-geocodage-terrains/1.0 (confidentialite@nexussports.ca)";

/** Le bâtiment : le lieu sans « (Court N) ». */
const batiment = (lieu) => lieu.replace(/\s*\(Court \d+\)\s*$/i, "").trim();

/** Point publié par le RSEQ pour le même bâtiment (libellé RSEQ entre parenthèses). */
const REPERES_RSEQ = {
  "École secondaire Dalbé-Viau": [45.442936, -73.67909, "École secondaire Dalbé-Viau"],
  "École secondaire Pointe-Aux-Trembles": [45.68561319, -73.495074582, "É. sec. de la Pointe-aux-Trembles"],
  "Cégep Bois de Boulogne": [45.53806, -73.675791, "Collège Bois-de-Boulogne"],
  "Collège St-Jean-Vianney": [45.692907, -73.519977, "Collège St-Jean-Vianney"],
};

/** Requête Nominatim par bâtiment : le nom officiel, à Montréal. */
const REQUETES = {
  "École secondaire Dalbé-Viau": "École secondaire Dalbé-Viau, Lachine, Montréal",
  "École secondaire Pointe-Aux-Trembles": "École secondaire de la Pointe-aux-Trembles, Montréal",
  "Cégep Bois de Boulogne": "Collège de Bois-de-Boulogne, Montréal",
  "Collège St-Jean-Vianney": "Collège Saint-Jean-Vianney, Montréal",
};

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
async function nominatim(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ca&accept-language=fr&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`Nominatim HTTP ${r.status} pour « ${q} »`);
  const [hit] = await r.json();
  return hit ?? null;
}

function metres(a, b) {
  const R = 6371000, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b[0] - a[0]), dLon = rad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[0])) * Math.cos(rad(b[0])) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

const { matchs } = JSON.parse(fs.readFileSync(ENTREE, "utf8"));
const lieux = new Map();
for (const m of matchs) lieux.set(m.lieu, (lieux.get(m.lieu) ?? 0) + 1);

const parBatiment = new Map();
for (const [lieu, n] of lieux) {
  const b = batiment(lieu);
  if (!REQUETES[b]) { console.error(`ARRÊT : gymnase inconnu « ${b} » (lieu « ${lieu} ») — ajouter sa requête et son repère`); process.exit(1); }
  const g = parBatiment.get(b) ?? { lieux: [], matchs: 0 };
  g.lieux.push([lieu, n]);
  g.matchs += n;
  parBatiment.set(b, g);
}

const csv = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const lignes = [["nom_normalise", "nom_affiche", "libelles_source", "matchs", "batiment", "requete", "adresse_trouvee",
  "type_osm", "lat", "lon", "point_rseq", "ecart_rseq_m", "google_maps", "valide_par_bp"].join(",")];
for (const [b, g] of parBatiment) {
  const requete = REQUETES[b];
  const hit = await nominatim(requete);
  await attendre(1100);
  const lat = hit ? Number(hit.lat) : null, lon = hit ? Number(hit.lon) : null;
  const [rLat, rLon, rNom] = REPERES_RSEQ[b];
  const ecart = hit ? metres([lat, lon], [rLat, rLon]) : "";
  console.log(`${b} : ${hit ? `${lat}, ${lon} — ${hit.display_name} [${hit.category}/${hit.type}] — écart RSEQ ${ecart} m` : "INTROUVABLE"}`);
  for (const [lieu, n] of g.lieux.sort()) {
    lignes.push([lieuNormalise(lieu), lieu, lieu, n, b, requete, hit?.display_name ?? "", hit ? `${hit.category}/${hit.type}` : "",
      lat ?? "", lon ?? "", `${rNom} (${rLat}, ${rLon})`, ecart,
      lat != null ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}` : "", "en_attente"].map(csv).join(","));
  }
}
fs.writeFileSync(SORTIE, "﻿" + lignes.join("\n") + "\n", "utf8");
console.log(`${lignes.length - 1} lieu(x), ${parBatiment.size} gymnase(s) → ${SORTIE} (valide_par_bp = en_attente)`);
