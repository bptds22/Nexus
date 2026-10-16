// Construit le LOT DE PROD de 20261016060000_processus_cartes_rpc — même méthode que push A5 (docs/push-a5/prod).
//   cd C:\tmp\nexus-processus ; node docs/processus-rpc/prod/construire-lot.mjs <empreinte_objets> [--faux]
// Une seule transaction : relevé avant (+ état des objets = relevé prod) → garde (une transaction, migration
// absente, état de départ attendu) → le fichier octet pour octet → enregistrement de la version
// (schema_migrations) → admin_operations → gardes finales (md5 du texte enregistré, empreinte des objets
// testés en local, données inchangées, une opération de plus) → résultat JSON.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const VERSION = "20261016060000";
const NOM = "processus_cartes_rpc";
const ETAT_DEPART = "7cf4b4282075e604ca6b7d74b2c12d24"; // etat-avant.sql : prod relevée le 2026-10-16 = local (12 éléments)
const FICHIER = path.resolve(`supabase/migrations/${VERSION}_${NOM}.sql`);
const empreinteObjets = process.argv[2];
const faux = process.argv.includes("--faux");
if (!/^[0-9a-f]{32}$/.test(empreinteObjets ?? "")) throw new Error("empreinte des objets attendue (32 hex)");

const brut = fs.readFileSync(FICHIER);
if (brut[0] === 0xef && brut[1] === 0xbb && brut[2] === 0xbf) throw new Error("BOM dans le fichier");
const texte = brut.toString("utf8");
if (texte.includes("\r")) throw new Error("CR dans le fichier : le md5 ne serait pas celui des octets testés");
for (const tag of ["$PRMIG$", "$gpr$", "$fpr$", "$epr$"]) if (texte.includes(tag)) throw new Error("repère déjà présent : " + tag);
const md5Fichier = crypto.createHash("md5").update(brut).digest("hex");
const empreinte = faux ? "0".repeat(32) : empreinteObjets;
const lireRequete = (f) => fs.readFileSync(path.resolve(f), "utf8")
  .split("\n").filter((l) => !l.startsWith("--")).join("\n").trim().replace(/;$/, "");
const requeteEmpreinte = lireRequete("docs/processus-rpc/prod/empreinte-objets.sql");
const requeteEtat = lireRequete("docs/processus-rpc/prod/etat-avant.sql");

// Données qui ne doivent PAS changer : la migration ne crée que des fonctions. (Un recruteur qui écrit une carte ou
// une note pendant la seconde que dure le lot ferait échouer cette garde : rien n'est appliqué, on relance.)
const DONNEES = `(select count(*) from public.cartes_prospect) || '|' || (select count(*) from public.cartes_prospect_notes)
       || '|' || (select count(*) from public.recruiter_notes) || '|' || (select count(*) from public.recruiter_pipeline)
       || '|' || (select count(*) from public.users)`;

