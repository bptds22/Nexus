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

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SplashAnimMobile } from "./SplashAnimMobile";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";
const FADE_OUT_MS = 200;
const AUTH_READY_FALLBACK_MS = 2500;
const MIN_SPLASH_MS = 2000;

// Persistance du flag "splash déjà joué" en sessionStorage (au lieu d'une
// variable module). En Capacitor la nav interne est MPA : chaque navigation
// recharge le document → le module JS est ré-évalué → une variable module
// repasserait à false et rejouerait le splash à CHAQUE nav. sessionStorage
// survit au reboot DANS la session → le splash ne joue qu'au VRAI cold start
// (clé absente), jamais sur une nav interne. (sessionStorage, pas
// localStorage → reset au prochain lancement réel de l'app.)
const PLAYED_KEY = "nx-splash-played";
function readPlayed(): boolean {
  if (typeof window === "undefined") return false;
  try { return window.sessionStorage.getItem(PLAYED_KEY) === "1"; } catch { return false; }
}
function markPlayed(): void {
  try { window.sessionStorage.setItem(PLAYED_KEY, "1"); } catch { /* no-op */ }
}

// useLayoutEffect côté client (masque le splash AVANT le 1er paint sur un
// reboot interne) ; useEffect au prerender (évite le warning SSR).
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

export function SplashGate({ children }: { children: ReactNode }) {
  // Hooks AVANT toute condition (canon).
  // Init à false = identique au prerender → pas de mismatch d'hydratation.
  // Le layout effect ci-dessous masque AVANT paint si déjà joué (reboot interne).
  const [done, setDone] = useState<boolean>(false);
  const [animDone, setAnimDone] = useState<boolean>(false);
  const [authReady, setAuthReady] = useState<boolean>(false);
  const mountTimeRef = useRef<number>(Date.now());

  // Reboot d'une nav interne (sessionStorage déjà posé) → on saute le splash
  // immédiatement, avant le 1er paint : aucune animation ne rejoue.
  useIsoLayoutEffect(() => {
    if (IS_CAPACITOR && readPlayed()) setDone(true);
  }, []);

  // Listener nx-auth-ready + fallback timeout (iter 7.47b BUG 2).
  useEffect(() => {
    if (!IS_CAPACITOR || readPlayed()) return;
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
      markPlayed();
      setDone(true);
      return;
    }
    const remaining = MIN_SPLASH_MS - elapsed;
    const t = window.setTimeout(() => {
      markPlayed();
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
            className="nx-splash-overlay"
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
