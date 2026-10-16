// Construit le LOT DE PROD du push A5 — même méthode que A4a (docs/push-a4a/prod).
//   cd C:\tmp\nexus-a5 ; node docs/push-a5/prod/construire-lot.mjs <empreinte_objets> [--faux]
// Une seule transaction : relevé avant (+ état des objets = relevé prod) → garde (une transaction, migration
// absente, état de départ attendu) → le fichier octet pour octet → enregistrement de la version
// (schema_migrations) → admin_operations → gardes finales (md5 du texte enregistré, empreinte des objets
// testés en local, données inchangées, une opération de plus) → résultat JSON.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const VERSION = "20261016020000";
const NOM = "push_a5_ouverture";
const ETAT_DEPART = "a356cc149bde5a47d7ba7b06af675d0e"; // etat-avant.sql : prod relevée le 2026-10-16 = local A4a
const FICHIER = path.resolve(`supabase/migrations/${VERSION}_${NOM}.sql`);
const empreinteObjets = process.argv[2];
const faux = process.argv.includes("--faux");
if (!/^[0-9a-f]{32}$/.test(empreinteObjets ?? "")) throw new Error("empreinte des objets attendue (32 hex)");

const brut = fs.readFileSync(FICHIER);
if (brut[0] === 0xef && brut[1] === 0xbb && brut[2] === 0xbf) throw new Error("BOM dans le fichier");
const texte = brut.toString("utf8");
if (texte.includes("\r")) throw new Error("CR dans le fichier : le md5 ne serait pas celui des octets testés");
for (const tag of ["$P5MIG$", "$g5$", "$f5$", "$e5$"]) if (texte.includes(tag)) throw new Error("repère déjà présent : " + tag);
const md5Fichier = crypto.createHash("md5").update(brut).digest("hex");
const empreinte = faux ? "0".repeat(32) : empreinteObjets;
const lireRequete = (f) => fs.readFileSync(path.resolve(f), "utf8")
  .split("\n").filter((l) => !l.startsWith("--")).join("\n").trim().replace(/;$/, "");
const requeteEmpreinte = lireRequete("docs/push-a5/prod/empreinte-objets.sql");
const requeteEtat = lireRequete("docs/push-a5/prod/etat-avant.sql");

// Données qui ne doivent PAS changer : la migration ne touche aucune ligne.
const DONNEES = `(select count(*) from public.athlete_notifications) || '|' || (select count(*) from public.push_file)
       || '|' || (select count(*) from public.push_envois) || '|' || (select count(*) from public.push_preferences)
       || '|' || (select count(*) from public.device_tokens) || '|' || (select count(*) from public.athletes)
       || '|' || (select count(*) from public.athlete_badges) || '|' || (select count(*) from public.evaluations)
       || '|' || (select count(*) from public.partner_athlete_badges) || '|' || (select count(*) from public.partner_evaluations)
       || '|' || (select md5(coalesce(string_agg(type || ':' || n, ',' order by type), '')) from
                  (select type, count(*) n from public.athlete_notifications group by type) t)`;

