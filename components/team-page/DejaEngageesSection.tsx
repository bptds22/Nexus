"use client";

// components/team-page/DejaEngageesSection.tsx
// Section « Déjà engagées » (sous le widget besoins). Rangées sobres (style staff
// — séparateurs fins, pas de cards) : une par recrue engagée. Étoiles = composant
// plateforme StarRating (or #F59E0B), pas réinventé. R2 : AUCUNE photo (noms de
// mineurs) ; seul c.visiblePublic (consentement, câblage Bloc 2) est affiché.
// Accord au genre de l'équipe. 0 recrue visible → section absente. MOCK.

import * as React from "react";
import StarRating from "@/components/ui/StarRating";
import type { TeamData } from "./content";

export default function DejaEngageesSection({ team }: { team: TeamData }) {
  const commits = (team.commits ?? []).filter((c) => c.visiblePublic); // R2 : consentement
  if (commits.length === 0) return null;
  const feminin = team.genre === "Féminin";

  return (
    <section id="deja-engagees" className="engaged rv">
      {/* .sec-in = le contenant 1180px de la page école (parité de rythme) */}
      <div className="sec-in">
        <div className="p-head">
          <div className="kick">RENTRÉE {team.season + 1}</div>
          <div className="h2">{feminin ? "Elles" : "Ils"} ont déjà dit <em>oui</em></div>
          <div className="pbar" />
        </div>

        <div className="sList eList">
          {commits.map((c, i) => (
            <div key={i} className="sRow eRow">
              <div className="e-id">
                <span className="sName">{c.prenom} {c.nom}</span>
                <span className="e-school">{c.ecoleProvenance}</span>
              </div>
              <div className="e-meta">
                <span className="e-promo">Promotion {c.promo}</span>
                <StarRating rating={c.etoiles} size="sm" showNumber={false} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
