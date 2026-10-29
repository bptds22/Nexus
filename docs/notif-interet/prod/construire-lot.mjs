// Construit le LOT DE PROD « notif intérêt recruteur » — même méthode que push A5 (docs/push-a5/prod).
//   cd C:\tmp\nexus-merge-notif-interet ; node docs/notif-interet/prod/construire-lot.mjs [--faux]
// Une seule transaction : relevé avant → garde (une transaction, version absente et postérieure à la dernière,
// lot non appliqué (autant de MIGRATION que de ROLLBACK dans admin_operations), état de départ = prod relevée) → la migration telle que git la stocke (LF) →
// schema_migrations + admin_operations → gardes finales (md5 du texte enregistré, empreinte = local,
// données inchangées, une opération de plus) → résultat JSON. Une garde qui échoue annule tout.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const VERSION = "20261029170000";
const NOM = "notif_interet_recruteur";
const OPERATION = "MIGRATION_NOTIF_INTERET_RECRUTEUR";
const ETAT_DEPART = "bba20215160886b637ed628bbe4fa293"; // etat-objets.sql : prod relue le 2026-10-29 17 h 03 UTC (|51)
const ETAT_APRES = "619e5f2e9620c07c15d7fb66b9388f80";  // etat-objets.sql : pile NexusNotif après migration (|59)
const faux = process.argv.includes("--faux");

const texte = execFileSync("git", ["show", `HEAD:supabase/migrations/${VERSION}_${NOM}.sql`], { encoding: "utf8" });
if (texte.charCodeAt(0) === 0xfeff) throw new Error("BOM dans le fichier");
if (texte.includes("\r")) throw new Error("CR dans le fichier : le md5 ne serait pas celui des octets testés");
for (const tag of ["$NXMIG$", "$gni$", "$eni$", "$fni$"]) if (texte.includes(tag)) throw new Error("repère déjà présent : " + tag);
if (/^\s*(begin|commit|rollback)\s*;/im.test(texte)) throw new Error("begin/commit au niveau du fichier : la transaction du lot serait coupée");
const md5 = (s) => crypto.createHash("md5").update(Buffer.from(s, "utf8")).digest("hex");
const md5Fichier = md5(texte);
const etatApres = faux ? "0".repeat(32) : ETAT_APRES;
const requeteEtat = fs.readFileSync(path.resolve("docs/notif-interet/etat-objets.sql"), "utf8")
  .split("\n").filter((l) => !l.startsWith("--")).join("\n").trim().replace(/;$/, "");

// Données qui ne doivent PAS changer : la migration ne touche aucune ligne.
const DONNEES = `(select count(*) from public.athlete_notifications) || '|' || (select count(*) from public.push_file)
       || '|' || (select count(*) from public.push_envois) || '|' || (select count(*) from public.push_preferences)
       || '|' || (select count(*) from public.device_tokens) || '|' || (select count(*) from public.recruiter_favorites)
       || '|' || (select count(*) from public.recruiter_list_members) || '|' || (select count(*) from public.recruiter_pipeline)
       || '|' || (select count(*) from public.recruiter_athlete_views) || '|' || (select count(*) from public.parent_contact_avis)`;

