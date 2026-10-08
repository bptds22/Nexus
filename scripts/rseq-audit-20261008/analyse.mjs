// analyse.mjs — croise la grille RSEQ (grille.json + diffusion.json) et les relevés de la base.
// Aucune écriture en base. Sorties : catalogue-rseq.csv, ecarts.json, equipes-2026-a-creer.csv, analyse.txt
import fs from 'fs'; import crypto from 'crypto';
const J = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const G = J('grille.json'), D = J('diffusion.json');
const schools = J('schools.json'), teams = J('teams.json'), cand = J('cand.json'), TA = J('team-athletes.json');
const h8 = id => crypto.createHash('md5').update(String(id)).digest('hex').slice(0, 8);
const lireDb = f => new Map(fs.readFileSync(f, 'utf8').trim().split(/\s+/).map(x => { const [h, n, nn] = x.split(':'); return [h, { n: +n, nul: nn === undefined ? null : +nn }]; }));
const db = { '2026 - 2027': lireDb('db-2026.txt'), '2025 - 2026': lireDb('db-2025.txt') };
const REG = ["Abitibi-Témiscamingue","Cantons-de-l'Est","Côte-Nord","Est-du-Québec","GMAA","Lac-Saint-Louis","Laurentides-Lanaudière","Laval","Mauricie","Montérégie","Montréal","Outaouais","Québec-Chaudière-Appalaches","Saguenay-Lac-Saint-Jean","Provincial"];
const NUL = '00000000-0000-0000-0000-000000000000';
const SERIES = /^(gagnant|position|champion|perdant|toutes les)/i;
const csv = v => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const sportNom = c => G.union[String(c)] || `code ${c}`;
const out = [];
const log = (...a) => { out.push(a.join(' ')); };

// ─── 1. CATALOGUE ────────────────────────────────────────────────────────────
const cat = Object.values(G.ligues).map(e => {
  const L = e.L, d = D[L.LeagueId], base = db[e.annee]?.get(h8(L.LeagueId));
  const menuOui = e.couples.filter(c => c.menu).length;
  const hosts = [...new Set(e.couples.map(c => c.host))].sort().join('+');
  return {
    annee: e.annee, id: L.LeagueId, hosts, region_code: L.Region, region: REG[L.Region] ?? `?${L.Region}`,
    sport: L.SportName || sportNom(L.Sport), sport_code: L.Sport, secteur: L.Sector, ligue: L.LeagueName,
    division: L.Division, categorie: L.Category, sexe: L.SexType, nb_equipes: L.TeamCount, maitre: L.IsMasterLeague,
    rseq_reg: d?.reg ?? null, rseq_post: d?.post ?? null, rseq_pre: d?.pre ?? null, rseq_champ: d?.champ ?? null,
    rseq_matchs: d ? d.reg + d.post : null, base_matchs: base?.n ?? 0, base_sans_equipe: base?.nul ?? null,
    couples: e.couples.map(c => `${c.host === 'diffusion' ? 'd' : 's1'}:${c.region}x${c.sport}${c.menu ? '' : '*'}`).join(' '),
    menu: menuOui === e.couples.length ? 'oui' : menuOui === 0 ? 'NON' : 'partiel',
  };
});
const cols = ['annee','hosts','region','sport','secteur','ligue','division','categorie','sexe','nb_equipes','rseq_matchs','rseq_reg','rseq_post','rseq_pre','rseq_champ','base_matchs','base_sans_equipe','menu','couples','id'];
fs.writeFileSync('catalogue-rseq.csv', '﻿' + cols.join(';') + '\n' + cat.sort((a, b) => (a.annee + a.region + a.sport + a.ligue).localeCompare(b.annee + b.region + b.sport + b.ligue)).map(r => cols.map(c => csv(r[c])).join(';')).join('\n') + '\n');

const horsPrim = r => r.secteur !== 'Primaire';
for (const an of ['2026 - 2027', '2025 - 2026']) {
  const L = cat.filter(r => r.annee === an);
  log(`\n== ${an} : ${L.length} ligues RSEQ (grille), secteurs :`, JSON.stringify(L.reduce((a, r) => (a[r.secteur] = (a[r.secteur] || 0) + 1, a), {})));
  log(`   hôtes :`, JSON.stringify(L.reduce((a, r) => (a[r.hosts] = (a[r.hosts] || 0) + 1, a), {})));
  log(`   menu proposait le couple : `, JSON.stringify(L.reduce((a, r) => (a[r.menu] = (a[r.menu] || 0) + 1, a), {})));
  const abs = L.filter(r => horsPrim(r) && r.base_matchs === 0);
  const absAvecMatchs = abs.filter(r => (r.rseq_matchs ?? 0) > 0);
  log(`   hors Primaire, absentes de la base : ${abs.length} (dont ${absAvecMatchs.length} qui portent des matchs, ${absAvecMatchs.reduce((a, r) => a + r.rseq_matchs, 0)} matchs)`);
}

