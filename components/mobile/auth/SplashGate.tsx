"use client";

/* ═══════════════════════════════════════════════════════════════
   SplashGate — iter 7.47 → 7.47g

   Iter 7.47g — DROP du layoutId glide :
   - Plus de SplashLogoContext, plus de LayoutGroup, plus de splashActive
   - Le splash sort par un simple fade opacity → 0 (200ms)
   - Le header Welcome/Login a son logo STATIQUE, rien ne "voyage"
   - Simplification massive : 4 hooks (down de 5), une seule décision
     de timing (animDone && authReady && elapsed >= MIN_SPLASH_MS)

   Logique conservée :
   - One-shot module-level (cold start = anim, nav interne = skip)
   - MIN_SPLASH_MS 2000 (iter 7.47f)
   - Fallback authReady 2500ms
   - Desktop passthrough immédiat (!IS_CAPACITOR)

   ⚠️ Hooks AVANT toute condition (canon).
═══════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SplashAnimMobile } from "./SplashAnimMobile";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";
const FADE_OUT_MS = 200;
const AUTH_READY_FALLBACK_MS = 2500;
const MIN_SPLASH_MS = 2000;

let played = false;

export function SplashGate({ children }: { children: ReactNode }) {
  // Hooks AVANT toute condition (canon).
  const [done, setDone] = useState<boolean>(played);
  const [animDone, setAnimDone] = useState<boolean>(false);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const mountTimeRef = useRef<number>(Date.now());

  // Listener nx-auth-ready + fallback timeout (iter 7.47b BUG 2).
  useEffect(() => {
    if (!IS_CAPACITOR || played) return;
    const onReady = () => setAuthReady(true);
    window.addEventListener("nx-auth-ready", onReady);
    const timer = window.setTimeout(() => setAuthReady(true), AUTH_READY_FALLBACK_MS);
    return () => {
      window.removeEventListener("nx-auth-ready", onReady);
      window.clearTimeout(timer);
    };
  }, []);

  // Dévoile children quand anim + auth prêts ET MIN_SPLASH_MS écoulé.
  useEffect(() => {
    if (!animDone || !authReady || done) return;
    const elapsed = Date.now() - mountTimeRef.current;
    if (elapsed >= MIN_SPLASH_MS) {
      played = true;
      setDone(true);
      return;
    }
    const remaining = MIN_SPLASH_MS - elapsed;
    const t = window.setTimeout(() => {
      played = true;
      setDone(true);
    }, remaining);
    return () => window.clearTimeout(t);
  }, [animDone, authReady, done]);

  if (!IS_CAPACITOR) return <>{children}</>;

  return (
    <>
      {children}
      <AnimatePresence>
        {!done && (
          <motion.div
            key="splash-overlay"
            initial={false}
            exit={{ opacity: 0 }}
            transition={{ duration: FADE_OUT_MS / 1000, ease: "easeOut" }}
            style={{ position: "fixed", inset: 0, zIndex: 9999 }}
            aria-hidden
          >
            <SplashAnimMobile onAnimDone={() => setAnimDone(true)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
