"use client";

/* Toggle iOS canon (iter 7.40b) — composant unique réutilisé pour tous
   les switches Paramètres (Notif APP/EMAIL, marketing, Confidentialité).

   Math (canon brief 7.40b) :
   - Track 44 × 26, rounded-full
   - Thumb 22 × 22 (= track height − 4) ; margin 2 px à gauche, 2 px à droite
   - Slide range : 44 − 22 − 2×2 = 18 px (translateX 18px à ON)
   - Bg track : #3A3A3C OFF / #E63946 ON, transition 200ms
   - Thumb : bg blanc, shadow subtile 0 1 2 rgba(0,0,0,0.25)
   - Haptic Light au tap ; touch-action manipulation pour éviter zoom iOS.

   Extrait verbatim de RecruteurParametresMobile pour partage coach. */

import { triggerHaptic } from "./utils";

export function Toggle({
  checked, onChange, ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => { triggerHaptic("Light"); onChange(!checked); }}
      className="relative shrink-0 rounded-full"
      style={{
        width: 44,
        height: 26,
        background: checked ? "#E63946" : "#3A3A3C",
        transition: "background-color 200ms ease",
        touchAction: "manipulation",
      }}
    >
      <span
        className="block absolute rounded-full bg-white"
        style={{
          top: 2,
          left: 2,
          width: 22,
          height: 22,
          transform: checked ? "translateX(18px)" : "translateX(0)",
          transition: "transform 200ms ease",
          boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
        }}
        aria-hidden
      />
    </button>
  );
}
