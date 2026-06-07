"use client";

/* ═══════════════════════════════════════════════════════════════
   AuthMobileDispatcher — iter 7.46 → 7.46e

   Sur /auth en contexte Capacitor, décide quoi afficher :

   1. Session valide → postLoginDispatch direct.
   2. Deep link invitation_token → render desktop AuthContent.
   3. Opt-out _web=1 dans l'URL → render desktop AuthContent.
   4. Sinon → Preferences "nexus_has_launched" :
      - Pas posé → WelcomeMobile
      - Posé → LoginMobile

   Iter 7.46e (gros refactor — design pur, logique intacte) :
   - PlaybookHeroArt LIFTÉ ici (persistant), montée UNE seule fois.
     Welcome ↔ Login ne le démontent pas → continuité visuelle.
   - Slide directionnel Framer Motion AnimatePresence mode="wait" :
       welcome→login : welcome exit -100% / login enter +100%
       login→welcome : login exit +100% / welcome enter -100%
     duration 0.38s, ease canon iOS [0.4, 0, 0.2, 1].
   - Parallax sur le playbook : translation x partielle (~-10vw)
     contrairement au contenu (-100%) → effet de profondeur premium.
   - Opacity interpolée 0.07 (welcome) ↔ 0.05 (login) sur le motion
     wrapper du playbook.
   - boot / desktop phases inchangées (pas d'AnimatePresence,
     pas de playbook lifted — directs).

   ⚠️ Hooks AVANT toute condition (canon 7.8d/7.25).
   ⚠️ Containing block : playbook et content sont SIBLINGS au niveau
     fixed inset-0 → la translation du content n'affecte pas le
     parallax du playbook (chacun son stacking context).
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { postLoginDispatch } from "@/lib/auth/postLoginDispatch";
import { WelcomeMobile } from "./WelcomeMobile";
import { LoginMobile } from "./LoginMobile";
import { PlaybookHeroArt } from "./PlaybookTileStatic";

type Phase = "boot" | "welcome" | "login" | "desktop";

interface AuthMobileDispatcherProps {
  desktopFallback: ReactNode;
}

async function getHasLaunched(): Promise<boolean> {
  try {
    const { Preferences } = await import("@capacitor/preferences");
    const { value } = await Preferences.get({ key: "nexus_has_launched" });
    return value === "true";
  } catch {
    return false;
  }
}

/* ── Slide variants (canon iOS push) ──────────────────────────── */

const slideVariants: Variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : "-100%",
  }),
  center: { x: 0 },
  exit: (direction: number) => ({
    x: direction > 0 ? "-100%" : "100%",
  }),
};

const slideTransition = {
  duration: 0.38,
  ease: [0.4, 0, 0.2, 1] as const,
};

/* ── Parallax x target par view (vw partiel — pas la même
   distance que le contenu, sinon "colle").
   Iter 7.46g — cibles en VW (absolu viewport), pas en % (relatif
   width du layer). Avec layer 124vw, le -10% interprété par framer
   = -12.4vw → débord couvert tangent. -10vw = exactement 10vw de
   marge constante des 2 côtés (cf. left:-12vw + width:124vw). */
const PLAYBOOK_X_BY_VIEW = {
  welcome: "0vw",
  login: "-10vw",
};

const PLAYBOOK_OPACITY_BY_VIEW = {
  welcome: 0.07,
  // Iter 7.46f — Login a besoin de PLUS d'opacity car son gradient
  // interne masque la zone basse. 0.09 compense pour rendre le playbook
  // clairement visible sous le form, pas un cercle fantôme.
  login: 0.09,
};

