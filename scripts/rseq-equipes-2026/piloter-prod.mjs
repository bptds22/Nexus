// piloter-prod.mjs — lots 02 à 09 en prod (GO BP du 2026-10-08), l'un après l'autre, STOP au premier écart.
// Pour chaque lot : md5 du fichier ; relevés AVANT (comparés aux attendus) ; exécution de run/<lot>.run.sql
// (BEGIN + lot tel quel + contrôle de signature + COMMIT) par la CLI Supabase ; relevés APRÈS (comparés).
// Sortie : journal brut dans run/journal-prod.txt. Aucun rollback automatique en dehors de la transaction du lot.
import fs from 'fs'; import crypto from 'crypto'; import { execFileSync } from 'child_process';
const REF = 'nrloizyemulbhujrqhgx';
const NEXUS = 'C:/Users/bptds/Documents/Nexus';
const md5 = s => crypto.createHash('md5').update(s, 'utf8').digest('hex');
const LOTS = [
  ['02-flag-football', 'cee62100a0caa8d9edda373850a541bb', 442, 1309, 1318, 'a80e22e2d7b04d110159ec05ab081a91'],
  ['03-soccer', 'b41b04e0b6a88a66677a27d0d4e7822d', 203, 691, 663, '8bdf1bed390140c2eb4c2708d15d9495'],
  ['04-volleyball', '610b99304879b2bdd1f87099465fc17f', 328, 1872, 1891, 'e60196f2df1c93f98a47ea1d9b8f8353'],
  ['05-basketball', '2a40083d94ba9193726f5c4d3d4fbb8a', 370, 2204, 2207, 'b82428bf2ef919ff84a8d163e0373c1e'],
  ['06-futsal', '7a235479ac77c8d724a271830bff5e27', 328, 1689, 1689, '2788b8b8c79d2c6f0b67cad52da4922c'],
  ['07-baseball', 'abc4cafdc70cad66248498dfe1c6731c', 15, 45, 45, '1b55df09e63c2fe3e6c35c3b133e7b17'],
  ['08-rugby', '89281f9ca297c4c2d492ef4bcebb8ac8', 6, 26, 22, 'a24047249e0536c99bb2fb60487e77c5'],
  ['09-ultimate-frisbee', 'f51da263ee696698cc9e6e701674dd7f', 7, 34, 26, 'c4ddd0ffbceedb2bc7a1414742e36dcd'],
];
const FIXE = {
  equipes_md5_hors_lots_crees: '5bdc27ebe858eb58de8323691d6e83bd', matchs_hors_liaison_md5: 'eead097c3bd0bac3e9a9fd6f65029518',
  notifications_unite: '3', rapprochement_file: '0', rapprochements: '0', 'net.http_request_queue': '0',
  team_athletes: '115', team_coaches: '16', athletes_md5: '6b7dd79361c4010ec14a594ffe766f99',
};
const journal = [];
const log = (...a) => { const l = a.join(' '); journal.push(l); console.log(l); fs.writeFileSync('run/journal-prod.txt', journal.join('\n') + '\n'); };

function cli(fichier) {
  try {
    const out = execFileSync('npx.cmd', ['supabase', 'db', 'query', '--linked', '--project-ref', REF, '-f', fichier],
      { cwd: NEXUS, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024, shell: true });
    return { ok: true, json: JSON.parse(out.slice(out.indexOf('{'))) };
  } catch (e) {
    return { ok: false, err: String(e.stdout || '') + String(e.stderr || '') };
  }
}
function releve(lot, slugApplique) {
  const pref = lot ? lot.prefixes : '';
  const q = `with app_ids as (select distinct (jsonb_array_elements_text(details->'rseq_team_ids'))::uuid r from admin_operations where operation='EQUIPES_RSEQ_2026_CREEES' and details->>'lot' = '${slugApplique || 'zz'}'),
pref(p) as (select unnest(string_to_array('${pref}', ',')))
select 'equipes_total' k, count(*)::text v from teams
union all select 'equipes_md5_hors_lots_crees', md5(string_agg(t::text, '|' order by t.id)) from teams t where t.id not in (select t2.id from teams t2 join (select (jsonb_array_elements_text(details->'rseq_team_ids'))::uuid r from admin_operations where operation='EQUIPES_RSEQ_2026_CREEES') a on a.r=t2.rseq_team_id)
union all select 'matchs_hors_liaison_md5', md5(string_agg((to_jsonb(g) - 'home_team_id' - 'visitor_team_id')::text, '|' order by g.id)) from games g
union all select 'admin_operations', count(*)::text from admin_operations
union all select 'notifications_unite', count(*)::text from notifications_unite
union all select 'rapprochement_file', count(*)::text from rapprochement_file
union all select 'rapprochements', count(*)::text from rapprochements
union all select 'net.http_request_queue', count(*)::text from net.http_request_queue
union all select 'team_athletes', count(*)::text from team_athletes
union all select 'team_coaches', count(*)::text from team_coaches
union all select 'athletes_md5', md5(string_agg(a::text, '|' order by a.id)) from athletes a
union all select 'app_equipes', count(*)::text from teams t join app_ids a on a.r=t.rseq_team_id where t.season='2026-2027'
union all select 'app_signature', md5(string_agg(t.rseq_team_id||'|'||t.school_id||'|'||t.sport_id||'|'||t.name||'|'||coalesce(t.age_group,'')||'|'||coalesce(t.division,'')||'|'||coalesce(t.gender,''), ';' order by t.rseq_team_id)) from teams t join app_ids a on a.r=t.rseq_team_id where t.season='2026-2027'
union all select 'app_dom', (select count(*) from games g join teams t on t.id=g.home_team_id join app_ids a on a.r=t.rseq_team_id)::text
union all select 'app_vis', (select count(*) from games g join teams t on t.id=g.visitor_team_id join app_ids a on a.r=t.rseq_team_id)::text
union all select 'app_null_restants', ((select count(*) from games where home_team_id is null and home_rseq_team_id in (select r from app_ids))+(select count(*) from games where visitor_team_id is null and visitor_rseq_team_id in (select r from app_ids)))::text
union all select 'app_ligne_ops', (select operation||' · '||(details->>'equipes')||' éq · '||(details->>'cotes_domicile')||' dom · '||(details->>'cotes_visiteur')||' vis · '||to_char(le at time zone 'UTC','YYYY-MM-DD HH24:MI:SS')||' UTC · par '||left(par::text,8) from admin_operations where details->>'lot' = '${slugApplique || 'zz'}' order by le desc limit 1)
union all select 'avant_rseq_deja', (select count(*)::text from teams where left(md5(rseq_team_id::text),8) in (select p from pref))
union all select 'avant_dom_null', (select count(*) from games where home_team_id is null and left(md5(home_rseq_team_id::text),8) in (select p from pref))::text
union all select 'avant_vis_null', (select count(*) from games where visitor_team_id is null and left(md5(visitor_rseq_team_id::text),8) in (select p from pref))::text
order by 1;`;
  fs.writeFileSync('run/releve.sql', q);
  const r = cli(fs.realpathSync('run/releve.sql'));
  if (!r.ok) return null;
  return Object.fromEntries(r.json.rows.map(x => [x.k, x.v]));
}
const ecarts = (R, attendu) => Object.entries(attendu).filter(([k, v]) => String(R?.[k]) !== String(v)).map(([k, v]) => `${k}=${R?.[k]} (attendu ${v})`);

