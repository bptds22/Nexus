"use client";

/* ═══════════════════════════════════════════════════════════════
   PlaybookHeroArt — iter 7.46c → 7.46d

   v7.46d : redessine une VRAIE formation football reconnaissable.
   v7.46c laissait courbes Bézier qui partaient de nulle part = lecture
   abstraite. Un coach doit reconnaître un play.

   Formation : passing play "QB throws WR1 OUT route".

   OFFENSE (sur/derrière la ligne de mêlée y=500) :
   - 5 O alignés SUR la ligne : LT (310,500), LG (400,500), C (500,500),
     RG (600,500), RT (690,500). Centre légèrement plus gros (r=42 vs 38).
   - 2 WR aux extrémités : WR1 gauche (140,500), WR2 droite (860,500).
   - QB en retrait derrière le centre, point plein blanc (signal ball
     handler) : (500,590).

   DÉFENSE (X) — placés EN FACE de l'offense, au-dessus de la ligne :
   - DE-L (390,390), DE-R (610,390) — defensive ends en bout de O-line
   - LB (500,290) — middle linebacker derrière les DT
   - FS (500,180) — free safety deep middle

   ROUTES (partent d'un joueur, vont quelque part) :
   - WR1 OUT route : stem vertical depuis WR1 puis cassure 90° vers le
     milieu. Trajet (140,462) → (140,330) → (320,330). Marker arrow.
   - WR2 GO route : ligne verticale pure depuis WR2. (860,462) → (860,130).
     Marker arrow.
   - QB pass au WR1 OUT : courbe pointillée depuis le QB jusqu'au point
     de réception. (500,545) → quadratic → (320,330). Marker arrow.

   Style :
   - Stroke #FFFFFF, opacity prop (défaut 0.07)
   - Rotation -5° sur tout le groupe (signature playbook)
   - Crop par les bords (viewBox dépassant + preserveAspectRatio slice)
   - StrokeLinecap round, pas de texte
   - Pas d'animation, pas de hook

   Prop fade (nouveau 7.46d) :
   - "soft" (défaut) : Welcome, diagramme visible ~45% du container
   - "strong" : Login, fade plus agressif → diagramme visible ~25%,
     le form respire sur fond #111317 plein
═══════════════════════════════════════════════════════════════ */

interface PlaybookHeroArtProps {
  opacity?: number;
  position?: "top" | "bottom";
  height?: string;
  /** Force du dégradé d'extinction côté contenu. "none" = aucun
   *  overlay interne (le dim est géré par l'écran consommateur — utile
   *  pour le pattern persistant lifted dans AuthMobileDispatcher iter 7.46e). */
  fade?: "soft" | "strong" | "none";
}

