"use client";

/* ═══════════════════════════════════════════════════════════════
   HeartButton — Toggle favori premium (iter 5.4)

   Référence : Apple Music / Linear. Subtle, confident, premium.
   PAS Instagram (zéro particule, zéro burst).

   Tap inactif → actif :
   - Haptic Light
   - Scale 1 → 1.15 → 1 en 280ms cubic-bezier(0.34, 1.56, 0.64, 1)
   - Color transition 200ms : #9CA3AF → #E63946
   - Icon outline → filled
   - Halo glow box-shadow 400ms (keyframe nx-heart-glow)

   Tap actif → inactif :
   - Haptic Light
   - Scale 1 → 0.9 → 1 en 200ms (subtle press, pas de bounce up)
   - Color transition rouge → gris, fill → outline
   - Pas de halo
═══════════════════════════════════════════════════════════════ */

import { useState, useEffect } from "react";
import { triggerHaptic } from "@/lib/haptics";


interface HeartButtonProps {
  isFavorited: boolean;
  onToggle: () => void | Promise<void>;
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
}

const SIZE_MAP = {
  sm: { container: 32, icon: 16 },
  md: { container: 44, icon: 24 },
  lg: { container: 56, icon: 32 },
} as const;

// Durée d'animation par taille — sm plus snappy pour cards (iter 6.0b)
const ANIM_DURATION = {
  sm: { add: 200, remove: 160 },
  md: { add: 280, remove: 200 },
  lg: { add: 350, remove: 240 },
} as const;

export function HeartButton({ isFavorited, onToggle, size = "md", disabled = false }: HeartButtonProps) {
  const [pressed, setPressed] = useState(false);
  const [glowing, setGlowing] = useState(false);
  const { container, icon } = SIZE_MAP[size];

  // Reset l'état pressed après l'animation (durée pilotée par taille — iter 6.0b)
  useEffect(() => {
    if (!pressed) return;
    const d = ANIM_DURATION[size];
    const t = window.setTimeout(() => setPressed(false), isFavorited ? d.remove : d.add);
    return () => window.clearTimeout(t);
  }, [pressed, isFavorited, size]);

  // Reset le halo après 400ms
  useEffect(() => {
    if (!glowing) return;
    const t = window.setTimeout(() => setGlowing(false), 400);
    return () => window.clearTimeout(t);
  }, [glowing]);

  const handleClick = async () => {
    if (disabled) return;
    triggerHaptic("Light");
    // Halo uniquement à l'ajout (favorited === false avant le tap)
    const willBecomeFavorited = !isFavorited;
    setPressed(true);
    if (willBecomeFavorited) setGlowing(true);
    await onToggle();
  };

  // Scale animation différenciée selon direction
  const scale = pressed
    ? (isFavorited ? 0.9 : 1.15) // press down si actif, bounce up si vient d'activer
    : 1;

  const color = isFavorited ? "#E63946" : "#9CA3AF";

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={isFavorited ? "Retirer des favoris" : "Ajouter aux favoris"}
      className={`relative flex items-center justify-center rounded-full ${disabled ? "opacity-40" : "active:opacity-80"} ${glowing ? "nx-heart-glowing" : ""}`}
      style={{
        width: container,
        height: container,
        background: "transparent",
        WebkitTapHighlightColor: "transparent",
      }}
    >
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 24 24"
        fill={isFavorited ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          color,
          transform: `scale(${scale})`,
          transition: pressed
            ? `transform ${isFavorited ? ANIM_DURATION[size].remove : ANIM_DURATION[size].add}ms cubic-bezier(0.34, 1.56, 0.64, 1), color 200ms ease`
            : "transform 200ms ease, color 200ms ease",
        }}
      >
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
      <style jsx>{`
        @keyframes nx-heart-glow {
          0%   { box-shadow: 0 0 0 0 rgba(230,57,70,0.5); }
          50%  { box-shadow: 0 0 12px 2px rgba(230,57,70,0.5); }
          100% { box-shadow: 0 0 0 0 rgba(230,57,70,0); }
        }
        .nx-heart-glowing { animation: nx-heart-glow 400ms ease-out; }
      `}</style>
    </button>
  );
}
