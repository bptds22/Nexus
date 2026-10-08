import fs from 'fs'; import {get,HOSTS,REGIONS,appels} from './lib.mjs';
const t0=Date.now();
const years=(await get(HOSTS[0]+"api/SchoolYearApi/GetSchoolYearList")).j;
// A. Menus : GetRegionSports, toutes années × régions (diffusion ; s1 répond 404)
const menu={}; const union={};
for(const y of years) for(let r=0;r<=14;r++){
  const x=await get(`${HOSTS[0]}api/HomeApi/GetRegionSports/?schoolYearId=${y.SchoolYearId}&region=${r}`);
  const sp=(x.j&&x.j.Sports)||{}; menu[`${y.SchoolYear}|${r}`]=Object.keys(sp).map(Number);
  for(const [c,n] of Object.entries(sp)) union[c]=n||union[c]||'';
}
console.log('A fini', Object.keys(union).length,'codes', Math.round((Date.now()-t0)/1000),'s');
const codes=[...new Set([...Object.keys(union).map(Number), ...Array.from({length:61},(_,i)=>i)])].sort((a,b)=>a-b);
// B. Grille complète GetLeagueList
const cibles=years.filter(y=>/^(2026 - 2027|2025 - 2026)$/.test(y.SchoolYear));
const ligues={}; const echecs=[];
for(const y of cibles) for(const h of HOSTS) for(let r=0;r<=14;r++){ for(const c of codes){
  const x=await get(`${h}api/LeagueApi/GetLeagueList/?schoolYearId=${y.SchoolYearId}&region=${r}&sport=${c}`);
  if(x.s!==200){ echecs.push([y.SchoolYear,h,r,c,x.s]); continue; }
  for(const L of (Array.isArray(x.j)?x.j:[])){
    const k=L.LeagueId; if(!k) continue;
    const e=ligues[k]??={L,annee:y.SchoolYear,couples:[]};
    e.couples.push({host:h.includes('diffusion')?'diffusion':'s1',region:r,sport:c,menu:(menu[`${y.SchoolYear}|${r}`]||[]).includes(c)});
  }}
  console.log(y.SchoolYear,h,r,'ligues',Object.keys(ligues).length,'appels',appels,Math.round((Date.now()-t0)/1000),'s');
}
fs.writeFileSync('grille.json',JSON.stringify({years,menu,union,codes,ligues,echecs},null,0));
console.log('FINI', Object.keys(ligues).length,'ligues', echecs.length,'echecs', appels,'appels', Math.round((Date.now()-t0)/1000),'s');
