// generer-lots.mjs — lots de création des équipes RSEQ 2026 (secondaire), décisions BP du 2026-10-08.
// Entrée : equipes-2026-revue.json (= docs/rseq-audit-20261008/equipes-2026-a-creer.csv).
// Sorties : lots/NN-<sport>.sql (création + liaison des matchs), lots/NN-<sport>.rollback.sql, lots/lots.csv.
// Aucune écriture : ce script produit du SQL, il ne l'exécute pas. Règles : CLAUDE.md § « Pont RSEQ ».
import fs from 'fs';
const L = JSON.parse(fs.readFileSync('equipes-2026-revue.json', 'utf8'));
const SPORTS = {
  'Baseball': '0d0ac8e3-f3e6-48e6-8f73-3aef00ee1b8b', 'Basketball': '5dd6a7c8-2aa4-4b0e-a150-4ac77255f492',
  'Flag football': 'f1c283ba-7ef2-44a5-acff-d16017562d67', 'Football': '4b859bf1-5832-4258-897c-e094062926af',
  'Futsal': '19c2d1e6-978a-402e-9c22-c967274121bc', 'Rugby': '8480c09c-1d30-46eb-a819-67ded94c8390',
  'Soccer': 'aa2d1f97-989d-4491-b733-9236129ba154', 'Ultimate frisbee': '0f3d4984-605a-4af1-86a9-432499ab8fd9',
  'Volleyball': '063752bb-e786-4009-ac46-bb3c4eccfdee',
};
// Décisions BP 2026-10-08 au-delà des lignes « oui », avec l'école retenue (null = celle du CSV).
const DECIDE = [
  [/^É\.I\. Du Phare$/, 'c1d6d080-a8e4-47b9-bc3b-a1f1e34fa75b'],        // École internationale du Phare (Sherbrooke)
  [/^Séminaire Saint-Joseph$/, '5c286b8c-e9f9-43ab-8f70-0633fc36ed9d'],  // Séminaire Saint-Joseph de Trois-Rivières
  [/^É\.S\. du Triolet$/, null],    // seconde équipe RSEQ du Triolet : créer
  [/^É\. sec\. Du Rocher$/, null],  // Du Rocher : équipe normale ; « Pionniers » n'est pas un doublon (décision BP)
];
const EXCEPTIONS_DOUBLON = new Set(); // rapprochements école+sport+catégorie+division tranchés « créer » par BP

const lignes = [];
for (const r of L) {
  if (r.secteur !== 'Secondaire' || !(r.matchs_en_base > 0)) continue;
  let ecole = r.ecole_id;
  if (r.a_creer !== 'oui') {
    const d = DECIDE.find(([re]) => re.test(r.nom_rseq));
    if (!d) continue;
    if (d[1]) ecole = d[1];
    if (/doublon/.test(r.a_creer)) EXCEPTIONS_DOUBLON.add(r.rseq_team_id);
  }
  if (!SPORTS[r.sport_nexus]) throw new Error('sport sans id : ' + r.sport_nexus);
  lignes.push({
    rid: r.rseq_team_id, school_id: ecole, sport: r.sport_nexus, sport_id: SPORTS[r.sport_nexus], name: r.nom_rseq,
    age_group: r.categorie || null, division: r.division || null, gender: r.sexe_nexus || null, cotes: r.matchs_en_base,
  });
}

