// Génère les fichiers prod du lot de données E6 (coordonnées des 59 universités, pour la carte du Canada du cégépien) :
//   docs/cegep-lot-d/prod/e6-geo-<rejeu-blanc|apply|rollback>-<date>.sql
// depuis scripts/cegep-lot-d/universites-geo.json (OpenStreetMap Nominatim, relevé du 2026-10-28, source par ligne,
// décision BP Q8). Même voie que les cégeps : schools.lat / lng, geo_source = 'nominatim'. LF.
// Usage : node scripts/cegep-lot-d/generer-e6-geo.mjs 20261028 [rejeu-blanc|apply|rollback]
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.chdir(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".."));
const [date, type = "rejeu-blanc"] = process.argv.slice(2);
if (!/^\d{8}$/.test(date ?? "")) throw new Error("date AAAAMMJJ attendue");
if (!["rejeu-blanc", "apply", "rollback"].includes(type)) throw new Error("type inconnu : " + type);
const md5 = (t) => crypto.createHash("md5").update(t, "utf8").digest("hex");
const q = (v) => (v == null ? "null" : "'" + String(v).replace(/'/g, "''") + "'");

const brut = fs.readFileSync("scripts/cegep-lot-d/universites-geo.json", "utf8").replace(/\r\n/g, "\n");
const d = JSON.parse(brut);
if (d.universites.length !== 59) throw new Error("59 universités attendues");
for (const u of d.universites) {
  if (!(u.lat > 41 && u.lat < 70 && u.lng > -142 && u.lng < -52)) throw new Error("coordonnées hors du Canada : " + u.universite);
  if (!u.source || !u.osm) throw new Error("source manquante : " + u.universite);
}
const lignes = d.universites.map((u) => `  (${q(u.universite)}, ${q(u.province)}, ${u.lat}, ${u.lng}, ${q(u.osm)}, ${q(u.source)})`).join(",\n");
const MD5 = md5(brut), N = d.universites.length;

const tete = `\\set ON_ERROR_STOP 1
\\pset pager off
begin;
set local lock_timeout = '3s';
set local statement_timeout = '60s';
set local application_name = 'nexus-${type}-cegep-e6-geo';
create temp table _g (universite text primary key, province text not null, lat double precision not null, lng double precision not null,
                      osm text not null, source text not null) on commit drop;
insert into _g values
${lignes};
do $$
begin
  if current_user <> 'postgres' then raise exception 'NEXUS: lancer en postgres'; end if;
  if exists (select 1 from _g g where (select count(*) from public.schools s where s.name = g.universite and s.type = 'UNIVERSITE' and s.province = g.province) <> 1) then
    raise exception 'NEXUS: une université du relevé ne correspond pas à exactement une université';
  end if;
end $$;
`;
let sql;
if (type === "rollback") {
  sql = `-- Lot de données E6 (coordonnées des universités) — ROLLBACK RÉEL EN PROD (sur GO BP) : remet lat / lng / geo_source à
-- vide pour les ${N} universités du relevé (données ${MD5}).
${tete}
do $$ begin
  if not exists (select 1 from public.admin_operations where operation = 'CEGEP_LOT_E6_GEO_UNIVERSITES') then raise exception 'NEXUS: lot non appliqué'; end if;
end $$;
update public.schools s set lat = null, lng = null, geo_source = null from _g g where s.name = g.universite and s.type = 'UNIVERSITE';
insert into public.admin_operations (operation, motif, details, par)
values ('CEGEP_LOT_E6_GEO_UNIVERSITES_RETIREES', 'Chantier cégep, lot E6 : coordonnées des universités retirées (GO BP)',
        jsonb_build_object('universites', ${N}, 'empreinte_donnees', '${MD5}'), (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0'));
commit;
\\echo '== COMMIT fait : coordonnées des universités retirées.'
`;
} else {
  const apply = type === "apply";
  sql = `-- ════════════════════════════════════════════════════════════════════════════
-- Lot de données E6 (coordonnées des ${N} universités, carte du Canada) — ${apply ? "APPLY RÉEL EN PROD (sur GO BP seulement)" : "REJEU À BLANC (finit par ROLLBACK)"}.
-- Source : OpenStreetMap Nominatim (${d.source_generale}), une requête et un objet OSM par ligne
-- (scripts/cegep-lot-d/universites-geo.json, données ${MD5}). Même voie que les cégeps (geo_source = 'nominatim').
-- Seules lat, lng et geo_source des universités changent ; la lecture des universités reste masquée hors admin
-- (et cégépien sous ON, E1). Lancer SANS -1, en postgres.
-- ════════════════════════════════════════════════════════════════════════════
${tete}
do $$ begin
  if exists (select 1 from public.admin_operations where operation like 'CEGEP_LOT_E6_GEO_UNIVERSITES%') then raise exception 'NEXUS: lot déjà tracé'; end if;
  if exists (select 1 from public.schools where type = 'UNIVERSITE' and (lat is not null or lng is not null)) then
    raise exception 'NEXUS: des universités ont déjà des coordonnées — relire';
  end if;
end $$;
create temp table _avant on commit drop as
select md5(string_agg(id::text || coalesce(lat::text, '') || coalesce(lng::text, '') || coalesce(geo_source, ''), ',' order by id)) e
  from public.schools where type <> 'UNIVERSITE';
update public.schools s set lat = g.lat, lng = g.lng, geo_source = 'nominatim'
  from _g g where s.name = g.universite and s.type = 'UNIVERSITE' and s.province = g.province;
select count(*) filter (where lat is not null) as universites_geocodees, count(*) as universites,
       round(min(lat)::numeric, 2) as lat_min, round(max(lat)::numeric, 2) as lat_max, round(min(lng)::numeric, 2) as lng_min, round(max(lng)::numeric, 2) as lng_max
  from public.schools where type = 'UNIVERSITE';
do $$ begin
  if (select count(*) from public.schools where type = 'UNIVERSITE' and lat is not null and geo_source = 'nominatim') <> ${N} then
    raise exception 'NEXUS: toutes les universités ne sont pas géocodées';
  end if;
  if (select md5(string_agg(id::text || coalesce(lat::text, '') || coalesce(lng::text, '') || coalesce(geo_source, ''), ',' order by id))
        from public.schools where type <> 'UNIVERSITE') is distinct from (select e from _avant) then
    raise exception 'NEXUS: une école non universitaire a bougé';
  end if;
  raise notice 'NEXUS: VERDICT E6 géo — ${N} universités géocodées (Nominatim), rien d''autre ne bouge';
end $$;
select 'VERDICT' as verdict, 'conforme' as resultat;
${apply ? `
do $$ begin if public.lancement_universitaire_actif() then raise exception 'NEXUS: l''interrupteur doit rester OFF'; end if; end $$;
insert into public.admin_operations (operation, motif, details, par)
values ('CEGEP_LOT_E6_GEO_UNIVERSITES', 'Chantier cégep, lot E6 : coordonnées des ${N} universités (OpenStreetMap Nominatim) pour la carte du Canada (GO BP)',
        jsonb_build_object('universites', ${N}, 'releve', '${d.date_releve}', 'empreinte_donnees', '${MD5}', 'donnees', 'scripts/cegep-lot-d/universites-geo.json'),
        (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0'));
commit;
\\echo '== COMMIT fait : coordonnées des universités en prod.'
` : `
update public.schools s set lat = null, lng = null, geo_source = null from _g g where s.name = g.universite and s.type = 'UNIVERSITE';
do $$ begin
  if exists (select 1 from public.schools where type = 'UNIVERSITE' and lat is not null) then raise exception 'NEXUS: rollback incomplet'; end if;
  raise notice 'NEXUS: rollback E6 géo vérifié';
end $$;
rollback;
\\echo '== ROLLBACK fait : rien n''est appliqué.'
`}`;
}
const OUT = `docs/cegep-lot-d/prod/e6-geo-${type}-${date}.sql`;
fs.writeFileSync(OUT, sql);
console.log(`données ${MD5}  universités ${N}  généré ${md5(sql)}  ${OUT}`);
