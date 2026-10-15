// Construit le LOT DE PROD du push A4a — même méthode que les invitations (docs/invitations-coach-nomme/prod).
//   cd C:\tmp\nexus-push ; node docs/push-a4a/prod/construire-lot.mjs <empreinte_objets> [--faux]
// Une seule transaction : relevé avant → garde (une transaction, migration absente) → le fichier octet
// pour octet → enregistrement de la version (schema_migrations) → admin_operations → gardes finales (md5
// du texte enregistré, empreinte des objets testés en local — corps, droits, colonnes, triggers, cron —,
// données inchangées sauf les notifications PARTENAIRE_EVALUATION sans réponse, réécrites) → résultat JSON.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const VERSION = "20261016010000";
const NOM = "push_a4a_file";
const FICHIER = path.resolve(`supabase/migrations/${VERSION}_${NOM}.sql`);
const empreinteObjets = process.argv[2];
const faux = process.argv.includes("--faux");
if (!/^[0-9a-f]{32}$/.test(empreinteObjets ?? "")) throw new Error("empreinte des objets attendue (32 hex)");

const brut = fs.readFileSync(FICHIER);
if (brut[0] === 0xef && brut[1] === 0xbb && brut[2] === 0xbf) throw new Error("BOM dans le fichier");
const texte = brut.toString("utf8");
if (texte.includes("\r")) throw new Error("CR dans le fichier : le md5 ne serait pas celui des octets testés");
for (const tag of ["$PAMIG$", "$g$", "$f$", "$e$"]) if (texte.includes(tag)) throw new Error("repère déjà présent : " + tag);
const md5Fichier = crypto.createHash("md5").update(brut).digest("hex");
const empreinte = faux ? "0".repeat(32) : empreinteObjets;
const requeteEmpreinte = fs.readFileSync(path.resolve("docs/push-a4a/prod/empreinte-objets.sql"), "utf8")
  .split("\n").filter((l) => !l.startsWith("--")).join("\n").trim().replace(/;$/, "");

// Données qui ne doivent PAS changer (comptes). Les messages PARTENAIRE_EVALUATION sans réponse, eux,
// sont réécrits : comptés à part.
const DONNEES = `(select count(*) from public.athlete_notifications) || '|' || (select count(*) from public.athlete_badges)
       || '|' || (select count(*) from public.evaluations) || '|' || (select count(*) from public.partner_athlete_badges)
       || '|' || (select count(*) from public.partner_evaluations) || '|' || (select count(*) from public.device_tokens)
       || '|' || (select count(*) from public.notification_preferences) || '|' || (select count(*) from public.athletes)`;
const ANCIEN = `'Réponds depuis nexussports.ca : confirme si c''est bien toi, ou indique que ce n''est pas toi.'`;
const NOUVEAU = `'Réponds dans l''appli Nexus ou sur nexussports.ca.'`;
const A_REECRIRE = `(select count(*) from public.athlete_notifications n
        where n.type = 'PARTENAIRE_EVALUATION' and n.message = ${ANCIEN}
          and not coalesce((n.metadata->>'caduque')::boolean, false)
          and exists (select 1 from public.partenaire_prospects_rapprochements r
                       where r.carte_id::text = n.metadata->>'carte_id' and r.athlete_id = n.athlete_id and r.statut = 'PROPOSE'))`;
const NOUVEAUX = `(select count(*) from public.athlete_notifications where type = 'PARTENAIRE_EVALUATION' and message = ${NOUVEAU})`;

