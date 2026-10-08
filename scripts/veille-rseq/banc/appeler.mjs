// appeler.mjs "<query string>" — appelle la fonction du banc (veille_edge) avec le secret du banc, ?wait=1.
// Module http (pas fetch) : aucun délai côté client — une passe peut durer jusqu'au fusible (330 s).
import http from 'http';
const qs = process.argv[2] ?? '';
const t0 = Date.now();
const req = http.request({ host: '127.0.0.1', port: 54397, method: 'POST', path: `/?${qs}${qs.includes('wait=') ? '' : '&wait=1'}`,
  headers: { 'x-rseq-secret': 'veille-locale-banc-2026-10-08', 'content-type': 'application/json' } }, (res) => {
  let txt = ''; res.setEncoding('utf8'); res.on('data', (d) => { txt += d; });
  res.on('end', () => {
    console.log(JSON.stringify({ qs, http: res.statusCode, mur_s: Math.round((Date.now() - t0) / 100) / 10 }));
    console.log(txt.length > 4000 ? txt.slice(0, 4000) + '…' : txt);
  });
});
req.setTimeout(0);
req.on('error', (e) => console.log(JSON.stringify({ qs, erreur: String(e), mur_s: Math.round((Date.now() - t0) / 100) / 10 })));
req.end('{}');
