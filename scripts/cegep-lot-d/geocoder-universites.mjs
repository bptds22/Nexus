// Géocode les 59 universités (lot E6, décision BP Q8 : « géocode avec source ») — même voie que les cégeps
// (geo_source = 'nominatim') : OpenStreetMap Nominatim, 1 requête / 1,1 s, User-Agent identifiable (politique d'usage
// OSM), aucune autre source. Chaque résultat garde sa requête, l'objet OSM trouvé et l'URL de la source.
// Entrée : la base LOCALE (mêmes noms et villes qu'en prod, lots D1 / D1b). Sortie : scripts/cegep-lot-d/universites-geo.json.
// Un résultat hors de la province attendue est REFUSÉ (noté, jamais deviné).
// Usage : node scripts/cegep-lot-d/geocoder-universites.mjs
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

process.chdir(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".."));
const UA = "Nexus-geocodage-universites/1.0 (confidentialite@nexussports.ca)";
const PROVINCES = { QC: "Québec", ON: "Ontario", NS: "Nova Scotia", NB: "New Brunswick", PE: "Prince Edward Island",
  NL: "Newfoundland and Labrador", MB: "Manitoba", SK: "Saskatchewan", AB: "Alberta", BC: "British Columbia" };
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));
/* Requêtes précises, essayées EN PREMIER, pour les cas que la requête générique place mal (vérifiés au premier passage
   le 2026-10-28) : uOttawa rendait Carleton, McGill le campus Macdonald, Cape Breton un bureau, UQAM une œuvre d'art ;
   Memorial et Laurentienne sans résultat sous leur nom français / complet. */
const ville = (x) => x.address?.city ?? x.address?.town ?? x.address?.village ?? x.address?.municipality ?? "";
const estUniv = (x) => x.category === "amenity" && ["university", "college"].includes(x.type);
const PRECISES = {
  "Université d'Ottawa": { q: "University of Ottawa, 75 Laurier Avenue East, Ottawa", garde: estUniv },
  "Université McGill": { q: "McGill University", garde: (x) => estUniv(x) && ville(x) === "Montréal" },
  "Cape Breton University": { q: "Cape Breton University", garde: estUniv },
  // Aucun objet « université » d'UQAM à Montréal dans OSM : on retient le point du campus (Promenade Maisonneuve, au
  // cœur du Quartier latin), pas un campus de banlieue (Laval, Longueuil, Terrebonne).
  "Université du Québec à Montréal": { q: "Université du Québec à Montréal", garde: (x) => ville(x) === "Montréal" },
  "Memorial University of Newfoundland": { q: "Memorial University of Newfoundland", garde: estUniv },
  "Université Laurentienne": { q: "Laurentian University, Ramsey Lake Road, Sudbury", garde: estUniv },
};

const lignes = execSync(`docker exec -i supabase_db_Nexus psql -U postgres -X -At -F "|" -c "select name, coalesce(city,''), province from public.schools where type='UNIVERSITE' order by name"`, { encoding: "utf8" })
  .trim().split(/\r?\n/).map((l) => l.split("|"));
if (lignes.length !== 59) throw new Error("59 universités attendues en local, trouvé " + lignes.length);

async function chercher(q) {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=ca&addressdetails=1&accept-language=fr&q=${encodeURIComponent(q)}`;
  const r = await fetch(url, { headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`Nominatim ${r.status} pour « ${q} »`);
  return { url, resultats: await r.json() };
}

const sortie = [];
for (const [nom, villeEcole, prov] of lignes) {
  const requetes = PRECISES[nom] ? [PRECISES[nom].q] : [`${nom}, ${villeEcole}, ${PROVINCES[prov]}`, `${nom}, ${PROVINCES[prov]}`];
  let retenu = null, essais = [];
  for (const q of requetes) {
    const { url, resultats } = await chercher(q);
    await attendre(1100);
    // Province par son code ISO (CA-QC, CA-NL…) : le nom varie selon la langue (« Terre-Neuve et Labrador »).
    const dansProvince = resultats.filter((x) => x.address?.["ISO3166-2-lvl4"] === `CA-${prov}`);
    const univ = PRECISES[nom] ? dansProvince.find(PRECISES[nom].garde)
      : dansProvince.find((x) => ["university", "college"].includes(x.type) || x.category === "amenity") ?? dansProvince[0];
    essais.push({ requete: q, resultats: resultats.length, dans_province: dansProvince.length });
    if (univ) {
      retenu = { requete: q, source: url, lat: Number(univ.lat), lng: Number(univ.lon), osm: `${univ.osm_type}/${univ.osm_id}`,
                 categorie: `${univ.category}/${univ.type}`, lieu: univ.display_name };
      break;
    }
  }
  sortie.push({ universite: nom, ville: villeEcole, province: prov, ...(retenu ?? { refuse: "aucun résultat dans la province", essais }) });
  console.log(`${retenu ? "OK " : "-- "} ${nom} → ${retenu ? `${retenu.lat.toFixed(4)}, ${retenu.lng.toFixed(4)} (${retenu.categorie})` : "aucun"}`);
}
fs.writeFileSync("scripts/cegep-lot-d/universites-geo.json",
  JSON.stringify({ date_releve: new Date().toISOString().slice(0, 10), source_generale: "OpenStreetMap Nominatim (https://nominatim.openstreetmap.org), données © contributeurs OpenStreetMap, ODbL",
                   universites: sortie }, null, 2) + "\n");
console.log(`trouvées ${sortie.filter((x) => x.lat != null).length} / ${sortie.length}`);
