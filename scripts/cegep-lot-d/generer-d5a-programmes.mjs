// Génère les fichiers prod des lots de données D5a (programmes de premier cycle) — « qc » : les 12 universités du
// Québec ; « hc » : les 47 universités hors Québec (lot D1b), mêmes règles, mêmes essais :
//   docs/cegep-lot-d/prod/d5a-programmes-qc-<rejeu-blanc|apply|rollback>-<date>.sql
// depuis scripts/cegep-lot-d/d5a-programmes-qc/*.json (relevé du 2026-10-28, sources citées). LF.
// Chaque programme reçoit un uuid STABLE (md5 de université|nom|cycle), le même au rejeu, à l'apply et au rollback.
// Usage : node scripts/cegep-lot-d/generer-d5a-programmes.mjs 20261028 [rejeu-blanc|apply|rollback]
import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

process.chdir(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", ".."));
const [date, type = "rejeu-blanc", lot = "qc"] = process.argv.slice(2);
if (!["qc", "hc"].includes(lot)) throw new Error("lot inconnu : " + lot);
const HC = lot === "hc";
if (!/^\d{8}$/.test(date ?? "")) throw new Error("date AAAAMMJJ attendue");
if (!["rejeu-blanc", "apply", "rollback"].includes(type)) throw new Error("type inconnu : " + type);

const DIR = `scripts/cegep-lot-d/d5a-programmes-${lot}`;
const ORDRE = HC
  ? JSON.parse(fs.readFileSync("scripts/cegep-lot-d/d1b-universites.json", "utf8")).ecoles.map((_, i) => String(i).padStart(2, "0"))
  : ["laval", "udem", "uqam", "ets", "mcgill", "concordia", "usherbrooke", "bishops", "uqtr", "uqac", "uqar", "uqo"];
const md5 = (t) => crypto.createHash("md5").update(t, "utf8").digest("hex");
const uuid = (g) => { const h = md5(`nexus-d5a-${lot}|` + g); return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`; };
const q = (v) => (v == null ? "null" : "'" + String(v).replace(/'/g, "''") + "'");

let brut = "";
const lignes = [], parUniv = [];
for (const slug of ORDRE) {
  const t = fs.readFileSync(`${DIR}/${slug}.json`, "utf8").replace(/\r\n/g, "\n");
  brut += t;
  const d = JSON.parse(t);
  const vus = new Set();
  let nb = 0, nc = 0;
  d.programmes.forEach((p, i) => {
    const nom = p.nom.trim(), fac = p.faculte?.trim() || null, lien = p.lien?.trim() || null, src = p.source?.trim() || null;
    if (!nom || nom.length > 200) throw new Error(`${slug} : nom ${nom}`);
    if (!["baccalaureat", "certificat"].includes(p.cycle)) throw new Error(`${slug} : cycle ${p.cycle}`);
    if (fac && fac.length > 150) throw new Error(`${slug} : faculté trop longue`);
    if (lien && (!lien.startsWith("https://") || lien.length > 500)) throw new Error(`${slug} : lien ${lien}`);
    if (!src || src.length > 500) throw new Error(`${slug} : source ${nom}`);
    const k = nom.toLowerCase() + "|" + p.cycle;
    if (vus.has(k)) throw new Error(`${slug} : doublon ${k}`);
    vus.add(k);
    p.cycle === "baccalaureat" ? nb++ : nc++;
    lignes.push(`  (${q(uuid(`${d.universite}|${nom}|${p.cycle}`))}, ${q(d.universite)}, ${q(nom)}, ${q(p.cycle)}, ${q(fac)}, ${q(lien)}, ${i}, ${q(src)})`);
  });
  parUniv.push(`  (${q(d.universite)}, ${nb}, ${nc})`);
}
const N = lignes.length, MD5_DONNEES = md5(brut);

const ENTETE = `\\set ON_ERROR_STOP 1
\\pset pager off
\\pset null '·'

begin;
set local lock_timeout = '3s';
set local statement_timeout = '120s';
set local search_path = public, extensions;
set local application_name = 'nexus-${type}-cegep-d5a-programmes';
select now() as debut, current_user;

create temp table _p (cle uuid primary key, universite text not null, name text not null, cycle text not null,
                      faculte text, lien text, position int not null, source_url text not null) on commit drop;
insert into _p values
${lignes.join(",\n")};
create temp table _a (universite text primary key, bacc int not null, cert int not null) on commit drop;
insert into _a values
${parUniv.join(",\n")};
`;

const GARDES = `do $$
begin
  if current_user <> 'postgres' then raise exception 'NEXUS: lancer en postgres, pas en %', current_user; end if;
  if not exists (select 1 from supabase_migrations.schema_migrations where version = '20261028090000') then
    raise exception 'NEXUS: préalable D5a étape 2 (university_programs) absent';
  end if;
  if exists (select 1 from public.admin_operations where operation like 'CEGEP_LOT_D5A_PROGRAMMES_QC%') then
    raise exception 'NEXUS: le lot de données D5a (Québec) a déjà laissé une trace';
  end if;
  if (select count(*) from _p) <> ${N} then raise exception 'NEXUS: données incomplètes'; end if;
  if exists (select 1 from _a a where (select count(*) from public.schools s where s.name = a.universite
                                        and s.type = 'UNIVERSITE' and s.province = 'QC') <> 1) then
    raise exception 'NEXUS: une université du relevé ne correspond pas à exactement une université QC : %',
      (select string_agg(a.universite, ', ') from _a a where (select count(*) from public.schools s where s.name = a.universite
                                        and s.type = 'UNIVERSITE' and s.province = 'QC') <> 1);
  end if;
  if exists (select 1 from public.university_programs up join public.schools s on s.id = up.school_id where s.province = 'QC') then
    raise exception 'NEXUS: des programmes existent déjà pour une université du Québec';
  end if;
  if exists (select 1 from public.university_programs where id in (select cle from _p)) then
    raise exception 'NEXUS: une clé du lot existe déjà';
  end if;
end $$;
`;

let sql;
if (type === "rollback") {
  sql = `-- ════════════════════════════════════════════════════════════════════════════
-- Lot de données D5a (programmes, Québec) — ROLLBACK RÉEL EN PROD (sur GO BP seulement) : retire les ${N} programmes
-- pré-remplis par d5a-programmes-qc-apply, sauf ceux que l'université a déjà modifiés (source 'manuel', comptés).
-- Fichier GÉNÉRÉ par scripts/cegep-lot-d/generer-d5a-programmes.mjs (données ${MD5_DONNEES}).
-- ════════════════════════════════════════════════════════════════════════════

${ENTETE}
do $$
begin
  if not exists (select 1 from public.admin_operations where operation = 'CEGEP_LOT_D5A_PROGRAMMES_QC') then
    raise exception 'NEXUS: le lot n''a pas été appliqué';
  end if;
  if exists (select 1 from public.admin_operations where operation = 'CEGEP_LOT_D5A_PROGRAMMES_QC_RETIRES') then
    raise exception 'NEXUS: le lot a déjà été retiré';
  end if;
end $$;
select count(*) filter (where source = 'manuel') as modifies_par_universite_gardes from public.university_programs where id in (select cle from _p);
delete from public.university_programs where id in (select cle from _p) and source = 'seed';
insert into public.admin_operations (operation, motif, details, par)
values ('CEGEP_LOT_D5A_PROGRAMMES_QC_RETIRES', 'Chantier cégep, lot D5a : programmes pré-remplis du Québec retirés (GO BP)',
        jsonb_build_object('programmes', ${N}, 'empreinte_donnees', '${MD5_DONNEES}'),
        (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0'));
commit;
\\echo '== COMMIT fait : programmes pré-remplis du Québec retirés.'
`;
} else {
  const apply = type === "apply";
  sql = `-- ════════════════════════════════════════════════════════════════════════════
-- Lot de données D5a (programmes, Québec) — ${apply ? "APPLY RÉEL EN PROD (sur GO BP seulement, après le rejeu à blanc)" : "REJEU À BLANC (finit par ROLLBACK)"}.
-- ${N} programmes de premier cycle (baccalauréats, certificats) des 12 universités du Québec, relevés le 2026-10-28 sur
-- leurs sites officiels (source citée par ligne), source 'seed'. Fichier GÉNÉRÉ par
-- scripts/cegep-lot-d/generer-d5a-programmes.mjs (données ${MD5_DONNEES}). Lancer SANS -1, en postgres.
-- Rien d'autre ne bouge ; lecture : admin seulement sous OFF (D5a étape 2). Aucun nom de personne affiché.
-- ════════════════════════════════════════════════════════════════════════════

${ENTETE}
${GARDES}
create temp table _avant on commit drop as
select (select count(*) from public.schools) ecoles, (select count(*) from public.teams) equipes,
       (select count(*) from public.users) comptes, (select count(*) from public.athletes) fiches,
       (select count(*) from public.school_programs) programmes_cegep, (select count(*) from public.university_programs) programmes_univ;

insert into public.university_programs (id, school_id, name, cycle, faculte, lien, is_displayed, position, source, source_url)
select p.cle, s.id, p.name, p.cycle, p.faculte, p.lien, true, p.position, 'seed', p.source_url
  from _p p join public.schools s on s.name = p.universite and s.type = 'UNIVERSITE' and s.province = 'QC';

-- Attendu contre obtenu, par université.
create temp table _o on commit drop as
select a.universite, a.bacc as bacc_attendus,
       count(*) filter (where up.cycle = 'baccalaureat') as bacc_obtenus, a.cert as cert_attendus,
       count(*) filter (where up.cycle = 'certificat') as cert_obtenus,
       count(*) filter (where up.lien is null) as sans_lien, count(*) filter (where up.faculte is null) as sans_faculte
  from _a a join public.schools s on s.name = a.universite and s.type = 'UNIVERSITE' and s.province = 'QC'
  left join public.university_programs up on up.school_id = s.id
 group by a.universite, a.bacc, a.cert;
select * from _o order by universite;

-- Qui lit (interrupteur tel quel, OFF en prod), plus un recruteur universitaire témoin sous ON.
create function pg_temp.lit(p_role text, p_uid uuid, p_on boolean) returns text language plpgsql as $$
declare n int; v_neuf uuid := '00000000-0000-4000-8000-0000000d5a03'; v_univ uuid;
begin
  begin
    if p_on then
      update public.app_settings set value = 'true' where key = 'lancement_universitaire';
      select id into v_univ from public.schools where name = 'Université Laval' and type = 'UNIVERSITE';
      insert into auth.users (instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data, created_at, updated_at)
      values ('00000000-0000-0000-0000-000000000000', v_neuf, 'authenticated', 'authenticated', 'd5a3-temoin@nexus.invalid', '{}', '{}', now(), now());
      update public.users set role = 'RECRUTEUR'::public.user_role, context = 'universitaire', school_id = v_univ,
             primary_team_id = null, onboarding_complete = true, role_claimed_at = now() where id = v_neuf;
      p_uid := v_neuf;
    end if;
    if p_role = 'anon' then
      perform set_config('request.jwt.claims', json_build_object('role', 'anon')::text, true);
      perform set_config('role', 'anon', true);
    else
      perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
      perform set_config('role', 'authenticated', true);
    end if;
    begin
      select count(*) into n from public.university_programs;
      raise exception using errcode = 'NX000', message = n::text;
    exception when insufficient_privilege then raise exception using errcode = 'NX000', message = 'refusé';
    end;
  exception
    when sqlstate 'NX000' then return sqlerrm;
    when others then return 'ERREUR ' || sqlstate || ' ' || left(sqlerrm, 70);
  end;
end $$;
create temp table _l on commit drop as
select 1 o, 'anon' appelant, pg_temp.lit('anon', null, false) lu
union all select 2, 'athlète', pg_temp.lit('authenticated', (select a.user_id from public.athletes a join public.users u on u.id = a.user_id
                    where u.role = 'ATHLETE'::public.user_role order by a.user_id limit 1), false)
union all select 3, 'coach', pg_temp.lit('authenticated', (select id from public.users where role = 'COACH'::public.user_role order by id limit 1), false)
union all select 4, 'recruteur collégial', pg_temp.lit('authenticated', (select id from public.users where role = 'RECRUTEUR'::public.user_role
                    and context is distinct from 'universitaire' order by id limit 1), false)
union all select 5, 'partenaire', pg_temp.lit('authenticated', (select id from public.users where role = 'PARTNER'::public.user_role order by id limit 1), false)
union all select 6, 'admin', pg_temp.lit('authenticated', (select id from public.users where role = 'ADMIN'::public.user_role and is_platform_admin order by id limit 1), false)
union all select 7, 'recruteur universitaire (Laval, sous ON)', pg_temp.lit('authenticated', null, true);
select appelant, lu as programmes_lus from _l order by o;

do $$
declare b record;
begin
  if exists (select 1 from _o where bacc_obtenus <> bacc_attendus or cert_obtenus <> cert_attendus) then
    raise exception 'NEXUS: écart attendu / obtenu pour %', (select string_agg(universite, ', ') from _o where bacc_obtenus <> bacc_attendus or cert_obtenus <> cert_attendus);
  end if;
  if (select count(*) from public.university_programs where id in (select cle from _p) and source = 'seed') <> ${N} then
    raise exception 'NEXUS: nombre de programmes insérés différent de ${N}';
  end if;
  select (select count(*) from public.schools) ecoles, (select count(*) from public.teams) equipes,
         (select count(*) from public.users) comptes, (select count(*) from public.athletes) fiches,
         (select count(*) from public.school_programs) programmes_cegep into b;
  if exists (select 1 from _avant a where (a.ecoles, a.equipes, a.comptes, a.fiches, a.programmes_cegep)
               is distinct from (b.ecoles, b.equipes, b.comptes, b.fiches, b.programmes_cegep)) then
    raise exception 'NEXUS: une autre table a bougé';
  end if;
  if exists (select 1 from _l where lu like 'ERREUR%') then raise exception 'NEXUS: un essai de lecture a échoué'; end if;
  if exists (select 1 from _l where o in (2, 3, 4, 5) and lu <> '0') or (select lu from _l where o = 1) <> 'refusé' then
    raise exception 'NEXUS: un non-admin lit des programmes universitaires';
  end if;
  if (select lu from _l where o = 6) <> '${N}' then raise exception 'NEXUS: l''admin ne lit pas les ${N} programmes'; end if;
  if (select lu from _l where o = 7) <> (select (bacc_obtenus + cert_obtenus)::text from _o where universite = 'Université Laval') then
    raise exception 'NEXUS: le recruteur universitaire témoin ne lit pas exactement les programmes de son université';
  end if;
  if exists (select 1 from auth.users where id = '00000000-0000-4000-8000-0000000d5a03') then raise exception 'NEXUS: compte témoin resté'; end if;
  raise notice 'NEXUS: VERDICT données D5a — ${N} programmes du Québec, attendu = obtenu, rien d''autre ne bouge, lus par l''admin seulement (et SA liste pour le recruteur universitaire sous ON)';
end $$;
select 'VERDICT' as verdict, 'conforme' as resultat;
${apply ? `
do $$
begin
  if public.lancement_universitaire_actif() then raise exception 'NEXUS: l''interrupteur doit rester OFF'; end if;
end $$;
insert into public.admin_operations (operation, motif, details, par)
values ('CEGEP_LOT_D5A_PROGRAMMES_QC', 'Chantier cégep, lot D5a : programmes de premier cycle des 12 universités du Québec pré-remplis (GO BP)',
        jsonb_build_object('programmes', ${N}, 'releve', '2026-10-28', 'empreinte_donnees', '${MD5_DONNEES}',
                           'donnees', 'scripts/cegep-lot-d/d5a-programmes-qc/'),
        (select id from public.users where id = 'f51384b5-a2c2-4827-9137-8aa8d29a1fe0'));
select count(*) as programmes_du_lot, clock_timestamp() as avant_commit from public.university_programs where id in (select cle from _p);
commit;
\\echo '== COMMIT fait : programmes du Québec pré-remplis en prod (interrupteur OFF).'
` : `
-- Rollback joué dans la transaction : retire les lignes du lot, vérifie qu'il n'en reste aucune.
delete from public.university_programs where id in (select cle from _p) and source = 'seed';
do $$
begin
  if exists (select 1 from public.university_programs where id in (select cle from _p)) then raise exception 'NEXUS: rollback incomplet'; end if;
  raise notice 'NEXUS: rollback des données D5a vérifié';
end $$;
rollback;
\\echo '== ROLLBACK fait : rien n''est appliqué.'
`}`;
}
if (HC) {
  // Même SQL que le Québec, autre périmètre. Les remplacements ne visent que le gabarit : on vérifie qu'aucune ligne
  // de données ne contient un des motifs remplacés.
  const R = [
    ["s.province = 'QC'", "s.province <> 'QC'"],
    ["CEGEP_LOT_D5A_PROGRAMMES_QC", "CEGEP_LOT_D5A_PROGRAMMES_HC"],
    ["D5a (Québec)", "D5a (hors Québec)"],
    ["exactement une université QC", "exactement une université hors Québec"],
    ["pour une université du Québec", "pour une université hors Québec"],
    ["(programmes, Québec)", "(programmes, hors Québec)"],
    ["des 12 universités du Québec", `des ${ORDRE.length} universités hors Québec (lot D1b)`],
    ["programmes du Québec", "programmes hors Québec"],
    ["pré-remplis du Québec", "pré-remplis hors Québec"],
    ["'Université Laval'", "'Western University'"],
    ["(Laval, sous ON)", "(Western, sous ON)"],
    ["d5a-programmes-qc/", "d5a-programmes-hc/"],
    // L'admin lit TOUTE la table (Québec compris) : on compare à ce qu'elle contient, pas au seul lot.
    [`(select lu from _l where o = 6) <> '${N}' then raise exception 'NEXUS: l''admin ne lit pas les ${N} programmes'`,
     "(select lu from _l where o = 6) <> (select count(*)::text from public.university_programs) then raise exception 'NEXUS: l''admin ne lit pas tous les programmes'"],
  ];
  const donnees = lignes.join("\n") + parUniv.join("\n");
  for (const [a, b] of R) {
    if (donnees.includes(a)) throw new Error("motif présent dans les données : " + a);
    sql = sql.split(a).join(b);
  }
}
const OUT = `docs/cegep-lot-d/prod/d5a-programmes-${lot}-${type}-${date}.sql`;
fs.writeFileSync(OUT, sql);
console.log(`données ${MD5_DONNEES}  programmes ${N}  généré ${md5(sql)}  ${OUT}`);
