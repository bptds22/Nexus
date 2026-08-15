// scripts/civil-football-schedule-probe3.mjs
// ============================================================================
// LeagueSuite — /api/v1/matches répond 401 sans cookie. On refait l'appel en
// visiteur ANONYME normal : on charge la page, on garde les cookies de session
// (laravel_session + XSRF-TOKEN) et on ré-émet le jeton CSRF dans l'en-tête,
// exactement ce que fait le navigateur. Aucun identifiant, aucun contournement.
// AUCUNE écriture DB. UA Nexus, délai 800 ms.
// Run:  node scripts/civil-football-schedule-probe3.mjs
// ============================================================================

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; Nexus-Research/1.0; research scrape for nexussports.ca)",
  "Accept-Language": "fr-CA,fr;q=0.9,en;q=0.5",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const jar = new Map();
function absorb(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  for (const c of raw) {
    const [pair] = c.split(";");
    const idx = pair.indexOf("=");
    if (idx > 0) jar.set(pair.slice(0, idx).trim(), pair.slice(idx + 1).trim());
  }
}
const cookieHeader = () => [...jar].map(([k, v]) => `${k}=${v}`).join("; ");

async function go(url, extra = {}) {
  const res = await fetch(url, {
    ...extra,
    headers: {
      ...HEADERS,
      ...(jar.size ? { Cookie: cookieHeader() } : {}),
      ...(jar.has("XSRF-TOKEN") ? { "X-XSRF-TOKEN": decodeURIComponent(jar.get("XSRF-TOKEN")) } : {}),
      ...(extra.headers || {}),
    },
  });
  absorb(res);
  const body = await res.text();
  return { status: res.status, ct: res.headers.get("content-type") || "", body, url };
}

const O = "https://qmfl.ca";

// 1) visite normale : on récupère la session
const page = await go(`${O}/league/qmfl/division/10/schedule`);
console.log(`page  [${page.status}] cookies: ${[...jar.keys()].join(", ") || "(aucun)"}`);

// 2) le même endpoint, avec la session en poche
for (const q of [
  `${O}/api/v1/matches?setup_division_id=10`,
  `${O}/api/v1/matches?setup_division_id=10&season_id=F26`,
  `${O}/api/v1/matches?league_id=1&season_id=F26`,
  `${O}/api/v1/matches`,
]) {
  await sleep(800);
  const r = await go(q, { headers: { Accept: "application/json" } });
  console.log(`[${r.status}] ${q}\n     ${r.body.slice(0, 300).replace(/\s+/g, " ")}`);
}
