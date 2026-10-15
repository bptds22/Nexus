// Construit le LOT DE PROD de D1 : le texte exact à envoyer par le connecteur Supabase, en UN appel.
//   cd C:\tmp\nexus-w4bc ; node docs/doublons-d1/prod/construire-lot.mjs <empreinte_objets> [--faux]
// <empreinte_objets> : rendue par empreinte-objets.sql en LOCAL, après application du fichier testé.
// --faux : variante de PREUVE (empreinte attendue volontairement fausse) → la dernière garde échoue.
//
// Contenu, dans l'ordre (une seule transaction : un seul message, plusieurs instructions) :
//  1. relevé avant, dans la transaction (table temporaire, avec l'identifiant de transaction) ;
//  2. garde « une seule transaction » + « D1 absente » — AVANT toute écriture ;
//  3. le fichier de migration, octet pour octet, entre deux repères ;
//  4. l'enregistrement de la version (statements = le fichier, comme les lots précédents) ;
//  5. gardes finales : texte enregistré = fichier testé (md5), objets créés = objets testés
//     (empreinte), aucune fiche athlète touchée, même transaction ;
//  6. un SELECT final : relevé avant + après (le connecteur ne rend que le dernier résultat).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const VERSION = "20261015094834";
const NOM = "d1_doublons_athletes";
const FICHIER = path.resolve(`supabase/migrations/${VERSION}_${NOM}.sql`);
const empreinteObjets = process.argv[2];
const faux = process.argv.includes("--faux");
if (!/^[0-9a-f]{32}$/.test(empreinteObjets ?? "")) throw new Error("empreinte des objets attendue (32 hex)");

const brut = fs.readFileSync(FICHIER);
if (brut[0] === 0xef && brut[1] === 0xbb && brut[2] === 0xbf) throw new Error("BOM dans le fichier");
const texte = brut.toString("utf8");
if (texte.includes("\r")) throw new Error("CR dans le fichier : le md5 ne serait pas celui des octets testés");
for (const tag of ["$D1MIG$", "$g$", "$f$", "$e$"]) if (texte.includes(tag)) throw new Error("repère déjà présent : " + tag);
const md5Fichier = crypto.createHash("md5").update(brut).digest("hex");
const empreinte = faux ? "0".repeat(32) : empreinteObjets;
const requeteEmpreinte = fs.readFileSync(path.resolve("docs/doublons-d1/prod/empreinte-objets.sql"), "utf8")
  .split("\n").filter((l) => !l.startsWith("--")).join("\n").trim().replace(/;$/, "");

