// Terrains civils — CSV FINAL après la revue de BP (2026-10-08).
// HORS APP, aucune écriture en base : lit le CSV de revue, applique les
// décisions de BP, géocode les adresses qu'il a données (Nominatim) et écrit
// terrains-civils-final.csv, que lit ecrire-lieux.mjs.
//
//   node scripts/carte-matchs-lot-b/geocoder-corrections.mjs
//
// Décisions appliquées :
//   · les 19 « Semble juste » + les 2 de l'Ontario → valide_par_bp = oui (source nominatim) ;
//   · les corrections → valide_par_bp = manuel (source manuel), adresse donnée par BP géocodée ;
//   · Parc des Bénévoles et Glenn F. McHugh → les coordonnées que le RSEQ a déjà en base ;
//   · D'Arcy McGee (Gatineau) → CONFIRMÉ par BP (2026-10-08 bis), géocodé ; Stade Hébert,
//     Claude-Robillard, Gerry-Dattilio → POINT RSEQ (décision BP 2026-10-08 bis) ;
//   · (historique) D'Arcy McGee était d'abord géocodé, MONTRÉ, NON inclus (valide_par_bp = en_attente)
//     tant que BP ne l'a pas confirmé.
// Règle : un terrain non confirmé reste « Lieu non précisé » ; jamais un point deviné.
// Chaque point géocodé est comparé au point que le RSEQ a déjà pour le même lieu
// quand il existe (relevé prod en lecture seule, 2026-10-08).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lireCsv } from "./csv.mjs";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const REVUE = path.join(ICI, "terrains-civils-revue.csv");
const SORTIE = path.join(ICI, "terrains-civils-final.csv");
const UA = "Nexus-geocodage-terrains/1.0 (confidentialite@nexussports.ca)";

/** Points RSEQ déjà en base (games.venue_lat / venue_lon), relevés en prod. */
const RSEQ = {
  stade_hebert: { venue: "Stade Hébert", lat: 45.5739577, lon: -73.5950628 },
  robillard: { venue: "Complexe sportif Claude-Robillard", lat: 45.551838, lon: -73.635135 },
  dattilio: { venue: "Parc Gerry-Dattilio", lat: 45.552139, lon: -73.741385 },
  benevoles: { venue: "Parc des Bénévoles Kirkland", lat: 45.442127, lon: -73.884571 },
  mchugh: { venue: "DDO2 Turf field (Parc Glenn Francis McHugh)", lat: 45.482828, lon: -73.80592 },
  darcy: { venue: "École secondaire D'Arcy McGee", lat: 45.422416, lon: -75.806254 },
};

/** Décisions de BP, par clé. `requetes` : géocodées dans l'ordre, la 1re qui répond gagne.
 *  `rseqFixe` : coordonnées reprises telles quelles du RSEQ (adresse = géocodage inverse, pour info). */
