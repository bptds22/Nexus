// Génère le SQL d'écriture des terrains VALIDÉS par BP dans lieux_geocodes.
// N'écrit rien lui-même : il produit un fichier .sql à appliquer (runbook),
// en une transaction gardée + une ligne admin_operations.
//
//   node scripts/carte-matchs-lot-b/ecrire-lieux.mjs [revue.csv] [sortie.sql]
//
// Colonne « valide_par_bp » du CSV :
//   oui     → lat/lon de Nominatim gardés, source 'nominatim'
//   manuel  → lat/lon corrigés à la main par BP dans le CSV, source 'manuel'
//   autre / vide → ligne ignorée (non écrite)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lieuNormalise } from "./normalise.mjs";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const ENTREE = process.argv[2] ?? path.join(ICI, "terrains-civils-revue.csv");
const SORTIE = process.argv[3] ?? path.join(ICI, "ecrire-lieux.sql");

/** CSV RFC 4180 minimal : guillemets doublés, virgules dans les champs. */
export function lireCsv(texte) {
  const lignes = [];
  let champ = "", ligne = [], dedans = false;
  const t = texte.replace(/^﻿/, "");
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (dedans) {
      if (c === '"' && t[i + 1] === '"') { champ += '"'; i++; }
      else if (c === '"') dedans = false;
      else champ += c;
    } else if (c === '"') dedans = true;
    else if (c === ",") { ligne.push(champ); champ = ""; }
    else if (c === "\n") { ligne.push(champ.replace(/\r$/, "")); lignes.push(ligne); ligne = []; champ = ""; }
    else champ += c;
  }
  if (champ || ligne.length) { ligne.push(champ); lignes.push(ligne); }
  const [tete, ...corps] = lignes.filter((l) => l.some((v) => v.trim()));
  return corps.map((l) => Object.fromEntries(tete.map((k, i) => [k.trim(), (l[i] ?? "").trim()])));
}

const sql = (v) => `'${String(v).replace(/'/g, "''")}'`;

const lignes = lireCsv(fs.readFileSync(ENTREE, "utf8"));
const retenues = [];
const refus = [];
for (const l of lignes) {
  const choix = l.valide_par_bp.toLowerCase();
  if (choix !== "oui" && choix !== "manuel") continue;
  const lat = Number(l.lat), lon = Number(l.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat === 0 || lon === 0) { refus.push(`${l.nom_normalise} : lat/lon absents`); continue; }
  if (lieuNormalise(l.nom_normalise) !== l.nom_normalise) { refus.push(`${l.nom_normalise} : clé non normalisée`); continue; }
  retenues.push({ cle: l.nom_normalise, nom: l.nom_affiche, lat, lon, source: choix === "manuel" ? "manuel" : "nominatim" });
}
if (refus.length) { console.error("Lignes refusées :\n  " + refus.join("\n  ")); process.exit(1); }
if (!retenues.length) { console.error("Aucune ligne validée (colonne valide_par_bp = oui | manuel)."); process.exit(1); }

const valeurs = retenues.map((r) => `    (${sql(r.cle)}, ${sql(r.nom)}, ${r.lat}, ${r.lon}, ${sql(r.source)})`).join(",\n");
const sortie = `-- Terrains civils validés par BP → lieux_geocodes (carte des matchs, lot B).
-- Généré par scripts/carte-matchs-lot-b/ecrire-lieux.mjs depuis ${path.basename(ENTREE)}.
-- ${retenues.length} terrain(s). Transaction gardée : exactement ${retenues.length} ligne(s) insérée(s)
-- et 1 ligne admin_operations, sinon RIEN n'est écrit.
do $$
declare
  v_bp uuid;
  n_avant int; n_apres int; n_ops_avant int; n_ops_apres int;
begin
  select id into strict v_bp from public.users where email = 'bptds22@gmail.com';
  select count(*) into n_avant from public.lieux_geocodes;
  select count(*) into n_ops_avant from public.admin_operations;

  insert into public.lieux_geocodes (nom_normalise, nom_affiche, lat, lon, source, revu_par, revu_le)
  select v.cle, v.nom, v.lat, v.lon, v.src, v_bp, now()
    from (values
${valeurs}
    ) as v(cle, nom, lat, lon, src);

  insert into public.admin_operations (operation, motif, details, par)
  values ('LIEUX_GEOCODES_ECRITS', 'Terrains civils géocodés, revus par BP (carte des matchs, lot B)',
          jsonb_build_object('nombre', ${retenues.length}, 'cles', jsonb_build_array(${retenues.map((r) => sql(r.cle)).join(", ")})),
          v_bp);

  select count(*) into n_apres from public.lieux_geocodes;
  select count(*) into n_ops_apres from public.admin_operations;
  if n_apres - n_avant <> ${retenues.length} or n_ops_apres - n_ops_avant <> 1 then
    raise exception 'NEXUS: garde échouée (lieux +%, ops +%) — rien écrit', n_apres - n_avant, n_ops_apres - n_ops_avant;
  end if;
  raise notice 'OK : % terrain(s) écrit(s), 1 ligne admin_operations', n_apres - n_avant;
end $$;
`;
fs.writeFileSync(SORTIE, sortie, "utf8");
console.log(`${retenues.length} terrain(s) validé(s) → ${SORTIE}`);