export function PlaybookHeroArt({
  opacity = 0.07,
  position = "top",
  height,
  fade = "soft",
}: PlaybookHeroArtProps) {
  const resolvedHeight = height ?? (position === "top" ? "67vh" : "60vh");

  // Stops du dégradé d'extinction. "strong" coupe le diagramme bien plus
  // haut → la zone du form (Login) reste sur fond plein #111317.
  // "none" = pas d'overlay interne (consommateur gère le dim — pattern
  // shared-playbook iter 7.46e).
  const stops =
    fade === "strong"
      ? { transparentTo: 25, fadeAt: 60, fadeFull: 100 }
      : { transparentTo: 55, fadeAt: 90, fadeFull: 100 };

  // Direction : fade vers le côté contenu.
  // position="top" → art en haut → fade vers le BAS (côté contenu).
  // position="bottom" → art en bas → fade vers le HAUT (côté contenu).
  const dir = position === "top" ? "to bottom" : "to top";
  const gradient = `linear-gradient(${dir}, rgba(17,19,23,0) 0%, rgba(17,19,23,0) ${stops.transparentTo}%, rgba(17,19,23,0.95) ${stops.fadeAt}%, #111317 ${stops.fadeFull}%)`;
  const showGradient = fade !== "none";

  const anchor = position === "top" ? { top: 0 } : { bottom: 0 };

  return (
    <div
      aria-hidden
      className="absolute inset-x-0 pointer-events-none overflow-hidden"
      style={{ ...anchor, height: resolvedHeight, zIndex: 0 }}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1000 800"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
        style={{ display: "block", opacity }}
      >
        <defs>
          <marker
            id="ah-hero"
            markerWidth="10"
            markerHeight="8"
            refX="9"
            refY="4"
            orient="auto"
          >
            <polygon points="0 0, 10 4, 0 8" fill="#FFFFFF" />
          </marker>
        </defs>

        {/* Tout le diagramme tourné -5° autour du centre (signature playbook). */}
        <g
          transform="rotate(-5, 500, 400)"
          stroke="#FFFFFF"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* === LIGNE DE MÊLÉE === */}
          <line
            x1="-80"
            y1="500"
            x2="1080"
            y2="500"
            strokeWidth="3"
            strokeDasharray="22 14"
          />

          {/* === ROUTES (sous les joueurs, partent du bord du cercle) === */}

          {/* WR1 (gauche) OUT route : stem vertical puis cassure 90° vers le milieu */}
          <path
            d="M 140 462 L 140 330 L 320 330"
            strokeWidth="6"
            markerEnd="url(#ah-hero)"
          />

          {/* WR2 (droite) GO route : ligne verticale pure */}
          <path
            d="M 860 462 L 860 130"
            strokeWidth="6"
            markerEnd="url(#ah-hero)"
          />

          {/* QB pass au WR1 OUT : courbe quadratique pointillée */}
          <path
            d="M 500 545 Q 380 460, 320 330"
            strokeWidth="4"
            strokeDasharray="14 10"
            markerEnd="url(#ah-hero)"
          />

          {/* === DÉFENSE (X) — en face de l'offense, au-dessus de la ligne === */}

          {/* DE-L (defensive end gauche) */}
          <line x1="356" y1="356" x2="424" y2="424" strokeWidth="5" />
          <line x1="424" y1="356" x2="356" y2="424" strokeWidth="5" />

          {/* DE-R (defensive end droit) */}
          <line x1="576" y1="356" x2="644" y2="424" strokeWidth="5" />
          <line x1="644" y1="356" x2="576" y2="424" strokeWidth="5" />

          {/* LB (middle linebacker) */}
          <line x1="466" y1="256" x2="534" y2="324" strokeWidth="5" />
          <line x1="534" y1="256" x2="466" y2="324" strokeWidth="5" />

          {/* FS (free safety, deep middle) */}
          <line x1="466" y1="146" x2="534" y2="214" strokeWidth="5" />
          <line x1="534" y1="146" x2="466" y2="214" strokeWidth="5" />

          {/* === OFFENSE (O) — sur et derrière la ligne === */}

          {/* O-Line : 5 joueurs sur la ligne de mêlée (y=500) */}
          <circle cx="310" cy="500" r="38" strokeWidth="4.5" />
          <circle cx="400" cy="500" r="38" strokeWidth="4.5" />
          <circle cx="500" cy="500" r="42" strokeWidth="5" />
          <circle cx="600" cy="500" r="38" strokeWidth="4.5" />
          <circle cx="690" cy="500" r="38" strokeWidth="4.5" />

          {/* WR aux extrémités (sur la ligne, isolés des extrémités O) */}
          <circle cx="140" cy="500" r="38" strokeWidth="4.5" />
          <circle cx="860" cy="500" r="38" strokeWidth="4.5" />

          {/* QB derrière le centre, ballcarrier (point plein) */}
          <circle cx="500" cy="590" r="40" strokeWidth="4.5" />
          <circle cx="500" cy="590" r="10" fill="#FFFFFF" stroke="none" />
        </g>
      </svg>

      {/* Overlay dégradé d'extinction — vit côté contenu.
          Omis si fade="none" (dim géré par l'écran consommateur). */}
      {showGradient && (
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ background: gradient }}
        />
      )}
    </div>
  );
}

/* Backwards-compatibility export (au cas où d'autres imports utilisaient
   l'ancien nom). */
export const PlaybookTileStatic = PlaybookHeroArt;
