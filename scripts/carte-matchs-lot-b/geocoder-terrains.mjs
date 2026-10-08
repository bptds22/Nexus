// Géocodage des terrains CIVILS de la carte des matchs (lot B, décision 8).
// HORS APP, lecture seule : aucune écriture en base. Sortie : un CSV de revue
// pour BP (nom, adresse trouvée, lat, lon, lien Google Maps). Les lignes
// validées sont écrites ensuite par ecrire-lieux.mjs (transaction gardée).
//
//   node scripts/carte-matchs-lot-b/geocoder-terrains.mjs [entrée.json] [sortie.csv]
//
// Nominatim (OSM), comme pour schools.lat/lng : 1 requête par seconde au plus,
// User-Agent identifiable (politique d'usage OSM). La clé MapTiler publique
// est restreinte par domaine : on ne l'utilise pas ici.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lieuNormalise } from "./normalise.mjs";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const ENTREE = process.argv[2] ?? path.join(ICI, "terrains-civils.json");
const SORTIE = process.argv[3] ?? path.join(ICI, "terrains-civils-revue.csv");
const UA = "Nexus-geocodage-terrains/1.0 (confidentialite@nexussports.ca)";

/** Ce qu'on demande à Nominatim : le nom sans « (Main) », sans numéro de
 *  terrain « (1) » / « #2 », sans le sous-terrain après « - ». */
function requeteDe(nom) {
  return nom.replace(/\(main\)/i, "").replace(/\(\d+\)/, "").replace(/#\d+/, "")
    .split(" - ")[0].replace(/\s+/g, " ").trim();
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
async function nominatim(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ca&accept-language=fr&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`Nominatim HTTP ${r.status} pour « ${q} »`);
  const [hit] = await r.json();
  return hit ?? null;
}

const terrains = JSON.parse(fs.readFileSync(ENTREE, "utf8"));
// Regroupe par clé : deux libellés de la même clé = un seul terrain.
const parCle = new Map();
for (const t of terrains) {
  const cle = lieuNormalise(t.venue);
  const g = parCle.get(cle) ?? { cle, libelles: [], matchs: 0, ligues: new Set(), domicile: t.domicile };
  g.libelles.push(t.venue);
  g.matchs += t.matchs;
  t.ligues.split(",").forEach((l) => g.ligues.add(l));
  parCle.set(cle, g);
}

const csv = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
const lignes = [["nom_normalise", "nom_affiche", "libelles_source", "matchs", "ligues", "equipe_domicile",
  "requete", "adresse_trouvee", "type_osm", "lat", "lon", "hors_quebec", "google_maps", "valide_par_bp"].join(",")];
let trouves = 0;
for (const g of parCle.values()) {
  const base = requeteDe(g.libelles[0]);
  let hit = null, requete = "";
  for (const q of [`${base}, Québec, Canada`, `${base}, Canada`]) {
    requete = q;
    hit = await nominatim(q);
    await attendre(1100);
    if (hit) break;
  }
  const lat = hit ? Number(hit.lat).toFixed(6) : "";
  const lon = hit ? Number(hit.lon).toFixed(6) : "";
  const horsQc = hit ? !/Québec|Quebec/i.test(hit.display_name) : "";
  if (hit) trouves++;
  lignes.push([
    csv(g.cle), csv(base), csv(g.libelles.join(" | ")), g.matchs, csv([...g.ligues].join(",")), csv(g.domicile),
    csv(requete), csv(hit?.display_name ?? "INTROUVABLE"), csv(hit ? `${hit.category}/${hit.type}` : ""),
    lat, lon, horsQc === "" ? "" : horsQc ? "oui" : "non",
    csv(hit ? `https://www.google.com/maps/search/?api=1&query=${lat},${lon}` : ""), "",
  ].join(","));
  console.log(`${hit ? "✓" : "✗"} ${g.cle.padEnd(40)} → ${hit ? `${lat}, ${lon} · ${hit.display_name.slice(0, 90)}` : "introuvable"}`);
}
fs.writeFileSync(SORTIE, "﻿" + lignes.join("\r\n") + "\r\n", "utf8");
console.log(`\n${terrains.length} libellés → ${parCle.size} terrains · ${trouves} trouvés · ${parCle.size - trouves} introuvables → ${SORTIE}`);
