// Génère la migration et le rollback du lot D3a cégep (le recruteur universitaire ne voit que les cégépiens)
// depuis les corps PROD relevés (docs/cegep-lot-d/d3a/corps-prod-<date>.sql, pg_get_functiondef + md5(prosrc)).
// Chaque fonction rebasée reçoit le seul filtre inverse du lot A ; la migration garde le md5 du corps prod.
// Usage : node scripts/cegep-lot-d/generer-d3a.mjs 20261028
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.chdir(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".."));
const [date] = process.argv.slice(2);
if (!/^\d{8}$/.test(date ?? "")) throw new Error("date AAAAMMJJ attendue");
const VERSION = "20261028040000", NOM = "cegep_lot_d3a_universitaire_cegepiens_seulement";
const MIG = `supabase/migrations/${VERSION}_${NOM}.sql`;
const RB = `supabase/rollback/${VERSION}_rollback_${NOM}.sql`;
const md5 = (t) => crypto.createHash("md5").update(t, "utf8").digest("hex");

const brut = fs.readFileSync(`docs/cegep-lot-d/d3a/corps-prod-${date}.sql`, "utf8").replace(/^﻿/, "").replace(/\r\n/g, "\n");
const fns = [];
for (const bloc of brut.split(/^=====FN /m).slice(1)) {
  const nl = bloc.indexOf("\n");
  const [nom, empreinte, ...args] = bloc.slice(0, nl).split(" ");
  const def = bloc.slice(nl + 1).replace(/\s+$/, "");
  if (!def.startsWith("CREATE OR REPLACE FUNCTION public." + nom + "(")) throw new Error("corps illisible : " + nom);
  fns.push({ nom, empreinte, args: args.join(" "), def });
}
if (fns.length !== 19) throw new Error("19 fonctions attendues, " + fns.length);

// Le filtre inverse, par motif du lot A. Chaque motif doit se trouver le nombre de fois attendu.
const LECT = "(select nexus_prive.lecteur_universitaire())";
const P_MIN = "((select public.peut_voir_cegepiens()) or not public.athlete_est_cegepien(a.id))";
const P_MAJ = "((SELECT public.peut_voir_cegepiens()) OR NOT public.athlete_est_cegepien(a.id))";
const regles = {
  agenda_flux: [["(public.unite_voit_cegepiens(v_u.school_id) or not public.athlete_est_cegepien(a.id))",
    "((public.unite_voit_cegepiens(v_u.school_id) or not public.athlete_est_cegepien(a.id)) and (not nexus_prive.unite_universitaire(v_u.school_id) or public.athlete_est_cegepien(a.id)))", 1]],
  rapprochement_candidats: [["(public.unite_voit_cegepiens(n.unite_cegep_id) or not public.athlete_est_cegepien(n.ath_id))",
    "((public.unite_voit_cegepiens(n.unite_cegep_id) or not public.athlete_est_cegepien(n.ath_id)) and (not nexus_prive.unite_universitaire(n.unite_cegep_id) or public.athlete_est_cegepien(n.ath_id)))", 1]],
  is_athlete_contactable: [["(public.compte_voit_cegepiens(auth.uid()) or not public.athlete_est_cegepien(p_athlete))",
    "((public.compte_voit_cegepiens(auth.uid()) or not public.athlete_est_cegepien(p_athlete)) and (not nexus_prive.compte_universitaire(auth.uid()) or public.athlete_est_cegepien(p_athlete)))", 1]],
  log_new_athlete: [[`  WHERE NOT v_cegepien
     OR NOT EXISTS (SELECT 1 FROM public.users u
                     WHERE u.id = rf.recruiter_id
                       AND u.role = 'RECRUTEUR'::public.user_role
                       AND NOT public.unite_voit_cegepiens(u.school_id));`,
    `  WHERE (NOT v_cegepien
     OR NOT EXISTS (SELECT 1 FROM public.users u
                     WHERE u.id = rf.recruiter_id
                       AND u.role = 'RECRUTEUR'::public.user_role
                       AND NOT public.unite_voit_cegepiens(u.school_id)))
    AND (v_cegepien OR NOT nexus_prive.compte_universitaire(rf.recruiter_id));`, 1]],
  log_athlete_update: [[`                             AND NOT public.unite_voit_cegepiens(u.school_id)));
  END IF;`,
    `                             AND NOT public.unite_voit_cegepiens(u.school_id)))
      AND (v_cegepien OR NOT nexus_prive.compte_universitaire(rf.recruiter_id));
  END IF;`, 1]],
  log_coach_reply: [[`                           AND NOT public.unite_voit_cegepiens(r.school_id)));`,
    `                           AND NOT public.unite_voit_cegepiens(r.school_id)))
    AND (c.athlete_id IS NULL OR public.athlete_est_cegepien(c.athlete_id)
         OR NOT nexus_prive.compte_universitaire(c.recruiter_id));`, 1]],
};
const attendusP = { matchs_recherche: 2 };
const corps = [];
for (const f of fns) {
  let def = f.def;
  const r = regles[f.nom] ?? [[def.includes(P_MAJ) ? P_MAJ : P_MIN, null, attendusP[f.nom] ?? 1]];
  for (const [motif, remplace, n] of r) {
    const vus = def.split(motif).length - 1;
    if (vus !== n) throw new Error(`${f.nom} : motif vu ${vus} fois, attendu ${n}`);
    const par = remplace ?? (motif === P_MAJ
      ? `(${P_MAJ} AND (NOT ${LECT} OR public.athlete_est_cegepien(a.id)))`
      : `(${P_MIN} and (not ${LECT} or public.athlete_est_cegepien(a.id)))`);
    def = def.split(motif).join(par);
  }
  if (def.includes("$nexus_mig$") || def.includes("$nexus_rb$")) throw new Error("délimiteur dans " + f.nom);
  corps.push({ ...f, nouveau: def });
}

