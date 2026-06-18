"use client";

/* ═══════════════════════════════════════════════════════════════
   SplashAnimMobile — iter 7.47 → 7.47g

   Iter 7.47g — REFONTE : X reste FIXE, mot se forme autour.
   - PAS de scale wrapper (drop 7.47c)
   - PAS de layoutId glide vers header (drop 7.47d)
   - SVG rendu à width SVG_WIDTH stable, position centrée
   - Le X est rendu IMMÉDIATEMENT (opacity 1, aucune anim)
   - Centré géométriquement dans le viewBox (197.21, 68.965 = centre)
     → SVG centré viewport → X centré viewport, match native splash_icon
   - Lettres N/E/U/S apparaissent autour : opacity 0 → 1 + translate Y
     léger (8px → 0) avec stagger. Props composited (GPU-clean).
   - Hold court puis fade out via AnimatePresence parent (SplashGate).

   Props animées :
   - opacity (composited)
   - transform translate Y (composited)
   - AUCUNE width, AUCUNE layout, AUCUNE scale

   ⚠️ Hooks AVANT toute condition (canon).
═══════════════════════════════════════════════════════════════ */

import { useEffect } from "react";
import { motion } from "framer-motion";
import { PlaybookHeroArt } from "./PlaybookTileStatic";

/* ── Constantes timing (modifiables par BP) ──────────────────── */

const TOTAL_DURATION_MS = 1600;
const NATIVE_FADE_OUT_MS = 250;
const EASE = [0.4, 0, 0.2, 1] as const;

// Taille SVG : X = SVG_WIDTH × 136.05 / 394.42 ≈ 124px pour SVG_WIDTH=360.
// Match cible : splash_icon.xml natif à 128dp (≈ 124-128 logical px).
const SVG_WIDTH = 360;

// Phase 0 — playbook delay (X visible seul jusqu'à PHASE_0_HOLD_MS).
const PHASE_0_HOLD_MS = 250;
const PLAYBOOK_FADE_DURATION_MS = 700;

// Phase 2 — letters stagger.
const LETTER_BASE_DELAY_MS = 800;
const LETTER_STAGGER_MS = 70;
const LETTER_DURATION_MS = 320;
const LETTER_TRANSLATE_PX = 8;

/* ── Paths verbatim depuis public/brand/logo-white.svg ───────── */

const POLYGON_N =
  "48.15 77.64 29.91 24.86 0 24.86 0 136.39 23.07 136.39 23.07 69.31 46.24 136.39 71.22 136.39 71.22 24.86 48.15 24.86 48.15 77.64";

const PATH_E =
  "M143.68,24.86v22.62h-37.07v21.08h29.54v22.62h-29.54v22.61h29.39c-6.09,7.54-12.19,15.08-18.28,22.62h-36.49V24.86h62.45Z";

const PATH_X =
  "M265.01,25.13c-4.11.03-8.25.08-12.43.16-2.31.04-4.61.09-6.89.14-.22-1.04-.59-2.48-1.31-4.09-1.05-2.37-2.31-3.93-3.22-5.04-.69-.85-2.15-2.64-4.21-4.16-3.71-2.75-7.79-3.47-10.33-3.66,1.51,1.71,10.12,11.8,8.82,26.66-1.21,13.8-10.13,21.97-12.05,23.65,9.45-17.29,7.08-37.41-4.77-48.94C207.86-.62,193.26-.12,190.14.06c3.55,7.95,6.68,18.46,1.94,25.88-3.15,4.94-7.59,5.09-10.73,9.64-3.21,4.65-4.66,13.32,3.91,31.04-3.09-3.32-13.92-15.77-12.34-32.07.34-3.47,1.18-6.56,2.22-9.23-4.69-.06-9.4-.1-14.13-.14-3.64-.02-7.27-.04-10.89-.05.04.05.07.12.1.19,3.3,6.42,6.6,12.86,9.9,19.3,2.3,4.47,16.73,31.64,17.38,32.2-16.19,20.02-32.36,40.03-48.54,60.04h36.9c4.36-5.89,22.73-29.27,27.22-34.64,2.65,6.52,13.85,30.06,16.29,34.64h37.19c-9.81-18.62-19.62-37.25-29.44-55.87,0,0,43.76-51.09,47.89-55.86ZM214.87,40.65c-.3,4.42-1.8,9.04-6.33,11.06-3.47,1.54-8.74.55-10.74-2.48-2.04-3.08-3.33-9.21-.1-12.04,1.36-1.2,3.49-1.64,4.92-2.81,1.1-.89,1.45-2.02,1.74-2.65,2.16-4.68.78-11.96.54-13.16.87.54,1.95,1.28,3.07,2.3.41.37,1.22,1.14,2.11,2.23,1.67,2.03,2.59,3.9,2.89,4.64,1.09,2.63,1.6,5.55,1.83,8.34.12,1.41.17,2.98.07,4.57Z";