export function AuthMobileDispatcher({ desktopFallback }: AuthMobileDispatcherProps) {
  // Hooks AVANT toute condition (canon).
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<Phase>("boot");
  // Direction du slide : +1 = welcome→login (forward), -1 = login→welcome (back).
  // Init à +1 (premier mount welcome ne lance pas d'animation grâce à
  // initial={false} sur AnimatePresence).
  const [direction, setDirection] = useState<number>(1);

  const hasInvitationToken = !!searchParams.get("invitation_token");
  const optOutWeb = searchParams.get("_web") === "1";

  useEffect(() => {
    if (hasInvitationToken || optOutWeb) {
      setPhase("desktop");
      return;
    }

    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.user) {
        try {
          await postLoginDispatch(supabase, session.user, router);
        } catch {
          if (!cancelled) setPhase("welcome");
        }
        return;
      }

      const launched = await getHasLaunched();
      if (cancelled) return;
      setPhase(launched ? "login" : "welcome");
    })();

    return () => { cancelled = true; };
  }, [router, hasInvitationToken, optOutWeb]);

  // Iter 7.47b BUG 2 — Émet "nx-auth-ready" dès que la phase résout vers
  // un écran rendu (welcome/login/desktop). SplashGate l'écoute pour
  // dévoiler les children sans flash. Boot n'émet pas (boot = noir, pas
  // un écran prêt).
  useEffect(() => {
    if (phase === "boot") return;
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent("nx-auth-ready"));
  }, [phase]);

  // Transitions explicites (set direction puis phase — batch React).
  const goToLogin = () => {
    setDirection(1);
    setPhase("login");
  };
  const goToWelcome = () => {
    setDirection(-1);
    setPhase("welcome");
  };

  // Boot : noir vide (splash Capacitor visible).
  if (phase === "boot") {
    return <div className="fixed inset-0 bg-[#111317]" />;
  }

  if (phase === "desktop") {
    return <>{desktopFallback}</>;
  }

  // phase === "welcome" ou "login" : montage de la paire animée.
  const view: "welcome" | "login" = phase;
  const playbookX = PLAYBOOK_X_BY_VIEW[view];
  const playbookOpacity = PLAYBOOK_OPACITY_BY_VIEW[view];

  return (
    <>
      {/* zIndex 0 : fond solide #111317 — fallback ultime sous tout */}
      <div
        aria-hidden
        className="fixed inset-0 bg-[#111317]"
        style={{ zIndex: 0 }}
      />

      {/* zIndex 1 : playbook persistant, parallax animé.
          Iter 7.46g — layer SURDIMENSIONNÉ 124vw × 100vh, déporté à
          left:-12vw : ≥100vw + 2×(amplitude max 10vw) de marge des 2
          côtés. Les cibles parallax restent "0%" / "-10%" (relatives
          à la width du layer = 124vw) → décale visuellement de
          0 / -12.4vw, mais COMME le layer dépassait déjà de 12vw à
          droite au repos, après translation -12.4vw on est juste
          à -0.4vw de marge restante côté droit (encore positif, donc
          pas de bord visible). Au mid-transition (-5vw) : marges 7vw
          de chaque côté → également invisibles. Aucun bord coupé,
          jamais.

          position:fixed (hors flow document) → ne contribue PAS à la
          largeur de page. overflow-hidden sur les écrans Welcome/Login
          (canon iter 7.34) verrouille tout débordement résiduel. */}
      <motion.div
        aria-hidden
        className="fixed pointer-events-none"
        style={{
          zIndex: 1,
          top: 0,
          left: "-12vw",
          width: "124vw",
          height: "100vh",
        }}
        animate={{ x: playbookX, opacity: playbookOpacity }}
        transition={slideTransition}
        initial={false}
      >
        <PlaybookHeroArt opacity={1} position="top" height="100vh" fade="none" />
      </motion.div>

      {/* zIndex 10 : contenu animé. mode="wait" sérialise exit/enter
          → pas d'écran à moitié slidé même en double-tap rapide. */}
      <AnimatePresence mode="wait" custom={direction} initial={false}>
        <motion.div
          key={view}
          className="fixed inset-0"
          style={{ zIndex: 10 }}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={slideTransition}
        >
          {view === "welcome" ? (
            <WelcomeMobile onShowLogin={goToLogin} />
          ) : (
            <LoginMobile onShowWelcome={goToWelcome} />
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
}
