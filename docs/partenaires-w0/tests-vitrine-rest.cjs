// Le carrousel d'accueil, à l'identique (chaîne supabase-js .rpc().select().eq()), contre l'API LOCALE.
// node docs/partenaires-w0/tests-vitrine-rest.cjs <racine du dépôt>
const root = process.argv[2];
const req = require('module').createRequire(root + '/package.json');
const { createClient } = req('@supabase/supabase-js');
const env = Object.fromEntries(require('fs').readFileSync(root + '/.env.local.docker', 'utf8').split(/\r?\n/)
  .filter(l => l.includes('=') && !l.startsWith('#')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
if (!env.NEXT_PUBLIC_SUPABASE_URL.includes('127.0.0.1')) throw new Error('pas local');
(async () => {
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { data, error } = await sb.rpc('partenaires_vitrine')
    .select('id, organization_name, logo_url, card_image_url, tier, category, homepage_order')
    .eq('status', 'APPROVED').eq('show_on_homepage', false);   // false : aucun partenaire local n'est à l'accueil
  const ok = !error && Array.isArray(data) && data.length >= 1 && !('contact_email' in data[0]);
  console.log(`${ok ? 'PASS' : 'FAIL'}|REST anon : chaîne du carrousel sur partenaires_vitrine|${error ? error.message : data.length + ' ligne(s), clés : ' + Object.keys(data[0] ?? {}).join(',')}`);
  const r2 = await sb.rpc('partenaires_vitrine').select('contact_email');
  console.log(`${r2.error ? 'PASS' : 'FAIL'}|REST anon : contact_email demandé à la vitrine|${r2.error ? r2.error.message : 'rendu'}`);
})();
