'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    setMounted(true);

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Single structural return path : the tree shape is constant across
  // renders. Toggling animation behavior via props (not via conditional
  // structure) avoids the "Rendered more hooks than during the previous
  // render" violation that fix v1 (b4a7188, reset) caused in the parent
  // Router subtree when an early-return path replaced AnimatePresence.
  //
  // Before client mount : initial={false} + duration 0 = no visible fade
  // (matches SSR exactly, no cold-load flash).
  // After mount : route transitions animate normally.
  // Reduced motion : duration 0 keeps the structure but skips visible motion.
  const shouldAnimate = mounted && !reducedMotion;

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname ?? 'initial'}
        initial={shouldAnimate ? { opacity: 0 } : false}
        animate={{ opacity: 1 }}
        exit={shouldAnimate ? { opacity: 0 } : { opacity: 1 }}
        transition={{
          duration: shouldAnimate ? 0.2 : 0,
          ease: 'easeOut',
        }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
