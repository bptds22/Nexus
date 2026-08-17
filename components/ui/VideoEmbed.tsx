"use client";

import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";

interface VideoEmbedProps {
  url: string;
  title?: string;
}

/** ID YouTube depuis une URL watch?v= ou youtu.be/… (null si pas YouTube).
 *  EXPORTÉ : les cartes du carrousel campus (web ET mobile) ont leur propre
 *  habillage mais doivent partager CETTE décision-ci, pas la rejouer. */
export function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
      return u.searchParams.get("v");
    }
    if (u.hostname === "youtu.be") {
      return u.pathname.replace(/^\//, "") || null;
    }
  } catch {
    return null;
  }
  return null;
}

/** URL d'intégration Hudl, dérivée d'un lien de partage (null si impossible).
 *
 *  Hudl sert TROIS formes, et une seule est intégrable :
 *
 *    /v/2U3ZFM                        lien court de partage  → non dérivable
 *    /video/3/26518191/6a64ce78…      page vidéo             → X-Frame-Options: Deny
 *    /embed/video/3/26518191/6a64…    intégration officielle → aucun XFO, frame-ancestors *
 *
 *  Hudl déclare lui-même la troisième dans ses balises `twitter:player` et
 *  `embedUrl` : c'est un point d'entrée assumé, pas un contournement.
 *
 *  ⚠ L'ancienne version rendait l'URL de la PAGE VIDÉO telle quelle comme
 *  source d'iframe. Cette page porte `X-Frame-Options: Deny` — le cadre
 *  restait donc vide, en silence. Il manquait `/embed` dans le chemin.
 *
 *  Le lien COURT n'est pas dérivable ici : `2U3ZFM` ne contient ni
 *  l'identifiant utilisateur ni celui de la vidéo, seul Hudl connaît la
 *  correspondance. Il faut suivre la redirection, ce que le navigateur ne
 *  peut pas faire (CORS). C'est le rôle de /api/video/resolve, appelé À LA
 *  SAISIE pour stocker directement la forme longue. */
export function getHudlEmbedUrl(url: string): string | null {
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

/** EXPORTÉ — voir getYouTubeId. Porte l'atténuation nocookie + origin. */
export function getEmbedUrl(url: string): string | null {
  const ytId = getYouTubeId(url);
  // Dégradé (option a) : ?origin déclaré pour le player web (inoffensif, aide
  // la validation d'origin côté YouTube). La garantie device reste l'option (c).
  if (ytId) return `https://www.youtube-nocookie.com/embed/${ytId}?origin=https://nexussports.ca`;
  return getHudlEmbedUrl(url);
}

/** Ouvre l'URL dans le navigateur in-app (SFSafariViewController sur iOS) —
    contexte Safari réel avec origin https → YouTube joue (corrige Error 153
    sous capacitor://localhost). Fallback web : nouvel onglet. */
export async function openVideoExternal(url: string) {
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

export default function VideoEmbed({ url, title }: VideoEmbedProps) {
  // Décidé après mount → pas de mismatch d'hydratation (le prerender = web).
  const [isNative, setIsNative] = useState(false);
  const [thumbErr, setThumbErr] = useState(false);
  useEffect(() => { setIsNative(Capacitor.isNativePlatform()); }, []);

  const ytId = getYouTubeId(url);
  const embedUrl = getEmbedUrl(url);

  // ── DEVICE + YouTube : vignette cliquable → Browser.open (option c) ──────
  // L'iframe YouTube échoue sous capacitor://localhost (origin non reconnu).
  if (isNative && ytId) {
    return (
      <button
        type="button"
        onClick={() => openVideoExternal(url)}
        aria-label={title || "Lire la vidéo sur YouTube"}
        className="relative block w-full rounded-lg overflow-hidden bg-black"
        style={{ paddingBottom: "56.25%" }}
      >
        {!thumbErr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`https://img.youtube.com/vi/${ytId}/hqdefault.jpg`}
            alt={title || "Aperçu de la vidéo"}
            onError={() => setThumbErr(true)}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-[#111317]" />
        )}

        {/* Voile + bouton play centré */}
        <div className="absolute inset-0 flex items-center justify-center bg-black/25">
          <span className="w-16 h-16 rounded-full bg-black/60 backdrop-blur-sm flex items-center justify-center">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="#E63946" stroke="none">
              <polygon points="8 5 19 12 8 19 8 5" />
            </svg>
          </span>
        </div>

        {/* Titre en bas */}
        {title && (
          <div className="absolute bottom-0 inset-x-0 px-3 py-2 bg-gradient-to-t from-black/80 to-transparent">
            <p className="text-[13px] font-bold text-white truncate text-left">{title}</p>
          </div>
        )}
      </button>
    );
  }

  // ── IFRAME EN LIGNE ──────────────────────────────────────────────────────
  // Toute URL d'intégration résolue passe ici, plus seulement YouTube.
  //
  // Le cas YouTube + natif a déjà rendu la vignette plus haut (son iframe est
  // refusée sous une origine non-http). Hudl, lui, annonce `frame-ancestors: *`
  // et se moque de l'origine : il s'affiche donc en ligne SUR TOUTES LES
  // PLATEFORMES, y compris dans l'application. À confirmer sur un vrai
  // appareil — l'en-tête est permissif, mais je ne l'ai pas vu tourner en
  // WKWebView.
  if (embedUrl) {
    return (
      <div className="relative w-full rounded-lg overflow-hidden bg-black" style={{ paddingBottom: "56.25%" }}>
        <iframe
          src={embedUrl}
          title={title || "Video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 w-full h-full"
        />
      </div>
    );
  }

  // Fallback: external link button (Hudl, ou URL non reconnue)
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 bg-[#111317] border border-[#2D3748] rounded-lg px-5 py-4 hover:border-[#E63946]/40 transition-colors group"
    >
      <div className="w-10 h-10 rounded-full bg-[#E63946]/10 flex items-center justify-center flex-shrink-0 group-hover:bg-[#E63946]/20 transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#E63946" stroke="none"><polygon points="8 5 19 12 8 19 8 5" /></svg>
      </div>
      <div>
        <p className="text-[13px] font-bold text-white">{title || "Voir la vidéo"}</p>
        <p className="text-[11px] text-[#6b7280] truncate max-w-[300px]">{url}</p>
      </div>
      <svg className="ml-auto text-[#6b7280]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
    </a>
  );
}
