// components/program-page/StatRows.tsx
// S1 — APERÇU header + Suivre/preuve-sociale (→ mes cibles) + 3 type-block rows
// (v8.2: no D1 row — teams / athletes / city·region). D1 lives on sport cards.
// The follow button shares ProgramPage's single targets state (= CTA cibleBtn):
// toggling one reflects the other. Vues / likes-count = mock (DB binding = Bloc 2).

import * as React from "react";
import { Heart, Eye, Check } from "lucide-react";
import GhostLayer from "./GhostLayer";
import type { ProgramPageContent } from "./content";

export default function StatRows({
  schoolName,
  city,
  stats,
  inTargets,
  onToggleTargets,
  followers = 86,
}: {
  schoolName: string;
  city: string;
  stats: ProgramPageContent["stats"];
  inTargets: boolean;
  onToggleTargets: () => void;
  /** nb d'athlètes ciblant ce collège (count_followers_by_school). Défaut 86 =
   *  valeur historique du fixture dev (préserve la non-régression /page-test). */
  followers?: number;
}) {
  const first = schoolName.split(" ")[0];
  const body = schoolName.slice(first.length).trim();
  return (
    <section id="apercu" style={{ paddingBottom: 0 }}>
      <GhostLayer section="apercu" />
      <div className="sec-in">
        <div className="hd-top">
          <div className="bigid">
            <div className="l1x rvy">{first}</div>
            <div className="l2x rvy">{body}</div>
            <div className="pbar" />
          </div>

          {/* Suivre + preuve sociale — moment plateforme (rouge Nexus).
              1 240 vues / 86 athlètes = mock ; binding DB en Bloc 2. */}
          <div className="hfollow rv">
            <div className="hf-stats">
              <span className="hf-chip">
                <Eye className="ic eye" size={14} strokeWidth={2} aria-hidden />1 240<span className="u">vues</span>
              </span>
            </div>
            <button
              type="button"
              className={inTargets ? "hf-btn on" : "hf-btn"}
              onClick={onToggleTargets}
            >
              {inTargets ? (
                <Check className="p" size={16} strokeWidth={3} aria-hidden />
              ) : (
                <Heart className="p" size={16} fill="currentColor" aria-hidden />
              )}
              <span className="t">{inTargets ? "Dans tes cibles" : "Rajouter dans mes cibles"}</span>
            </button>
            <div className="hf-note"><b>{`${followers} athlètes`}</b> suivent ce collège</div>
          </div>
        </div>
      </div>
      <div className="tstack">
        <div className="trow tr-ink rv">
          <span className="big" data-count={stats.teams}>0</span>
          <span className="lab">{stats.teamsLabel}</span>
        </div>
        <div className="trow tr-red rv">
          <span className="big" data-count={stats.athletes} data-suffix="+">0</span>
          <span className="lab">{stats.athletesLabel}</span>
          <span className="man">saisie collège</span>
        </div>
        <div className="trow tr-cream rv">
          <span className="big" style={{ fontSize: "clamp(38px,4.6vw,64px)" }}>{city.toUpperCase()}</span>
          <span className="lab">{stats.region}</span>
        </div>
      </div>
    </section>
  );
}