const lot = `-- LOT PROD notif intérêt recruteur — généré par docs/notif-interet/prod/construire-lot.mjs${faux ? " — VARIANTE DE PREUVE (empreinte fausse)" : ""}
-- Fichier : supabase/migrations/${VERSION}_${NOM}.sql (git, LF) — md5 ${md5Fichier}
-- État de départ attendu : ${ETAT_DEPART}|51 ; attendu après : ${etatApres}|59
-- À envoyer TEL QUEL, en UN SEUL appel : une seule transaction. Une garde qui échoue annule tout.

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- 1. Relevé avant (dans la transaction)
create temp table _ni_releve on commit drop as
select txid_current() as txid,
       ${DONNEES} as donnees,
       (${requeteEtat}) as etat_objets,
       (select count(*) from public.admin_operations) as operations,
       (select count(*) filter (where operation = 'MIGRATION_NOTIF_INTERET_RECRUTEUR')
              - count(*) filter (where operation = 'ROLLBACK_NOTIF_INTERET_RECRUTEUR')
          from public.admin_operations) as traces_lot,
       (select count(*) from supabase_migrations.schema_migrations where version = '${VERSION}') as version_deja,
       (select max(version) from supabase_migrations.schema_migrations) as derniere_version,
       current_setting('server_version') as pg;

-- 2. Garde AVANT toute écriture
do $gni$
begin
  if (select txid from _ni_releve) <> txid_current() then
    raise exception 'NEXUS LOT: les instructions ne partagent pas une seule transaction — arrêt avant toute écriture';
  end if;
  if (select version_deja from _ni_releve) <> 0 or (select traces_lot from _ni_releve) <> 0 then
    raise exception 'NEXUS LOT: version ${VERSION} présente ou lot déjà appliqué (MIGRATION sans ROLLBACK) — rien n''est appliqué';
  end if;
  if (select derniere_version from _ni_releve) >= '${VERSION}' then
    raise exception 'NEXUS LOT: version ${VERSION} pas après la dernière (%) — renuméroter', (select derniere_version from _ni_releve);
  end if;
  if (select etat_objets from _ni_releve) is distinct from '${ETAT_DEPART}|51' then
    raise exception 'NEXUS LOT: objets de départ ≠ relevé (%) — rien n''est appliqué', (select etat_objets from _ni_releve);
  end if;
end $gni$;

-- 3. ===== DÉBUT ${VERSION}_${NOM}.sql =====
${texte}
-- ===== FIN ${VERSION}_${NOM}.sql =====

-- 4. Enregistrement de la version (statements = le fichier) et du geste (admin_operations)
create temp table _ni_texte on commit drop as select $NXMIG$${texte}$NXMIG$::text as t;
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '${VERSION}', '${NOM}', array[t], 'bptds22@gmail.com' from _ni_texte;
insert into public.admin_operations (operation, motif, details, par)
select '${OPERATION}',
       'Notifications d''intérêt recruteur (vue de profil, ajout à une liste, titre « Nexus ») et heures calmes 22 h 00 – 7 h 59 pour tous (GO BP)',
       jsonb_build_object('version', '${VERSION}', 'md5_fichier', '${md5Fichier}', 'etat_depart', '${ETAT_DEPART}|51',
                          'etat_apres', '${etatApres}|59',
                          'rollback', 'supabase/rollback/${VERSION}_rollback_${NOM}.sql'),
       (select id from public.users where lower(email) = 'bptds22@gmail.com' limit 1);

-- 5. Gardes finales
do $fni$
declare
  v_etat text;
begin
  if (select txid from _ni_releve) <> txid_current() then
    raise exception 'NEXUS LOT: transaction changée en cours de lot';
  end if;
  if (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '${VERSION}')
     is distinct from '${md5Fichier}' then
    raise exception 'NEXUS LOT: le texte enregistré n''est pas le fichier testé (md5)';
  end if;
  v_etat := (${requeteEtat});
  if v_etat is distinct from '${etatApres}|59' then
    raise exception 'NEXUS LOT: objets créés ≠ objets testés en local (%) — tout est annulé', v_etat;
  end if;
  if ${DONNEES} <> (select donnees from _ni_releve) then
    raise exception 'NEXUS LOT: une donnée a changé — tout est annulé';
  end if;
  if (select count(*) from public.admin_operations) <> (select operations + 1 from _ni_releve) then
    raise exception 'NEXUS LOT: admin_operations non enregistrée — tout est annulé';
  end if;
end $fni$;

-- 6. Résultat
select json_build_object(
  'avant', (select row_to_json(r) from (select donnees, etat_objets, operations, version_deja, derniere_version, pg from _ni_releve) r),
  'apres', json_build_object(
     'donnees', ${DONNEES},
     'etat_objets', (${requeteEtat}),
     'version', (select version from supabase_migrations.schema_migrations where version = '${VERSION}'),
     'md5_enregistre', (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '${VERSION}'),
     'admin_operation', (select id from public.admin_operations where operation = '${OPERATION}' order by le desc limit 1),
     'heure_calme_22h', public.push_heure_calme('2026-10-29 22:00 America/Toronto'::timestamptz),
     'meme_transaction', (select txid from _ni_releve) = txid_current())
) as resultat_lot_notif_interet;
`;

const sortie = path.resolve(`docs/notif-interet/prod/${faux ? "lot-preuve-garde-fausse.sql" : "lot-prod.sql"}`);
fs.writeFileSync(sortie, lot);
const debut = `-- 3. ===== DÉBUT ${VERSION}_${NOM}.sql =====\n`;
const section = lot.slice(lot.indexOf(debut) + debut.length, lot.indexOf(`\n-- ===== FIN ${VERSION}_${NOM}.sql =====`));
const lit = lot.slice(lot.indexOf("$NXMIG$") + 7, lot.lastIndexOf("$NXMIG$"));
console.log(JSON.stringify({
  lot: path.relative(process.cwd(), sortie), md5_fichier: md5Fichier, md5_section_executee: md5(section),
  md5_litteral_enregistre: md5(lit), md5_lot: md5(lot), octets_lot: Buffer.byteLength(lot), etat_apres_attendu: etatApres,
}, null, 1));
