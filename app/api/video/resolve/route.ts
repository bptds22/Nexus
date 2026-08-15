import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/* ═══════════════════════════════════════════════════════════════
   POST /api/video/resolve

   Résout une URL de vidéo collée par un athlète ou un entraîneur,
   AU MOMENT DE LA SAISIE, et dit si elle pourra réellement se lire
   sur une fiche.

   Pourquoi côté serveur — deux choses que le navigateur ne peut
   pas faire :
     · suivre la redirection d'un lien court Hudl (`/v/2U3ZFM` →
       `/video/3/26518191/6a64…`) : CORS l'interdit ;
     · interroger l'oEmbed de YouTube, qui répond 401 quand le
       propriétaire a décoché « Autoriser l'intégration ».

   Le but est d'attraper le cas AVANT qu'il n'atterrisse sur une
   fiche vue par un recruteur. Un athlète colle souvent le lien
   d'une vidéo qu'il ne possède pas — faits saillants montés par le
   coach, chaîne d'un tiers — et n'a alors aucun moyen de corriger
   le réglage. Autant le lui dire tout de suite.

   Corps :
     { url: string }

   Réponse :
     { provider: "youtube" | "hudl" | "autre",
       embedUrl: string | null,   // à stocker, prêt pour l'iframe
       playable: boolean,         // false = ne se lira jamais en ligne
       reason:  string | null }   // message affichable à l'utilisateur

   Erreurs : 400 corps invalide · 401 non authentifié

   ⚠ ALLOWLIST D'HÔTES — cette route fait une requête sortante vers
   une URL fournie par l'utilisateur : c'est un SSRF si on la laisse
   ouverte. Seuls youtube.com / youtu.be / hudl.com sont contactés ;
   tout le reste rend `provider: "autre"` SANS aucun appel réseau.
═══════════════════════════════════════════════════════════════ */

interface ResolveBody {
  url?: string;
}

type Provider = "youtube" | "hudl" | "autre";

type ResolveResult = {
  provider: Provider;
  embedUrl: string | null;
  playable: boolean;
  reason: string | null;
};

/** Délai court : la saisie est interactive, on ne fait pas patienter. */
const TIMEOUT_MS = 6000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

function hostOf(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

function youtubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
      return u.searchParams.get("v");
    }
    if (u.hostname === "youtu.be") return u.pathname.replace(/^\//, "") || null;
  } catch {
    return null;
  }
  return null;
}

/* ── YouTube ────────────────────────────────────────────────────
   L'oEmbed est le seul point qui distingue « vidéo absente » de
   « vidéo présente mais intégration refusée » :
     200 → intégrable
     401 → existe, mais le propriétaire a désactivé l'intégration
     404 → n'existe pas / supprimée / privée                      */
async function resolveYoutube(id: string): Promise<ResolveResult> {
  const embedUrl = `https://www.youtube-nocookie.com/embed/${id}?origin=https://nexussports.ca`;
  try {
    const r = await fetchWithTimeout(
      `https://www.youtube.com/oembed?url=https://youtu.be/${encodeURIComponent(id)}&format=json`,
    );
    if (r.ok) return { provider: "youtube", embedUrl, playable: true, reason: null };
    if (r.status === 401) {
      return {
        provider: "youtube",
        embedUrl,
        playable: false,
        reason:
          "Le propriétaire de cette vidéo a désactivé la lecture sur les autres sites. Elle ne pourra pas se jouer sur ta fiche — choisis-en une autre, ou demande-lui d'activer l'intégration dans YouTube Studio.",
      };
    }
    if (r.status === 404) {
      return {
        provider: "youtube",
        embedUrl: null,
        playable: false,
        reason: "Cette vidéo YouTube est introuvable, privée ou supprimée.",
      };
    }
    // Statut inattendu : on n'invente pas de verdict négatif.
    return { provider: "youtube", embedUrl, playable: true, reason: null };
  } catch {
    // Réseau indisponible : on ne bloque pas la saisie sur notre panne.
    return { provider: "youtube", embedUrl, playable: true, reason: null };
  }
}

/* ── Hudl ───────────────────────────────────────────────────────
   Forme longue → transformation de chaîne, aucun réseau.
   Forme courte → il FAUT suivre la redirection : le code court ne
   contient ni l'identifiant utilisateur ni celui de la vidéo.     */
async function resolveHudl(url: string): Promise<ResolveResult> {
  const direct = deriveHudlEmbed(url);
  if (direct) return { provider: "hudl", embedUrl: direct, playable: true, reason: null };

  try {
    const r = await fetchWithTimeout(url, { redirect: "follow" });
    if (!r.ok) {
      return {
        provider: "hudl",
        embedUrl: null,
        playable: false,
        reason: "Ce lien Hudl est inaccessible.",
      };
    }

    // 1er choix : l'URL finale après redirection (/video/…).
    const fromFinal = deriveHudlEmbed(r.url);
    if (fromFinal) return { provider: "hudl", embedUrl: fromFinal, playable: true, reason: null };

    // 2e choix : la balise `embedUrl` que Hudl publie dans la page.
    const html = await r.text();
    const m = html.match(/"embedUrl"\s*:\s*"([^"]+)"/);
    if (m && hostOf(m[1])?.endsWith("hudl.com")) {
      return { provider: "hudl", embedUrl: m[1], playable: true, reason: null };
    }

    return {
      provider: "hudl",
      embedUrl: null,
      playable: false,
      reason: "Impossible de déterminer la vidéo Hudl derrière ce lien.",
    };
  } catch {
    return {
      provider: "hudl",
      embedUrl: null,
      playable: false,
      reason: "Hudl n'a pas répondu. Réessaie dans un instant.",
    };
  }
}

/** Même dérivation que components/ui/VideoEmbed.tsx — volontairement
    dupliquée : la route est un module serveur et ne doit pas importer un
    composant client. Toute correction ici doit être reportée là-bas. */
function deriveHudlEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname !== "hudl.com" && !u.hostname.endsWith(".hudl.com")) return null;
    if (u.pathname.startsWith("/embed/video/")) return `https://www.hudl.com${u.pathname}`;
    if (u.pathname.startsWith("/video/")) return `https://www.hudl.com/embed${u.pathname}`;
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  // 1. Auth — la route sort sur le réseau, elle n'est pas ouverte à tous.
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  // 2. Corps
  let body: ResolveBody;
  try {
    body = (await req.json()) as ResolveBody;
  } catch {
    return NextResponse.json({ error: "Corps de requête invalide" }, { status: 400 });
  }
  const url = body.url?.trim();
  if (!url) {
    return NextResponse.json({ error: "Paramètre invalide : url requise" }, { status: 400 });
  }

  const host = hostOf(url);
  if (!host) {
    return NextResponse.json({ error: "URL invalide" }, { status: 400 });
  }

  // 3. Aiguillage — allowlist stricte, aucun appel hors de ces hôtes.
  const ytId = youtubeId(url);
  if (ytId) {
    return NextResponse.json(await resolveYoutube(ytId));
  }
  if (host === "hudl.com" || host.endsWith(".hudl.com")) {
    return NextResponse.json(await resolveHudl(url));
  }

  const autre: ResolveResult = {
    provider: "autre",
    embedUrl: null,
    playable: false,
    reason: null,
  };
  return NextResponse.json(autre);
}