const CORRECTIONS = {
  "stade hebert": { adresse: "Stade Hébert, Saint-Léonard (point RSEQ « Stade Hébert », décision BP 2026-10-08 bis)", rseqFixe: RSEQ.stade_hebert },
  "centre claude robillard 1": { adresse: "Complexe sportif Claude-Robillard, Montréal (point RSEQ, décision BP 2026-10-08 bis)", rseqFixe: RSEQ.robillard },
  "parc pierre laporte elie saab 1": { adresse: "Parc Pierre-Laporte, Boucherville", requetes: ["Parc Pierre-Laporte, Boucherville, Québec"] },
  "parc gerry datillio": { adresse: "Parc-école Gerry-Dattilio, Chomedey, Laval (point RSEQ « Parc Gerry-Dattilio », décision BP 2026-10-08 bis)", rseqFixe: RSEQ.dattilio },
  "parc gerry dattillio": { adresse: "Parc-école Gerry-Dattilio, Chomedey, Laval (point RSEQ « Parc Gerry-Dattilio », décision BP 2026-10-08 bis)", rseqFixe: RSEQ.dattilio },
  "parc ducharme": { note: "Parc Ducharme trouvé sur le boulevard Ducharme (code postal OSM J7E 5R4 ; J7E 4R6 inconnu de Nominatim), à ~520 m de l’arrêt « Cégep Lionel-Groulx »",  adresse: "Boulevard Ducharme, Sainte-Thérèse, J7E 4R6 (en face du Cégep Lionel-Groulx)", requetes: ["Parc Ducharme, Sainte-Thérèse, Québec", "Boulevard Ducharme, Sainte-Thérèse, Québec, J7E 4R6"] },
  "terrain martin charpentier": { note: "L’adresse est celle de la Polyvalente La Poudrière",  adresse: "1125, boulevard Jean-De Brébeuf, Drummondville, J2B 4T5", requetes: ["1125 Boulevard Jean-De Brébeuf, Drummondville, Québec", "1125 Boulevard Jean-De-Brébeuf, Drummondville"] },
  "parc des benevoles": { adresse: "Parc des Bénévoles, Kirkland (coordonnées RSEQ « Parc des Bénévoles Kirkland »)", rseqFixe: RSEQ.benevoles },
  "glenn f mchugh field": { adresse: "Parc Glenn-Francis-McHugh, Dollard-des-Ormeaux (coordonnées RSEQ « DDO2 Turf field »)", rseqFixe: RSEQ.mchugh },
  "d arcy mcgee": { adresse: "925, boulevard du Plateau, Aylmer, Gatineau (confirmé par BP le 2026-10-08)", requetes: ["École secondaire D'Arcy-McGee, Gatineau, Québec", "D'Arcy McGee High School, Gatineau", "D'Arcy McGee, Gatineau, Québec"], rseq: RSEQ.darcy },
};
const EN_ATTENTE = {
};

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
async function nominatim(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=ca&accept-language=fr&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  await attendre(1100);
  if (!r.ok) throw new Error(`Nominatim HTTP ${r.status} pour « ${q} »`);
  const [hit] = await r.json();
  return hit ?? null;
}
async function inverse(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&accept-language=fr&lat=${lat}&lon=${lon}`;
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  await attendre(1100);
  if (!r.ok) throw new Error(`Nominatim reverse HTTP ${r.status}`);
  return (await r.json())?.display_name ?? "";
}
/** Distance en mètres (haversine). */
function distance(a, b) {
  const R = 6371000, rad = (x) => (x * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}
const fixe = (x) => Number(x).toFixed(6);
const lien = (lat, lon) => `https://www.google.com/maps/search/?api=1&query=${fixe(lat)},${fixe(lon)}`;

async function geocoder(d) {
  for (const q of d.requetes) {
    const hit = await nominatim(q);
    if (hit) return { requete: q, adresse: hit.display_name, lat: Number(hit.lat), lon: Number(hit.lon), type: `${hit.category}/${hit.type}` };
  }
  return null;
}

const revue = lireCsv(fs.readFileSync(REVUE, "utf8"));
const sortie = [];
for (const l of revue) {
  const cle = l.nom_normalise;
  const base = { nom_normalise: cle, nom_affiche: l.nom_affiche, libelles_source: l.libelles_source, matchs: l.matchs, ligues: l.ligues, equipe_domicile: l.equipe_domicile };
  const corr = CORRECTIONS[cle], att = EN_ATTENTE[cle];
  if (corr?.rseqFixe) {
    const p = corr.rseqFixe;
    sortie.push({ ...base, valide_par_bp: "manuel", source: "manuel", adresse_donnee_par_bp: corr.adresse,
      requete: "(aucune — coordonnées RSEQ)", adresse_trouvee: await inverse(p.lat, p.lon), lat: fixe(p.lat), lon: fixe(p.lon),
      point_rseq: `${p.venue} (${p.lat}, ${p.lon})`, ecart_rseq_m: 0, google_maps: lien(p.lat, p.lon),
      remarque: "Correction BP : coordonnées RSEQ reprises telles quelles" });
  } else if (corr || att) {
    const d = corr ?? att;
    const g = await geocoder(d);
    const ecart = g && d.rseq ? distance(g, d.rseq) : "";
    sortie.push({ ...base,
      valide_par_bp: g ? (corr ? "manuel" : "en_attente") : "non_confirme",
      source: g ? "manuel" : "", adresse_donnee_par_bp: d.adresse,
      requete: g?.requete ?? d.requetes.join(" | "), adresse_trouvee: g ? `${g.adresse} [${g.type}]` : "INTROUVABLE",
      lat: g ? fixe(g.lat) : "", lon: g ? fixe(g.lon) : "",
      point_rseq: d.rseq ? `${d.rseq.venue} (${d.rseq.lat}, ${d.rseq.lon})` : "", ecart_rseq_m: ecart,
      google_maps: g ? lien(g.lat, g.lon) : "",
      remarque: !g ? "INTROUVABLE à l'adresse donnée — reste « Lieu non précisé »"
        : att ? "EN ATTENTE de la confirmation de BP — NON inclus (reste « Lieu non précisé » d'ici là)"
        : `Correction BP : adresse donnée par BP, géocodée${d.note ? ` — ${d.note}` : ""}` });
  } else {
    // Validés tels quels (19 « Semble juste » + 2 Ontario).
    sortie.push({ ...base, valide_par_bp: "oui", source: "nominatim", adresse_donnee_par_bp: "",
      requete: l.requete, adresse_trouvee: `${l.adresse_trouvee} [${l.type_osm}]`, lat: l.lat, lon: l.lon,
      point_rseq: "", ecart_rseq_m: "", google_maps: l.google_maps,
      remarque: l.hors_quebec === "oui" ? "Validé par BP tel quel — Ontario, gardé (décision 3)" : "Validé par BP tel quel" });
  }
}

const COLS = ["nom_normalise", "nom_affiche", "libelles_source", "matchs", "ligues", "equipe_domicile", "valide_par_bp", "source",
  "adresse_donnee_par_bp", "requete", "adresse_trouvee", "lat", "lon", "point_rseq", "ecart_rseq_m", "google_maps", "remarque"];
const csv = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
fs.writeFileSync(SORTIE, "﻿" + [COLS.join(","), ...sortie.map((r) => COLS.map((c) => csv(r[c])).join(","))].join("\r\n") + "\r\n", "utf8");
const compte = sortie.reduce((a, r) => ((a[r.valide_par_bp] = (a[r.valide_par_bp] ?? 0) + 1), a), {});
console.log(`${sortie.length} terrains → ${SORTIE} · ${JSON.stringify(compte)}`);
for (const r of sortie.filter((x) => x.valide_par_bp !== "oui")) {
  console.log(`\n[${r.valide_par_bp}] ${r.nom_affiche}\n  donnée : ${r.adresse_donnee_par_bp}\n  trouvée : ${r.adresse_trouvee}\n  point : ${r.lat}, ${r.lon} · ${r.google_maps}\n  RSEQ : ${r.point_rseq || "—"}${r.ecart_rseq_m !== "" ? ` · écart ${r.ecart_rseq_m} m` : ""}`);
}