const q = v => (v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const DIV = c => `regexp_replace(lower(coalesce(${c}, '')), '^division\\s*', 'd')`;
const ORDRE = ['Football', 'Flag football', 'Soccer', 'Volleyball', 'Basketball', 'Futsal', 'Baseball', 'Rugby', 'Ultimate frisbee'];
const resume = [];

ORDRE.forEach((sport, i) => {
  const lot = lignes.filter(l => l.sport === sport).sort((a, b) => a.rid.localeCompare(b.rid));
  if (!lot.length) return;
  const nn = String(i + 1).padStart(2, '0');
  const slug = sport.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z]+/g, '-');
  const n = lot.length;
  const cotes = lot.reduce((a, l) => a + l.cotes, 0);
  const exc = lot.filter(l => EXCEPTIONS_DOUBLON.has(l.rid)).map(l => l.rid);
  const excSql = exc.length ? `array[${exc.map(x => q(x) + '::uuid').join(', ')}]` : 'array[]::uuid[]';
  const values = lot.map(l =>
    `    (${q(l.rid)}::uuid, ${q(l.school_id)}::uuid, ${q(l.sport_id)}::uuid, ${q(l.name)}, ${q(l.age_group)}, ${q(l.division)}, ${q(l.gender)})`,
  ).join(',\n');
  const tete =
`-- Lot ${nn} — ${sport} : ${n} équipe(s) RSEQ 2026 (secondaire), ${cotes} côté(s) de match à relier (relevé prod du 2026-10-08).
-- Généré par scripts/rseq-equipes-2026/generer-lots.mjs. Règles : CLAUDE.md § « Pont RSEQ ».`;

  const lotSql = `${tete}
-- Transaction gardée : exactement ${n} équipe(s) créée(s) et exactement les côtés de match relevés
-- (games.home_team_id / visitor_team_id NULL portant un rseq_team_id du lot), sinon RIEN n'est écrit.
-- Aucun match supprimé ; aucune équipe existante modifiée ; seules colonnes écrites dans games :
-- home_team_id et visitor_team_id, et seulement là où elles sont NULL.
do $$
declare
  v_bp uuid;
  n_attendu constant int := ${n};
  cotes_releves constant int := ${cotes};  -- relevé à la génération ; recompté et exigé dans la transaction
  n_ins int; n_h int; n_v int; n_h0 int; n_v0 int; n_ops0 int; n_ops1 int; n_teams0 int; n_teams1 int;
begin
  select id into strict v_bp from public.users where email = 'bptds22@gmail.com';
  create temp table _lot (rseq_team_id uuid primary key, school_id uuid not null, sport_id uuid not null,
    name text not null, age_group text, division text, gender text) on commit drop;
  insert into _lot values
${values};

  -- Gardes (dédoublonnage du Pont RSEQ)
  if (select count(*) from _lot) <> n_attendu then
    raise exception 'NEXUS: lot de % ligne(s), attendu %', (select count(*) from _lot), n_attendu; end if;
  if exists (select 1 from public.teams t join _lot l using (rseq_team_id)) then
    raise exception 'NEXUS: % rseq_team_id du lot déjà en base — régénérer',
      (select count(*) from public.teams t join _lot l using (rseq_team_id)); end if;
  if exists (select 1 from _lot l left join public.schools s on s.id = l.school_id
              where s.id is null or s.type <> 'SECONDAIRE') then
    raise exception 'NEXUS: école absente ou non SECONDAIRE dans le lot'; end if;
  if exists (select 1 from _lot l join public.teams t
               on t.school_id = l.school_id and t.sport_id = l.sport_id and t.season = '2026-2027'
              and coalesce(t.age_group, '') = coalesce(l.age_group, '')
              and ${DIV('t.division')} = ${DIV('l.division')}
             where l.rseq_team_id <> all (${excSql})) then
    raise exception 'NEXUS: doublon école + sport + catégorie + division + saison non tranché par BP'; end if;

  select count(*) into n_h0 from public.games g join _lot l on l.rseq_team_id = g.home_rseq_team_id where g.home_team_id is null;
  select count(*) into n_v0 from public.games g join _lot l on l.rseq_team_id = g.visitor_rseq_team_id where g.visitor_team_id is null;
  if n_h0 + n_v0 <> cotes_releves then
    raise exception 'NEXUS: % côté(s) de match à relier aujourd''hui, % au relevé — la veille a bougé, régénérer',
      n_h0 + n_v0, cotes_releves; end if;
  select count(*) into n_ops0 from public.admin_operations;
  select count(*) into n_teams0 from public.teams;

  insert into public.teams (school_id, sport_id, name, age_group, division, gender, season, rseq_team_id)
  select school_id, sport_id, name, age_group, division, gender, '2026-2027', rseq_team_id from _lot;
  get diagnostics n_ins = row_count;

  update public.games g set home_team_id = t.id
    from public.teams t join _lot l using (rseq_team_id)
   where g.home_rseq_team_id = t.rseq_team_id and g.home_team_id is null;
  get diagnostics n_h = row_count;
  update public.games g set visitor_team_id = t.id
    from public.teams t join _lot l using (rseq_team_id)
   where g.visitor_rseq_team_id = t.rseq_team_id and g.visitor_team_id is null;
  get diagnostics n_v = row_count;

  insert into public.admin_operations (operation, motif, details, par)
  values ('EQUIPES_RSEQ_2026_CREEES',
          'Équipes RSEQ 2026 secondaires créées et matchs reliés — lot ${nn} ${sport} (audit RSEQ, GO BP)',
          jsonb_build_object('lot', '${nn}-${slug}', 'sport', ${q(sport)}, 'equipes', n_ins,
                             'cotes_domicile', n_h, 'cotes_visiteur', n_v,
                             'rseq_team_ids', (select jsonb_agg(rseq_team_id order by rseq_team_id) from _lot)),
          v_bp);
  select count(*) into n_ops1 from public.admin_operations;
  select count(*) into n_teams1 from public.teams;

  if n_ins <> n_attendu or n_teams1 - n_teams0 <> n_attendu or n_h <> n_h0 or n_v <> n_v0 or n_ops1 - n_ops0 <> 1 then
    raise exception 'NEXUS: garde échouée (équipes +%, domicile %/%, visiteur %/%, ops +%) — rien écrit',
      n_ins, n_h, n_h0, n_v, n_v0, n_ops1 - n_ops0; end if;
  raise notice 'OK lot ${nn} ${sport} : % équipe(s), % côté(s) domicile + % côté(s) visiteur reliés, 1 ligne admin_operations',
    n_ins, n_h, n_v;
end $$;
`;

  const rbSql = `${tete}
-- ROLLBACK du lot : remet à NULL les côtés de match reliés aux équipes du lot, puis supprime ces équipes.
-- Gardé : exactement ${n} équipe(s) du lot en base, aucune n'a reçu de dépendant (athlète, coach, invitation,
-- page, fanion, événement, besoin, jeton, carte prospect, équipe principale, revendication), sinon RIEN.
do $$
declare
  v_bp uuid; n_attendu constant int := ${n};
  n_eq int; n_h int; n_v int; n_del int; n_ops0 int; n_ops1 int;
begin
  select id into strict v_bp from public.users where email = 'bptds22@gmail.com';
  create temp table _lot (rseq_team_id uuid primary key) on commit drop;
  insert into _lot values ${lot.map(l => `(${q(l.rid)}::uuid)`).join(', ')};
  create temp table _eq on commit drop as
    select t.id from public.teams t join _lot l using (rseq_team_id) where t.season = '2026-2027';
  select count(*) into n_eq from _eq;
  if n_eq <> n_attendu then raise exception 'NEXUS: % équipe(s) du lot en base, attendu %', n_eq, n_attendu; end if;
  if exists (select 1 from public.team_athletes x join _eq e on e.id = x.team_id)
     or exists (select 1 from public.team_coaches x join _eq e on e.id = x.team_id)
     or exists (select 1 from public.team_invitations x join _eq e on e.id = x.team_id)
     or exists (select 1 from public.team_page_content x join _eq e on e.id = x.team_id)
     or exists (select 1 from public.team_pennants x join _eq e on e.id = x.team_id)
     or exists (select 1 from public.team_events x join _eq e on e.id = x.team_id)
     or exists (select 1 from public.team_position_needs x join _eq e on e.id = x.team_id)
     or exists (select 1 from public.team_join_tokens x join _eq e on e.id = x.team_id)
     or exists (select 1 from public.cartes_prospect x join _eq e on e.id = x.team_id)
     or exists (select 1 from public.users x join _eq e on e.id = x.primary_team_id)
     or exists (select 1 from public.ambassadeur_revendications x join _eq e on e.id = x.team_id) then
    raise exception 'NEXUS: une équipe du lot a reçu un dépendant — rollback refusé, à trancher par BP'; end if;
  select count(*) into n_ops0 from public.admin_operations;

  update public.games g set home_team_id = null from _eq e where g.home_team_id = e.id;
  get diagnostics n_h = row_count;
  update public.games g set visitor_team_id = null from _eq e where g.visitor_team_id = e.id;
  get diagnostics n_v = row_count;
  delete from public.teams t using _eq e where t.id = e.id;
  get diagnostics n_del = row_count;

  insert into public.admin_operations (operation, motif, details, par)
  values ('EQUIPES_RSEQ_2026_RETIREES', 'Rollback du lot ${nn} ${sport} (équipes RSEQ 2026 créées par l''audit)',
          jsonb_build_object('lot', '${nn}-${slug}', 'equipes', n_del, 'cotes_domicile', n_h, 'cotes_visiteur', n_v), v_bp);
  select count(*) into n_ops1 from public.admin_operations;
  if n_del <> n_attendu or n_ops1 - n_ops0 <> 1 then
    raise exception 'NEXUS: garde échouée (supprimées %, ops +%) — rien écrit', n_del, n_ops1 - n_ops0; end if;
  raise notice 'OK rollback lot ${nn} ${sport} : % équipe(s) supprimée(s), % + % côté(s) remis à NULL', n_del, n_h, n_v;
end $$;
`;
  fs.writeFileSync(`lots/${nn}-${slug}.sql`, lotSql);
  fs.writeFileSync(`lots/${nn}-${slug}.rollback.sql`, rbSql);
  resume.push([nn, sport, n, cotes, exc.length]);
});

fs.writeFileSync('lots/lots.csv',
  'lot;sport;equipes;cotes_a_relier;exceptions_doublon\n' + resume.map(r => r.join(';')).join('\n') + '\n');
console.log(resume.map(r => r.join(' | ')).join('\n'));
console.log('TOTAL', resume.reduce((a, r) => a + r[2], 0), 'équipes,', resume.reduce((a, r) => a + r[3], 0),
  'côtés ; exceptions doublon :', [...EXCEPTIONS_DOUBLON].join(', '));
