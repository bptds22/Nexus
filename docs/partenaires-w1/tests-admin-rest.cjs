// Les appels de /admin/partenaires (W1), à l'identique (supabase-js), contre l'API LOCALE.
// JWT signés avec le secret local par défaut de la CLI Supabase — refuse toute URL non locale.
// Tout ce qui est écrit est remis à l'état initial à la fin.
// node docs/partenaires-w1/tests-admin-rest.cjs <racine du dépôt>
const root = process.argv[2];
const req = require('module').createRequire(root + '/package.json');
const { createClient } = req('@supabase/supabase-js');
const crypto = require('crypto');
const env = Object.fromEntries(require('fs').readFileSync(root + '/.env.local.docker', 'utf8').split(/\r?\n/)
  .filter(l => l.includes('=') && !l.startsWith('#')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
if (!env.NEXT_PUBLIC_SUPABASE_URL.includes('127.0.0.1')) throw new Error('pas local');
const SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long';
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (sub) => {
  const h = b64({ alg: 'HS256', typ: 'JWT' });
  const p = b64({ sub, role: 'authenticated', aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 600 });
  return `${h}.${p}.${crypto.createHmac('sha256', SECRET).update(`${h}.${p}`).digest('base64url')}`;
};
const client = (sub) => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false }, global: { headers: { Authorization: `Bearer ${jwt(sub)}` } } });
const ADMIN = 'eeeeeeee-0000-0000-0000-0000000000aa';
const P1 = '66666666-0000-0000-0000-00000000000a';
const out = (ok, t, d) => console.log(`${ok ? 'PASS' : 'FAIL'}|${t}|${d}`);
(async () => {
  const a = client(ADMIN), p = client(P1);
  const { data: mp } = await a.from('media_partners').select('id, peut_evaluer').eq('user_id', P1).single();
  const { data: foot } = await a.from('sports').select('id').eq('nom', 'Football').single();

  // Chargement de la page (admin).
  let r = await a.from('partenaire_sports_permis').select('partner_id, sport_id');
  out(!r.error, 'admin charge partenaire_sports_permis', r.error?.message ?? `${r.data.length} ligne(s)`);
  out(mp.peut_evaluer === false, 'p1 : bascule désactivée par défaut', String(mp.peut_evaluer));

  // Bascule (admin) — basculerEvaluation().
  r = await a.from('media_partners').update({ peut_evaluer: true }).eq('id', mp.id).select();
  out(!r.error && r.data?.length === 1 && r.data[0].peut_evaluer === true, 'admin active « Peut évaluer »', r.error?.message ?? `${r.data.length} ligne`);
  // Case sport (admin) — basculerSport().
  r = await a.from('partenaire_sports_permis').insert({ partner_id: mp.id, sport_id: foot.id }).select();
  out(!r.error && r.data?.length === 1, 'admin coche Football', r.error?.message ?? `${r.data.length} ligne`);

  // Le partenaire, par la même API.
  r = await p.rpc('partenaire_peut_evaluer', { p_partner_id: mp.id, p_sport_id: foot.id });
  out(r.data === true, 'p1 : partenaire_peut_evaluer(Football) par RPC', r.error?.message ?? String(r.data));
  r = await p.from('media_partners').update({ peut_evaluer: false }).eq('id', mp.id).select();
  out(!!r.error && r.error.code === '42501', 'p1 modifie peut_evaluer par REST → refusé', r.error ? `${r.error.code} ${r.error.message}` : 'ACCEPTÉ');
  r = await p.from('partenaire_sports_permis').delete().eq('partner_id', mp.id).select();
  out(!r.error && r.data.length === 0, 'p1 décoche ses sports par REST → 0 ligne', r.error?.message ?? `${r.data.length} ligne`);
  r = await p.from('partenaire_sports_permis').select('sport_id');
  out(!r.error && r.data.length === 1, 'p1 lit ses sports par REST', r.error?.message ?? `${r.data.length} ligne`);

  // Remise à l'état initial (admin) — décocher, puis désactiver.
  r = await a.from('partenaire_sports_permis').delete().eq('partner_id', mp.id).eq('sport_id', foot.id).select();
  out(!r.error && r.data.length === 1, 'admin décoche Football', r.error?.message ?? `${r.data.length} ligne`);
  r = await a.from('media_partners').update({ peut_evaluer: false }).eq('id', mp.id).select();
  out(!r.error && r.data[0].peut_evaluer === false, 'admin désactive « Peut évaluer » (état initial)', r.error?.message ?? 'ok');
})();
