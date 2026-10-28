// Génère les fichiers prod du lot D1b cégep (universités U SPORTS hors Québec + leurs équipes) :
//   docs/cegep-lot-d/prod/d1b-<rejeu-blanc|apply|rollback>-<date>.sql
// depuis scripts/cegep-lot-d/d1b-universites.json et docs/cegep-lot-d/prod/d1b.gabarit.sql. LF.
// Hors RSEQ, pas d'identifiant RSEQ : chaque école / équipe reçoit un uuid STABLE dérivé de son nom (md5), le même
// au rejeu, à l'apply et au rollback.
// Usage : node scripts/cegep-lot-d/generer-d1b.mjs 20261028 [rejeu-blanc|apply|rollback]
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.chdir(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".."));
const [date, type = "rejeu-blanc"] = process.argv.slice(2);
if (!/^\d{8}$/.test(date ?? "")) throw new Error("date AAAAMMJJ attendue");
if (!["rejeu-blanc", "rejeu-constat", "apply", "rollback"].includes(type)) throw new Error("type inconnu : " + type);

const md5 = (t) => crypto.createHash("md5").update(t, "utf8").digest("hex");
const uuid = (graine) => {
  const h = md5("nexus-d1b|" + graine);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const PROVINCES = { ON: "Ontario", NS: "Nouvelle-Écosse", NB: "Nouveau-Brunswick", PE: "Île-du-Prince-Édouard",
  NL: "Terre-Neuve-et-Labrador", MB: "Manitoba", SK: "Saskatchewan", AB: "Alberta", BC: "Colombie-Britannique" };
const SPORTS = new Set(["Basketball", "Football", "Hockey", "Rugby", "Soccer", "Volleyball"]);

const brut = fs.readFileSync("scripts/cegep-lot-d/d1b-universites.json", "utf8").replace(/\r\n/g, "\n");
const donnees = JSON.parse(brut);
const noms = new Set();
for (const e of donnees.ecoles) {
  if (!PROVINCES[e.province]) throw new Error("province inconnue : " + e.name + " " + e.province);
  if (noms.has(e.name)) throw new Error("école en double : " + e.name);
  noms.add(e.name);
}
const vus = new Set();
for (const t of donnees.equipes) {
  if (!noms.has(t.ecole)) throw new Error("équipe hors des écoles : " + t.ecole);
  if (!SPORTS.has(t.sport)) throw new Error("sport hors liste : " + t.sport);
  if (!["Masculin", "Féminin"].includes(t.gender)) throw new Error("genre : " + t.gender);
  const k = `${t.ecole}|${t.sport}|${t.gender}`;
  if (vus.has(k)) throw new Error("équipe en double : " + k);
  vus.add(k);
}
const q = (v) => (v == null ? "null" : "'" + String(v).replace(/'/g, "''") + "'");
const parNom = new Map(donnees.ecoles.map((e) => [e.name, e]));
const ecoles = donnees.ecoles.map((e) =>
  `  (${q(uuid(e.name))}, ${q(e.name)}, ${q(e.team_name)}, ${q(e.city)}, ${q(e.province)}, ${q(PROVINCES[e.province])}, ${q(e.langue === "BIL" ? "BILINGUE" : e.langue)}, ${q(e.website)})`).join(",\n");
const equipes = donnees.equipes.map((t) =>
  `  (${q(uuid(`${t.ecole}|${t.sport}|${t.gender}`))}, ${q(uuid(t.ecole))}, ${q(parNom.get(t.ecole).team_name || t.ecole)}, ${q(t.sport)}, ${q(t.gender)}, null, ${q(t.ligue)})`).join(",\n");
const NE = String(donnees.ecoles.length), N = String(donnees.equipes.length);

// Corps du rollback : refuse si une ligne d'une autre table (hors teams.school_id) pointe vers le lot.
const corps = `do $rb$
declare
  r record; n bigint; v_t uuid[]; v_s uuid[];
begin
  select coalesce(array_agg(t.id), '{}') into v_t from public.teams t join _equipes q on q.cle = t.id;
  select coalesce(array_agg(s.id), '{}') into v_s from public.schools s join _ecoles e on e.cle = s.id where s.type = 'UNIVERSITE';
  for r in
    select c.conrelid as tbl, a.attname as col, c.confrelid as cible
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f' and c.confrelid in ('public.teams'::regclass, 'public.schools'::regclass)
  loop
    if r.tbl = 'public.teams'::regclass and r.col = 'school_id' then
      continue;
    end if;
    execute format('select count(*) from %s where %I = any($1)', r.tbl::regclass, r.col)
      into n using case when r.cible = 'public.teams'::regclass then v_t else v_s end;
    if n > 0 then
      raise exception 'NEXUS: rollback D1b refusé : % ligne(s) de %.% pointent vers le lot', n, r.tbl::regclass, r.col;
    end if;
  end loop;
  delete from public.teams where id = any(v_t);
  delete from public.schools where id = any(v_s);
end $rb$;`;

function remplir(g, extra) {
  const r = { "@@MODE@@": type, "@@DATE@@": date, "@@N_EQUIPES@@": N, "@@N_ECOLES@@": NE, "@@MD5_DONNEES@@": md5(brut),
    "@@MD5_ROLLBACK_CORPS@@": md5(corps), ...extra };
  for (const [k, v] of Object.entries(r)) g = g.split(k).join(v);
  g = g.replace("@@ECOLES@@", () => ecoles).replace("@@EQUIPES@@", () => equipes).replace("@@ROLLBACK_CORPS@@", () => corps);
  if (/@@[A-Z_0-9]+@@/.test(g)) throw new Error("marqueur non remplacé : " + g.match(/@@[A-Z_0-9]+@@/)[0]);
  return g;
}
function bloc(t, nom, garde) {
  const ouv = `-- [[${nom}\n`, fer = `-- ${nom}]]\n`;
  const i = t.indexOf(ouv), j = t.indexOf(fer);
  if (i < 0 || j < i) throw new Error("bloc " + nom + " introuvable");
  return t.slice(0, i) + (garde ? t.slice(i + ouv.length, j) : "") + t.slice(j + fer.length);
}

let g;
if (type === "rollback") {
  g = remplir(`-- ════════════════════════════════════════════════════════════════════════════
-- Lot D1b cégep — ROLLBACK RÉEL EN PROD (sur GO BP seulement) : retire les @@N_ECOLES@@ universités hors Québec et
-- leurs @@N_EQUIPES@@ équipes créées par d1b-apply. Refusé si une autre ligne pointe vers elles.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer-d1b.mjs (données @@MD5_DONNEES@@).
-- ════════════════════════════════════════════════════════════════════════════

\\set ON_ERROR_STOP 1
\\pset pager off

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local application_name = 'nexus-rollback-cegep-d1b';

create temp table _ecoles (cle uuid primary key, name text not null, team_name text, city text, province text not null,
                           region text, langue text, website text) on commit drop;
insert into _ecoles values
@@ECOLES@@;
create temp table _equipes (cle uuid primary key, cle_ecole uuid not null, nom text not null,
                            sport text not null, gender text, division text, ligue text not null) on commit drop;
insert into _equipes values
@@EQUIPES@@;

do $$
begin
  if not exists (select 1 from public.admin_operations where operation = 'CEGEP_LOT_D1B_UNIVERSITES_CANADA') then
    raise exception 'NEXUS: le lot D1b n''a pas été appliqué';
  end if;
  if exists (select 1 from public.admin_operations where operation = 'CEGEP_LOT_D1B_UNIVERSITES_CANADA_RETIREES') then
    raise exception 'NEXUS: le lot D1b a déjà été retiré';
  end if;
end $$;

@@ROLLBACK_CORPS@@

insert into public.admin_operations (operation, motif, details, par)
values ('CEGEP_LOT_D1B_UNIVERSITES_CANADA_RETIREES', 'Chantier cégep, lot D1b retiré (GO BP)',
        jsonb_build_object('universites', @@N_ECOLES@@, 'equipes', @@N_EQUIPES@@, 'empreinte_donnees', '@@MD5_DONNEES@@'),
        (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0'));
do $$
begin
  if exists (select 1 from public.schools s join _ecoles e on e.cle = s.id)
     or exists (select 1 from public.teams t join _equipes q on q.cle = t.id) then
    raise exception 'NEXUS: rollback D1b incomplet';
  end if;
end $$;
commit;
\\echo '== COMMIT fait : lot D1b retiré.'
`, {});
} else {
  const apply = type === "apply";
  g = fs.readFileSync("docs/cegep-lot-d/prod/d1b.gabarit.sql", "utf8").replace(/\r\n/g, "\n");
  g = bloc(bloc(g, apply ? "REJEU" : "APPLY", false), apply ? "APPLY" : "REJEU", true);
  g = bloc(bloc(g, "GARDE_D1A2", true), "BANC_VERDICT", true);
  g = remplir(g, {
    "@@TITRE@@": apply ? "APPLY RÉEL EN PROD (sur GO BP seulement, après le rejeu à blanc)" : "REJEU À BLANC (finit par ROLLBACK)",
    "@@SUITE@@": apply ? "Finit par admin_operations CEGEP_LOT_D1B_UNIVERSITES_CANADA et COMMIT." : "Joue aussi le rollback dans la transaction, puis ROLLBACK : rien n'est appliqué.",
  });
}
const OUT = `docs/cegep-lot-d/prod/d1b-${type}-${date}.sql`;
fs.writeFileSync(OUT, g);
console.log(`données ${md5(brut)}  écoles ${NE}  équipes ${N}  généré ${md5(g)}  ${OUT}`);
