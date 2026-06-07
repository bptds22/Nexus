"use client";

/* ═══════════════════════════════════════════════════════════════
   AnimatedRoute — push iOS sur TOUTES les routes recruteur
   (iter 5.4 → 7.36)

   Matrice direction (signe du slide horizontal) :
   ─────────────────────────────────────────────────────────────
   Cas                              | direction | Effet
   ─────────────────────────────────────────────────────────────
   First mount                      |     0     | render direct
   Tab A → Tab B (différents)       | sign(B-A) | slide ordre tabs
   Tab → Plus (idx -1)              |    +1     | push iOS depuis droite
   Plus → Tab                       |    -1     | retour slide droite
   Même tab, segments+ (drill-down) |    +1     | push iOS depuis droite
   Même tab, segments- (back)       |    -1     | retour slide droite
   Plus → Plus / même depth         |     0     | fade fallback court
   ─────────────────────────────────────────────────────────────

   - Tab roots : /recruteur/tableau-de-bord, /recherche, /pipeline, /messages
   - Plus roots : /recruteur/activites, /favoris, /listes, /profil, /parametres, /cegep*
   - Drill-down : /listes/[id], /athletes/[id], /messages/[id], /cegep/entraineurs/[id]

   Avant 7.36, seules les 4 routes tab animaient. Toutes les autres
   tombaient dans currentIndex === -1 → return enfants direct → cut sec.
   Iter 7.36 supprime ce shortcut : toute route traverse AnimatePresence.

   Iter 6.0c : LayoutGroup wrap pour shared element morph (motion.div
   layoutId="athlete-photo-${id}"). Conservé tel quel — framer gère
   la coexistence layoutId + transform du wrapper.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

const TAB_PATHS: { index: number; matchers: string[] }[] = [
  { index: 0, matchers: ["/recruteur/tableau-de-bord"] },
  { index: 1, matchers: ["/recruteur/recherche", "/recruteur/athletes"] },
  { index: 2, matchers: ["/recruteur/pipeline"] },
  { index: 3, matchers: ["/recruteur/messages"] },
];

function getTabIndex(pathname: string): number {
  for (const tab of TAB_PATHS) {
    if (tab.matchers.some((m) => pathname === m || pathname.startsWith(m + "/"))) {
      return tab.index;
    }
  }
  return -1;
}

function segmentCount(pathname: string): number {
  return pathname.split("/").filter(Boolean).length;
}

export function AnimatedRoute({ children }: { children: ReactNode }) {
  const pathname = usePathname() || "";
  const currentIndex = getTabIndex(pathname);
  const prevIndexRef = useRef<number>(currentIndex);
  const prevPathnameRef = useRef<string>(pathname);
  const isFirstMountRef = useRef<boolean>(true);

  // Direction calculée AVANT effect pour le render courant.
  let direction = 0;
  if (!isFirstMountRef.current) {
    const cur = currentIndex;
    const prev = prevIndexRef.current;

    if (cur >= 0 && prev >= 0 && cur !== prev) {
      // Tab → autre Tab : ordre des tabs (gauche ↔ droite)
      direction = Math.sign(cur - prev);
    } else if (cur < 0 && prev >= 0) {
      // Tab → Plus (ou détail hors mapping) : push depuis la droite
      direction = 1;
    } else if (cur >= 0 && prev < 0) {
      // Plus → Tab : retour vers la droite
      direction = -1;
    } else {
      // Même tab (drill-down/back) ou Plus → Plus : nombre de segments
      const curSegs = segmentCount(pathname);
      const prevSegs = segmentCount(prevPathnameRef.current);
      if (curSegs > prevSegs) direction = 1; // drill-down
      else if (curSegs < prevSegs) direction = -1; // back
      // Même depth → reste à 0 (rare : Plus → Plus same depth, ou /athletes/[a] → /athletes/[b])
    }
  }

  useEffect(() => {
    isFirstMountRef.current = false;
    prevIndexRef.current = currentIndex;
    prevPathnameRef.current = pathname;
  }, [pathname, currentIndex]);

  // Web desktop : comportement Next natif, aucune animation
  if (!IS_CAPACITOR) return <>{children}</>;

  // Iter 7.36 — Plus de shortcut "currentIndex === -1 → enfants direct".
  // Toutes les routes traversent AnimatePresence. Pour direction === 0
  // (premier mount, ou Plus → Plus same depth), on fait un fade court
  // au lieu d'un cut, pour éviter le flash entre 2 motion.div empilés.
  const hasSlide = direction !== 0;

  return (
    <LayoutGroup>
      <AnimatePresence mode="sync" initial={false}>
        <motion.div
          key={pathname}
          initial={{
            x: hasSlide ? (direction > 0 ? "100%" : "-100%") : 0,
            opacity: hasSlide ? 1 : 0,
          }}
          animate={{ x: 0, opacity: 1 }}
          exit={{
            x: hasSlide ? (direction > 0 ? "-100%" : "100%") : 0,
            opacity: hasSlide ? 1 : 0,
          }}
          transition={{
            duration: hasSlide ? 0.28 : 0.18,
            ease: [0.4, 0, 0.2, 1],
          }}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            // Iter 6.1c — bg unifié pour éviter le flash entre 2 pages mobile
            // pendant la transition (page enter / page exit chevauchées).
            backgroundColor: "#111317",
            willChange: "transform, opacity",
          }}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </LayoutGroup>
  );
}
