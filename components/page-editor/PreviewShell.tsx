"use client";

// components/page-editor/PreviewShell.tsx
//
// Enveloppe les previews de l'éditeur dans le MÊME contexte que ProgramPage :
// conteneur `.pp nx-dna` + rootStyle (thème Grasset) — les composants
// program-page ne sont pas self-contained (établi au diagnostic). Le CSS scopé
// (DNA_CSS + PP_CSS) est injecté UNE fois par PageEditor (voir PREVIEW_CSS).
//
// Réplique aussi l'effet compteurs (data-count) de ProgramPage : anime à chaque
// changement de `contentKey` (débouncé). Les reveals (.rv/.rvy) sont forcés
// statiques (pas de scroll-trigger dans une colonne de preview).

import * as React from "react";
import { DNA_CSS } from "@/components/shared/dna";
import { PP_CSS } from "@/components/program-page/ProgramPage";
import { PREVIEW_ROOT_STYLE } from "./pageBridge";

const PREVIEW_OVERRIDE = `
.pe-prev.pp .rv,.pe-prev.pp .rvy{opacity:1!important;transform:none!important}
.pe-prev.pp section{padding:30px 24px;border-bottom:0}
.pe-prev.pp .sec-in{max-width:none}
`;
/** À injecter UNE fois (PageEditor) — CSS scopé .pp partagé par tous les previews. */
export const PREVIEW_CSS = DNA_CSS + PP_CSS + PREVIEW_OVERRIDE;

/** Débounce par valeur (clé string/number) — le composant lourd ne re-rend
 *  qu'après stabilisation ; les champs de saisie restent instantanés. */
export function useDebounced<T>(value: T, ms = 180): T {
  const [v, setV] = React.useState(value);
  React.useEffect(() => {
    const id = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return v;
}

export default function PreviewShell({
  children, contentKey,
}: { children: React.ReactNode; contentKey?: string | number }) {
  const ref = React.useRef<HTMLDivElement>(null);

  // compteurs data-count → ease-out cubic (comme ProgramPage). Re-anime quand
  // contentKey change (le composant a re-rendu ses spans à "0").
  React.useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const counters = [...root.querySelectorAll<HTMLElement>("[data-count]")];
    if (window.matchMedia("(prefers-reduced-motion:reduce)").matches) {
      counters.forEach((el) => (el.textContent = (el.dataset.count ?? "") + (el.dataset.suffix ?? "")));
      return;
    }
    const raf: number[] = [];
    for (const el of counters) {
      const end = +(el.dataset.count ?? 0), suf = el.dataset.suffix ?? "", t0 = performance.now(), D = 1050;
      const tick = (t: number) => {
        const k = Math.min((t - t0) / D, 1);
        el.textContent = Math.round(end * (1 - Math.pow(1 - k, 3))) + suf;
        if (k < 1) raf.push(requestAnimationFrame(tick));
      };
      raf.push(requestAnimationFrame(tick));
    }
    return () => raf.forEach(cancelAnimationFrame);
  }, [contentKey]);

  return (
    <div className="pe-prev pp nx-dna" ref={ref} style={PREVIEW_ROOT_STYLE}>
      {children}
    </div>
  );
}
