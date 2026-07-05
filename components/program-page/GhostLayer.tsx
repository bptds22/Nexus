// components/program-page/GhostLayer.tsx
//
// Layer 0 of each section — the wall's vocabulary ghosted behind the content
// (z-index:0; all section content is z-index:2). Positions / sizes / angles /
// opacities are copied EXACTLY from page-niveau1-web-v8.html, per section.
//
// v8.3 rule: masked motifs (.gm-fleur/.gm-maple/.gm-nx) are painted in --red so
// they recolor per school (green for Momo); word / italic / marker / chalk /
// RSEQ ghosts are cold Nexus neutral (rgba(237,239,243,…)) — colours live in CSS.

import * as React from "react";

export type GhostSection =
  | "apercu"
  | "sports"
  | "apropos"
  | "campus"
  | "academique"
  | "parcours";

export default function GhostLayer({ section }: { section: GhostSection }) {
  switch (section) {
    case "apercu":
      return (
        <>
          <div className="gm gm-fleur" style={{ right: "3%", top: "6%", width: 300, height: 300, opacity: 0.05, transform: "rotate(-8deg)" }} />
          <div className="gwd" style={{ left: "1%", bottom: "24%", fontSize: 110, transform: "rotate(-2deg)" }}>ÉLITE</div>
        </>
      );
    case "sports":
      return (
        <>
          <div className="gwd" style={{ right: "2%", top: "5%", fontSize: 120, transform: "rotate(-2deg)" }}>ON MONTE</div>
          <svg className="gchalk" style={{ left: -14, bottom: 30, width: 260 }} viewBox="0 0 260 180" fill="none" stroke="currentColor" strokeWidth="4">
            <path d="M30 30l26 26M56 30L30 56" /><circle cx="150" cy="46" r="17" />
            <path d="M46 100c46 34 106 6 168 52" strokeDasharray="8 10" /><path d="M204 142l24 12-6-26" />
          </svg>
        </>
      );
    case "apropos":
      return (
        <>
          <div className="gm gm-maple" style={{ left: "4%", bottom: "10%", width: 150, height: 150, opacity: 0.04, transform: "rotate(10deg)" }} />
          <div className="gwi" style={{ right: "8%", bottom: "14%", fontSize: 56, transform: "rotate(-5deg)" }}>Fierté</div>
          <svg className="spine" style={{ right: 0, top: 50, width: 320 }} viewBox="0 0 320 240" fill="none" stroke="currentColor" strokeWidth="3">
            <circle cx="270" cy="40" r="13" /><path d="M270 56v66c0 28-66 24-104 62" strokeDasharray="8 10" />
            <path d="M172 172l-22 12 4-24" /><path d="M60 200l16 16M76 200l-16 16" />
          </svg>
        </>
      );
    case "campus":
      return (
        <>
          <div className="gwi" style={{ right: "4%", top: "9%", fontSize: 64, transform: "rotate(-4deg)" }}>Québec</div>
          <div className="gm gm-fleur" style={{ left: "2%", top: "14%", width: 130, height: 130, opacity: 0.045, transform: "rotate(7deg)" }} />
        </>
      );
    case "academique":
      return (
        <>
          <div className="gwd" style={{ left: "1%", top: "6%", fontSize: 110, transform: "rotate(-2deg)" }}>CANADA</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="grseq" style={{ right: "5%", bottom: "8%", width: 170, transform: "rotate(6deg)" }} src="/logos/rseq.png" alt="" />
        </>
      );
    case "parcours":
      return (
        <>
          <div className="gm gm-nx" style={{ right: "2%", top: "8%", width: 330, height: 330, opacity: 0.045, transform: "rotate(-7deg)" }} />
          <div className="gmk" style={{ left: "6%", bottom: "8%", fontSize: 44, transform: "rotate(-3deg)" }}>D&apos;ici ➔ pour ici</div>
          <div className="gwd" style={{ left: "38%", top: "4%", fontSize: 90, transform: "rotate(-2deg)" }}>QUÉBEC</div>
        </>
      );
  }
}
