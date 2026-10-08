import fs from 'fs'; import crypto from 'crypto';
const md5=s=>crypto.createHash('md5').update(s).digest('hex');
const v=JSON.parse(fs.readFileSync('veille-raw.json'))[0];
const jeux=new Map(v.jeux.split(' ').map(x=>{const [g,l,t]=x.split(':');return [g,{l,t}]}));
const pub=new Set(v.publiees.split(' ')), app=new Set(v.a_appeler.split(' '));
const G=JSON.parse(fs.readFileSync('grille.json')); const D=JSON.parse(fs.readFileSync('diffusion.json'));
const cat=JSON.parse(fs.readFileSync('catalogue.json'));
const res=[];
for(const r of cat.filter(r=>r.annee==='2026 - 2027'&&r.secteur!=='Primaire'&&+r.rseq_matchs>0)){
  const d=D[r.id]; const u=d.host+'api/LeagueApi/GetLeagueDiffusion/?leagueId='+r.id;
  const c=JSON.parse(fs.readFileSync('cache/'+md5(u)+'.json')).j;
  const gs=[...(c.RegularSeasonGames||[]),...(c.PostSeasonGames||[])].map(g=>g.GameId).filter(Boolean);
  const h=md5(r.id).slice(0,8);
  let enBase=0, autreLigue=0, lies=0; for(const g of gs){const x=jeux.get(md5(g).slice(0,10)); if(x){enBase++; if(x.l!==h) autreLigue++; if(x.t==='11') lies++;}}
  res.push({...r, n:gs.length, enBase, autreLigue, manquants:gs.length-enBase, publiee:pub.has(h), a_appeler:app.has(h)});
}
fs.writeFileSync('jeux-par-ligue.json',JSON.stringify(res));
const S=(f)=>res.filter(f).reduce((a,r)=>({l:a.l+1,m:a.m+r.manquants,n:a.n+r.n}),{l:0,m:0,n:0});
console.log('ligues 2026 avec matchs (hors primaire):',res.length,'matchs RSEQ',res.reduce((a,r)=>a+r.n,0),'dont absents de la base',res.reduce((a,r)=>a+r.manquants,0));
for(const sec of ['Secondaire','Collégial','Universitaire','Primaire et secondaire']) console.log(sec, JSON.stringify(S(r=>r.secteur===sec)), 'avec manquants:', JSON.stringify(S(r=>r.secteur===sec&&r.manquants>0)));
console.log('\nLigues avec matchs manquants (Secondaire/Collégial) :');
for(const r of res.filter(r=>r.manquants>0&&r.secteur!=='Universitaire').sort((a,b)=>b.manquants-a.manquants)) console.log([r.secteur,r.region,r.sport,r.ligue,'rseq '+r.n,'en base '+r.enBase+(r.autreLigue?` (dont ${r.autreLigue} sous une autre ligue)`:''),'manquants '+r.manquants,'catalogue '+(r.publiee?'oui':'non'),'à appeler '+(r.a_appeler?'oui':'non'),r.hosts,'menu '+r.menu].join(' | '));
console.log('\nLigues « absentes » dont tous les matchs sont en base sous une autre ligue :', res.filter(r=>+r.base_matchs===0&&r.manquants===0).length);