const lot = `-- LOT PROD push A4a — généré par docs/push-a4a/prod/construire-lot.mjs${faux ? " — VARIANTE DE PREUVE (empreinte fausse)" : ""}
-- Fichier : supabase/migrations/${VERSION}_${NOM}.sql — md5 ${md5Fichier}
-- Empreinte attendue des objets : ${empreinte}
-- À envoyer TEL QUEL, en UN SEUL appel : une seule transaction. Une garde qui échoue annule tout.

-- 1. Relevé avant (dans la transaction)
create temp table _pa_releve as
select txid_current() as txid,
       ${DONNEES} as donnees,
       ${A_REECRIRE} as a_reecrire,
       ${NOUVEAUX} as nouveaux_avant,
       (select count(*) from public.admin_operations) as operations,
       (select count(*) from supabase_migrations.schema_migrations where version = '${VERSION}') as version_deja,
       (select max(version) from supabase_migrations.schema_migrations) as derniere_version,
       current_setting('server_version') as pg;

-- 2. Garde AVANT toute écriture
do $g$
begin
  if (select txid from _pa_releve) <> txid_current() then
    raise exception 'NEXUS LOT: les instructions ne partagent pas une seule transaction — arrêt avant toute écriture';
  end if;
  if (select version_deja from _pa_releve) <> 0 then
    raise exception 'NEXUS LOT: migration push A4a déjà présente — rien n''est appliqué';
  end if;
end $g$;

-- 3. ===== DÉBUT ${VERSION}_${NOM}.sql =====
${texte}
-- ===== FIN ${VERSION}_${NOM}.sql =====

-- 4. Enregistrement de la version (statements = le fichier) et du geste (admin_operations)
create temp table _pa_texte as select $PAMIG$${texte}$PAMIG$::text as t;
do $e$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'supabase_migrations'
               and table_name = 'schema_migrations' and column_name = 'created_by') then
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements, created_by)
             select $1, $2, array[t], $3 from _pa_texte' using '${VERSION}', '${NOM}', 'bptds22@gmail.com';
  else
    execute 'insert into supabase_migrations.schema_migrations (version, name, statements)
             select $1, $2, array[t] from _pa_texte' using '${VERSION}', '${NOM}';
  end if;
end $e$;
insert into public.admin_operations (operation, motif, details, par)
select 'MIGRATION_PUSH_A4A',
       'Push A4a : file des pushs, préférences par type, heures calmes, déclencheurs badges et évaluations (GO BP)',
       jsonb_build_object('version', '${VERSION}', 'md5_fichier', '${md5Fichier}', 'empreinte_objets', '${empreinte}',
                          'notifications_partenaire_reecrites', (select a_reecrire from _pa_releve)),
       (select id from public.users where lower(email) = 'bptds22@gmail.com' limit 1);

-- 5. Gardes finales
do $f$
declare
  v_empreinte text;
  v_n int;
begin
  if (select txid from _pa_releve) <> txid_current() then
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
  if ${DONNEES} <> (select donnees from _pa_releve) then
    raise exception 'NEXUS LOT: une donnée a changé — tout est annulé';
  end if;
  if ${A_REECRIRE} <> 0
     or ${NOUVEAUX} <> (select nouveaux_avant + a_reecrire from _pa_releve) then
    raise exception 'NEXUS LOT: réécriture des notifications PARTENAIRE_EVALUATION inattendue — tout est annulé';
  end if;
  if (select count(*) from public.admin_operations) <> (select operations + 1 from _pa_releve) then
    raise exception 'NEXUS LOT: admin_operations non enregistrée — tout est annulé';
  end if;
  if (select count(*) from public.push_file) + (select count(*) from public.push_envois) <> 0 then
    raise exception 'NEXUS LOT: la file doit naître vide — tout est annulé';
  end if;
end $f$;

-- 6. Résultat
select json_build_object(
  'avant', (select row_to_json(r) from (select donnees, a_reecrire, nouveaux_avant, operations, version_deja, derniere_version, pg from _pa_releve) r),
  'apres', json_build_object(
     'donnees', ${DONNEES},
     'version', (select version from supabase_migrations.schema_migrations where version = '${VERSION}'),
     'md5_enregistre', (select md5(statements[1]) from supabase_migrations.schema_migrations where version = '${VERSION}'),
     'admin_operation', (select id from public.admin_operations where operation = 'MIGRATION_PUSH_A4A' order by le desc limit 1),
     'cron', (select schedule from cron.job where jobname = 'push-file-envoi'),
     'meme_transaction', (select txid from _pa_releve) = txid_current())
) as resultat_lot_push_a4a;
`;

const sortie = path.resolve(`docs/push-a4a/prod/${faux ? "lot-preuve-garde-fausse.sql" : "lot-prod.sql"}`);
fs.writeFileSync(sortie, lot);
const marqueDebut = `-- 3. ===== DÉBUT ${VERSION}_${NOM}.sql =====\n`;
const section = lot.slice(lot.indexOf(marqueDebut) + marqueDebut.length, lot.indexOf(`\n-- ===== FIN ${VERSION}_${NOM}.sql =====`));
const lit = lot.slice(lot.indexOf("$PAMIG$") + 7, lot.lastIndexOf("$PAMIG$"));
const md5 = (s) => crypto.createHash("md5").update(Buffer.from(s, "utf8")).digest("hex");
console.log(JSON.stringify({
  lot: path.relative(process.cwd(), sortie), md5_fichier: md5Fichier, md5_section_executee: md5(section),
  md5_litteral_enregistre: md5(lit), md5_lot: md5(lot), octets_lot: Buffer.byteLength(lot), empreinte_attendue: empreinte,
}, null, 1));
