// Banc d'essai local : relaie http://hôte:54399/rest/v1/* vers la PostgREST de nexus_copie (hôte:54398/*).
// supabase-js préfixe toujours /rest/v1 ; une PostgREST nue sert à la racine. Rien d'autre.
import http from 'http';
http.createServer((req, res) => {
  const chemin = req.url.replace(/^\/rest\/v1/, '') || '/';
  const amont = http.request({ host: '127.0.0.1', port: 54398, path: chemin, method: req.method, headers: { ...req.headers, host: '127.0.0.1:54398' } },
    (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  amont.on('error', (e) => { res.writeHead(502); res.end(String(e)); });
  req.pipe(amont);
}).listen(54399, '0.0.0.0', () => console.log('proxy nexus_copie prêt sur 54399'));
