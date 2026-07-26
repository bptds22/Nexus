// components/program-page/ParcoursRoute.tsx
// S6 — TON PARCOURS : TOI → {initiales} → U.S. route + stats + universities +
// marker slogan, then the Nexus strip.

import * as React from "react";
import GhostLayer from "./GhostLayer";
import NexusStrip from "./NexusStrip";
import type { ProgramPageContent } from "./content";

export default function ParcoursRoute({
  schoolName,
  initials,
  slogan,
  route,
  universities,
  nexusStripText,
  nexusRecruitedCount,
}: {
  schoolName: string;
  initials: string;
  slogan: string | null;
  route: ProgramPageContent["route"];
  universities: string[];
  nexusStripText: string;
  nexusRecruitedCount: number;
}) {
  const kick = schoolName.slice(schoolName.split(" ")[0].length).trim().toUpperCase();
  // Slogan sans saut de ligne → sortie inchangée (non-régression /page-test
  // fixture byte-identique). Avec saut → 2 lignes via white-space:pre-line inline
  // (aucune modif de PP_CSS, aucun impact fixture).
  const sloganHasBreak = !!slogan && /\n/.test(slogan);
  const markerSlogan = slogan ? `« ${slogan.replace(/\n/g, " ")} »` : null;
  const markerSloganMulti = slogan ? `« ${slogan} »` : null;

  return (
    <section id="parcours">
      <GhostLayer section="parcours" />
      <div className="sec-in">
        <div className="kick">{kick}</div>
        <h2 className="sec-h">
          Ton <em>parcours</em>
        </h2>
        <div className="pbar" />
        <div className="route">
          <div className="stop rvy">
            <div className="dot">TOI</div>
            <div className="sl">{route.stop1.sl}</div>
            <h4>{route.stop1.h4}</h4>
            <p>{route.stop1.p}</p>
          </div>
          <div className="stop rvy">
            <div className="dot">{initials}</div>
            <div className="sl">{route.stop2.sl}</div>
            <h4>{route.stop2.h4}</h4>
            <p>{route.stop2.p}</p>
          </div>
          <div className="stop rvy">
            <div className="dot" style={{ fontSize: 14 }}>U.S.</div>
            <div className="sl">{route.stop3.sl}</div>
            <h4>{route.stop3.h4}</h4>
            {/* Stats = SAISIE MANUELLE (fixture — Bloc 2). Une valeur absente
                (count null/undefined) => item non rendu, jamais un 0. */}
            <div className="nums">
              {route.stop3.stats
                .filter((s) => s.count != null)
                .map((s, i) => (
                  <div key={i}>
                    <span data-count={s.count} data-suffix={s.suffix || undefined}>0</span>
                    <small>{s.label}</small>
                  </div>
                ))}
            </div>
            <div className="uni">
              {universities.map((u, i) => (
                <span className="uc" key={i}>{u}</span>
              ))}
            </div>
          </div>
          <svg className="fin" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6"><path d="M12 3v15M6 12l6 7 6-7" /></svg>
        </div>
        {markerSlogan && (sloganHasBreak
          ? <span className="mknote rv" style={{ whiteSpace: "pre-line" }}>{markerSloganMulti}</span>
          : <span className="mknote rv">{markerSlogan}</span>)}
        <NexusStrip text={nexusStripText} count={nexusRecruitedCount} />
      </div>
    </section>
  );
}
