// Construit les DEUX lots du texte AJOUT_LISTE (20261029210000) pour le connecteur Supabase :
//   cd C:\tmp\nexus-notif-texte ; node docs/notif-interet/texte-ajout/construire-lots.mjs
// Toutes les sources sont lues par `git show HEAD:` (LF, octets que git stocke), et les lots sont écrits
// en LF : le md5 sur disque est celui que git stockera.
//   lot-prod.sql     : relevé → garde (même transaction, version absente et après la dernière, lot non
//                      appliqué, état 619e5f2e…|59) → migration → schema_migrations + admin_operations
//                      → gardes finales (md5 enregistré, état 431ce116…|59, données inchangées, +1 opération).
//   lot-rollback.sql : relevé → garde (version présente, lot appliqué, état 431ce116…|59) → rollback →
//                      retrait de la version + admin_operations → gardes finales (état 619e5f2e…|59, version
//                      absente, +1 opération).
// Une garde qui échoue annule tout.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";

const VERSION = "20261029210000";
const NOM = "texte_ajout_liste";
const OP_MIG = "MIGRATION_TEXTE_AJOUT_LISTE";
const OP_RB = "ROLLBACK_TEXTE_AJOUT_LISTE";
const ETAT_AVANT = "619e5f2e9620c07c15d7fb66b9388f80|59"; // prod relue le 2026-10-29 20 h 07 UTC
const ETAT_APRES = "431ce1164bba28694c21be5ec04d3435|59"; // pile NexusNotif après 20261029210000

const git = (p) => execFileSync("git", ["show", `HEAD:${p}`], { encoding: "utf8" });
const md5 = (s) => crypto.createHash("md5").update(Buffer.from(s, "utf8")).digest("hex");
const verifier = (nom, t) => {
  if (t.includes("\r")) throw new Error(`CR dans ${nom}`);
  if (/^\\/m.test(t)) throw new Error(`commande psql dans ${nom}`);
  if (/^\s*(begin|commit|rollback)\s*;/im.test(t)) throw new Error(`begin/commit dans ${nom}`);
  for (const tag of ["$NXTXT$", "$gtx$", "$ftx$"]) if (t.includes(tag)) throw new Error(`repère ${tag} dans ${nom}`);
};
const migration = git(`supabase/migrations/${VERSION}_${NOM}.sql`);
const rollback = git(`supabase/rollback/${VERSION}_rollback_${NOM}.sql`);
verifier("la migration", migration);
verifier("le rollback", rollback);
const requeteEtat = git("docs/notif-interet/etat-objets.sql")
  .split("\n").filter((l) => !l.startsWith("--")).join("\n").trim().replace(/;$/, "");
const DONNEES = `(select count(*) from public.athlete_notifications) || '|' || (select count(*) from public.push_file)
       || '|' || (select count(*) from public.push_envois) || '|' || (select count(*) from public.push_preferences)
       || '|' || (select count(*) from public.recruiter_favorites) || '|' || (select count(*) from public.recruiter_list_members)
       || '|' || (select count(*) from public.recruiter_pipeline) || '|' || (select count(*) from public.recruiter_athlete_views)`;
const APPLIQUE = `(select count(*) filter (where operation = '${OP_MIG}') - count(*) filter (where operation = '${OP_RB}')
          from public.admin_operations)`;
const BP = "(select id from public.users where lower(email) = 'bptds22@gmail.com' limit 1)";

const entete = (titre, depart, arrivee) => `-- ${titre} — généré par docs/notif-interet/texte-ajout/construire-lots.mjs (sources lues par git show, LF)
-- Migration md5 ${md5(migration)} ; rollback md5 ${md5(rollback)}
-- État de départ attendu : ${depart} ; arrivée : ${arrivee}
-- À envoyer TEL QUEL, en UN SEUL appel : une seule transaction. Une garde qui échoue annule tout.

set local lock_timeout = '5s';
set local statement_timeout = '120s';
`;

