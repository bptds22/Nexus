// apercu-hudl : l'aperçu d'un lien Hudl sur une fiche (recette 1.4.4).
//
// Appelé depuis le web ET l'app via supabase.functions.invoke("apercu-hudl"),
// sous le JWT de l'utilisateur connecté (verify_jwt par défaut).
//
// POURQUOI CÔTÉ SERVEUR — trois choses que la WebView ne peut pas faire (CORS) :
//   · suivre la redirection d'un lien court (`/v/2QYfwB` → `/video/3/…/…`) ;
//   · savoir si la vidéo EXISTE encore : l'intégration `/embed/video/…` d'une
//     vidéo supprimée rend 200, avec « Sorry, we couldn't find that video ».
//     Seule la présence de `og:video` dans la page distingue les deux ;
//   · lire la vignette (`og:image`) — d'une vidéo comme d'un profil.
//
// RÈGLE DU CLIENT : un lecteur n'est rendu QUE sur `genre: "video"`, qui
// n'existe que si `og:video` a été vu. Tout le reste — profil, lien inconnu,
// vidéo introuvable, Hudl muet — devient une carte « Voir sur Hudl ».
// Jamais un lecteur vide.
//
// Relevé prod 2026-10-05 (72 liens Hudl) : 52 profils, 15 liens courts /v/,
// 4 pages /video/3/…, 1 /library/ (autre).
//
// ⚠ SSRF : la fonction fait une requête sortante vers une URL fournie par
// l'utilisateur. Seul https://*.hudl.com est contacté, et chaque redirection
// est suivie À LA MAIN pour la revérifier. Tout le reste rend `autre` sans
// aucun appel réseau.

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Apercu =
  | { genre: "video"; embedUrl: string; vignette: string | null; titre: string | null }
  | { genre: "profil"; vignette: string | null; titre: string | null }
  | { genre: "introuvable" }
  | { genre: "autre" };

const json = (body: unknown, status = 200, cache = 0): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...CORS,
      "Content-Type": "application/json",
      ...(cache > 0 ? { "Cache-Control": `private, max-age=${cache}` } : {}),
    },
  });

const TIMEOUT_MS = 6000;
// Hudl sert la même page à un navigateur mobile ; sans agent, certaines
// réponses sont plus pauvres.
const UA = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36";

function estHudl(u: URL): boolean {
  const h = u.hostname.toLowerCase();
  return u.protocol === "https:" && (h === "hudl.com" || h.endsWith(".hudl.com"));
}

async function chercher(url: string): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { redirect: "manual", signal: ctrl.signal, headers: { "User-Agent": UA } });
  } finally {
    clearTimeout(t);
  }
}

/** Suit au plus 3 redirections, chacune REVÉRIFIÉE sur hudl.com (un
 *  `redirect: "follow"` irait n'importe où). Relevé 2026-10-05 : `/v/…` → 302
 *  vers `/video/…` ; `/profile/ID` → 302 vers `/profile/ID/Nom` ; `hudl.com`
 *  → 301 vers `www.hudl.com` ; `/library/…` → 302 vers `/login`. */
async function suivre(depart: URL): Promise<{ r: Response; url: URL } | null> {
  let url = depart;
  for (let i = 0; i < 4; i++) {
    const r = await chercher(url.toString());
    if (r.status < 300 || r.status >= 400) return { r, url };
    const loc = r.headers.get("location");
    await r.body?.cancel();
    if (!loc) return null;
    const suivante = new URL(loc, url);
    if (!estHudl(suivante)) return null;
    url = suivante;
  }
  return null;
}

/** Valeur d'une balise `<meta property="og:…" content="…">`, entités HTML
 *  courantes décodées. */
function meta(html: string, prop: string): string | null {
  const re = new RegExp(`<meta[^>]+property=["']${prop.replace(/:/g, "\\:")}["'][^>]*content=["']([^"']*)["']`, "i");
  const v = html.match(re)?.[1]?.trim();
  if (!v) return null;
  // Hudl encode les accents en entités numériques : « C&#xF4;t&#xE9; ».
  return v
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

/** Une vignette n'est rendue que si elle vient de Hudl. */
function vignetteSure(v: string | null): string | null {
  if (!v) return null;
  try { return estHudl(new URL(v)) ? v : null; } catch { return null; }
}

const VIDEO = /^\/(?:embed\/)?video\/(\d+)\/(\d+)\/([0-9a-f]+)\/?$/i;
const PROFIL = /^\/profile\/(\d+)(?:\/|$)/i;

async function apercuVideo(t: string, a: string, v: string): Promise<Apercu> {
  const embedUrl = `https://www.hudl.com/embed/video/${t}/${a}/${v}`;
  const fin = await suivre(new URL(embedUrl));
  if (!fin || !fin.r.ok) return { genre: "introuvable" };
  const html = await fin.r.text();
  // Le SEUL signal d'existence : la page d'une vidéo supprimée n'a aucune
  // balise og (relevé 2026-10-05).
  if (!meta(html, "og:video") && !meta(html, "og:video:secure_url")) return { genre: "introuvable" };
  return {
    genre: "video",
    embedUrl,
    vignette: vignetteSure(meta(html, "og:image")),
    titre: meta(html, "og:title"),
  };
}

function lireProfil(html: string): Apercu {
  // « Alexis Abran on Hudl » → « Alexis Abran ».
  const titre = meta(html, "og:title")?.replace(/\s+on Hudl$/i, "") ?? null;
  return { genre: "profil", vignette: vignetteSure(meta(html, "og:image")), titre };
}

async function apercu(brute: string): Promise<Apercu> {
  let u: URL;
  try { u = new URL(brute.trim()); } catch { return { genre: "autre" }; }
  if (u.protocol === "http:") u.protocol = "https:";
  if (!estHudl(u)) return { genre: "autre" };

  // Vidéo sous forme longue : l'URL d'intégration se dérive sans réseau.
  const directe = u.pathname.match(VIDEO);
  if (directe) return apercuVideo(directe[1], directe[2], directe[3]);

  // Tout le reste (lien court, profil, autre) : on suit, puis on classe
  // l'URL d'ARRIVÉE.
  const fin = await suivre(u);
  if (!fin) return { genre: "introuvable" };
  const v = fin.url.pathname.match(VIDEO);
  if (v) { await fin.r.body?.cancel(); return apercuVideo(v[1], v[2], v[3]); }
  if (PROFIL.test(fin.url.pathname)) {
    if (!fin.r.ok) { await fin.r.body?.cancel(); return { genre: "profil", vignette: null, titre: null }; }
    return lireProfil(await fin.r.text());
  }
  await fin.r.body?.cancel();
  return { genre: "autre" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let url = "";
  try { url = String((await req.json())?.url ?? ""); } catch { return json({ error: "Bad JSON" }, 400); }
  if (!url || url.length > 2000) return json({ error: "url requise" }, 400);

  try {
    // Une heure de cache navigateur : une fiche rouverte ne refait pas l'appel.
    return json(await apercu(url), 200, 3600);
  } catch {
    // Hudl muet ou délai dépassé : le client montre la carte, pas un lecteur.
    return json({ genre: "introuvable" }, 200);
  }
});
