// Construit le LOT DE PROD du journal partenaire (20261016150000) — même méthode que les lots coach nommé et D1.
//   cd C:\tmp\nexus-145 ; node docs/partenaire-journal/prod/construire-lot.mjs <empreinte_objets> [--faux]
// Une seule transaction : relevé avant → garde (une transaction, migration absente) → le fichier octet
// pour octet → enregistrement de la version → gardes finales (md5 du texte enregistré, empreinte
// des objets testés en local — corps, droits ET policies des deux journaux —, aucune donnée touchée) → JSON.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const VERSION = "20261016150000";
const NOM = "partenaire_journal";
const FICHIER = path.resolve(`supabase/migrations/${VERSION}_${NOM}.sql`);
const empreinteObjets = process.argv[2];
const faux = process.argv.includes("--faux");
if (!/^[0-9a-f]{32}$/.test(empreinteObjets ?? "")) throw new Error("empreinte des objets attendue (32 hex)");

const brut = fs.readFileSync(FICHIER);
if (brut[0] === 0xef && brut[1] === 0xbb && brut[2] === 0xbf) throw new Error("BOM dans le fichier");
const texte = brut.toString("utf8");
if (texte.includes("\r")) throw new Error("CR dans le fichier : le md5 ne serait pas celui des octets testés");
for (const tag of ["$PJMIG$", "$g$", "$f$", "$e$"]) if (texte.includes(tag)) throw new Error("repère déjà présent : " + tag);
const md5Fichier = crypto.createHash("md5").update(brut).digest("hex");
const empreinte = faux ? "0".repeat(32) : empreinteObjets;
const requeteEmpreinte = fs.readFileSync(path.resolve("docs/partenaire-journal/prod/empreinte-objets.sql"), "utf8")
  .split("\n").filter((l) => !l.startsWith("--")).join("\n").trim().replace(/;$/, "");
// Données : la migration n'en écrit aucune.
const DONNEES = `(select count(*) from public.partner_profile_views) || '|' || (select count(*) from public.partner_card_downloads)
       || '|' || (select count(*) from public.media_partners)`;

const lot = `-- LOT PROD journal partenaire — généré par docs/partenaire-journal/prod/construire-lot.mjs${faux ? " — VARIANTE DE PREUVE (empreinte fausse)" : ""}
-- Fichier : supabase/migrations/${VERSION}_${NOM}.sql — md5 ${md5Fichier}
-- Empreinte attendue des objets : ${empreinte}
-- À envoyer TEL QUEL, en UN SEUL appel : une seule transaction. Une garde qui échoue annule tout.

-- 1. Relevé avant (dans la transaction)
create temp table _pj_releve as
select txid_current() as txid,
       ${DONNEES} as donnees,
       (select count(*) from supabase_migrations.schema_migrations where version = '${VERSION}') as version_deja,
       (select max(version) from supabase_migrations.schema_migrations) as derniere_version,
       current_setting('server_version') as pg;

-- 2. Garde AVANT toute écriture
do $g$
begin
  if (select txid from _pj_releve) <> txid_current() then
    raise exception 'NEXUS LOT: les instructions ne partagent pas une seule transaction — arrêt avant toute écriture';
  end if;
  if (select version_deja from _pj_releve) <> 0 then
    raise exception 'NEXUS LOT: migration journal partenaire déjà présente — rien n''est appliqué';
  end if;
end $g$;

-- 3. ===== DÉBUT ${VERSION}_${NOM}.sql =====
${texte}
-- ===== FIN ${VERSION}_${NOM}.sql =====

-- 4. Enregistrement de la version (statements = le fichier)
create temp table _pj_texte as select $PJMIG$${texte}$PJMIG$::text as t;
do $e$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'supabase_migrations'
               and table_name = 'schema_migrations' and column_name = 'created_by') then
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
             select $1, $2, array[t], $3 from _pj_texte' using '${VERSION}', '${NOM}', 'bptds22@gmail.com';
  else
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements)
             select $1, $2, array[t] from _pj_texte' using '${VERSION}', '${NOM}';
  end if;
end $e$;

-- 5. Gardes finales
do $f$
declare
  v_empreinte text;
  v_n int;
begin
  if (select txid from _pj_releve) <> txid_current() then
    raise exception 'NEXUS LOT: transaction changée en cours de lot';
  end if;
  if (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '${VERSION}')
     is distinct from '${md5Fichier}' then
    raise exception 'NEXUS LOT: le texte enregistré n''est pas le fichier testé (md5)';
  end if;
  select e.empreinte_objets, e.n_elements into v_empreinte, v_n from (
${requeteEmpreinte}
  ) e;
  if v_empreinte is distinct from '${empreinte}' then
    raise exception 'NEXUS LOT: objets créés ≠ objets testés en local (empreinte % / % éléments) — tout est annulé', v_empreinte, v_n;
  end if;
  if ${DONNEES} <> (select donnees from _pj_releve) then
    raise exception 'NEXUS LOT: une donnée a changé — tout est annulé';
  end if;
end $f$;

-- 6. Résultat
select json_build_object(
  'avant', (select row_to_json(r) from (select donnees, version_deja, derniere_version, pg from _pj_releve) r),
  'apres', json_build_object(
     'donnees', ${DONNEES},
     'version', (select version from supabase_migrations.schema_migrations where version = '${VERSION}'),
     'md5_enregistre', (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '${VERSION}'),
     'fonction', to_regprocedure('public.partenaire_journaliser(uuid,text,text)')::text,
     'meme_transaction', (select txid from _pj_releve) = txid_current())
) as resultat_lot_journal_partenaire;
`;

const sortie = path.resolve(`docs/partenaire-journal/prod/${faux ? "lot-preuve-garde-fausse.sql" : "lot-prod.sql"}`);
fs.writeFileSync(sortie, lot);
const marqueDebut = `-- 3. ===== DÉBUT ${VERSION}_${NOM}.sql =====\n`;
const section = lot.slice(lot.indexOf(marqueDebut) + marqueDebut.length, lot.indexOf(`\n-- ===== FIN ${VERSION}_${NOM}.sql =====`));
const lit = lot.slice(lot.indexOf("$PJMIG$") + 7, lot.lastIndexOf("$PJMIG$"));
const md5 = (s) => crypto.createHash("md5").update(Buffer.from(s, "utf8")).digest("hex");
console.log(JSON.stringify({
  lot: path.relative(process.cwd(), sortie), md5_fichier: md5Fichier, md5_section_executee: md5(section),
  md5_litteral_enregistre: md5(lit), md5_lot: md5(lot), octets_lot: Buffer.byteLength(lot), empreinte_attendue: empreinte,
}, null, 1));
