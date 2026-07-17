// components/shared/dna/index.tsx
//
// ADN VISUEL PARTAGÉ — les composants. Voir dnaCss.ts pour le contrat de tokens.
// Factorisé côté école, consommé des deux côtés (école + équipe). Une seule
// source de vérité : tout changement de vocabulaire décoratif se fait ICI.

import * as React from "react";

export { DNA_CSS } from "./dnaCss";

/* ══ GhostWords ══════════════════════════════════════════════════════════════
   Les mots/motifs fantômes de la couche 0. Data-driven : la page école décrit
   ses compositions figées par section, la page équipe alimente les siennes
   depuis wallWords. Même vocabulaire, mêmes classes, mêmes densités. */

/** `word` = Anton contour · `italic` = Playfair · `marker` = Permanent Marker
 *  · `mark` = motif PNG masqué (peint à --dna-mark). */
export type GhostVariant = "word" | "italic" | "marker" | "mark";

export type GhostMask = "fleur" | "maple" | "nx";

export interface GhostItem {
  variant: GhostVariant;
  /** texte (variantes word/italic/marker) */
  text?: string;
  /** motif (variante mark) */
  mask?: GhostMask;
  left?: string;
  right?: string;
  top?: string;
  bottom?: string;
  /** number → px ; string → passé tel quel (clamp(), etc.) */
  fontSize?: number | string;
  /** variante mark uniquement */
  size?: number;
  /** degrés — rotation STATIQUE, posée à la construction (jamais animée) */
  rotate?: number;
  /** variante mark uniquement (défaut .045) */
  opacity?: number;
}

const VARIANT_CLASS: Record<GhostVariant, string> = {
  word: "gwd",
  italic: "gwi",
  marker: "gmk",
  mark: "gm",
};

function ghostStyle(g: GhostItem): React.CSSProperties {
  const s: React.CSSProperties = {
    left: g.left,
    right: g.right,
    top: g.top,
    bottom: g.bottom,
  };
  if (g.rotate !== undefined) s.transform = `rotate(${g.rotate}deg)`;
  if (g.variant === "mark") {
    s.width = g.size;
    s.height = g.size;
    s.opacity = g.opacity ?? 0.045;
  } else {
    s.fontSize = g.fontSize;
  }
  return s;
}

/**
 * @param items      la composition
 * @param wrapped    true → enveloppe dans `.nx-ghosts` (inset:0, overflow:hidden).
 *                   Utile quand le conteneur n'écrête pas lui-même. Les sections
 *                   école ont déjà `overflow:hidden` → items en enfants directs.
 */
export function GhostWords({
  items,
  wrapped = false,
}: {
  items: GhostItem[];
  wrapped?: boolean;
}) {
  const nodes = items.map((g, i) => (
    <div
      key={i}
      className={g.variant === "mark" ? `gm gm-${g.mask}` : VARIANT_CLASS[g.variant]}
      style={ghostStyle(g)}
    >
      {g.variant === "mark" ? null : g.text}
    </div>
  ));
  if (!wrapped) return <>{nodes}</>;
  return (
    <div className="nx-ghosts" aria-hidden>
      {nodes}
    </div>
  );
}

/** Les 5 densités de la page équipe (positions/tailles/angles portés verbatim de
 *  l'ancien `.tp .gw:nth-child(n)`). Alimenté par `wallWords` — au-delà de 5
 *  mots, on boucle sur les mêmes ancrages. */
const WALL_SLOTS: Omit<GhostItem, "text" | "variant">[] = [
  { left: "1%", top: "54px", fontSize: "clamp(58px,7vw,104px)", rotate: -3 },
  { right: "2%", top: "150px", fontSize: "clamp(74px,10vw,150px)", rotate: 2 },
  { left: "34%", top: "250px", fontSize: "clamp(90px,13vw,190px)", rotate: -2 },
  { left: "3%", bottom: "90px", fontSize: "clamp(46px,5.5vw,84px)", rotate: -2 },
  { right: "6%", bottom: "34px", fontSize: "clamp(40px,5vw,72px)", rotate: 3 },
];

/** Mots du mur d'une équipe → items GhostWords, aux densités page école. */
export function wallWordGhosts(words: string[]): GhostItem[] {
  return words.map((w, i) => ({
    variant: "word" as const,
    text: w.toUpperCase(),
    ...WALL_SLOTS[i % WALL_SLOTS.length],
  }));
}

/* ══ PlaybookDecor ═══════════════════════════════════════════════════════════
   Les tracés de craie — X/O, flèches pointillées, routes. MÊMES assets que la
   page école, portés verbatim (aucun redessin). Trois presets = les trois
   compositions existantes. */

export type PlaybookPreset = "xo" | "chalk" | "spine";

/**
 * @param preset  `xo` = X + O + route courte (planche académique, 120×100)
 *                `chalk` = X + O + longue route fléchée (section sports, 260×180)
 *                `spine` = O + route fléchée + X (section à-propos, 320×240)
 */
export function PlaybookDecor({
  preset,
  style,
}: {
  preset: PlaybookPreset;
  style?: React.CSSProperties;
}) {
  if (preset === "xo") {
    return (
      <svg className="xo" style={style} viewBox="0 0 120 100" fill="none" stroke="currentColor" strokeWidth="4" aria-hidden>
        <path d="M20 20l20 20M40 20L20 40" />
        <circle cx="85" cy="30" r="12" />
        <path d="M30 70c20-16 40 4 60-14" strokeDasharray="6 8" />
      </svg>
    );
  }
  if (preset === "chalk") {
    return (
      <svg className="gchalk" style={style} viewBox="0 0 260 180" fill="none" stroke="currentColor" strokeWidth="4" aria-hidden>
        <path d="M30 30l26 26M56 30L30 56" />
        <circle cx="150" cy="46" r="17" />
        <path d="M46 100c46 34 106 6 168 52" strokeDasharray="8 10" />
        <path d="M204 142l24 12-6-26" />
      </svg>
    );
  }
  return (
    <svg className="spine" style={style} viewBox="0 0 320 240" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
      <circle cx="270" cy="40" r="13" />
      <path d="M270 56v66c0 28-66 24-104 62" strokeDasharray="8 10" />
      <path d="M172 172l-22 12 4-24" />
      <path d="M60 200l16 16M76 200l-16 16" />
    </svg>
  );
}

/* ══ NexusMark ═══════════════════════════════════════════════════════════════ */

/** Le X Nexus masqué, peint à la couleur de marque de la page (--dna-mark). */
export function NexusMark({
  size = 46,
  className = "",
  style,
}: {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`nxmask ${className}`.trim()}
      style={{ width: size, height: size, ...style }}
      aria-hidden
    />
  );
}

/* ══ GrainOverlay ════════════════════════════════════════════════════════════ */

/** Grain fixe en overlay (mix-blend-mode:overlay, .18). Un par page. */
export function GrainOverlay({ id = "pg" }: { id?: string }) {
  return (
    <svg className="pgrain" aria-hidden>
      <filter id={id}>
        <feTurbulence type="fractalNoise" baseFrequency=".8" numOctaves="2" stitchTiles="stitch" />
        <feColorMatrix type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .5 0" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
}