const lot = `-- LOT PROD D1 — généré par docs/doublons-d1/prod/construire-lot.mjs${faux ? " — VARIANTE DE PREUVE (empreinte fausse)" : ""}
-- Fichier : supabase/migrations/${VERSION}_${NOM}.sql — md5 ${md5Fichier}
-- Empreinte attendue des objets : ${empreinte}
-- À envoyer TEL QUEL, en UN SEUL appel : une seule transaction. Une garde qui échoue annule tout.

-- 1. Relevé avant (dans la transaction)
create temp table _d1_releve as
select txid_current() as txid,
       (select count(*) from public.athletes) as athletes,
       md5(coalesce((select string_agg(id::text || coalesce(first_name, '') || coalesce(last_name, '') || coalesce(date_naissance::text, '') || status::text, ',' order by id) from public.athletes), '')) as athletes_md5,
       (select count(*) from supabase_migrations.schema_migrations where version = '${VERSION}') as version_deja,
       (select max(version) from supabase_migrations.schema_migrations) as derniere_version,
       to_regclass('public.doublons_probables') is not null or to_regclass('public.doublons_verifications') is not null as tables_deja,
       current_setting('server_version') as pg;

-- 2. Garde AVANT toute écriture
do $g$
begin
  if (select txid from _d1_releve) <> txid_current() then
    raise exception 'NEXUS LOT: les instructions ne partagent pas une seule transaction — arrêt avant toute écriture';
  end if;
  if (select version_deja from _d1_releve) <> 0 or (select tables_deja from _d1_releve) then
    raise exception 'NEXUS LOT: D1 déjà présente — rien n''est appliqué';
  end if;
end $g$;

-- 3. ===== DÉBUT ${VERSION}_${NOM}.sql =====
${texte}
-- ===== FIN ${VERSION}_${NOM}.sql =====

-- 4. Enregistrement de la version (même forme que W4a : statements = le fichier).
--    created_by existe en prod, pas dans la base locale (CLI plus ancienne) : même lot aux deux endroits.
create temp table _d1_texte as select $D1MIG$${texte}$D1MIG$::text as t;
do $e$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'supabase_migrations'
               and table_name = 'schema_migrations' and column_name = 'created_by') then
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
             select $1, $2, array[t], $3 from _d1_texte' using '${VERSION}', '${NOM}', 'bptds22@gmail.com';
  else
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements)
             select $1, $2, array[t] from _d1_texte' using '${VERSION}', '${NOM}';
  end if;
end $e$;

-- 5. Gardes finales
do $f$
declare
  v_empreinte text;
  v_n int;
begin
  if (select txid from _d1_releve) <> txid_current() then
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
  if (select count(*) from public.athletes) <> (select athletes from _d1_releve)
     or md5(coalesce((select string_agg(id::text || coalesce(first_name, '') || coalesce(last_name, '') || coalesce(date_naissance::text, '') || status::text, ',' order by id) from public.athletes), ''))
        <> (select athletes_md5 from _d1_releve) then
    raise exception 'NEXUS LOT: une fiche athlète a changé — tout est annulé';
  end if;
  if (select count(*) from public.doublons_probables) <> 0 or (select count(*) from public.doublons_verifications) <> 0 then
    raise exception 'NEXUS LOT: les tables D1 doivent être vides';
  end if;
end $f$;

-- 6. Résultat
select json_build_object(
  'avant', (select row_to_json(r) from (select athletes, version_deja, derniere_version, tables_deja, pg from _d1_releve) r),
  'apres', json_build_object(
     'athletes', (select count(*) from public.athletes),
     'version', (select version from supabase_migrations.schema_migrations where version = '${VERSION}'),
     'md5_enregistre', (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '${VERSION}'),
     'tables', (select count(*) from pg_class where oid in (to_regclass('public.doublons_probables'), to_regclass('public.doublons_verifications'))),
     'purge', (select count(*) from cron.job where jobname = 'doublons-verifications-purge'),
     'meme_transaction', (select txid from _d1_releve) = txid_current())
) as resultat_lot_d1;
`;

const sortie = path.resolve(`docs/doublons-d1/prod/${faux ? "lot-preuve-garde-fausse.sql" : "lot-prod.sql"}`);
fs.writeFileSync(sortie, lot);
const debut = lot.indexOf(`-- 3. ===== DÉBUT ${VERSION}_${NOM}.sql =====\n`) + `-- 3. ===== DÉBUT ${VERSION}_${NOM}.sql =====\n`.length;
const fin = lot.indexOf(`\n-- ===== FIN ${VERSION}_${NOM}.sql =====`);
const section = lot.slice(debut, fin);
const lit = lot.slice(lot.indexOf("$D1MIG$") + 7, lot.lastIndexOf("$D1MIG$"));
const md5 = (s) => crypto.createHash("md5").update(Buffer.from(s, "utf8")).digest("hex");
console.log(JSON.stringify({
  lot: path.relative(process.cwd(), sortie),
  md5_fichier: md5Fichier,
  md5_section_executee: md5(section),
  md5_litteral_enregistre: md5(lit),
  md5_lot: md5(lot),
  octets_lot: Buffer.byteLength(lot),
  empreinte_attendue: empreinte,
}, null, 1));
