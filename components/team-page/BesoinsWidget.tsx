"use client";

// components/team-page/BesoinsWidget.tsx
// v2.2 — mots du mur (fantômes, même vocabulaire que la page école) derrière le
// terrain. UNE box unique double-état (match / sans match) remplace la rangée de
// cards. Bouton cibles de la box = MÊME state que le hero (remonté dans TeamPage).
// Plaques + toggle plus gros. Moteur/mapping inchangés.

import * as React from "react";
import { Heart } from "lucide-react";
import { GhostWords, PlaybookDecor, wallWordGhosts } from "@/components/shared/dna";
import TerrainStage from "./TerrainStage";
import {
  SPORT_CONFIGS, deriveFacette, countNoYear, matchState,
  type TeamData, type SportConfig,
} from "./content";

export default function BesoinsWidget({
  team, cible, onToggleCible,
}: {
  team: TeamData;
  cible: boolean;
  onToggleCible: () => void;
}) {
  const cfg: SportConfig = SPORT_CONFIGS[team.sportKey];
  const hasToggle = cfg.facettes.length > 1;
  const [fi, setFi] = React.useState(0);
  const facette = cfg.facettes[fi];

  const { plaques } = deriveFacette(team.roster, facette.groups, team.season);
  const noYear = countNoYear(team.roster);
  const ms = matchState(team, team.season);
  const nextYear = team.season + 1;

  return (
    <section className="widget rv">
      {/* mots du mur — ADN partagé, mêmes densités que la page école (§C5) */}
      <GhostWords items={wallWordGhosts(team.wallWords)} wrapped />
      {/* craie playbook — MÊMES assets que la page école, zéro redessin */}
      <PlaybookDecor preset="chalk" style={{ left: -14, bottom: 30, width: 260 }} />

      {/* .sec-in = le contenant 1180px de la page école (parité de rythme) */}
      <div className="sec-in">
      <div className="top">
        <div>
          <div className="kick">RECRUTEMENT · RENTRÉE {nextYear}</div>
          <div className="h2">On cherche <em>du monde</em></div>
          <div className="pbar" />
        </div>
        {(team.commits ?? []).some((c) => c.visiblePublic) ? (
          <button
            type="button"
            className="commit commit-link"
            onClick={() => document.getElementById("deja-engagees")?.scrollIntoView({ behavior: "smooth", block: "start" })}
          >
            ✓ {team.engagesCount} recrue{team.engagesCount > 1 ? "s" : ""} déjà engagée{team.engagesCount > 1 ? "s" : ""}
          </button>
        ) : (
          <div className="commit">
            ✓ {team.engagesCount} recrue{team.engagesCount > 1 ? "s" : ""} déjà engagée{team.engagesCount > 1 ? "s" : ""}
          </div>
        )}
      </div>

      {hasToggle && (
        <div className="toggle">
          {cfg.facettes.map((f, i) => (
            <button key={f.key} type="button" className={i === fi ? "on" : ""} onClick={() => setFi(i)}>
              {f.label}
            </button>
          ))}
        </div>
      )}

      <TerrainStage asset={cfg.asset} perspective={cfg.perspective} court={cfg.court} sportKey={team.sportKey} plaques={plaques} />

      {/* warning « sans année » — petit texte discret sous le terrain (§A1) */}
      {noYear > 0 && (
        <div className="noyear">
          {noYear} joueur{noYear > 1 ? "s" : ""} sans année de fin — à compléter dans l&apos;éditeur.
        </div>
      )}

      {/* Box UNIQUE (§A2) — double état, absente si non connecté / autre sport */}
      {ms?.kind === "match" && (
        <div className="needbox match">
          <div className="nb-l"><b>✓ Match parfait</b> — {ms.posLabel} est un besoin ici.</div>
          <div className="nb-s">
            {ms.departures} des {ms.effectif} {ms.posLabelPlural} graduent l&apos;an prochain.
          </div>
        </div>
      )}
      {ms?.kind === "none" && (
        <div className="needbox none">
          <div className="nb-l">
            Pas d&apos;ouverture à ton poste pour l&apos;instant — mais montre ton intérêt :
            les coachs voient qui les suit.
          </div>
          <button type="button" className={`cibles sm${cible ? " on" : ""}`} onClick={onToggleCible}>
            <Heart size={15} fill="currentColor" aria-hidden />
            {cible ? "Dans tes cibles" : "Rajouter à mes cibles"}
          </button>
        </div>
      )}
      </div>
    </section>
  );
}