// Tableau des écarts 2026 : ligues avec matchs absentes, et écarts de compte.
const e26 = cat.filter(r => r.annee === '2026 - 2027' && horsPrim(r));
const absentes = e26.filter(r => r.base_matchs === 0 && (r.rseq_matchs ?? 0) > 0);
const ecartsN = e26.filter(r => r.base_matchs > 0 && r.rseq_matchs != null && r.rseq_matchs !== r.base_matchs);
const grp = (rows, k) => rows.reduce((a, r) => { const key = k(r); (a[key] ??= { ligues: 0, matchs: 0, equipes: 0 }); a[key].ligues++; a[key].matchs += r.rseq_matchs ?? 0; a[key].equipes += r.nb_equipes ?? 0; return a; }, {});
log('\n== 2026 : ligues avec matchs ABSENTES de la base, par secteur | région | sport');
for (const [k, v] of Object.entries(grp(absentes, r => `${r.secteur} | ${r.region} | ${r.sport}`)).sort()) log(`   ${k} : ${v.ligues} ligue(s), ${v.matchs} matchs, ${v.equipes} équipes`);
log('\n== 2026 : cause probable des absences (menu / hôte / sport hors liste fixe)');
const cause = r => {
  const c = [];
  if (r.hosts === 's1') c.push(r.region_code === 14 && [1, 5, 16].includes(r.sport_code) ? 's1-liste-fixe-OK?' : 's1 hors liste fixe (région≠14 ou sport∉{1,5,16})');
  if (r.menu === 'NON') c.push('couple caché par le menu');
  if (r.menu === 'partiel') c.push('menu partiel');
  if (['natation', 'cross-country'].includes(String(r.sport).toLowerCase())) c.push('sport exclu par la vue');
  if (!['Secondaire', 'Collégial'].includes(r.secteur)) c.push(`secteur ${r.secteur}`);
  return c.join(' + ') || 'menu OK, hôte diffusion — autre cause';
};
for (const [k, v] of Object.entries(grp(absentes, cause)).sort()) log(`   ${k} : ${v.ligues} ligue(s), ${v.matchs} matchs`);
log(`\n== 2026 : écarts de nombre de matchs (ligues présentes) : ${ecartsN.length}`);
for (const r of ecartsN.sort((a, b) => Math.abs(b.rseq_matchs - b.base_matchs) - Math.abs(a.rseq_matchs - a.base_matchs)).slice(0, 25))
  log(`   ${r.region} | ${r.sport} | ${r.ligue} : RSEQ ${r.rseq_matchs} (rég ${r.rseq_reg} + séries ${r.rseq_post}), base ${r.base_matchs}`);

// Cas précis.
log('\n== Cas précis');
const show = rs => rs.forEach(r => log(`   [${r.annee}] ${r.region} | ${r.sport} | ${r.secteur} | ${r.ligue} | ${r.categorie} ${r.sexe} ${r.division} | équipes ${r.nb_equipes} | matchs RSEQ ${r.rseq_matchs} | base ${r.base_matchs} | menu ${r.menu} | ${r.couples}`));
log(' Outaouais, football et flag, cadet/juvénile :'); show(cat.filter(r => r.region_code === 11 && /football/i.test(r.sport) && /cadet|juv/i.test(r.categorie || '')));
log(' Football (code 5) Montréal / Laval / GMAA :'); show(cat.filter(r => [4, 7, 10].includes(r.region_code) && r.sport_code === 5));
log(' Football (code 5) — toutes les ligues 2026 dont un couple n\'était PAS proposé par le menu :'); show(cat.filter(r => r.annee === '2026 - 2027' && r.sport_code === 5 && r.menu !== 'oui'));