const lotProd = `${entete("LOT PROD texte AJOUT_LISTE", ETAT_AVANT, ETAT_APRES)}
-- 1. Relevé avant (dans la transaction)
create temp table _tx_releve on commit drop as
select txid_current() as txid,
       ${DONNEES} as donnees,
       (${requeteEtat}) as etat_objets,
       (select count(*) from public.admin_operations) as operations,
       ${APPLIQUE} as lot_applique,
       (select count(*) from supabase_migrations.schema_migrations where version = '${VERSION}') as version_deja,
       (select max(version) from supabase_migrations.schema_migrations) as derniere_version;

-- 2. Garde AVANT toute écriture
do $gtx$
begin
  if (select txid from _tx_releve) <> txid_current() then
    raise exception 'NEXUS LOT: les instructions ne partagent pas une seule transaction — arrêt avant toute écriture';
  end if;
  if (select version_deja from _tx_releve) <> 0 or (select lot_applique from _tx_releve) <> 0 then
    raise exception 'NEXUS LOT: version ${VERSION} présente ou lot déjà appliqué — rien n''est appliqué';
  end if;
  if (select derniere_version from _tx_releve) >= '${VERSION}' then
    raise exception 'NEXUS LOT: version ${VERSION} pas après la dernière (%) — renuméroter', (select derniere_version from _tx_releve);
  end if;
  if (select etat_objets from _tx_releve) is distinct from '${ETAT_AVANT}' then
    raise exception 'NEXUS LOT: objets de départ ≠ relevé (%) — rien n''est appliqué', (select etat_objets from _tx_releve);
  end if;
end $gtx$;

-- 3. ===== DÉBUT ${VERSION}_${NOM}.sql =====
${migration}
-- ===== FIN ${VERSION}_${NOM}.sql =====

-- 4. Enregistrement de la version et du geste
create temp table _tx_texte on commit drop as select $NXTXT$${migration}$NXTXT$::text as t;
insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
select '${VERSION}', '${NOM}', array[t], 'bptds22@gmail.com' from _tx_texte;
insert into public.admin_operations (operation, motif, details, par)
select '${OP_MIG}', 'Texte AJOUT_LISTE : « Ton profil a été ajouté à une liste de suivi » (GO BP)',
       jsonb_build_object('version', '${VERSION}', 'md5_fichier', '${md5(migration)}', 'etat_depart', '${ETAT_AVANT}',
                          'etat_apres', '${ETAT_APRES}', 'rollback', 'supabase/rollback/${VERSION}_rollback_${NOM}.sql'),
       ${BP};

-- 5. Gardes finales
do $ftx$
begin
  if (select txid from _tx_releve) <> txid_current() then
    raise exception 'NEXUS LOT: transaction changée en cours de lot';
  end if;
  if (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '${VERSION}')
     is distinct from '${md5(migration)}' then
    raise exception 'NEXUS LOT: le texte enregistré n''est pas le fichier testé (md5)';
  end if;
  if (${requeteEtat}) is distinct from '${ETAT_APRES}' then
    raise exception 'NEXUS LOT: objets ≠ objets testés en local — tout est annulé';
  end if;
  if ${DONNEES} <> (select donnees from _tx_releve) then
    raise exception 'NEXUS LOT: une donnée a changé — tout est annulé';
  end if;
  if (select count(*) from public.admin_operations) <> (select operations + 1 from _tx_releve) then
    raise exception 'NEXUS LOT: admin_operations non enregistrée — tout est annulé';
  end if;
end $ftx$;

-- 6. Résultat
select json_build_object(
  'avant', (select row_to_json(r) from (select donnees, etat_objets, operations, version_deja, derniere_version from _tx_releve) r),
  'apres', json_build_object(
     'donnees', ${DONNEES},
     'etat_objets', (${requeteEtat}),
     'version', (select version from supabase_migrations.schema_migrations where version = '${VERSION}'),
     'md5_enregistre', (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '${VERSION}'),
     'texte', (select t.titre || ' / ' || t.texte from public.push_textes('AJOUT_LISTE', null, 1, null) t),
     'meme_transaction', (select txid from _tx_releve) = txid_current())
) as resultat_lot_texte_ajout;
`;

