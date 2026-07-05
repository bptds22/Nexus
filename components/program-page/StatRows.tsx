// components/program-page/StatRows.tsx
// S1 — APERÇU header + 3 type-block rows (v8.2: no D1 row — teams / athletes /
// city·region). D1 now lives on the sport cards.

import * as React from "react";
import GhostLayer from "./GhostLayer";
import type { ProgramPageContent } from "./content";

export default function StatRows({
  schoolName,
  city,
  stats,
}: {
  schoolName: string;
  city: string;
  stats: ProgramPageContent["stats"];
}) {
  const first = schoolName.split(" ")[0];
  const body = schoolName.slice(first.length).trim();
  return (
    <section id="apercu" style={{ paddingBottom: 0 }}>
      <GhostLayer section="apercu" />
      <div className="sec-in bigid">
        <div className="l1x rvy">{first}</div>
        <div className="l2x rvy">{body}</div>
        <div className="pbar" />
      </div>
      <div className="tstack">
        <div className="trow tr-ink rv">
          <span className="big" data-count={stats.teams}>0</span>
          <span className="lab">{stats.teamsLabel}</span>
        </div>
        <div className="trow tr-red rv">
          <span className="big" data-count={stats.athletes} data-suffix="+">0</span>
          <span className="lab">{stats.athletesLabel}</span>
        </div>
        <div className="trow tr-cream rv">
          <span className="big" style={{ fontSize: "clamp(38px,4.6vw,64px)" }}>{city.toUpperCase()}</span>
          <span className="lab">{stats.region}</span>
        </div>
      </div>
    </section>
  );
}
