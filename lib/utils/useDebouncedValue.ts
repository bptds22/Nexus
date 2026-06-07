/* ═══════════════════════════════════════════════════════════════
   useDebouncedValue — utility hook (iter 5.3a)
   Retarde la propagation d'une valeur de N ms après son dernier
   changement. Utilisé pour débouncer les inputs text (search) avant
   de les feed dans une query key TanStack.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
