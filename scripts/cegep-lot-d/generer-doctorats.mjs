// Génère la migration et le rollback du lot « doctorats de premier cycle » (demande BP du 2026-10-29) depuis
// docs/cegep-lot-d/doctorats-1er-cycle.json (relevé du 2026-10-29, source officielle citée par ligne) :
//   supabase/migrations/20261029200000_doctorats_premier_cycle.sql
//   supabase/rollback/20261029200000_rollback_doctorats_premier_cycle.sql
// Le corps de replace_university_programs vient de la migration E3 (20261028150000), seule la liste des cycles
// et le message changent. Chaque programme reçoit un uuid STABLE (md5 de université|nom). LF.
// Usage : node scripts/cegep-lot-d/generer-doctorats.mjs   (puis generer.mjs <date> <rejeu-blanc|apply> doc1)
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.chdir(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".."));
const VERSION = "20261029200000", NOM = "doctorats_premier_cycle";
const SRC = "docs/cegep-lot-d/doctorats-1er-cycle.json";
const md5 = (t) => crypto.createHash("md5").update(t, "utf8").digest("hex");
const uuid = (g) => { const h = md5("nexus-doc1|" + g); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`; };
const q = (v) => (v == null ? "null" : "'" + String(v).replace(/'/g, "''") + "'");

const brut = fs.readFileSync(SRC, "utf8").replace(/\r\n/g, "\n");
const d = JSON.parse(brut);
if (d.cycle !== "doctorat_1er_cycle") throw new Error("cycle inattendu");
const vus = new Set(), lignes = [], parUniv = new Map();
for (const p of d.programmes) {
  const nom = p.nom.trim(), fac = p.faculte?.trim() || null, src = p.source?.trim();
  if (!nom || nom.length > 200) throw new Error("nom " + nom);
  if (fac && fac.length > 150) throw new Error("faculté trop longue " + fac);
  if (!src || !src.startsWith("https://") || src.length > 500) throw new Error("source " + nom);
  const k = p.universite + "|" + nom.toLowerCase();
  if (vus.has(k)) throw new Error("doublon " + k);
  vus.add(k);
  const rang = parUniv.get(p.universite) ?? 0;
  parUniv.set(p.universite, rang + 1);
  lignes.push(`  (${q(uuid(`${p.universite}|${nom}`))}, ${q(p.universite)}, ${q(nom)}, ${q(fac)}, ${q(src)}, ${rang})`);
}
const N = lignes.length;
const attendus = [...parUniv].map(([u, n]) => `  (${q(u)}, ${n})`);
const ids = d.programmes.map((p) => q(uuid(`${p.universite}|${p.nom.trim()}`)));

const e3 = fs.readFileSync("supabase/migrations/20261028150000_cegep_lot_e3_cycle_libre.sql", "utf8").replace(/\r\n/g, "\n");
const i = e3.indexOf("create or replace function public.replace_university_programs");
const j = e3.indexOf("end $function$;", i);
if (i < 0 || j < 0) throw new Error("corps E3 introuvable");
const corpsE3 = e3.slice(i, j + "end $function$;".length);
const AV_LISTE = "not in ('baccalaureat', 'certificat', 'maitrise', 'doctorat', 'autre')";
const AV_MSG = "un cycle (baccalauréat, certificat, maîtrise, doctorat, ou « autre » avec son libellé)";
if (corpsE3.split(AV_LISTE).length !== 2 || corpsE3.split(AV_MSG).length !== 2) throw new Error("motifs E3 inattendus");
const corpsNeuf = corpsE3
  .replace(AV_LISTE, "not in ('baccalaureat', 'certificat', 'maitrise', 'doctorat', 'doctorat_1er_cycle', 'autre')")
  .replace(AV_MSG, "un cycle (baccalauréat, certificat, maîtrise, doctorat, doctorat de 1er cycle, ou « autre » avec son libellé)");

// md5 de pg_get_functiondef relevés en local ET en prod le 2026-10-29 (identiques).
const MD5_RPC_E3 = "90c99ad02f49ce901449dded595c2044";
const CONTRAINTE_E3 = "CHECK ((cycle = ANY (ARRAY['baccalaureat'::text, 'certificat'::text, 'maitrise'::text, 'doctorat'::text, 'autre'::text])))";

const mig = `-- Doctorats de premier cycle au catalogue des programmes universitaires (demande BP du 2026-10-29).
--   1. university_programs.cycle accepte 'doctorat_1er_cycle' (affiché « Doctorat de 1er cycle »).
--   2. replace_university_programs accepte ce cycle (corps E3, seule la liste des cycles et le message changent).
--   3. ${N} programmes pré-remplis (source 'seed', uuid stables) : médecine, médecine dentaire, pharmacie, médecine
--      vétérinaire, optométrie, chiropratique, podiatrie, et Juris Doctor (common law), relevés le ${d.releve} sur les
--      sites officiels (source citée par ligne, ${SRC}, données ${md5(brut)}).
--      Ajoutés à la fin de la liste de chaque université ; rien n'est supprimé ni modifié.
-- Lecture et écriture : policies D5a / E1 inchangées. Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer-doctorats.mjs.

do $garde$
begin
  if md5(pg_get_functiondef('public.replace_university_programs(uuid,jsonb,boolean)'::regprocedure)) <> '${MD5_RPC_E3}' then
    raise exception 'NEXUS: doctorats — replace_university_programs a changé depuis le relevé ; régénérer';
  end if;
  if pg_get_constraintdef((select oid from pg_constraint where conname = 'university_programs_cycle_check'))
       <> ${q(CONTRAINTE_E3)} then
    raise exception 'NEXUS: doctorats — la contrainte de cycle a changé ; relire';
  end if;
end $garde$;

alter table public.university_programs drop constraint university_programs_cycle_check;
alter table public.university_programs
  add constraint university_programs_cycle_check check (cycle in ('baccalaureat', 'certificat', 'maitrise', 'doctorat', 'doctorat_1er_cycle', 'autre'));

${corpsNeuf}

create temp table _doc1 (id uuid primary key, universite text not null, name text not null, faculte text,
                         lien text not null, rang int not null) on commit drop;
insert into _doc1 values
${lignes.join(",\n")};

do $donnees$
begin
  if exists (select 1 from (select distinct universite from _doc1) u
              where (select count(*) from public.schools s where s.name = u.universite and s.type = 'UNIVERSITE') <> 1) then
    raise exception 'NEXUS: doctorats — université introuvable ou ambiguë : %',
      (select string_agg(u.universite, ', ') from (select distinct universite from _doc1) u
        where (select count(*) from public.schools s where s.name = u.universite and s.type = 'UNIVERSITE') <> 1);
  end if;
  if exists (select 1 from public.university_programs where id in (select id from _doc1)) then
    raise exception 'NEXUS: doctorats — une clé du lot existe déjà';
  end if;
  if exists (select 1 from _doc1 d join public.schools s on s.name = d.universite and s.type = 'UNIVERSITE'
               join public.university_programs up on up.school_id = s.id and lower(btrim(up.name)) = lower(d.name)) then
    raise exception 'NEXUS: doctorats — un programme du lot existe déjà sous ce nom';
  end if;
end $donnees$;

insert into public.university_programs (id, school_id, name, cycle, faculte, lien, is_displayed, position, source, source_url)
select d.id, s.id, d.name, 'doctorat_1er_cycle', d.faculte, d.lien, true,
       coalesce((select max(up.position) + 1 from public.university_programs up where up.school_id = s.id), 0) + d.rang,
       'seed', d.lien
  from _doc1 d join public.schools s on s.name = d.universite and s.type = 'UNIVERSITE';

do $verif$
begin
  if (select count(*) from public.university_programs where id in (select id from _doc1) and cycle = 'doctorat_1er_cycle' and source = 'seed') <> ${N} then
    raise exception 'NEXUS: doctorats — nombre de programmes insérés différent de ${N}';
  end if;
end $verif$;
`;

const rb = `-- Rollback des doctorats de premier cycle (20261029200000) : retire les ${N} programmes pré-remplis du lot, remet la
-- contrainte de cycle et replace_university_programs du lot E3 (vérifié par md5). Refusé si un programme utilise
-- encore 'doctorat_1er_cycle' après le retrait (ajout ou modification par une université). Fichier GÉNÉRÉ.
delete from public.university_programs
 where source = 'seed' and cycle = 'doctorat_1er_cycle'
   and id in (
${ids.map((x) => "     " + x).join(",\n")});
do $$
begin
  if exists (select 1 from public.university_programs where cycle = 'doctorat_1er_cycle') then
    raise exception 'NEXUS: rollback doctorats refusé : % programme(s) utilisent encore le doctorat de 1er cycle',
      (select count(*) from public.university_programs where cycle = 'doctorat_1er_cycle');
  end if;
end $$;
alter table public.university_programs drop constraint university_programs_cycle_check;
alter table public.university_programs
  add constraint university_programs_cycle_check check (cycle in ('baccalaureat', 'certificat', 'maitrise', 'doctorat', 'autre'));

${corpsE3}

do $$
begin
  if md5(pg_get_functiondef('public.replace_university_programs(uuid,jsonb,boolean)'::regprocedure)) <> '${MD5_RPC_E3}' then
    raise exception 'NEXUS: rollback doctorats — corps E3 non retrouvé (md5)';
  end if;
end $$;
`;

for (const [nom, t] of [["migration", mig], ["rollback", rb]]) {
  if (t.includes("$nexus_mig$") || t.includes("$nexus_rb$")) throw new Error("délimiteur présent dans " + nom);
}
fs.writeFileSync(`supabase/migrations/${VERSION}_${NOM}.sql`, mig);
fs.writeFileSync(`supabase/rollback/${VERSION}_rollback_${NOM}.sql`, rb);
console.log(`données ${md5(brut)}  programmes ${N}  universités ${parUniv.size}  migration ${md5(mig)}  rollback ${md5(rb)}`);
console.log("attendus :\n" + attendus.join("\n"));
