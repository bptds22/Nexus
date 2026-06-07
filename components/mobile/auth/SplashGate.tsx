"use client";

/* ═══════════════════════════════════════════════════════════════
   SplashGate — iter 7.47 → 7.47d

   iter 7.47d ajouts :
   - LayoutGroup englobe children + splash overlay → permet le glide
     layoutId du logo entre splash (centré grand) et header
     (Welcome bottom-left / Login top-center, petit).
   - Context SplashLogoContext expose le layoutId UNIQUEMENT pendant
     la fenêtre splash + morph. Après morph completed, splashActive
     basule à false → layoutId undefined → AUCUN morph parasite entre
     les pages Welcome↔Login lors du slide 7.46e.

   Timeline :
   - t=0 (cold start) : played=false → splashActive=true, done=false
   - t=~1000ms : animDone && authReady → done=true → splash exit start
   - t=200ms après done : splash unmount → framer déclenche layoutId
     morph (450ms ease iOS) du logo splash → header logo
   - t=700ms après done : splashActive=false → headers perdent layoutId

   Hooks AVANT toute condition (canon 7.8d/7.25).
═══════════════════════════════════════════════════════════════ */

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import { SplashAnimMobile } from "./SplashAnimMobile";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";
const FADE_OUT_MS = 200;
const AUTH_READY_FALLBACK_MS = 2500;
// 200 fade exit + 450 morph layoutId + 50 buffer.
const SPLASH_ACTIVE_OFF_DELAY_MS = 700;
// Iter 7.47f — durée minimale d'affichage du splash, même si anim+auth
// résolvent plus tôt. Ajustable par BP. Le fallback 2500ms reste plus
// haut (sécurité si auth ne signale jamais).
const MIN_SPLASH_MS = 2000;

// Module-level one-shot. Cold start réinit à false.
let played = false;

/* ── Context : layoutId conditionnel ──────────────────────────────
   Pendant la splash active : "nexus-logo-auth" → headers Welcome/Login
   et splash logo partagent l'id → glide morph au démontage du splash.
   Après splash + morph : undefined → headers indépendants, pas de
   morph parasite lors du slide Welcome↔Login.
─────────────────────────────────────────────────────────────────── */
export const SplashLogoContext = createContext<string | undefined>(undefined);

export function useSplashLogoLayoutId(): string | undefined {
  return useContext(SplashLogoContext);
}

export function SplashGate({ children }: { children: ReactNode }) {
  // Hooks AVANT toute condition (canon).
  const [done, setDone] = useState<boolean>(played);
  const [animDone, setAnimDone] = useState<boolean>(false);
  const [authReady, setAuthReady] = useState<boolean>(false);
  // splashActive contrôle l'exposition du layoutId via le context.
  // Initialisé à !played → true au cold start, false post-anim.
  const [splashActive, setSplashActive] = useState<boolean>(!played);
  // Iter 7.47f — ref du moment exact de mount, pour mesurer elapsed
  // au moment de la décision de dévoiler. Date.now() à l'init useRef
  // = appelé une seule fois au premier render.
  const mountTimeRef = useRef<number>(Date.now());

  // Listener nx-auth-ready + fallback timeout (canon 7.47b BUG 2).
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

  // Dévoile children quand anim + auth sont prêts ET que le splash a
  // été affiché au moins MIN_SPLASH_MS (iter 7.47f). Garantit une
  // durée perçue minimale même si tout résout vite (avant 2s, le
  // user n'a pas le temps de "voir" le logo poser).
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

  // Désactive le layoutId APRÈS exit + morph complete → empêche le
  // morph parasite Welcome↔Login lors du slide 7.46e.
  useEffect(() => {
    if (!done || !splashActive) return;
    const t = window.setTimeout(
      () => setSplashActive(false),
      SPLASH_ACTIVE_OFF_DELAY_MS,
    );
    return () => window.clearTimeout(t);
  }, [done, splashActive]);

  // Desktop : passthrough immédiat (jamais d'anim, ni d'overlay).
  if (!IS_CAPACITOR) return <>{children}</>;

  const logoLayoutId = splashActive ? "nexus-logo-auth" : undefined;

  return (
    <SplashLogoContext.Provider value={logoLayoutId}>
      <LayoutGroup>
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
      </LayoutGroup>
    </SplashLogoContext.Provider>
  );
}
