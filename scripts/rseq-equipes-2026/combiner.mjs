// combiner.mjs — pour chaque lot 02..09 : run/NN-<sport>.run.sql = BEGIN + fichier de lot TEL QUEL + contrôle de
// signature de contenu des équipes créées (contre celle calculée depuis le fichier) + COMMIT.
// Un écart de signature lève une exception : la transaction entière est annulée (lot compris).
// Usage : node combiner.mjs [--fausser]   (--fausser : signature volontairement fausse, pour la preuve locale)
import fs from 'fs'; import crypto from 'crypto';
const md5 = s => crypto.createHash('md5').update(s, 'utf8').digest('hex');
const fausser = process.argv.includes('--fausser');
fs.mkdirSync('run', { recursive: true });
const out = [];
for (const f of fs.readdirSync('lots').filter(f => /^0[2-9]-[a-z-]+\.sql$/.test(f)).sort()) {
  const lot = fs.readFileSync('lots/' + f, 'utf8');
  const slug = f.replace(/\.sql$/, '');
  const rows = [...lot.matchAll(/^\s+\(('[^\n]*)\)[,;]$/gm)].map(m =>
    [...m[1].matchAll(/'((?:[^']|'')*)'(?:::uuid)?|null/g)].map(x => (x[0] === 'null' ? '' : x[1].replace(/''/g, "'"))));
  rows.sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const n = rows.length;
  const sig = fausser ? '00000000000000000000000000000000' : md5(rows.map(r => r.join('|')).join(';'));
  const controle = `
-- CONTRÔLE DE SIGNATURE (ajouté autour du lot, même transaction) : les équipes créées par ce lot doivent
-- reproduire exactement le contenu du fichier ${f} (md5 du fichier ${md5(lot)}).
do $ctl$
declare n int; s text;
begin
  select count(*), md5(string_agg(t.rseq_team_id || '|' || t.school_id || '|' || t.sport_id || '|' || t.name || '|'
           || coalesce(t.age_group, '') || '|' || coalesce(t.division, '') || '|' || coalesce(t.gender, ''), ';' order by t.rseq_team_id))
    into n, s
    from public.teams t
    join (select distinct (jsonb_array_elements_text(details -> 'rseq_team_ids'))::uuid r
            from public.admin_operations
           where operation = 'EQUIPES_RSEQ_2026_CREEES' and details ->> 'lot' = '${slug}') a on a.r = t.rseq_team_id
   where t.season = '2026-2027';
  if n <> ${n} or s is distinct from '${sig}' then
    raise exception 'NEXUS: signature de contenu du lot ${slug} : % équipe(s), signature %, attendu ${n} / ${sig} — transaction annulée', n, s;
  end if;
end $ctl$;
`;
  fs.writeFileSync(`run/${slug}.run.sql`, 'begin;\n' + lot + controle + 'commit;\n');
  out.push(`${f} | md5 fichier ${md5(lot)} | ${n} équipes | signature ${sig}`);
}
console.log(out.join('\n'));
