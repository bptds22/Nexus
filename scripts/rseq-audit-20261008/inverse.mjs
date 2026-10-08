import fs from 'fs'; import crypto from 'crypto';
const md5=s=>crypto.createHash('md5').update(s).digest('hex');
const v=JSON.parse(fs.readFileSync('veille-raw.json'))[0];
const base=v.jeux.split(' ').map(x=>{const [g,l,t]=x.split(':');return {g,l,t}});
const D=JSON.parse(fs.readFileSync('diffusion.json')); const G=JSON.parse(fs.readFileSync('grille.json'));
const servi=new Map(); const ligueNom=new Map(); const instParLigue={};
for(const [id,d] of Object.entries(D)){ const e=G.ligues[id]; if(e.annee!=='2026 - 2027') continue;
  ligueNom.set(md5(id).slice(0,8), `${e.L.Sector} | ${e.L.Region} | ${e.L.LeagueName}`);
  const c=JSON.parse(fs.readFileSync('cache/'+md5(d.host+'api/LeagueApi/GetLeagueDiffusion/?leagueId='+id)+'.json')).j||{};
  for(const g of [...(c.RegularSeasonGames||[]),...(c.PostSeasonGames||[])]) if(g.GameId) (servi.get(md5(g.GameId).slice(0,10))??servi.set(md5(g.GameId).slice(0,10),new Set()).get(md5(g.GameId).slice(0,10))).add(md5(id).slice(0,8));
}
let pareil=0, autre=0, nulle=0; const parL={};
for(const b of base){ const s=servi.get(b.g); if(!s){nulle++; parL[b.l]=(parL[b.l]||0)+1;} else if(s.has(b.l)) pareil++; else autre++; }
console.log('matchs 2026 en base',base.length,'servis par leur ligue',pareil,'servis seulement par une autre ligue',autre,'servis par AUCUNE ligue RSEQ',nulle);
console.log(Object.entries(parL).sort((a,b)=>b[1]-a[1]).slice(0,15).map(([l,n])=>`${n} ${ligueNom.get(l)??'(ligue '+l+' non lue / hors grille)'}`).join('\n'));