const lot = `-- LOT PROD push A5 — généré par docs/push-a5/prod/construire-lot.mjs${faux ? " — VARIANTE DE PREUVE (empreinte fausse)" : ""}
-- Fichier : supabase/migrations/${VERSION}_${NOM}.sql — md5 ${md5Fichier}
-- État de départ attendu des objets : ${ETAT_DEPART} ; empreinte attendue après : ${empreinte}
-- À envoyer TEL QUEL, en UN SEUL appel : une seule transaction. Une garde qui échoue annule tout.

-- 1. Relevé avant (dans la transaction)
create temp table _p5_releve as
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
do $g5$
begin
  if (select txid from _p5_releve) <> txid_current() then
    raise exception 'NEXUS LOT: les instructions ne partagent pas une seule transaction — arrêt avant toute écriture';
  end if;
  if (select version_deja from _p5_releve) <> 0 then
    raise exception 'NEXUS LOT: migration push A5 déjà présente — rien n''est appliqué';
  end if;
  if (select etat_objets from _p5_releve) is distinct from '${ETAT_DEPART}' then
    raise exception 'NEXUS LOT: objets de départ ≠ relevé (%) — rien n''est appliqué', (select etat_objets from _p5_releve);
  end if;
end $g5$;

-- 3. ===== DÉBUT ${VERSION}_${NOM}.sql =====
${texte}
-- ===== FIN ${VERSION}_${NOM}.sql =====

-- 4. Enregistrement de la version (statements = le fichier) et du geste (admin_operations)
create temp table _p5_texte as select $P5MIG$${texte}$P5MIG$::text as t;
do $e5$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'supabase_migrations'
               and table_name = 'schema_migrations' and column_name = 'created_by') then
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
             select $1, $2, array[t], $3 from _p5_texte' using '${VERSION}', '${NOM}', 'bptds22@gmail.com';
  else
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements)
             select $1, $2, array[t] from _p5_texte' using '${VERSION}', '${NOM}';
  end if;
end $e5$;
insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_PUSH_A5',
       'Push A5 : nx_type et route dans le push (ouverture au clic, 1.4.5), une notification de cloche par push (GO BP)',
       jsonb_build_object('version', '${VERSION}', 'md5_fichier', '${md5Fichier}', 'etat_depart', '${ETAT_DEPART}',
                          'empreinte_objets', '${empreinte}'),
       (select id from public.users where lower(email) = 'bptds22@gmail.com' limit 1);

-- 5. Gardes finales
do $f5$
declare
  v_empreinte text;
  v_n int;
begin
  if (select txid from _p5_releve) <> txid_current() then
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
  if ${DONNEES} <> (select donnees from _p5_releve) then
    raise exception 'NEXUS LOT: une donnée a changé — tout est annulé';
  end if;
  if (select count(*) from public.admin_operations) <> (select operations + 1 from _p5_releve) then
    raise exception 'NEXUS LOT: admin_operations non enregistrée — tout est annulé';
  end if;
end $f5$;

-- 6. Résultat
select json_build_object(
  'avant', (select row_to_json(r) from (select donnees, etat_objets, operations, version_deja, derniere_version, pg from _p5_releve) r),
  'apres', json_build_object(
     'donnees', ${DONNEES},
     'version', (select version from supabase_migrations.schema_migrations where version = '${VERSION}'),
     'md5_enregistre', (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '${VERSION}'),
     'admin_operation', (select id from public.admin_operations where operation = 'MIGRATION_PUSH_A5' order by le desc limit 1),
     'destination_badge', public.push_destination('BADGE_COACH'),
     'meme_transaction', (select txid from _p5_releve) = txid_current())
) as resultat_lot_push_a5;
`;

const sortie = path.resolve(`docs/push-a5/prod/${faux ? "lot-preuve-garde-fausse.sql" : "lot-prod.sql"}`);
fs.writeFileSync(sortie, lot);
const marqueDebut = `-- 3. ===== DÉBUT ${VERSION}_${NOM}.sql =====\n`;
const section = lot.slice(lot.indexOf(marqueDebut) + marqueDebut.length, lot.indexOf(`\n-- ===== FIN ${VERSION}_${NOM}.sql =====`));
const lit = lot.slice(lot.indexOf("$P5MIG$") + 7, lot.lastIndexOf("$P5MIG$"));
const md5 = (s) => crypto.createHash("md5").update(Buffer.from(s, "utf8")).digest("hex");
console.log(JSON.stringify({
  lot: path.relative(process.cwd(), sortie), md5_fichier: md5Fichier, md5_section_executee: md5(section),
  md5_litteral_enregistre: md5(lit), md5_lot: md5(lot), octets_lot: Buffer.byteLength(lot), empreinte_attendue: empreinte,
}, null, 1));
