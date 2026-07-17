"use client";

// components/team-page/TerrainStage.tsx
// Scène terrain : photo (asset PLACEHOLDER) inclinée via perspective+rotateX sur
// le DÉCOR seulement (.scene). Plaques 2D plates (.tk) par-dessus — jamais de
// texte transformé. Variante .flat (photo en perspective naturelle, ex. flag) =
// pas de bascule. Sans boîte : .fade fond dans le panneau. Bascule STATIQUE (R2).
//
// Sports sans photo dans la spec (basketball / soccer / volleyball) : terrain
// DESSINÉ (CourtSvg) — surface éclairée + lignes réglementaires, lisible sous
// l'overlay. Aucune photo inventée, aucun asset manquant (§D).

import * as React from "react";
import type { Plaque, SportConfig, TeamData } from "./content";

export default function TerrainStage({
  asset,
  perspective,
  court,
  sportKey,
  plaques,
}: {
  asset: string | null;
  perspective: boolean;
  court?: SportConfig["court"];
  sportKey?: TeamData["sportKey"]; // classe img par sport (normalisation luminance/cadrage)
  plaques: Plaque[];
}) {
  // Photo absente / 404 → on retombe sur le terrain dessiné (jamais d'image cassée).
  const [imgError, setImgError] = React.useState(false);
  const usePhoto = !!asset && !imgError;
  return (
    <div className="stage">
      <div className={perspective ? "scene" : "scene flat"}>
        <div className="imgwrap">
          {usePhoto ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={sportKey} src={asset!} alt="" onError={() => setImgError(true)} />
          ) : court ? (
            <CourtSvg court={court} />
          ) : (
            <div className="ph" /> // dernier recours (aucun asset, aucun court)
          )}
          <div className="tint" />
        </div>
      </div>
      <div className="fade" />
      <div className="glow" />
      <div className="tokens">
        {plaques.map((p, i) => (
          <div key={i} className={`tk ${p.level}`} style={{ left: `${p.left}%`, top: `${p.top}%` }}>
            <div className="pl">
              <div className="po">{p.label}</div>
              <div className="pn">{p.levelLabel}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Terrains dessinés (aucune photo dans la spec) ─────────────────────────────
 * viewBox 320×180 (16/9). Surface éclairée + lignes blanches translucides. */
function CourtSvg({ court }: { court: NonNullable<SportConfig["court"]> }) {
  if (court === "soccer") {
    return (
      <svg className="court" viewBox="0 0 320 180" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="pitch" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3f8a4a" /><stop offset="1" stopColor="#2f6d3a" />
          </linearGradient>
        </defs>
        <rect width="320" height="180" fill="url(#pitch)" />
        {/* bandes de tonte */}
        {[0, 40, 80, 120, 160, 200, 240, 280].map((x) => (
          <rect key={x} x={x} width="20" height="180" fill="#ffffff" opacity="0.03" />
        ))}
        <g fill="none" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1.6">
          <rect x="10" y="10" width="300" height="160" />
          <line x1="160" y1="10" x2="160" y2="170" />
          <circle cx="160" cy="90" r="28" />
          <circle cx="160" cy="90" r="1.6" fill="#fff" />
          {/* surfaces de réparation */}
          <rect x="10" y="52" width="42" height="76" />
          <rect x="10" y="72" width="16" height="36" />
          <rect x="268" y="52" width="42" height="76" />
          <rect x="294" y="72" width="16" height="36" />
        </g>
      </svg>
    );
  }
  if (court === "volleyball") {
    return (
      <svg className="court" viewBox="0 0 320 180" preserveAspectRatio="none" aria-hidden>
        <rect width="320" height="180" fill="#b7643a" />
        <rect x="46" y="18" width="228" height="144" fill="#c47245" />
        <g fill="none" stroke="#ffffff" strokeOpacity="0.72" strokeWidth="1.6">
          <rect x="46" y="18" width="228" height="144" />
          {/* lignes d'attaque (3 m) de part et d'autre du filet */}
          <line x1="122" y1="18" x2="122" y2="162" />
          <line x1="198" y1="18" x2="198" y2="162" />
        </g>
        {/* filet central */}
        <line x1="160" y1="14" x2="160" y2="166" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="3" strokeDasharray="3 3" />
      </svg>
    );
  }
  // basketball
  return (
    <svg className="court" viewBox="0 0 320 180" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="wood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#c48a4e" /><stop offset="1" stopColor="#a5713c" />
        </linearGradient>
      </defs>
      <rect width="320" height="180" fill="url(#wood)" />
      <g fill="none" stroke="#ffffff" strokeOpacity="0.72" strokeWidth="1.6">
        <rect x="10" y="10" width="300" height="160" />
        <line x1="160" y1="10" x2="160" y2="170" />
        <circle cx="160" cy="90" r="22" />
        {/* raquettes + cercles lancer franc */}
        <rect x="10" y="60" width="54" height="60" />
        <circle cx="64" cy="90" r="18" />
        <rect x="256" y="60" width="54" height="60" />
        <circle cx="256" cy="90" r="18" />
        {/* arcs à 3 points */}
        <path d="M10 34 A72 72 0 0 1 10 146" />
        <path d="M310 34 A72 72 0 0 0 310 146" />
      </g>
    </svg>
  );
}
