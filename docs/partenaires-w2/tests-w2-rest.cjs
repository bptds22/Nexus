// W2 par l'API LOCALE, avec les appels exacts des écrans (supabase-js .rpc()).
// JWT signés avec le secret local par défaut de la CLI — refuse toute URL non locale.
// Préparation et nettoyage par service_role : la base revient à son état initial.
// node docs/partenaires-w2/tests-w2-rest.cjs <racine du dépôt>
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
const opts = { auth: { persistSession: false } };
const client = (sub) => createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { ...opts, global: { headers: { Authorization: `Bearer ${jwt(sub)}` } } });
const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, opts);
const out = (ok, t, d) => console.log(`${ok ? 'PASS' : 'FAIL'}|${t}|${d}`);
const id = async (email) => (await svc.from('users').select('id').eq('email', email).single()).data.id;

(async () => {
  const P1 = await id('p1.partenaire@preuve.local'), ADMIN = await id('admin@demo.local');
  const REC = await id('julie.lambert@exemple.test'), COACH = await id('marc.desrosiers@exemple.test');
  const ATH_USER = await id('felix.gauthier@exemple.test');
  const felix = (await svc.from('athletes').select('id, partner_visibility_opt_in, cote_globale_entraineur').eq('user_id', ATH_USER).single()).data;
  const mp1 = (await svc.from('media_partners').select('id').eq('user_id', P1).single()).data.id;
  const foot = (await svc.from('sports').select('id').eq('nom', 'Football').single()).data.id;
  const p = client(P1), a = client(ADMIN), r = client(REC), c = client(COACH), at = client(ATH_USER);

  try {
    // Avant permission : pas de bouton.
    let x = await p.rpc('partenaire_evaluation_contexte', { p_athlete_id: felix.id });
    out(!x.error && x.data[0].peut_evaluer === false, 'bouton « Évaluer » absent sans permission', JSON.stringify(x.data ?? x.error.message));

    // Préparation : admin (écran /admin/partenaires) + opt-in de Félix (service_role).
    await a.from('media_partners').update({ peut_evaluer: true }).eq('id', mp1).select();
    await a.from('partenaire_sports_permis').insert({ partner_id: mp1, sport_id: foot }).select();
    await svc.from('athletes').update({ partner_visibility_opt_in: true }).eq('id', felix.id);

    x = await p.rpc('partenaire_evaluation_contexte', { p_athlete_id: felix.id });
    out(!x.error && x.data[0].peut_evaluer === true && !!x.data[0].grille_id, 'bouton « Évaluer » présent + grille', JSON.stringify(x.data));

    // Écriture (EvaluerAthleteModal, mode simple).
    x = await p.rpc('partenaire_evaluer_athlete', { p_athlete_id: felix.id, p_cote_globale: 4, p_traits: {} });
    out(!x.error, 'partenaire enregistre 4/5 (simple)', x.error?.message ?? 'ok');
    const apres = (await svc.from('athletes').select('cote_globale_entraineur').eq('id', felix.id).single()).data;
    out(apres.cote_globale_entraineur === felix.cote_globale_entraineur, 'cote_globale_entraineur inchangée', String(apres.cote_globale_entraineur));

    // Lecture (EvaluationPartenaireSection) par chaque rôle.
    for (const [nom, cl, attendu] of [['recruteur', r, 1], ['coach', c, 1], ['athlète', at, 1], ['partenaire', p, 1]]) {
      x = await cl.rpc('evaluations_partenaires_athlete', { p_athlete_id: felix.id });
      out(!x.error && x.data.length === attendu && x.data[0].organisation === 'Média Preuve' && !('evalue_par' in x.data[0]),
        `section lue par ${nom}`, x.error?.message ?? `${x.data.length} ligne, ${x.data[0]?.organisation} ${x.data[0]?.cote_globale}`);
    }

    // Recherche (useAthleteSearch) : « 4+ étoiles ».
    x = await r.rpc('recruiter_search_athletes', { p_min_rating: 4, p_limit: null, p_sort_by: 'rating_desc' });
    const ligne = (x.data ?? []).find((l) => l.id === felix.id);
    out(!x.error && !!ligne && ligne.cote_globale === null && ligne.cote_partenaire === 4 && ligne.cote_partenaire_organisation === 'Média Preuve',
      '« 4+ étoiles » : Félix présent, libellé partenaire', x.error?.message ?? JSON.stringify(ligne && { c: ligne.cote_globale, p: ligne.cote_partenaire, o: ligne.cote_partenaire_organisation }));
  } finally {
    // Nettoyage (service_role) : retour à l'état initial.
    await svc.from('partner_evaluations').delete().eq('athlete_id', felix.id);
    await svc.from('partenaire_sports_permis').delete().eq('partner_id', mp1);
    await svc.from('media_partners').update({ peut_evaluer: false }).eq('id', mp1);
    await svc.from('athletes').update({ partner_visibility_opt_in: felix.partner_visibility_opt_in }).eq('id', felix.id);
    const reste = (await svc.from('partner_evaluations').select('id', { count: 'exact', head: true })).count;
    out(reste === 0, 'nettoyage : aucune évaluation partenaire restante', String(reste));
  }
})();
