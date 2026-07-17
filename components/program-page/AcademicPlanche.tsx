"use client";

// components/program-page/AcademicPlanche.tsx
// S5 — LE DIPLÔME D'ABORD. Perfect-match board (piloted by the connected
// athlete's aimed program = viewerProgrammeVise; resemblance match, not strict
// equality) + live program search. Replaces the old "EN VEDETTE" ribbon + .prim
// hardcoded featured block. No programmeVise → board hidden, only the program
// list shows (never a broken empty board).

import * as React from "react";
import GhostLayer from "./GhostLayer";
import { PlaybookDecor } from "@/components/shared/dna";
import { matchPrograms, norm } from "./matchPrograms";

export default function AcademicPlanche({
  programs,
  viewerProgrammeVise,
  schoolName,
}: {
  programs: string[];
  viewerProgrammeVise?: string;
  schoolName: string;
}) {
  const [q, setQ] = React.useState("");
  // Recherche accent-insensible : « policieres » matche « policières », « genie » → « génie ».
  const nq = norm(q);
  const shown = programs.filter((p) => norm(p).includes(nq));

  const vise = viewerProgrammeVise?.trim();
  const match = vise ? matchPrograms(vise, programs) : null;
  const hasBoard = !!vise; // athlete connecté + programme visé → board affiché
  const hasMatches = !!match && (match.exact !== null || match.similaires.length > 0);

  return (
    <section id="academique">
      <GhostLayer section="academique" />
      <div className="sec-in">
        <div className="kick">LES ÉTUDES</div>
        <h2 className="sec-h">Le diplôme d&apos;abord</h2>
        <div className="pbar" />
        <div className="planche rv">
          <PlaybookDecor preset="xo" />

          {/* Perfect match — masqué si pas de programme visé (jamais un board vide) */}
          {hasBoard && (
            <>
              <div className="match-head">
                <span className="mh-kick">TON PROFIL VISE</span>
                <span className="mh-prog">{vise}</span>
                <span className="mh-tag">depuis ton profil</span>
              </div>

              {hasMatches ? (
                <div className="matches">
                  {match!.exact && (
                    <div className="mcard exact">
                      <span className="mbadge exact">✓ Correspond à ta recherche</span>
                      <b>{match!.exact}</b>
                      <span className="d">Offert ici — correspond à ton profil visé.</span>
                    </div>
                  )}
                  {match!.similaires.map((p) => (
                    <div className="mcard" key={p}>
                      <span className="mbadge sim">Programme similaire</span>
                      <b>{p}</b>
                      <span className="d">Programme apparenté offert ici.</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="match-empty">
                  <p>
                    Aucun programme comme <b>« {vise} »</b> n&apos;est offert au {schoolName} pour
                    l&apos;instant. Contacte le collège pour explorer des programmes similaires qui
                    pourraient t&apos;intéresser.
                  </p>
                  <button type="button" className="me-cta">Contacter le collège →</button>
                </div>
              )}

              <hr className="chalkline" />
            </>
          )}

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
