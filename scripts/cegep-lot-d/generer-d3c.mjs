// Génère la migration et le rollback du lot D3c cégep : retour de D3a (décision BP 2026-10-28, Q8 annulée — le
// recruteur universitaire voit TOUT LE MONDE, comme un recruteur collégial, plus les cégépiens).
// Retire les 9 policies et les 3 règles nexus_prive de D3a, remet les 19 corps prod d'avant D3a (relevé
// docs/cegep-lot-d/d3a/corps-prod-<date>.sql, md5 vérifié après). GARDE de D3a : unite_voit_cegepiens() exige
// l'interrupteur (une université ne voit les cégépiens que sous ON).
// Le rollback de D3c = la migration D3a sans sa partie unite_voit_cegepiens (déjà en place).
// Usage : node scripts/cegep-lot-d/generer-d3c.mjs 20261028
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.chdir(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".."));
const [date] = process.argv.slice(2);
if (!/^\d{8}$/.test(date ?? "")) throw new Error("date AAAAMMJJ attendue");
const VERSION = "20261028050000", NOM = "cegep_lot_d3c_universitaire_voit_tout";
const MIG = `supabase/migrations/${VERSION}_${NOM}.sql`;
const RB = `supabase/rollback/${VERSION}_rollback_${NOM}.sql`;
const D3A = "supabase/migrations/20261028040000_cegep_lot_d3a_universitaire_cegepiens_seulement.sql";
const md5 = (t) => crypto.createHash("md5").update(t, "utf8").digest("hex");

const brut = fs.readFileSync(`docs/cegep-lot-d/d3a/corps-prod-${date}.sql`, "utf8").replace(/^﻿/, "").replace(/\r\n/g, "\n");
const fns = brut.split(/^=====FN /m).slice(1).map((bloc) => {
  const nl = bloc.indexOf("\n");
  const [nom, empreinte, ...args] = bloc.slice(0, nl).split(" ");
  return { nom, empreinte, args: args.join(" "), def: bloc.slice(nl + 1).replace(/\s+$/, "") };
});
if (fns.length !== 19) throw new Error("19 fonctions attendues");
const q = (s) => s.replace(/'/g, "''");
const oid = (f) => `pronamespace = 'public'::regnamespace and proname = '${f.nom}' and pg_get_function_identity_arguments(oid) = '${q(f.args)}'`;
const FILTRE = "(prosrc like '%lecteur_universitaire%' or prosrc like '%compte_universitaire%' or prosrc like '%unite_universitaire%')";

const POLICIES = [
  ["non_cegepiens_masques_universitaires", ["athletes", "team_athletes", "athlete_badges", "evaluations", "recruiter_athlete_views", "recruiter_activity_log"]],
  ["non_cegepiens_ecriture_universitaires", ["recruiter_favorites", "recruiter_pipeline", "conversations"]],
];

const mig = `-- Lot D3c cégep — retour de D3a (décision BP 2026-10-28 : Q8 annulée). Le recruteur universitaire voit TOUT LE
-- MONDE (secondaire, civil, cégep, sans école), comme un recruteur collégial, plus les cégépiens.
--   1. Retire les 9 policies RESTRICTIVE de D3a (6 de lecture, 3 d'écriture).
--   2. Remet les 19 fonctions dans leur corps prod d'avant D3a (relevé le ${date}) ; md5 vérifié après.
--   3. Retire les règles nexus_prive.lecteur_universitaire / compte_universitaire / unite_universitaire.
-- GARDÉ de D3a : unite_voit_cegepiens() exige lancement_universitaire ON — sous OFF, aucune école, même une
-- université, ne voit les cégépiens (faille latente fermée).
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer-d3c.mjs ${date}.

do $garde$
begin
${fns.map((f) => `  if not exists (select 1 from pg_proc where ${oid(f)} and ${FILTRE}) then
    raise exception 'NEXUS: ${f.nom} n''est pas dans sa version D3a — rien à défaire';
  end if;`).join("\n")}
  if (select count(*) from pg_policies where policyname in ('non_cegepiens_masques_universitaires', 'non_cegepiens_ecriture_universitaires')) <> 9 then
    raise exception 'NEXUS: les 9 policies de D3a ne sont pas toutes là';
  end if;
  if (select prosrc from pg_proc where oid = 'public.unite_voit_cegepiens(uuid)'::regprocedure) not like '%lancement_universitaire_actif%' then
    raise exception 'NEXUS: unite_voit_cegepiens n''exige pas l''interrupteur (D3a absent ?)';
  end if;
end $garde$;

-- ── 1. Policies ──────────────────────────────────────────────────────────────
${POLICIES.flatMap(([p, ts]) => ts.map((t) => `drop policy ${p} on public.${t};`)).join("\n")}

-- ── 2. Corps d'avant D3a ─────────────────────────────────────────────────────
${fns.map((f) => `-- ${f.nom}\n${f.def};\n`).join("\n")}
do $verif$
begin
${fns.map((f) => `  if (select md5(prosrc) from pg_proc where ${oid(f)}) is distinct from '${f.empreinte}' then
    raise exception 'NEXUS: ${f.nom} n''a pas retrouvé son corps d''avant D3a';
  end if;`).join("\n")}
end $verif$;

-- ── 3. Règles de D3a ─────────────────────────────────────────────────────────
drop function nexus_prive.lecteur_universitaire();
drop function nexus_prive.compte_universitaire(uuid);
drop function nexus_prive.unite_universitaire(uuid);
`;

// Rollback de D3c : la migration D3a, sans sa garde de corps et sans la réécriture d'unite_voit_cegepiens.
let d3a = fs.readFileSync(D3A, "utf8").replace(/\r\n/g, "\n");
const i = d3a.indexOf("do $garde$"), j = d3a.indexOf("end $garde$;") + "end $garde$;".length;
if (i < 0 || j < i) throw new Error("garde D3a introuvable");
d3a = d3a.slice(0, i) + "-- (garde de D3a retirée : D3c remet exactement les corps qu'elle attendait)" + d3a.slice(j);
const u0 = d3a.indexOf("create or replace function public.unite_voit_cegepiens(p_ecole uuid)");
const u1 = d3a.indexOf("$function$;", d3a.indexOf("$function$", u0) + 10) + "$function$;".length;
if (u0 < 0 || u1 < u0) throw new Error("unite_voit_cegepiens introuvable dans D3a");
d3a = d3a.slice(0, u0) + "-- (unite_voit_cegepiens : inchangée par D3c, gardée telle quelle)" + d3a.slice(u1);
const rb = `-- Rollback du lot D3c cégep : remet D3a (masquage du non-cégépien pour le recruteur universitaire).\n` + d3a;

fs.writeFileSync(MIG, mig);
fs.writeFileSync(RB, rb);
console.log(`migration ${md5(mig)}  rollback ${md5(rb)}  ${MIG}`);