const PATH_U =
  "M293.81,24.86v81.3c0,6.33-2.78,9.15-9,9.15s-9-2.82-9-9.15V25.95c-5.53,6.43-16.02,18.68-25.38,29.61v49.37c0,3.58.37,6.9,1.08,9.95,0,0,0,0,0,0,.46,1.97,1.26,4.53,2.71,7.31,1.51,2.91,3.24,5.11,4.64,6.65h0c5.79,5.92,14.43,9.1,25.49,9.1,21.65,0,34.07-12.03,34.07-33V24.86h-24.61Z";

const PATH_S =
  "M369.79,70.27c-14.65-7.01-17.52-8.99-17.52-15.96,0-5.72,3.11-9,8.54-9,5.77,0,8.69,3.29,8.69,9.77v4.85h24.15v-5c0-19.8-12.34-31.61-33-31.61s-33.77,12-33.77,31.3c0,16.7,6.76,26.18,24.93,34.96,14.62,7.08,17.22,8.97,17.22,16.88,0,6.01-3.39,9.46-9.31,9.46-7.56,0-9.15-5.14-9.15-9.46v-6.69h-24.15v6.69c0,19.7,12.57,31.46,33.61,31.46s34.38-11.93,34.38-31.92c0-15.15-4.03-25.85-24.63-35.73Z";

interface SplashAnimMobileProps {
  /** Émis après TOTAL_DURATION_MS. SplashGate combine avec authReady. */
  onAnimDone: () => void;
}

export function SplashAnimMobile({ onAnimDone }: SplashAnimMobileProps) {
  // Hooks AVANT toute condition (canon).
  useEffect(() => {
    (async () => {
      try {
        const { SplashScreen } = await import("@capacitor/splash-screen");
        await SplashScreen.hide({ fadeOutDuration: NATIVE_FADE_OUT_MS });
      } catch { /* no-op : plugin absent (web) */ }
    })();

    const timer = window.setTimeout(() => onAnimDone(), TOTAL_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [onAnimDone]);

  return (
    <div
      className="fixed inset-0 bg-[#111317] flex items-center justify-center overflow-hidden"
      style={{ zIndex: 9999 }}
      aria-hidden
    >
      {/* Playbook fade-in 0 → 0.10 (Phase 1, delay = X hold seul) */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.1 }}
        transition={{
          duration: PLAYBOOK_FADE_DURATION_MS / 1000,
          delay: PHASE_0_HOLD_MS / 1000,
          ease: EASE,
        }}
      >
        <PlaybookHeroArt opacity={1} position="top" height="100vh" fade="none" />
      </motion.div>

      {/* SVG logo — STATIQUE, width fixe SVG_WIDTH, position centrée par
          le flex parent. Le X est rendu à opacity 1 dès le frame 0,
          AUCUNE animation. Centré géométriquement dans le viewBox →
          centré viewport → match splash_icon native. */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 394.42 137.93"
        preserveAspectRatio="xMidYMid meet"
        width={SVG_WIDTH}
        style={{ height: "auto", display: "block", position: "relative", zIndex: 10 }}
      >
        {/* X — toujours visible, AUCUNE animation. Fixe à sa place dans
            le mot ET centré viewport (le viewBox du logo le place
            géométriquement au centre). */}
        <path d={PATH_X} fill="#E63946" />

        {/* N — fade in + translate Y léger (rising letter effect) */}
        <motion.polygon
          points={POLYGON_N}
          fill="#FFFFFF"
          initial={{ opacity: 0, y: LETTER_TRANSLATE_PX }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: LETTER_DURATION_MS / 1000,
            delay: LETTER_BASE_DELAY_MS / 1000,
            ease: EASE,
          }}
        />

        {/* E */}
        <motion.path
          d={PATH_E}
          fill="#FFFFFF"
          initial={{ opacity: 0, y: LETTER_TRANSLATE_PX }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: LETTER_DURATION_MS / 1000,
            delay: (LETTER_BASE_DELAY_MS + LETTER_STAGGER_MS) / 1000,
            ease: EASE,
          }}
        />

        {/* U */}
        <motion.path
          d={PATH_U}
          fill="#FFFFFF"
          initial={{ opacity: 0, y: LETTER_TRANSLATE_PX }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: LETTER_DURATION_MS / 1000,
            delay: (LETTER_BASE_DELAY_MS + 2 * LETTER_STAGGER_MS) / 1000,
            ease: EASE,
          }}
        />

        {/* S */}
        <motion.path
          d={PATH_S}
          fill="#FFFFFF"
          initial={{ opacity: 0, y: LETTER_TRANSLATE_PX }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: LETTER_DURATION_MS / 1000,
            delay: (LETTER_BASE_DELAY_MS + 3 * LETTER_STAGGER_MS) / 1000,
            ease: EASE,
          }}
        />
      </svg>
    </div>
  );
}
