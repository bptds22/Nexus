"use client";

// components/program-page/AcademicPlanche.tsx
// S5 — ACADÉMIQUE : "EN VEDETTE" board + live program search (React state +
// case-insensitive filter + empty state).

import * as React from "react";
import GhostLayer from "./GhostLayer";
import type { ProgramPageContent } from "./content";

export default function AcademicPlanche({
  featured,
  programs,
}: {
  featured: ProgramPageContent["featuredPrograms"];
  programs: string[];
}) {
  const [q, setQ] = React.useState("");
  const query = q.trim().toLowerCase();
  const shown = programs.filter((p) => p.toLowerCase().includes(query));

  return (
    <section id="academique">
      <GhostLayer section="academique" />
      <div className="sec-in">
        <div className="kick">LES ÉTUDES</div>
        <h2 className="sec-h">Le diplôme d&apos;abord</h2>
        <div className="pbar" />
        <div className="planche rv">
          <svg className="xo" style={{ color: "#EDEFF3" }} viewBox="0 0 120 100" fill="none" stroke="currentColor" strokeWidth="4"><path d="M20 20l20 20M40 20L20 40" /><circle cx="85" cy="30" r="12" /><path d="M30 70c20-16 40 4 60-14" strokeDasharray="6 8" /></svg>
          <span className="vedette">✦ EN VEDETTE</span>
          <div className="prim">
            {featured.map((f, i) => (
              <div className="pr" key={i}>
                <span className="no">{String(i + 1).padStart(2, "0")}</span>
                <div><b>{f.title}</b><span>{f.blurb}</span></div>
              </div>
            ))}
          </div>
          <hr className="chalkline" />
          <div className="pl-t">TOUS LES PROGRAMMES</div>
          <input
            className="psearch"
            type="text"
            placeholder="🔍 Cherche ton programme… (ex. sciences, soins, informatique)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="progs">
            {shown.map((p, i) => (
              <span className="prog" key={i}><i>●</i>{p}</span>
            ))}
            {shown.length === 0 && (
              <span className="prog empty" style={{ color: "#8A909C", background: "transparent" }}>
                Aucun programme trouvé — contacte le collège !
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