// préfixes md5 des rseq_team_id de chaque lot (relevé AVANT)
for (const L of LOTS) {
  const s = fs.readFileSync(`lots/${L[0]}.sql`, 'utf8');
  L.prefixes = [...s.matchAll(/^\s+\('([0-9a-f-]{36})'::uuid/gm)].map(m => md5(m[1]).slice(0, 8)).join(',');
}
let equipes = 8338, ops = 15, totEq = 38, totCotes = 227;
log(`# Lots 02 à 09 — prod ${REF} — début ${new Date().toISOString()}`);
for (const L of LOTS) {
  const [slug, md5Fichier, n, dom, vis, sig] = L;
  const lot = { prefixes: L.prefixes };
  const f = fs.readFileSync(`lots/${slug}.sql`, 'utf8');
  if (md5(f) !== md5Fichier) { log(`STOP ${slug} : md5 du fichier ${md5(f)} ≠ ${md5Fichier}`); process.exit(2); }
  const run = fs.readFileSync(`run/${slug}.run.sql`, 'utf8');
  if (!run.includes(f)) { log(`STOP ${slug} : le fichier combiné ne contient pas le lot tel quel`); process.exit(2); }
  const A = releve(lot, null);
  const eA = A ? ecarts(A, { ...FIXE, equipes_total: equipes, admin_operations: ops, avant_rseq_deja: 0, avant_dom_null: dom, avant_vis_null: vis }) : ['relevé impossible'];
  log(`\n## ${slug} — AVANT ${JSON.stringify(A)}`);
  if (eA.length) { log(`STOP ${slug} AVANT : ${eA.join(' ; ')}`); process.exit(3); }
  const t0 = new Date().toISOString();
  const X = cli(fs.realpathSync(`run/${slug}.run.sql`));
  log(`## ${slug} — EXÉCUTION ${t0} → ${X.ok ? 'OK (transaction validée)' : 'ERREUR : ' + X.err.trim()}`);
  if (!X.ok) { log(`STOP ${slug} : erreur d'exécution, transaction annulée`); process.exit(4); }
  const B = releve(null, slug);
  const eB = B ? ecarts(B, { ...FIXE, equipes_total: equipes + n, admin_operations: ops + 1, app_equipes: n, app_signature: sig, app_dom: dom, app_vis: vis, app_null_restants: 0 }) : ['relevé impossible'];
  log(`## ${slug} — APRÈS ${JSON.stringify(B)}`);
  if (eB.length) { log(`STOP ${slug} APRÈS : ${eB.join(' ; ')}`); process.exit(5); }
  equipes += n; ops += 1; totEq += n; totCotes += dom + vis;
  log(`OK ${slug} | ${n} équipes | ${dom} + ${vis} = ${dom + vis} côtés | ${B.app_ligne_ops} | signature ${B.app_signature} OK | cumul ${totEq} équipes / ${totCotes} côtés`);
}
log(`\n# FIN ${new Date().toISOString()} — total avec le lot 01 : ${totEq} équipes / ${totCotes} côtés (attendu 1737 / 15958)`);
