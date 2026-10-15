// Construit le LOT DE PROD des grades D+/E — même méthode que D1b (docs/noms-d1b/prod/construire-lot.mjs).
//   cd C:\tmp\nexus-laureats ; node docs/import-laureats/prod/construire-lot-grades.mjs [--faux]
// Une seule transaction : relevé avant → garde (une transaction, version absente) → le fichier octet
// pour octet → enregistrement de la version → gardes finales (md5 du texte enregistré, définitions
// exactes des deux CHECK, aucune ligne de grade modifiée) → résultat JSON.
// --faux : variante de preuve dont la garde finale échoue (définition attendue fausse).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const VERSION = "20261015130353";
const NOM = "grades_d_plus_e";
const FICHIER = path.resolve(`supabase/migrations/${VERSION}_${NOM}.sql`);
const faux = process.argv.includes("--faux");

const brut = fs.readFileSync(FICHIER);
if (brut[0] === 0xef && brut[1] === 0xbb && brut[2] === 0xbf) throw new Error("BOM dans le fichier");
const texte = brut.toString("utf8");
if (texte.includes("\r")) throw new Error("CR dans le fichier : le md5 ne serait pas celui des octets testés");
for (const tag of ["$GRMIG$", "$g$", "$f$", "$e$"]) if (texte.includes(tag)) throw new Error("repère déjà présent : " + tag);
const md5Fichier = crypto.createHash("md5").update(brut).digest("hex");

// Définitions attendues APRÈS la migration, relevées en local (pg_get_constraintdef).
const DEF_CARTES = "CHECK (((grade IS NULL) OR (grade = ANY (ARRAY['A+'::text, 'A'::text, 'B+'::text, 'B'::text, 'C+'::text, 'C'::text, 'D+'::text, 'D'::text, 'E'::text]))))";
const DEF_GRADES = faux ? "CHECK (faux)"
  : "CHECK (((grade)::text = ANY ((ARRAY['A+'::character varying, 'A'::character varying, 'B+'::character varying, 'B'::character varying, 'C+'::character varying, 'C'::character varying, 'D+'::character varying, 'D'::character varying, 'E'::character varying])::text[])))";