// ─── 2. ÉQUIPES 2026 À CRÉER ────────────────────────────────────────────────
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const schoolById = new Map(schools.map(s => [s.id, s]));
const schoolByInst = new Map(schools.filter(s => s.inst).map(s => [s.inst.toLowerCase(), s]));
const teamByRid = new Map(teams.filter(t => t.rid).map(t => [t.rid.toLowerCase(), t]));
// Équipes RSEQ 2026 : (1) candidates de la base (matchs déjà chez nous, côté sans équipe) ;
// (2) participants des ligues 2026 absentes de la base (lus dans GetLeagueDiffusion).
const inst = new Map(); // rid -> InstitutionId (Teams[] de toutes les ligues lues)
for (const d of Object.values(D)) for (const t of d.equipes || []) if (t.id && t.inst) inst.set(t.id.toLowerCase(), t.inst.toLowerCase());
const eq = new Map();
const ajoute = (rid, o) => { rid = rid.toLowerCase(); const e = eq.get(rid) ?? { rid, nom: o.nom, sources: new Set(), ligues: new Set(), matchs: 0, meta: [] }; e.sources.add(o.src); e.ligues.add(o.ligue); e.matchs += o.n; e.meta.push(o); eq.set(rid, e); };
for (const c of cand) ajoute(c.rid, { src: 'base', nom: c.nom, ligue: c.league_name, n: c.n, sector: c.sector, sport: c.sport, region: c.region, category: c.category, division: c.division, sex: c.sex });
const ligueAbsente = new Set(absentes.map(r => r.id));
for (const r of cat.filter(r => r.annee === '2026 - 2027' && ligueAbsente.has(r.id))) {
  const d = D[r.id]; const n = new Map();
  for (const [id, nom] of d.participants || []) if (id && id !== NUL) n.set(id, { nom, k: (n.get(id)?.k ?? 0) + 1 });
  for (const [id, v] of n) ajoute(id, { src: 'ligue absente', nom: v.nom, ligue: r.ligue, n: v.k, sector: r.secteur, sport: r.sport, region: r.region, category: r.categorie, division: r.division, sex: r.sexe });
}
// Décisions BP (2026-10-08) et cas à faire confirmer.
const BP = [
  [/^le ber\b/i, 'eebf1ac9-ee89-4430-969a-6dc5992d6a3d', 'confirmée BP (Le Ber = École de la Montée)'],
  [/laval jr\.? academy/i, 'f3401c79-bc55-4ff5-ac85-d368b6eb88f2', 'confirmée BP (École secondaire Laval Junior)'],
  [/^matane\b/i, 'da845de0-6698-4110-98bb-15c0e7c35bfd', 'confirmée BP (École secondaire de Matane, pas le cégep)'],
  [/^s\.? de sherbrooke/i, '5d8885c8-037d-4e82-84eb-e6822b59c543', 'confirmée BP (Séminaire de Sherbrooke secondaire, pas le cégep)'],
];
// À faire confirmer par BP (2026-10-08) : noms RSEQ EXACTS.
const A_CONFIRMER = /^(é.?i.? du phare|st-fran[cç]ois|rivi[eè]re-du-loup)$/i;
// Pistes pour les noms sans école résolue : suggestion seulement, jamais créée sans BP.
const PISTES = [
  [/^é.?i.? du phare$/i, 'c1d6d080-a8e4-47b9-bc3b-a1f1e34fa75b'],
  [/^s[ée]minaire saint-joseph$/i, null, 'Séminaire Saint-Joseph de Trois-Rivières'],
  [/^rivi[eè]re-du-loup$/i, '41e6676c-4d83-4dbd-8532-6bb3dd5d459c'],
  [/^coll. h[ée]ritage$/i, null, 'Collège Héritage de Châteauguay'],
  [/^centennial academy$/i, null, 'Centennial Academy'],
  [/^coll[eè]ge pasteur/i, null, 'Collège Pasteur'],
  [/^sieur-de-coulonge$/i, null, 'École secondaire Sieur-de-Coulonge'],
  [/^collège beaubois$/i, null, 'Collège Beaubois'],
  [/^é.s. montcalm/i, null, 'École Mitchell - Montcalm'],
];
const SPORT_NEXUS = { 'Ultimate': 'Ultimate frisbee', 'Balle molle': null };
const SEXE = { 'Garçons': 'Masculin', 'Filles': 'Féminin' };
const t25parNom = new Map();
for (const t of teams.filter(t => t.season === '2025-2026')) { const k = norm(t.name) + '|' + schoolById.get(t.school_id)?.type; (t25parNom.get(k) ?? t25parNom.set(k, new Set()).get(k)).add(t.school_id); }
const secType = s => s === 'Collégial' ? 'CEGEP' : 'SECONDAIRE';
function ecole(e, m) {
  for (const [re, id, conf] of BP) if (re.test(e.nom)) return { s: schoolById.get(id), conf, how: 'décision BP' };
  const i = inst.get(e.rid); const si = i && schoolByInst.get(i);
  if (si && si.type === secType(m.sector)) return { s: si, conf: A_CONFIRMER.test(e.nom) ? 'à confirmer BP' : 'haute', how: 'InstitutionId RSEQ' };
  if (si) return { s: si, conf: 'à confirmer BP', how: `InstitutionId RSEQ → ${si.type} (secteur ${m.sector})` };
  const n = t25parNom.get(norm(e.nom) + '|' + secType(m.sector));
  if (n && n.size === 1) { const s = schoolById.get([...n][0]); if (s) return { s, conf: A_CONFIRMER.test(e.nom) ? 'à confirmer BP' : 'moyenne', how: 'même nom RSEQ qu\'une équipe 2025' }; }
  for (const [re, id, nom] of PISTES) if (re.test(e.nom)) {
    const c = id ? [schoolById.get(id)] : schools.filter(x => x.type === secType(m.sector) && norm(x.name) === norm(nom));
    if (c.length === 1 && c[0]) return { s: c[0], conf: 'à confirmer BP', how: `piste par le nom${i ? ' (InstitutionId RSEQ ' + i + ' inconnu chez nous)' : ''}` };
    if (c.length > 1) return { s: null, conf: 'introuvable', how: `piste : ${c.length} écoles « ${nom} » en double dans schools (${c.map(x => x.id).join(', ')})` };
  }
  return { s: null, conf: 'introuvable', how: i ? `InstitutionId ${i} sans école Nexus` : 'pas d\'InstitutionId, nom inconnu' };
}
const t26 = teams.filter(t => t.season === '2026-2027');
const lignes = [], exclues = { series: 0, nul: 0, deja: 0 };
for (const e of eq.values()) {
  if (e.rid === NUL) { exclues.nul++; continue; }
  if (SERIES.test(e.nom || '')) { exclues.series++; continue; }
  if (teamByRid.has(e.rid)) { exclues.deja++; continue; }
  if (!['Secondaire','Collégial'].includes(e.meta[0].sector)) { exclues.hors_perimetre = (exclues.hors_perimetre||0)+1; continue; }
  const m = e.meta.sort((a, b) => b.n - a.n)[0];
  const ec = ecole(e, m);
  const dup = ec.s && t26.filter(t => t.school_id === ec.s.id && t.sport === m.sport && norm(t.age) === norm(m.category) && norm(t.div).replace('division ', 'd') === norm(m.division).replace('division ', 'd'));
  const ath = ec.s ? TA.filter(a => a.season === '2025-2026' && a.school_id === ec.s.id && a.sport === m.sport && norm(a.age) === norm(m.category)) : [];
  lignes.push({
    secteur: m.sector, sport: m.sport, region: m.region, nom_rseq: e.nom, categorie: m.category, division: m.division, sexe: m.sex,
    rseq_team_id: e.rid, ecole: ec.s?.name ?? '', ecole_id: ec.s?.id ?? '', ville: ec.s?.city ?? '', confiance: ec.conf, comment: ec.how,
    doublon_2026: dup && dup.length ? dup.map(t => `${t.id} (${t.name}${t.rid ? ', rseq ' + t.rid : ', sans rseq'})`).join(' / ') : '',
    athletes_restes_2025: ath.map(a => `${a.team_id}: ${a.n} (${a.ids.split(String.fromCharCode(92)).join('')})`).join(' / '),
    sport_nexus: m.sport in SPORT_NEXUS ? (SPORT_NEXUS[m.sport] ?? 'ABSENT de sports') : m.sport, sexe_nexus: SEXE[m.sex] ?? m.sex,
    matchs: e.matchs, matchs_en_base: e.meta.filter(x => x.src === "base").reduce((a, x) => a + x.n, 0), source: [...e.sources].join('+'), ligues: [...e.ligues].join(' / '),
    a_creer: (m.sport in SPORT_NEXUS && !SPORT_NEXUS[m.sport]) ? 'non (sport absent de Nexus)' : !ec.s ? 'non (école introuvable)' : (dup && dup.length ? 'non (doublon à trancher)' : (ec.conf === 'à confirmer BP' ? 'après confirmation BP' : 'oui')),
  });
}
const c2 = ['a_creer','confiance','secteur','sport','sport_nexus','sexe_nexus','region','nom_rseq','ecole','ville','categorie','division','sexe','rseq_team_id','ecole_id','comment','doublon_2026','athletes_restes_2025','matchs','matchs_en_base','source','ligues'];
lignes.sort((a, b) => (a.secteur + a.sport + a.region + a.nom_rseq).localeCompare(b.secteur + b.sport + b.region + b.nom_rseq));
fs.writeFileSync('equipes-2026-a-creer.csv', '﻿' + c2.join(';') + '\n' + lignes.map(r => c2.map(c => csv(r[c])).join(';')).join('\n') + '\n');
fs.writeFileSync('equipes-2026.json', JSON.stringify(lignes));
log(`\n== Équipes 2026 sans équipe Nexus : ${lignes.length} lignes (exclues : ${JSON.stringify(exclues)})`);
const tab = (k) => Object.entries(lignes.reduce((a, r) => { const x = k(r); a[x] = (a[x] || 0) + 1; return a; }, {})).sort((a, b) => b[1] - a[1]).map(([x, n]) => `${x}: ${n}`).join(' · ');
log('   par décision  :', tab(r => r.a_creer));
log('   par confiance :', tab(r => r.confiance));
log('   par sport     :', tab(r => `${r.secteur}/${r.sport}`));
log('   par source    :', tab(r => r.source));
log('   football (création « oui ») :', lignes.filter(r => r.sport === 'Football' && r.a_creer === 'oui').length);
log('   lignes signalant des athlètes restés sur 2025 :', lignes.filter(r => r.athletes_restes_2025).length);
log('\n== Écoles ciblées (2026)');
for (const re of [/paul-le jeune/i, /ch[aâ]teauguay valley/i, /polyvalente sainte-th[eé]r[eè]se/i]) {
  const s = schools.filter(s => re.test(s.name)); for (const x of s) {
    const L = lignes.filter(r => r.ecole_id === x.id); const T = t26.filter(t => t.school_id === x.id);
    const R = [...eq.values()].filter(e => inst.get(e.rid) === x.inst?.toLowerCase());
    log(`   ${x.name} (inst ${x.inst}) : équipes Nexus 2026 ${T.length} ; équipes RSEQ 2026 vues ${R.length} [${R.map(e => e.nom + ' / ' + [...e.ligues].join(',')).join(' ; ')}] ; à créer ${L.length}`);
  }
}
log("\n== Athlètes ACTIFS restés sur une équipe 2025 alors qu'une équipe 2026 (existante ou à créer) existe pour la même école / sport / catégorie");
const A = [];
for (const a of TA.filter(a => a.season === '2025-2026')) {
  const ex = t26.filter(t => t.school_id === a.school_id && t.sport === a.sport && norm(t.age) === norm(a.age));
  const nv = lignes.filter(r => r.ecole_id === a.school_id && r.sport === a.sport && norm(r.categorie) === norm(a.age) && r.ecole_id);
  if (!ex.length && !nv.length) continue;
  const ec = schoolById.get(a.school_id)?.name; const ids = a.ids.split(String.fromCharCode(92)).join('');
  A.push([ec, a.sport, a.age, a.gender, a.div, a.team_id, a.n, ids, ex.map(t => t.id + ' ' + t.name + ' ' + t.age + ' ' + t.gender + ' ' + t.div).join(' / '), nv.map(r => r.nom_rseq + ' ' + r.categorie + ' ' + r.sexe + ' ' + r.division + ' [' + r.a_creer + ']').join(' / ')]);
  log(`   ${ec} | ${a.sport} ${a.age} ${a.gender} ${a.div} | équipe 2025 ${a.team_id.slice(0,8)} : ${a.n} athlète(s) [${ids}] | 2026 existante : ${ex.map(t => t.name + ' ' + t.gender + ' ' + t.div).join(', ') || '—'} | 2026 à créer : ${nv.map(r => r.nom_rseq + ' ' + r.sexe + ' ' + r.division).join(', ') || '—'}`);
}
fs.writeFileSync('athletes-restes-2025.csv', '﻿' + ['ecole','sport','categorie','sexe','division','equipe_2025','nb_actifs','athletes_id8','equipes_2026_existantes','equipes_2026_a_creer'].join(';') + '\n' + A.map(r => r.map(csv).join(';')).join('\n') + '\n');
fs.writeFileSync('analyse.txt', out.join('\n') + '\n'); console.log(out.join('\n'));
