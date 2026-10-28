// Génère les fichiers prod du lot D1 cégep (12 universités québécoises + leurs équipes RSEQ) :
//   docs/cegep-lot-d/prod/d1-<rejeu-blanc|apply|rollback>-<date>.sql
// depuis scripts/cegep-lot-d/d1-universites.json et docs/cegep-lot-d/prod/d1.gabarit.sql. LF.
// Usage : node scripts/cegep-lot-d/generer-d1.mjs 20261028 [rejeu-blanc|apply|rollback]
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.chdir(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".."));
const [date, type = "rejeu-blanc"] = process.argv.slice(2);
if (!/^\d{8}$/.test(date ?? "")) throw new Error("date AAAAMMJJ attendue");
if (!["rejeu-blanc", "apply", "rollback"].includes(type)) throw new Error("type inconnu : " + type);

const md5 = (t) => crypto.createHash("md5").update(t, "utf8").digest("hex");
const brut = fs.readFileSync("scripts/cegep-lot-d/d1-universites.json", "utf8").replace(/\r\n/g, "\n");
const donnees = JSON.parse(brut);
const q = (v) => (v == null ? "null" : "'" + String(v).replace(/'/g, "''") + "'");
const ecoles = donnees.ecoles.map((e) =>
  `  (${q(e.rseq_institution_id)}, ${q(e.name)}, ${q(e.team_name)}, ${q(e.city)}, ${q(e.region)}, ${q(e.langue)}, ${q(e.website)})`).join(",\n");
const equipes = donnees.equipes.map((t) =>
  `  (${q(t.rseq_team_id)}, ${q(t.rseq_institution_id)}, ${q(t.nom)}, ${q(t.sport)}, ${q(t.gender)}, ${q(t.division)}, ${q(t.ligue)})`).join(",\n");
const N = String(donnees.equipes.length);

// Corps du rollback : s'appuie sur les tables temporaires _ecoles / _equipes ; refuse si une ligne d'une
// autre table (hors teams.school_id et côtés de match) pointe vers une école ou une équipe du lot.
const corps = `do $rb$
declare
  r record; n bigint; v_t uuid[]; v_s uuid[];
begin
  select coalesce(array_agg(t.id), '{}') into v_t from public.teams t join _equipes q using (rseq_team_id);
  select coalesce(array_agg(s.id), '{}') into v_s from public.schools s join _ecoles e using (rseq_institution_id)
   where s.type = 'UNIVERSITE';
  for r in
    select c.conrelid as tbl, a.attname as col, c.confrelid as cible
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f' and c.confrelid in ('public.teams'::regclass, 'public.schools'::regclass)
  loop
    if (r.tbl = 'public.teams'::regclass and r.col = 'school_id')
       or (r.tbl = 'public.games'::regclass and r.col in ('home_team_id', 'visitor_team_id')) then
      continue;
    end if;
    execute format('select count(*) from %s where %I = any($1)', r.tbl::regclass, r.col)
      into n using case when r.cible = 'public.teams'::regclass then v_t else v_s end;
    if n > 0 then
      raise exception 'NEXUS: rollback D1 refusé : % ligne(s) de %.% pointent vers le lot', n, r.tbl::regclass, r.col;
    end if;
  end loop;
  update public.games set home_team_id = null where home_team_id = any(v_t);
  update public.games set visitor_team_id = null where visitor_team_id = any(v_t);
  delete from public.teams where id = any(v_t);
  delete from public.schools where id = any(v_s);
end $rb$;`;

function remplir(g, extra) {
  const r = {
    "@@MODE@@": type, "@@DATE@@": date, "@@N_EQUIPES@@": N, "@@MD5_DONNEES@@": md5(brut),
    "@@MD5_ROLLBACK_CORPS@@": md5(corps), ...extra,
  };
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
-- Lot D1 cégep — ROLLBACK RÉEL EN PROD (sur GO BP seulement) : retire les 12 universités et leurs
-- @@N_EQUIPES@@ équipes créées par d1-apply, délie leurs côtés de match. Refusé si une autre ligne pointe vers
-- elles (compte, fiche, page…). Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer-d1.mjs (données @@MD5_DONNEES@@).
-- ════════════════════════════════════════════════════════════════════════════

\\set ON_ERROR_STOP 1
\\pset pager off

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local application_name = 'nexus-rollback-cegep-d1';

create temp table _ecoles (rseq_institution_id uuid primary key, name text not null, team_name text, city text,
                           region text, langue text, website text) on commit drop;
insert into _ecoles values
@@ECOLES@@;
create temp table _equipes (rseq_team_id uuid primary key, rseq_institution_id uuid not null, nom text not null,
                            sport text not null, gender text, division text, ligue text not null) on commit drop;
insert into _equipes values
@@EQUIPES@@;

do $$
begin
  if not exists (select 1 from public.admin_operations where operation = 'CEGEP_LOT_D1_UNIVERSITES') then
    raise exception 'NEXUS: le lot D1 n''a pas été appliqué';
  end if;
  if exists (select 1 from public.admin_operations where operation = 'CEGEP_LOT_D1_UNIVERSITES_RETIREES') then
    raise exception 'NEXUS: le lot D1 a déjà été retiré';
  end if;
end $$;

@@ROLLBACK_CORPS@@

insert into public.admin_operations (operation, motif, details, par)
values ('CEGEP_LOT_D1_UNIVERSITES_RETIREES', 'Chantier cégep, lot D1 retiré (GO BP)',
        jsonb_build_object('universites', 12, 'equipes', @@N_EQUIPES@@, 'empreinte_donnees', '@@MD5_DONNEES@@'),
        (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0'));
do $$
begin
  if exists (select 1 from public.schools s join _ecoles e using (rseq_institution_id))
     or exists (select 1 from public.teams t join _equipes q using (rseq_team_id)) then
    raise exception 'NEXUS: rollback D1 incomplet';
  end if;
end $$;
commit;
\\echo '== COMMIT fait : lot D1 retiré.'
`, {});
} else {
  const apply = type === "apply";
  g = fs.readFileSync("docs/cegep-lot-d/prod/d1.gabarit.sql", "utf8").replace(/\r\n/g, "\n");
  g = bloc(bloc(g, apply ? "REJEU" : "APPLY", false), apply ? "APPLY" : "REJEU", true);
  g = remplir(g, {
    "@@TITRE@@": apply ? "APPLY RÉEL EN PROD (sur GO BP seulement, après le rejeu à blanc)" : "REJEU À BLANC (finit par ROLLBACK)",
    "@@SUITE@@": apply ? "Finit par admin_operations CEGEP_LOT_D1_UNIVERSITES et COMMIT." : "Joue aussi le rollback dans la transaction, puis ROLLBACK : rien n'est appliqué.",
  });
}
const OUT = `docs/cegep-lot-d/prod/d1-${type}-${date}.sql`;
fs.writeFileSync(OUT, g);
console.log(`données ${md5(brut)}  généré ${md5(g)}  ${OUT}`);