const q = (s) => "'" + s.replace(/'/g, "''") + "'";
const EMPREINTE_GRADES = "md5(coalesce((select string_agg(id::text || '|' || coalesce(grade, ''), ',' order by id) from public.cartes_prospect), '')) || md5(coalesce((select string_agg(recruiter_id::text || '|' || athlete_id::text || '|' || grade, ',' order by recruiter_id, athlete_id) from public.recruiter_athlete_grades), ''))";

const lot = `-- LOT PROD grades D+/E — généré par docs/import-laureats/prod/construire-lot-grades.mjs${faux ? " — VARIANTE DE PREUVE (garde finale fausse)" : ""}
-- Fichier : supabase/migrations/${VERSION}_${NOM}.sql — md5 ${md5Fichier}
-- À envoyer TEL QUEL, en UN SEUL appel : une seule transaction. Une garde qui échoue annule tout.

-- 1. Relevé avant (dans la transaction)
create temp table _gr_releve as
select txid_current() as txid,
       (select count(*) from public.cartes_prospect) as cartes,
       (select count(*) from public.recruiter_athlete_grades) as grades_recruteurs,
       ${EMPREINTE_GRADES} as empreinte_grades,
       (select count(*) from supabase_migrations.schema_migrations where version = '${VERSION}') as version_deja,
       (select max(version) from supabase_migrations.schema_migrations) as derniere_version;

-- 2. Garde AVANT toute écriture
do $g$
begin
  if (select txid from _gr_releve) <> txid_current() then
    raise exception 'NEXUS LOT: les instructions ne partagent pas une seule transaction — arrêt avant toute écriture';
  end if;
  if (select version_deja from _gr_releve) <> 0 then
    raise exception 'NEXUS LOT: grades D+/E déjà présents — rien n''est appliqué';
  end if;
end $g$;

-- 3. ===== DÉBUT ${VERSION}_${NOM}.sql =====
${texte}
-- ===== FIN ${VERSION}_${NOM}.sql =====

-- 4. Enregistrement de la version (statements = le fichier)
create temp table _gr_texte as select $GRMIG$${texte}$GRMIG$::text as t;
do $e$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'supabase_migrations'
               and table_name = 'schema_migrations' and column_name = 'created_by') then
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
             select $1, $2, array[t], $3 from _gr_texte' using '${VERSION}', '${NOM}', 'bptds22@gmail.com';
  else
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements)
             select $1, $2, array[t] from _gr_texte' using '${VERSION}', '${NOM}';
  end if;
end $e$;

-- 5. Gardes finales
do $f$
begin
  if (select txid from _gr_releve) <> txid_current() then
    raise exception 'NEXUS LOT: transaction changée en cours de lot';
  end if;
  if (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '${VERSION}')
     is distinct from '${md5Fichier}' then
    raise exception 'NEXUS LOT: le texte enregistré n''est pas le fichier testé (md5)';
  end if;
  if (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.cartes_prospect'::regclass
        and conname = 'cartes_prospect_grade_check') is distinct from ${q(DEF_CARTES)} then
    raise exception 'NEXUS LOT: CHECK de cartes_prospect différent de celui testé en local — tout est annulé';
  end if;
  if (select pg_get_constraintdef(oid) from pg_constraint where conrelid = 'public.recruiter_athlete_grades'::regclass
        and conname = 'recruiter_athlete_grades_grade_check') is distinct from ${q(DEF_GRADES)} then
    raise exception 'NEXUS LOT: CHECK de recruiter_athlete_grades différent de celui testé en local — tout est annulé';
  end if;
  if (select count(*) from public.cartes_prospect) <> (select cartes from _gr_releve)
     or (select count(*) from public.recruiter_athlete_grades) <> (select grades_recruteurs from _gr_releve)
     or ${EMPREINTE_GRADES} <> (select empreinte_grades from _gr_releve) then
    raise exception 'NEXUS LOT: une ligne de grade a changé — tout est annulé';
  end if;
end $f$;

-- 6. Résultat
select json_build_object(
  'avant', (select row_to_json(r) from (select cartes, grades_recruteurs, version_deja, derniere_version from _gr_releve) r),
  'apres', json_build_object(
     'cartes', (select count(*) from public.cartes_prospect),
     'grades_recruteurs', (select count(*) from public.recruiter_athlete_grades),
     'version', (select version from supabase_migrations.schema_migrations where version = '${VERSION}'),
     'md5_enregistre', (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '${VERSION}'),
     'meme_transaction', (select txid from _gr_releve) = txid_current())
) as resultat_lot_grades;
`;

const sortie = path.resolve(`docs/import-laureats/prod/${faux ? "lot-grades-preuve-garde-fausse.sql" : "lot-grades-prod.sql"}`);
fs.writeFileSync(sortie, lot);
const marqueDebut = `-- 3. ===== DÉBUT ${VERSION}_${NOM}.sql =====\n`;
const section = lot.slice(lot.indexOf(marqueDebut) + marqueDebut.length, lot.indexOf(`\n-- ===== FIN ${VERSION}_${NOM}.sql =====`));
const lit = lot.slice(lot.indexOf("$GRMIG$") + 7, lot.lastIndexOf("$GRMIG$"));
const md5 = (s) => crypto.createHash("md5").update(Buffer.from(s, "utf8")).digest("hex");
console.log(JSON.stringify({
  lot: path.relative(process.cwd(), sortie), md5_fichier: md5Fichier, md5_section_executee: md5(section),
  md5_litteral_enregistre: md5(lit), md5_lot: md5(lot), octets_lot: Buffer.byteLength(lot),
}, null, 1));
