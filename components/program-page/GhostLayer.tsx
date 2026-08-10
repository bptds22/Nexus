// components/program-page/GhostLayer.tsx
//
// Layer 0 of each section — the wall's vocabulary ghosted behind the content
// (z-index:0; all section content is z-index:2). Positions / sizes / angles /
// opacities are copied EXACTLY from page-niveau1-web-v8.html, per section.
//
// v8.3 rule: masked motifs (.gm-fleur/.gm-maple/.gm-nx) are painted in the page's
// brand colour so they recolor per school (green for Momo); word / italic /
// marker / chalk / RSEQ ghosts are cold Nexus neutral.
//
// This file is now COMPOSITION ONLY — the vocabulary itself (classes, fonts,
// strokes, the chalk assets) lives in components/shared/dna, the single source of
// truth shared with the team page. Sections here declare *what goes where*.

import * as React from "react";
import { GhostWords, PlaybookDecor, type GhostItem } from "@/components/shared/dna";

export type GhostSection =
  | "apercu"
  | "sports"
  | "apropos"
  | "campus"
  | "academique"
  | "parcours";

const COMPOSITIONS: Record<GhostSection, GhostItem[]> = {
  apercu: [
    { variant: "mark", mask: "fleur", right: "3%", top: "6%", size: 300, opacity: 0.05, rotate: -8 },
    { variant: "word", text: "ÉLITE", left: "1%", bottom: "24%", fontSize: 110, rotate: -2 },
  ],
  sports: [{ variant: "word", text: "ON MONTE", right: "2%", top: "5%", fontSize: 120, rotate: -2 }],
  apropos: [
    { variant: "mark", mask: "maple", left: "4%", bottom: "10%", size: 150, opacity: 0.04, rotate: 10 },
    { variant: "italic", text: "Fierté", right: "8%", bottom: "14%", fontSize: 56, rotate: -5 },
  ],
  campus: [
    { variant: "italic", text: "Québec", right: "4%", top: "9%", fontSize: 64, rotate: -4 },
    { variant: "mark", mask: "fleur", left: "2%", top: "14%", size: 130, opacity: 0.045, rotate: 7 },
  ],
  academique: [{ variant: "word", text: "CANADA", left: "1%", top: "6%", fontSize: 110, rotate: -2 }],
  parcours: [
    { variant: "mark", mask: "nx", right: "2%", top: "8%", size: 330, opacity: 0.045, rotate: -7 },
    { variant: "marker", text: "D’ici ➔ pour ici", left: "6%", bottom: "8%", fontSize: 44, rotate: -3 },
    { variant: "word", text: "QUÉBEC", left: "38%", top: "4%", fontSize: 90, rotate: -2 },
  ],
};

export default function GhostLayer({ section }: { section: GhostSection }) {
  return (
    <>
      <GhostWords items={COMPOSITIONS[section]} />
      {/* craie playbook — mêmes assets partagés, densités d'origine par section */}
      {section === "sports" && <PlaybookDecor preset="chalk" style={{ left: -14, bottom: 30, width: 260 }} />}
      {section === "apropos" && <PlaybookDecor preset="spine" style={{ right: 0, top: 50, width: 320 }} />}
      {section === "academique" && (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="grseq" style={{ right: "5%", bottom: "8%", width: 170, transform: "rotate(6deg)" }} src="/logos/rseq.png" alt="" />
      )}
    </>
  );
}
