const path = process.argv[2];
const { createRequire } = require('module');
const req = createRequire(path + '/package.json');
const { createClient } = req('@supabase/supabase-js');
const fs = require('fs');
const env = Object.fromEntries(fs.readFileSync(path + '/.env.local.docker', 'utf8').split(/\r?\n/).filter(l => l.includes('=') && !l.startsWith('#')).map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));
const URL = env.NEXT_PUBLIC_SUPABASE_URL, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY, SR = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL.includes('127.0.0.1')) throw new Error('pas local : ' + URL);
const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const appareil = () => createClient(URL, ANON, opts);
const EMAIL = 'w0.sessions@preuve.local', PWD = 'W0-sessions-' + Date.now();
(async () => {
  const admin = createClient(URL, SR, opts);
  const { data: cu, error: ce } = await admin.auth.admin.createUser({ email: EMAIL, password: PWD, email_confirm: true });
  if (ce) throw ce;
  const res = [];
  try {
    const A = appareil(), B = appareil();
    await A.auth.signInWithPassword({ email: EMAIL, password: PWD });
    await B.auth.signInWithPassword({ email: EMAIL, password: PWD });
    const { error: eo } = await A.auth.signOut({ scope: 'local' });       // = lib/auth/deconnexion.ts
    const { data: rb, error: eb } = await B.auth.refreshSession();
    res.push(['S1 signOut local sur A → B rafraîchit sa session', !eo && !eb && !!rb.session, eb?.message ?? 'ok']);
    const { data: ub, error: eu } = await B.auth.getUser();
    res.push(['S1 B est toujours authentifié (getUser)', !eu && ub.user?.email === EMAIL, eu?.message ?? 'ok']);
    // Témoin : l'ancien comportement (signOut() sans argument = global) tue B.
    const C = appareil();
    await C.auth.signInWithPassword({ email: EMAIL, password: PWD });
    await C.auth.signOut();
    const { error: eb2 } = await B.auth.refreshSession();
    res.push(['S2 témoin : signOut() par défaut sur C → B ne peut plus rafraîchir', !!eb2, eb2?.message ?? 'refresh accepté']);
  } finally {
    const { error: de } = await admin.auth.admin.deleteUser(cu.user.id);
    res.push(['nettoyage : compte jetable supprimé', !de, de?.message ?? 'ok']);
  }
  for (const [t, ok, d] of res) console.log(`${ok ? 'PASS' : 'FAIL'}|${t}|${d}`);
})().catch(e => { console.error('ERREUR', e); process.exit(1); });
