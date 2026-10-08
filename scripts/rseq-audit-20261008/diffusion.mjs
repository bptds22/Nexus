// Phase C : GetLeagueDiffusion pour les ligues retenues (lecture seule, cache par URL).
import fs from 'fs'; import crypto from 'crypto'; import {get,appels} from './lib.mjs';
const G=JSON.parse(fs.readFileSync('grille.json','utf8'));
const h8=id=>crypto.createHash('md5').update(id).digest('hex').slice(0,8);
const db25=new Set(fs.readFileSync('db-2025.txt','utf8').trim().split(/\s+/).map(x=>x.split(':')[0]));
const garde=(e)=>{const L=e.L; if(L.Sector==='Primaire') return false;
  if(e.annee==='2026 - 2027') return true;
  return ['Football','Flag football'].includes(L.SportName) || e.couples.some(c=>c.region===11) || [4,5].includes(L.Sport) || !db25.has(h8(L.LeagueId));};
const cibles=Object.values(G.ligues).filter(garde);
console.log('ligues a lire', cibles.length);
const t0=Date.now(); const res={};
for(const [i,e] of cibles.entries()){
  const host=e.couples.some(c=>c.host==='diffusion')?'https://diffusion.s1.rseq.ca/':'https://s1.rseq.ca/';
  const x=await get(host+'api/LeagueApi/GetLeagueDiffusion/?leagueId='+e.L.LeagueId);
  const j=x.j||{}; const n=k=>Array.isArray(j[k])?j[k].length:0;
  res[e.L.LeagueId]={s:x.s,host,reg:n('RegularSeasonGames'),post:n('PostSeasonGames'),pre:n('PreSeasonGames'),champ:n('ChampionshipGames'),teams:n('Teams'),
    equipes:(j.Teams||[]).map(t=>({id:t.TeamId,nom:t.TeamName,code:t.TeamCode,inst:t.InstitutionId})),
    participants:[...(j.RegularSeasonGames||[]),...(j.PostSeasonGames||[])].flatMap(g=>[[g.HomeTeamId,g.HomeTeamName],[g.VisitingTeamId,g.VisitingTeamName]])};
  if(i%50===0) console.log(i,'/',cibles.length,appels,'appels',Math.round((Date.now()-t0)/1000),'s');
}
fs.writeFileSync('diffusion.json',JSON.stringify(res));
console.log('FINI',Object.keys(res).length,appels,'appels',Math.round((Date.now()-t0)/1000),'s');
