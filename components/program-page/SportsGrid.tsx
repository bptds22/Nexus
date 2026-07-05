// components/program-page/SportsGrid.tsx
// S2 — SPORTS : clickable cards → Niveau-2 team route (mock href). Icons are the
// exact reference SVGs, keyed by sport slug.

import * as React from "react";
import GhostLayer from "./GhostLayer";
import type { SportCard } from "./content";

const SPORT_ICONS: Record<SportCard["slug"], React.ReactNode> = {
  football: (
    <svg className="si" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><ellipse cx="12" cy="12" rx="9.5" ry="6" transform="rotate(-35 12 12)" /><path d="M8.5 14.5l7-5M10.2 15.5l1-.8M11.8 16.6l1-.8M9 12.7l1-.8M10.6 13.8l1-.8" /></svg>
  ),
  basketball: (
    <svg className="si" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3v18M5.5 5.5c4 3.5 9 3.5 13 0M5.5 18.5c4-3.5 9-3.5 13 0" /></svg>
  ),
  soccer: (
    <svg className="si" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="12" cy="12" r="9" /><path d="M12 7l4 3-1.5 5h-5L8 10z" fill="currentColor" fillOpacity=".5" /><path d="M12 3v4M4 9l4 1M20 9l-4 1M6.5 19l3-4M17.5 19l-3-4" /></svg>
  ),
  volleyball: (
    <svg className="si" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="12" cy="12" r="9" /><path d="M12 3c1 4-1 8-6 10M12 3c5 1 8 5 8 9M4 14c4 3 10 3 15-2" /></svg>
  ),
  flag: (
    <svg className="si" viewBox="0 0 24 24" fill="currentColor"><path d="M5 3a1 1 0 0 1 1 1v16a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1Zm2 1 13 3-13 3V4Z" /></svg>
  ),
  cross: (
    <svg className="si" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="15" cy="5" r="2" /><path d="M14 8l-4 3 2 3-3 5M10 11l-3-1M12 14l4 1 1 5" /></svg>
  ),
  badminton: (
    <svg className="si" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><circle cx="8" cy="16" r="2.5" /><path d="M10 14L19 5M15 4l5 5M16.5 2.5l5 5" strokeLinecap="round" /></svg>
  ),
  cheer: (
    <svg className="si" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M4 11l12-6 2 9-12 4z" fill="currentColor" fillOpacity=".35" /><path d="M18 5l3-2M19 9h3M6 18l-1 4" /></svg>
  ),
  hockey: (
    <svg className="si" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M5 3l6 13c.6 1.3 0 3-2 3H6M19 3l-6 13" /><ellipse cx="16" cy="19.5" rx="3" ry="1.4" fill="currentColor" fillOpacity=".5" /></svg>
  ),
  natation: (
    <svg className="si" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="16" cy="7" r="2" /><path d="M4 13l5-4 4 3 3-2M2 18c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0" /></svg>
  ),
};

export default function SportsGrid({ sports }: { sports: SportCard[] }) {
  return (
    <section id="sports">
      <GhostLayer section="sports" />
      <div className="sec-in">
        <div className="kick">NOS ÉQUIPES</div>
        <h2 className="sec-h">Choisis ton sport</h2>
        <div className="pbar" />
        <div className="sports">
          {sports.map((s) => (
            <a key={s.slug} className="scard rvy" href={s.href}>
              {SPORT_ICONS[s.slug]}
              <span className="go">→</span>
              <div className="sn">{s.name}</div>
              <div className="sd">{s.desc}</div>
              <div className="sb">
                {s.badges.map((b, i) => (
                  <span key={i} className={`bdg ${b.kind === "rec" ? "b-rec" : "b-d1"}`}>{b.label}</span>
                ))}
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