const lot = `-- LOT PROD processus (cartes et notes par fonctions) — généré par docs/processus-rpc/prod/construire-lot.mjs${faux ? " — VARIANTE DE PREUVE (empreinte fausse)" : ""}
-- Fichier : supabase/migrations/${VERSION}_${NOM}.sql — md5 ${md5Fichier}
-- État de départ attendu des objets : ${ETAT_DEPART} ; empreinte attendue après : ${empreinte}
-- À envoyer TEL QUEL, en UN SEUL appel : une seule transaction. Une garde qui échoue annule tout.

-- 1. Relevé avant (dans la transaction)
create temp table _pr_releve as
select txid_current() as txid,
       ${DONNEES} as donnees,
       (select e.etat from (
${requeteEtat}
       ) e) as etat_objets,
       (select count(*) from public.admin_operations) as operations,
       (select count(*) from supabase_migrations.schema_migrations where version = '${VERSION}') as version_deja,
       (select max(version) from supabase_migrations.schema_migrations) as derniere_version,
       current_setting('server_version') as pg;

-- 2. Garde AVANT toute écriture
do $gpr$
begin
  if (select txid from _pr_releve) <> txid_current() then
    raise exception 'NEXUS LOT: les instructions ne partagent pas une seule transaction — arrêt avant toute écriture';
  end if;
  if (select version_deja from _pr_releve) <> 0 then
    raise exception 'NEXUS LOT: migration processus_cartes_rpc déjà présente — rien n''est appliqué';
  end if;
  if (select etat_objets from _pr_releve) is distinct from '${ETAT_DEPART}' then
    raise exception 'NEXUS LOT: objets de départ ≠ relevé (%) — rien n''est appliqué', (select etat_objets from _pr_releve);
  end if;
end $gpr$;

-- 3. ===== DÉBUT ${VERSION}_${NOM}.sql =====
${texte}
-- ===== FIN ${VERSION}_${NOM}.sql =====

-- 4. Enregistrement de la version (statements = le fichier) et du geste (admin_operations)
create temp table _pr_texte as select $PRMIG$${texte}$PRMIG$::text as t;
do $epr$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'supabase_migrations'
               and table_name = 'schema_migrations' and column_name = 'created_by') then
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
             select $1, $2, array[t], $3 from _pr_texte' using '${VERSION}', '${NOM}', 'bptds22@gmail.com';
  else
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements)
             select $1, $2, array[t] from _pr_texte' using '${VERSION}', '${NOM}';
  end if;
end $epr$;
insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_PROCESSUS_CARTES_RPC',
       'Mon processus : cartes et dernières notes lues par fonctions (ni identifiants dans l''adresse ni plafond de 1000 lignes), export complet (correctif urgent, GO BP)',
       jsonb_build_object('version', '${VERSION}', 'md5_fichier', '${md5Fichier}', 'etat_depart', '${ETAT_DEPART}',
                          'empreinte_objets', '${empreinte}'),
       (select id from public.users where lower(email) = 'bptds22@gmail.com' limit 1);

-- 5. Gardes finales
do $fpr$
declare
  v_empreinte text;
  v_n int;
begin
  if (select txid from _pr_releve) <> txid_current() then
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
  if ${DONNEES} <> (select donnees from _pr_releve) then
    raise exception 'NEXUS LOT: une donnée a changé — tout est annulé';
  end if;
  if (select count(*) from public.admin_operations) <> (select operations + 1 from _pr_releve) then
    raise exception 'NEXUS LOT: admin_operations non enregistrée — tout est annulé';
  end if;
end $fpr$;

-- 6. Résultat
select json_build_object(
  'avant', (select row_to_json(r) from (select donnees, etat_objets, operations, version_deja, derniere_version, pg from _pr_releve) r),
  'apres', json_build_object(
     'donnees', ${DONNEES},
     'version', (select version from supabase_migrations.schema_migrations where version = '${VERSION}'),
     'md5_enregistre', (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '${VERSION}'),
     'admin_operation', (select id from public.admin_operations where operation = 'MIGRATION_PROCESSUS_CARTES_RPC' order by le desc limit 1),
     'fonctions', (select count(*) from pg_proc where pronamespace = 'public'::regnamespace
                     and proname in ('processus_cartes', 'processus_dernieres_notes_cartes', 'processus_dernieres_notes',
                                     'processus_notes_export')),
     'meme_transaction', (select txid from _pr_releve) = txid_current())
) as resultat_lot_processus;
`;

const sortie = path.resolve(`docs/processus-rpc/prod/${faux ? "lot-preuve-garde-fausse.sql" : "lot-prod.sql"}`);
fs.writeFileSync(sortie, lot);
const marqueDebut = `-- 3. ===== DÉBUT ${VERSION}_${NOM}.sql =====\n`;
const section = lot.slice(lot.indexOf(marqueDebut) + marqueDebut.length, lot.indexOf(`\n-- ===== FIN ${VERSION}_${NOM}.sql =====`));
const lit = lot.slice(lot.indexOf("$PRMIG$") + 7, lot.lastIndexOf("$PRMIG$"));
const md5 = (s) => crypto.createHash("md5").update(Buffer.from(s, "utf8")).digest("hex");
console.log(JSON.stringify({
  lot: path.relative(process.cwd(), sortie), md5_fichier: md5Fichier, md5_section_executee: md5(section),
  md5_litteral_enregistre: md5(lit), md5_lot: md5(lot), octets_lot: Buffer.byteLength(lot), empreinte_attendue: empreinte,
}, null, 1));
