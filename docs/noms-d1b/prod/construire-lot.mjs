// Construit le LOT DE PROD de D1b — même méthode que D1 (docs/doublons-d1/prod/construire-lot.mjs).
//   cd C:\tmp\nexus-w4bc ; node docs/noms-d1b/prod/construire-lot.mjs <empreinte_objets> [--faux]
// Une seule transaction : relevé avant → garde (une transaction, D1b absente) → le fichier octet
// pour octet → enregistrement de la version → gardes finales (md5 du texte enregistré, empreinte
// des objets testés en local, aucune fiche ni aucun compte marqués, noms des fiches inchangés)
// → résultat JSON.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const VERSION = "20261015103315";
const NOM = "d1b_nom_a_confirmer";
const FICHIER = path.resolve(`supabase/migrations/${VERSION}_${NOM}.sql`);
const empreinteObjets = process.argv[2];
const faux = process.argv.includes("--faux");
if (!/^[0-9a-f]{32}$/.test(empreinteObjets ?? "")) throw new Error("empreinte des objets attendue (32 hex)");

const brut = fs.readFileSync(FICHIER);
if (brut[0] === 0xef && brut[1] === 0xbb && brut[2] === 0xbf) throw new Error("BOM dans le fichier");
const texte = brut.toString("utf8");
if (texte.includes("\r")) throw new Error("CR dans le fichier : le md5 ne serait pas celui des octets testés");
for (const tag of ["$D1BMIG$", "$g$", "$f$", "$e$"]) if (texte.includes(tag)) throw new Error("repère déjà présent : " + tag);
const md5Fichier = crypto.createHash("md5").update(brut).digest("hex");
const empreinte = faux ? "0".repeat(32) : empreinteObjets;
const requeteEmpreinte = fs.readFileSync(path.resolve("docs/noms-d1b/prod/empreinte-objets.sql"), "utf8")
  .split("\n").filter((l) => !l.startsWith("--")).join("\n").trim().replace(/;$/, "");
const NOMS_FICHES = "md5(coalesce((select string_agg(id::text || '|' || coalesce(first_name, '') || '|' || coalesce(last_name, '') || '|' || status::text, ',' order by id) from public.athletes), ''))";
const NOMS_COMPTES = "md5(coalesce((select string_agg(id::text || '|' || coalesce(first_name, '') || '|' || coalesce(last_name, ''), ',' order by id) from public.users), ''))";

const lot = `-- LOT PROD D1b — généré par docs/noms-d1b/prod/construire-lot.mjs${faux ? " — VARIANTE DE PREUVE (empreinte fausse)" : ""}
-- Fichier : supabase/migrations/${VERSION}_${NOM}.sql — md5 ${md5Fichier}
-- Empreinte attendue des objets : ${empreinte}
-- À envoyer TEL QUEL, en UN SEUL appel : une seule transaction. Une garde qui échoue annule tout.

-- 1. Relevé avant (dans la transaction)
create temp table _d1b_releve as
select txid_current() as txid,
       (select count(*) from public.athletes) as athletes,
       ${NOMS_FICHES} as noms_fiches,
       ${NOMS_COMPTES} as noms_comptes,
       (select count(*) from public.athletes where status <> 'SUPPRIME' and (coalesce(btrim(first_name), '') = '' or coalesce(btrim(last_name), '') = '')) as fiches_sans_nom,
       (select count(*) from supabase_migrations.schema_migrations where version = '${VERSION}') as version_deja,
       (select max(version) from supabase_migrations.schema_migrations) as derniere_version,
       current_setting('server_version') as pg;

-- 2. Garde AVANT toute écriture
do $g$
begin
  if (select txid from _d1b_releve) <> txid_current() then
    raise exception 'NEXUS LOT: les instructions ne partagent pas une seule transaction — arrêt avant toute écriture';
  end if;
  if (select version_deja from _d1b_releve) <> 0 then
    raise exception 'NEXUS LOT: D1b déjà présente — rien n''est appliqué';
  end if;
end $g$;

-- 3. ===== DÉBUT ${VERSION}_${NOM}.sql =====
${texte}
-- ===== FIN ${VERSION}_${NOM}.sql =====

-- 4. Enregistrement de la version (statements = le fichier)
create temp table _d1b_texte as select $D1BMIG$${texte}$D1BMIG$::text as t;
do $e$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'supabase_migrations'
               and table_name = 'schema_migrations' and column_name = 'created_by') then
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
             select $1, $2, array[t], $3 from _d1b_texte' using '${VERSION}', '${NOM}', 'bptds22@gmail.com';
  else
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements)
             select $1, $2, array[t] from _d1b_texte' using '${VERSION}', '${NOM}';
  end if;
end $e$;

-- 5. Gardes finales
do $f$
declare
  v_empreinte text;
  v_n int;
begin
  if (select txid from _d1b_releve) <> txid_current() then
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
  if (select count(*) from public.athletes) <> (select athletes from _d1b_releve)
     or ${NOMS_FICHES} <> (select noms_fiches from _d1b_releve)
     or ${NOMS_COMPTES} <> (select noms_comptes from _d1b_releve) then
    raise exception 'NEXUS LOT: un nom de fiche ou de compte a changé — tout est annulé';
  end if;
  if exists (select 1 from public.athletes where nom_a_confirmer) or exists (select 1 from public.users where nom_a_confirmer) then
    raise exception 'NEXUS LOT: aucune fiche ni aucun compte existants ne doivent être marqués';
  end if;
end $f$;

-- 6. Résultat
select json_build_object(
  'avant', (select row_to_json(r) from (select athletes, fiches_sans_nom, version_deja, derniere_version, pg from _d1b_releve) r),
  'apres', json_build_object(
     'athletes', (select count(*) from public.athletes),
     'version', (select version from supabase_migrations.schema_migrations where version = '${VERSION}'),
     'md5_enregistre', (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '${VERSION}'),
     'colonnes', (select count(*) from information_schema.columns where table_schema = 'public' and column_name = 'nom_a_confirmer'),
     'marques', (select count(*) from public.athletes where nom_a_confirmer) + (select count(*) from public.users where nom_a_confirmer),
     'meme_transaction', (select txid from _d1b_releve) = txid_current())
) as resultat_lot_d1b;
`;

const sortie = path.resolve(`docs/noms-d1b/prod/${faux ? "lot-preuve-garde-fausse.sql" : "lot-prod.sql"}`);
fs.writeFileSync(sortie, lot);
const marqueDebut = `-- 3. ===== DÉBUT ${VERSION}_${NOM}.sql =====\n`;
const section = lot.slice(lot.indexOf(marqueDebut) + marqueDebut.length, lot.indexOf(`\n-- ===== FIN ${VERSION}_${NOM}.sql =====`));
const lit = lot.slice(lot.indexOf("$D1BMIG$") + 8, lot.lastIndexOf("$D1BMIG$"));
const md5 = (s) => crypto.createHash("md5").update(Buffer.from(s, "utf8")).digest("hex");
console.log(JSON.stringify({
  lot: path.relative(process.cwd(), sortie), md5_fichier: md5Fichier, md5_section_executee: md5(section),
  md5_litteral_enregistre: md5(lit), md5_lot: md5(lot), octets_lot: Buffer.byteLength(lot), empreinte_attendue: empreinte,
}, null, 1));
