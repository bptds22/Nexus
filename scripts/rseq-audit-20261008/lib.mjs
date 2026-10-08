import fs from 'fs'; import crypto from 'crypto';
const UA={"User-Agent":"Mozilla/5.0 (compatible; Nexus-Veille/1.0; audit lecture seule pour nexussports.ca)","Accept-Language":"fr-CA,fr;q=0.9,en;q=0.5"};
let last=0; export let appels=0; const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export async function get(u){
  const f='cache/'+crypto.createHash('md5').update(u).digest('hex')+'.json';
  if(fs.existsSync(f)) return JSON.parse(fs.readFileSync(f,'utf8'));
  let res;
  for(let essai=1;essai<=2;essai++){
    const w=last+800-Date.now(); if(w>0) await sleep(w); last=Date.now(); appels++;
    const c=new AbortController(); const t=setTimeout(()=>c.abort(),30000);
    try{const r=await fetch(u,{headers:UA,signal:c.signal}); res={s:r.status,j:r.ok?await r.json():null};}
    catch(e){res={s:'ERR '+e.message,j:null};}
    finally{clearTimeout(t); last=Date.now();}
    if(res.s===200 || (typeof res.s==='number' && res.s<500)) break;
    await sleep(1500);
  }
  if(res.s===200 || typeof res.s==='number') fs.writeFileSync(f,JSON.stringify({u,...res}));
  return {u,...res};
}
export const HOSTS=["https://diffusion.s1.rseq.ca/","https://s1.rseq.ca/"];
export const REGIONS=["Abitibi-Témiscamingue","Cantons-de-l'Est","Côte-Nord","Est-du-Québec","GMAA","Lac-Saint-Louis","Laurentides-Lanaudière","Laval","Mauricie","Montérégie","Montréal","Outaouais","Québec-Chaudière-Appalaches","Saguenay-Lac-Saint-Jean","Provincial"];
