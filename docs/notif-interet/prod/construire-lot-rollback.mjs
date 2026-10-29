// Construit le LOT DE ROLLBACK « notif intérêt recruteur », compatible avec le connecteur (aucune commande psql).
//   cd C:\tmp\nexus-merge-notif-interet ; node docs/notif-interet/prod/construire-lot-rollback.mjs
// Une seule transaction : relevé avant → garde (même transaction, version présente, lot appliqué, état |59) →
// le rollback tel que git le stocke, sans « \set », « begin; » ni « commit; » (la transaction est celle du lot) →
// retrait de la version de schema_migrations → admin_operations ROLLBACK_NOTIF_INTERET_RECRUTEUR → gardes finales
// (état d'arrivée bba20215…|51, version absente, une opération de plus) → résultat JSON.
// État d'arrivée : |51 exact s'il n'existe aucune ligne des nouveaux genres ; s'il en existe, le rollback garde
// les 3 CHECK en NOT VALID (historique) et la garde compare l'empreinte où seule leur validation est neutralisée.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const VERSION = "20261029170000";
const NOM = "notif_interet_recruteur";
const OPERATION = "ROLLBACK_NOTIF_INTERET_RECRUTEUR";
const ETAT_DEPART = "619e5f2e9620c07c15d7fb66b9388f80|59";
const ETAT_ARRIVEE = "bba20215160886b637ed628bbe4fa293|51";

const brut = execFileSync("git", ["show", `HEAD:supabase/rollback/${VERSION}_rollback_${NOM}.sql`], { encoding: "utf8" });
if (brut.includes("\r")) throw new Error("CR dans le rollback");
const md5 = (s) => crypto.createHash("md5").update(Buffer.from(s, "utf8")).digest("hex");
const md5Rollback = md5(brut);
// Retire exactement trois lignes : la commande psql et la transaction propre au fichier.
let texte = brut;
for (const ligne of ["\\set ON_ERROR_STOP 1\n", "begin;\n", "commit;\n"]) {
  const n = texte.split("\n").filter((l) => l + "\n" === ligne).length;
  if (n !== 1) throw new Error(`ligne attendue une fois : ${JSON.stringify(ligne)} (${n})`);
  texte = texte.split("\n").filter((l) => l + "\n" !== ligne).join("\n");
}
if (/^\\/m.test(texte)) throw new Error("commande psql restante");
if (/^\s*(begin|commit|rollback)\s*;/im.test(texte)) throw new Error("begin/commit restant");
for (const tag of ["$grb$", "$frb$"]) if (texte.includes(tag)) throw new Error("repère déjà présent : " + tag);

const requeteEtat = fs.readFileSync(path.resolve("docs/notif-interet/etat-objets.sql"), "utf8")
  .split("\n").filter((l) => !l.startsWith("--")).join("\n").trim().replace(/;$/, "");
const CON = "pg_get_constraintdef(oid) || ' ' || convalidated";
if (requeteEtat.split(CON).length !== 2) throw new Error("expression des contraintes introuvable dans etat-objets.sql");
const NEUTRES = "('push_file_genre_check', 'push_file_categorie_check', 'push_preferences_categorie_check')";
const requeteEtatNeutre = requeteEtat.replace(CON,
  `case when conname in ${NEUTRES} then replace(pg_get_constraintdef(oid), ' NOT VALID', '') || ' true'
        else ${CON} end`);
const LIGNES_NOUVELLES = `exists (select 1 from public.push_file where genre in ('VUE_PROFIL', 'AJOUT_LISTE') or categorie = 'INTERET_RECRUTEURS')
     or exists (select 1 from public.push_preferences where categorie = 'INTERET_RECRUTEURS')`;