const lotRollback = `${entete("LOT ROLLBACK texte AJOUT_LISTE", ETAT_APRES, ETAT_AVANT)}
-- 1. Relevé avant (dans la transaction)
create temp table _tx_releve on commit drop as
select txid_current() as txid,
       (${requeteEtat}) as etat_objets,
       (select count(*) from public.admin_operations) as operations,
       ${APPLIQUE} as lot_applique,
       (select count(*) from supabase_migrations.schema_migrations where version = '${VERSION}') as version_la;

-- 2. Garde AVANT toute écriture
do $gtx$
begin
  if (select txid from _tx_releve) <> txid_current() then
    raise exception 'NEXUS LOT: les instructions ne partagent pas une seule transaction — arrêt avant toute écriture';
  end if;
  if (select version_la from _tx_releve) <> 1 or (select lot_applique from _tx_releve) <> 1 then
    raise exception 'NEXUS LOT: version ${VERSION} absente ou lot non appliqué — rien n''est défait';
  end if;
  if (select etat_objets from _tx_releve) is distinct from '${ETAT_APRES}' then
    raise exception 'NEXUS LOT: objets de départ ≠ état migré (%) — rien n''est défait', (select etat_objets from _tx_releve);
  end if;
end $gtx$;

-- 3. ===== DÉBUT ${VERSION}_rollback_${NOM}.sql =====
${rollback}
-- ===== FIN ${VERSION}_rollback_${NOM}.sql =====

-- 4. Retrait de la version et trace du geste
delete from supabase_migrations.schema_migrations where version = '${VERSION}';
insert into public.admin_operations (operation, motif, details, par)
select '${OP_RB}', 'Rollback du texte AJOUT_LISTE (retour à « Ton profil a été ajouté à une liste ») (GO BP)',
       jsonb_build_object('version', '${VERSION}', 'md5_rollback', '${md5(rollback)}', 'etat_depart', '${ETAT_APRES}',
                          'etat_arrivee', '${ETAT_AVANT}'),
       ${BP};

-- 5. Gardes finales
do $ftx$
begin
  if (select txid from _tx_releve) <> txid_current() then
    raise exception 'NEXUS LOT: transaction changée en cours de lot';
  end if;
  if (${requeteEtat}) is distinct from '${ETAT_AVANT}' then
    raise exception 'NEXUS LOT: objets ≠ état d''avant le texte — tout est annulé';
  end if;
  if exists (select 1 from supabase_migrations.schema_migrations where version = '${VERSION}') then
    raise exception 'NEXUS LOT: version ${VERSION} encore inscrite — tout est annulé';
  end if;
  if (select count(*) from public.admin_operations) <> (select operations + 1 from _tx_releve) then
    raise exception 'NEXUS LOT: admin_operations non enregistrée — tout est annulé';
  end if;
end $ftx$;

-- 6. Résultat
select json_build_object(
  'avant', (select row_to_json(r) from (select etat_objets, operations, version_la from _tx_releve) r),
  'apres', json_build_object(
     'etat_objets', (${requeteEtat}),
     'versions', (select count(*) from supabase_migrations.schema_migrations where version = '${VERSION}'),
     'texte', (select t.titre || ' / ' || t.texte from public.push_textes('AJOUT_LISTE', null, 1, null) t),
     'meme_transaction', (select txid from _tx_releve) = txid_current())
) as resultat_lot_rollback_texte_ajout;
`;

const dossier = path.resolve("docs/notif-interet/texte-ajout");
const sortie = {};
for (const [nom, lot] of [["lot-prod.sql", lotProd], ["lot-rollback.sql", lotRollback]]) {
  if (lot.includes("\r")) throw new Error("CR dans " + nom);
  fs.writeFileSync(path.join(dossier, nom), lot, { encoding: "utf8" });
  sortie[nom] = { md5: md5(lot), octets: Buffer.byteLength(lot) };
}
console.log(JSON.stringify({ md5_migration: md5(migration), md5_rollback: md5(rollback), ...sortie }, null, 1));