const garde = corps.map((f) =>
  `  if (select md5(prosrc) from pg_proc where pronamespace = 'public'::regnamespace and proname = '${f.nom}'\n` +
  `        and pg_get_function_identity_arguments(oid) = '${f.args.replace(/'/g, "''")}') is distinct from '${f.empreinte}' then\n` +
  `    raise exception 'NEXUS: corps prod de ${f.nom} changé depuis le relevé — régénérer';\n  end if;`).join("\n");

const mig = `-- Lot D3a cégep — le recruteur universitaire ne voit QUE les cégépiens (décisions BP 2026-10-28, Q8 : fiche
-- ancrée à un cégep). Secondaire, civil et fiches sans école lui sont masqués EN BASE, sur le modèle du lot A
-- (même règle, sens inverse). Rien ne change pour un compte qui n'est pas recruteur universitaire, et rien ne
-- s'active tant que lancement_universitaire est OFF.
--   1. Règles (nexus_prive, hors API) : lecteur_universitaire() (l'appelant), compte_universitaire(compte),
--      unite_universitaire(école) — le masquage tient OFF comme ON. unite_voit_cegepiens() (lot A) exige
--      désormais l'interrupteur : sous OFF, un recruteur universitaire ne voit AUCUNE fiche.
--   2. Lecture : policy RESTRICTIVE « non_cegepiens_masques_universitaires » TO authenticated sur les 6 tables du
--      lot A (athletes, team_athletes, athlete_badges, evaluations, recruiter_athlete_views, recruiter_activity_log).
--   3. Écriture : policy RESTRICTIVE INSERT « non_cegepiens_ecriture_universitaires » sur recruiter_favorites,
--      recruiter_pipeline, conversations (miroir du lot C0).
--   4. Les 16 fonctions et 3 déclencheurs qui lisent la règle du lot A, rebasés sur le corps prod relevé le
--      ${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6)} (garde md5), seul ajout : le filtre inverse.
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer-d3a.mjs ${date}.

do $garde$
begin
${garde}
  if (select md5(prosrc) from pg_proc where oid = 'public.unite_voit_cegepiens(uuid)'::regprocedure) is distinct from '1a5be0be556789bfd3874e571231fc0a' then
    raise exception 'NEXUS: corps prod de unite_voit_cegepiens changé depuis le relevé — régénérer';
  end if;
end $garde$;

-- ── 1. Règles ────────────────────────────────────────────────────────────────
-- Le MASQUAGE ne dépend pas de l'interrupteur (un retour à OFF après le lancement ne doit jamais rendre le
-- secondaire visible à un recruteur universitaire) ; VOIR les cégépiens, lui, exige ON (unite_voit_cegepiens).
-- Sous OFF, un recruteur universitaire ne voit donc aucune fiche.
create function nexus_prive.lecteur_universitaire() returns boolean
  language sql stable security definer
  set search_path = public set row_security = off
as $function$
  select exists (select 1 from public.users u join public.schools s on s.id = u.school_id
                  where u.id = auth.uid() and u.role = 'RECRUTEUR'::public.user_role and s.type = 'UNIVERSITE');
$function$;
create function nexus_prive.compte_universitaire(p_compte uuid) returns boolean
  language sql stable security definer
  set search_path = public set row_security = off
as $function$
  select exists (select 1 from public.users u join public.schools s on s.id = u.school_id
                  where u.id = p_compte and u.role = 'RECRUTEUR'::public.user_role and s.type = 'UNIVERSITE');
$function$;
create function nexus_prive.unite_universitaire(p_ecole uuid) returns boolean
  language sql stable security definer
  set search_path = public set row_security = off
as $function$
  select exists (select 1 from public.schools s where s.id = p_ecole and s.type = 'UNIVERSITE');
$function$;
revoke all on function nexus_prive.lecteur_universitaire() from public;
revoke all on function nexus_prive.compte_universitaire(uuid) from public;
revoke all on function nexus_prive.unite_universitaire(uuid) from public;
grant execute on function nexus_prive.lecteur_universitaire() to authenticated, service_role;
grant execute on function nexus_prive.compte_universitaire(uuid) to authenticated, service_role;
grant execute on function nexus_prive.unite_universitaire(uuid) to service_role;

create or replace function public.unite_voit_cegepiens(p_ecole uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
 set row_security to 'off'
as $function$
  select public.lancement_universitaire_actif()
     and exists (select 1 from public.schools s
                  where s.id = p_ecole and s.type::text = 'UNIVERSITE')
$function$;

-- ── 2. Lecture ───────────────────────────────────────────────────────────────
create policy non_cegepiens_masques_universitaires on public.athletes as restrictive for select to authenticated
  using ((not ${LECT}) or public.athlete_est_cegepien(id));
create policy non_cegepiens_masques_universitaires on public.team_athletes as restrictive for select to authenticated
  using ((not ${LECT}) or public.athlete_est_cegepien(athlete_id));
create policy non_cegepiens_masques_universitaires on public.athlete_badges as restrictive for select to authenticated
  using ((not ${LECT}) or public.athlete_est_cegepien(athlete_id));
create policy non_cegepiens_masques_universitaires on public.evaluations as restrictive for select to authenticated
  using ((not ${LECT}) or public.athlete_est_cegepien(athlete_id));
create policy non_cegepiens_masques_universitaires on public.recruiter_athlete_views as restrictive for all to authenticated
  using ((not ${LECT}) or public.athlete_est_cegepien(athlete_id))
  with check ((not ${LECT}) or public.athlete_est_cegepien(athlete_id));
create policy non_cegepiens_masques_universitaires on public.recruiter_activity_log as restrictive for select to authenticated
  using ((not ${LECT}) or public.athlete_est_cegepien(athlete_id));

-- ── 3. Écriture ──────────────────────────────────────────────────────────────
create policy non_cegepiens_ecriture_universitaires on public.recruiter_favorites as restrictive for insert to authenticated
  with check (not nexus_prive.compte_universitaire(recruiter_id) or public.athlete_est_cegepien(athlete_id));
create policy non_cegepiens_ecriture_universitaires on public.recruiter_pipeline as restrictive for insert to authenticated
  with check (not nexus_prive.compte_universitaire(recruiter_id) or public.athlete_est_cegepien(athlete_id));
create policy non_cegepiens_ecriture_universitaires on public.conversations as restrictive for insert to authenticated
  with check (recruiter_id is null or athlete_id is null
              or not nexus_prive.compte_universitaire(recruiter_id) or public.athlete_est_cegepien(athlete_id));

-- ── 4. Fonctions rebasées ────────────────────────────────────────────────────
${corps.map((f) => `-- ${f.nom}\n${f.nouveau};\n`).join("\n")}`;