const lot = `-- LOT ROLLBACK notif intérêt recruteur — généré par docs/notif-interet/prod/construire-lot-rollback.mjs
-- Fichier : supabase/rollback/${VERSION}_rollback_${NOM}.sql (git, LF) — md5 ${md5Rollback} ; section exécutée md5 ${md5(texte)}
--   (le fichier sans « \\set ON_ERROR_STOP 1 », « begin; » ni « commit; »).
-- État de départ attendu : ${ETAT_DEPART} ; arrivée : ${ETAT_ARRIVEE}
-- À envoyer TEL QUEL, en UN SEUL appel : une seule transaction. Une garde qui échoue annule tout.

set local lock_timeout = '5s';
set local statement_timeout = '120s';

-- 1. Relevé avant (dans la transaction)
create temp table _rb_releve on commit drop as
select txid_current() as txid,
       (${requeteEtat}) as etat_objets,
       (select count(*) from public.admin_operations) as operations,
       (select count(*) filter (where operation = 'MIGRATION_NOTIF_INTERET_RECRUTEUR')
              - count(*) filter (where operation = 'ROLLBACK_NOTIF_INTERET_RECRUTEUR')
          from public.admin_operations) as lot_applique,
       (select count(*) from supabase_migrations.schema_migrations where version = '${VERSION}') as version_la,
       (select count(*) from public.push_file where statut = 'EN_ATTENTE' and genre in ('VUE_PROFIL', 'AJOUT_LISTE')) as file_annulee,
       current_setting('server_version') as pg;

-- 2. Garde AVANT toute écriture
do $grb$
begin
  if (select txid from _rb_releve) <> txid_current() then
    raise exception 'NEXUS LOT: les instructions ne partagent pas une seule transaction — arrêt avant toute écriture';
  end if;
  if (select version_la from _rb_releve) <> 1 or (select lot_applique from _rb_releve) <> 1 then
    raise exception 'NEXUS LOT: version ${VERSION} absente ou lot non appliqué — rien n''est défait';
  end if;
  if (select etat_objets from _rb_releve) is distinct from '${ETAT_DEPART}' then
    raise exception 'NEXUS LOT: objets de départ ≠ état migré (%) — rien n''est défait', (select etat_objets from _rb_releve);
  end if;
end $grb$;

-- 3. ===== DÉBUT ${VERSION}_rollback_${NOM}.sql (sans \\set, begin, commit) =====
${texte}
-- ===== FIN ${VERSION}_rollback_${NOM}.sql =====

-- 4. Retrait de la version et trace du geste
delete from supabase_migrations.schema_migrations where version = '${VERSION}';
insert into public.admin_operations (operation, motif, details, par)
select '${OPERATION}',
       'Rollback des notifications d''intérêt recruteur et des heures calmes 22 h 00 – 7 h 59 (GO BP)',
       jsonb_build_object('version', '${VERSION}', 'md5_rollback', '${md5Rollback}', 'etat_depart', '${ETAT_DEPART}',
                          'etat_arrivee', '${ETAT_ARRIVEE}', 'file_annulee', (select file_annulee from _rb_releve)),
       (select id from public.users where lower(email) = 'bptds22@gmail.com' limit 1);

-- 5. Gardes finales
do $frb$
declare
  v_etat text;
begin
  if (select txid from _rb_releve) <> txid_current() then
    raise exception 'NEXUS LOT: transaction changée en cours de lot';
  end if;
  if ${LIGNES_NOUVELLES} then
    v_etat := (${requeteEtatNeutre});
  else
    v_etat := (${requeteEtat});
  end if;
  if v_etat is distinct from '${ETAT_ARRIVEE}' then
    raise exception 'NEXUS LOT: objets ≠ état d''avant la migration (%) — tout est annulé', v_etat;
  end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '${VERSION}') then
    raise exception 'NEXUS LOT: version ${VERSION} encore inscrite — tout est annulé';
  end if;
  if (select count(*) from public.admin_operations) <> (select operations + 1 from _rb_releve) then
    raise exception 'NEXUS LOT: admin_operations non enregistrée — tout est annulé';
  end if;
end $frb$;

-- 6. Résultat
select json_build_object(
  'avant', (select row_to_json(r) from (select etat_objets, operations, version_la, file_annulee, pg from _rb_releve) r),
  'apres', json_build_object(
     'etat_objets', (${requeteEtat}),
     'etat_neutre', (${requeteEtatNeutre}),
     'lignes_nouveaux_genres', ${LIGNES_NOUVELLES},
     'versions', (select count(*) from supabase_migrations.schema_migrations where version = '${VERSION}'),
     'admin_operation', (select id from public.admin_operations where operation = '${OPERATION}' order by le desc limit 1),
     'trg_notify_favorited', exists (select 1 from pg_trigger where tgname = 'trg_notify_favorited' and not tgisinternal),
     'heure_calme_21h', public.push_heure_calme('2026-10-29 21:00 America/Toronto'::timestamptz),
     'meme_transaction', (select txid from _rb_releve) = txid_current())
) as resultat_lot_rollback_notif_interet;
`;

const sortie = path.resolve("docs/notif-interet/prod/lot-rollback.sql");
fs.writeFileSync(sortie, lot);
const debut = lot.indexOf("=====\n", lot.indexOf("-- 3. ===== DÉBUT")) + 6;
const section = lot.slice(debut, lot.indexOf(`\n-- ===== FIN ${VERSION}_rollback_`));
console.log(JSON.stringify({
  lot: path.relative(process.cwd(), sortie), md5_rollback: md5Rollback, md5_section_attendue: md5(texte),
  md5_section_executee: md5(section), md5_lot: md5(lot), octets_lot: Buffer.byteLength(lot),
}, null, 1));
