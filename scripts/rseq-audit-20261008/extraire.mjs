// extraire.mjs <fichier tool-result> <sortie.json> : rend le tableau de lignes d'un résultat execute_sql sauvegardé.
import fs from 'fs';
const [,,src,out]=process.argv; const o=JSON.parse(fs.readFileSync(src,'utf8'));
const r=o.result; const a=r.indexOf('\n[')+1; const b=r.lastIndexOf(']\n')+1;
fs.writeFileSync(out, r.slice(a,b)); console.log(out, JSON.parse(r.slice(a,b)).length,'ligne(s)');