const rb = `-- Rollback du lot D3a cégep : corps prod du ${date} remis tels quels, policies et règles retirées.
${corps.map((f) => `-- ${f.nom}\n${f.def};\n`).join("\n")}
create or replace function public.unite_voit_cegepiens(p_ecole uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
 set row_security to 'off'
as $function$
  select exists (select 1 from public.schools s
                  where s.id = p_ecole and s.type::text = 'UNIVERSITE')
$function$;

drop policy non_cegepiens_masques_universitaires on public.athletes;
drop policy non_cegepiens_masques_universitaires on public.team_athletes;
drop policy non_cegepiens_masques_universitaires on public.athlete_badges;
drop policy non_cegepiens_masques_universitaires on public.evaluations;
drop policy non_cegepiens_masques_universitaires on public.recruiter_athlete_views;
drop policy non_cegepiens_masques_universitaires on public.recruiter_activity_log;
drop policy non_cegepiens_ecriture_universitaires on public.recruiter_favorites;
drop policy non_cegepiens_ecriture_universitaires on public.recruiter_pipeline;
drop policy non_cegepiens_ecriture_universitaires on public.conversations;
drop function nexus_prive.lecteur_universitaire();
drop function nexus_prive.compte_universitaire(uuid);
drop function nexus_prive.unite_universitaire(uuid);
`;
fs.writeFileSync(MIG, mig);
fs.writeFileSync(RB, rb);
console.log(`migration ${md5(mig)}  rollback ${md5(rb)}  ${corps.length} fonctions  ${MIG}`);
