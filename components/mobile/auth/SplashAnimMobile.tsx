"use client";

/* ═══════════════════════════════════════════════════════════════
   SplashAnimMobile — iter 7.47 → 7.47d

   iter 7.47d : consomme NexusLogoSvg (factorisé) + wrap layoutId
   pour le glide morph splash → header (Welcome/Login).

   Structure logo (3 motion wrappers imbriqués) :
   1. <motion.div layoutId> — cible du morph cross-component (le
      bounding rect de cette div est mesuré par framer pour le
      glide vers le header. Cette div ne se transforme PAS pendant
      le splash, donc la mesure est stable).
   2. <motion.div scale> — anim 7.47c (1.243 → 1, GPU-clean).
   3. <NexusLogoSvg> — SVG inline factorisé, 5 paths + stagger
      letters via prop.

   Le morph layoutId fire au démontage du splash overlay (200ms
   après done=true). Framer anime le bounding rect du wrapper (1)
   vers le header logo, 450ms ease iOS.

   Logique : Phase 0/1/2/3 + native hide INCHANGÉS depuis 7.47b/c.

   ⚠️ Hooks AVANT toute condition (canon).
═══════════════════════════════════════════════════════════════ */

import { useEffect } from "react";
import { motion } from "framer-motion";
import { PlaybookHeroArt } from "./PlaybookTileStatic";
import { NexusLogoSvg } from "./NexusLogoSvg";
import { useSplashLogoLayoutId } from "./SplashGate";

/* ── Constantes timing splash (iter 7.47e) ─────────────────────
   Total ~1600ms avant onAnimDone. Phases qui chevauchent.
   Modifiable par BP sans re-prompt.

   Phase 0 (0 → 250)         : X seul respire (scale stable 1.243)
   Phase 1 (250 → 950)       : scale 1.243 → 1 (700ms) + playbook 0 → 0.10
   Phase 2 (800 → 1330)      : stagger N/E/U/S, 70ms entre lettres,
                                durée 320ms chacune
   Phase 3 (1400 → 1600)     : hold logo complet 200ms → onAnimDone
─────────────────────────────────────────────────────────────── */

const TOTAL_DURATION_MS = 1600;
const NATIVE_FADE_OUT_MS = 250;
const EASE = [0.4, 0, 0.2, 1] as const;
const LAYOUT_MORPH_MS = 450;

const SVG_INITIAL_WIDTH = 348;
const SVG_FINAL_WIDTH = 280;

// Phase 0 hold avant que le scale ne démarre — laisse le X respirer seul.
const PHASE_0_HOLD_MS = 250;
// Phase 1 — scale wrapper (et playbook opacity) — durée 700ms à partir
// de PHASE_0_HOLD_MS → finit à 950ms.
const SCALE_DURATION_MS = 700;
const PLAYBOOK_FADE_DURATION_MS = 700;
// Phase 2 — base delay du N (la 1ère lettre) puis stagger entre chaque.
const LETTER_BASE_DELAY_MS = 800;
const LETTER_STAGGER_MS = 70;
const LETTER_DURATION_MS = 320;

interface SplashAnimMobileProps {
  onAnimDone: () => void;
}

export function SplashAnimMobile({ onAnimDone }: SplashAnimMobileProps) {
  // Hooks AVANT toute condition.
  const logoLayoutId = useSplashLogoLayoutId();

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
      {/* Playbook fade-in 0 → 0.10 (Phase 1, delay = hold Phase 0) */}
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

      {/* layoutId wrapper — bbox mesuré par framer pour le glide morph
          vers le header. Position centrée naturellement par le flex
          parent (items-center justify-center). */}
      <motion.div
        layoutId={logoLayoutId}
        transition={{ layout: { duration: LAYOUT_MORPH_MS / 1000, ease: EASE } }}
        className="relative"
        style={{ zIndex: 10 }}
      >
        {/* Scale wrapper 7.47c — GPU-clean (transform: scale, pas width).
            Iter 7.47e : delay = PHASE_0_HOLD_MS → X "respire" seul avant
            de commencer à reculer. Durée 700ms (Phase 1 = 250→950). */}
        <motion.div
          initial={{ scale: SVG_INITIAL_WIDTH / SVG_FINAL_WIDTH }}
          animate={{ scale: 1 }}
          transition={{
            duration: SCALE_DURATION_MS / 1000,
            delay: PHASE_0_HOLD_MS / 1000,
            ease: EASE,
          }}
          style={{ transformOrigin: "center center" }}
        >
          <NexusLogoSvg
            width={SVG_FINAL_WIDTH}
            staggerLetters
            staggerBaseDelay={LETTER_BASE_DELAY_MS / 1000}
            staggerInterval={LETTER_STAGGER_MS / 1000}
            staggerDuration={LETTER_DURATION_MS / 1000}
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
