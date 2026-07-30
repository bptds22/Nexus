"use client";

// components/program-page/SportsGrid.tsx
// S2 — SPORTS « L'affiche » : liste éditoriale de rangées, AUCUNE icône.
// Chaque rangée = nom (Anton) + pills dérivés de equipes[] (divisions / genre /
// nb). SINGLE (1 équipe) → clic = route directe (chevron →). MULTI (2+) → clic =
// tiroir .teams de chips (chevron ›, rotate à l'ouverture). 0 sport → section
// #sports absente.

import * as React from "react";
import { useRouter } from "next/navigation";
import GhostLayer from "./GhostLayer";
import type { Sport, SportTeam } from "./content";

const DIV_ORDER = ["D1", "D2", "D3"];

/** Union triée des divisions (D1<D2<D3) ; null/absent → ignoré (pas de pill). */
function divisionsOf(equipes: SportTeam[]): string[] {
  const set = new Set(equipes.map((t) => t.division).filter(Boolean) as string[]);
  return [...set].sort((a, b) => {
    const ia = DIV_ORDER.indexOf(a), ib = DIV_ORDER.indexOf(b);
    return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
  });
}

/** Genre agrégé (pill rangée) : Masculin / Féminin / Mixte / « M & F ». */
function genreAgg(equipes: SportTeam[]): string {
  let hasM = false, hasF = false, mixteOnly = true;
  for (const t of equipes) {
    if (t.genre === "Mixte") continue; // mixte n'ajoute ni M ni F
    mixteOnly = false;
    if (t.genre === "M" || t.genre === "M&F") hasM = true;
    if (t.genre === "F" || t.genre === "M&F") hasF = true;
  }
  if (mixteOnly) return "Mixte";
  if (hasM && hasF) return "M & F";
  if (hasM) return "Masculin";
  if (hasF) return "Féminin";
  return "Mixte";
}

export default function SportsGrid({ sports }: { sports: Sport[] }) {
  const [open, setOpen] = React.useState<Set<number>>(new Set());
  const router = useRouter();

  if (!sports || sports.length === 0) return null; // 0 sport → pas de section

  const toggle = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });

  // Route page équipe. Une équipe sans route (chaîne vide) n'est pas cliquable :
  // le clic ne fait rien plutôt que d'emmener l'athlète sur une page fausse.
  const goTeam = (url: string) => { if (url) router.push(url); };

  return (
    <section id="sports">
      <GhostLayer section="sports" />
      <div className="sec-in">
        <div className="kick">NOS ÉQUIPES</div>
        <h2 className="sec-h">Choisis ton sport</h2>
        <div className="pbar" />
        <div className="aList rv">
          {sports.map((s, i) => {
            const single = s.equipes.length === 1;
            const divs = divisionsOf(s.equipes);
            const gen = genreAgg(s.equipes);
            const cnt = s.equipes.length;
            const isOpen = open.has(i);
            return (
              <div
                key={i}
                className={`aRow ${single ? "single" : "multi"}${isOpen ? " open" : ""}`}
                onClick={single ? () => goTeam(s.equipes[0].url) : () => toggle(i)}
              >
                <div className="aTop">
                  <div className="aName">{s.nom}</div>
                  <div className="aPills">
                    {divs.map((d) => (
                      <span key={d} className={`pill ${d === "D1" ? "div1" : "div"}`}>{d}</span>
                    ))}
                    <span className="pill gen">{gen}</span>
                    <span className="pill cnt">{cnt} équipe{cnt > 1 ? "s" : ""}</span>
                  </div>
                  <span className="aChev">{single ? "→" : "›"}</span>
                </div>

                {!single && (
                  <div className={`teams${isOpen ? " open" : ""}`}>
                    {s.equipes.map((t, j) => (
                      <div
                        key={j}
                        className="tchip"
                        onClick={(e) => { e.stopPropagation(); goTeam(t.url); }}
                      >
                        {t.nom} <small>{[t.division, t.genre].filter(Boolean).join(" · ")}</small>
                        <span className="ar">→</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
