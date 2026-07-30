"use client";

// components/team-editor/HeritageSection.tsx — S1 « Identité héritée » (AUTO)
// Une école = une marque. Rien n'est éditable ici : logo, surnom, couleurs et
// mots du mur viennent de « Ma page », le nom/division/genre de Mes équipes, et
// l'entraîneur-chef du staff de l'équipe. Le lien renvoie à la bonne source.

import * as React from "react";
import { useTeamEditor } from "./teamEditorContext";

export default function HeritageSection() {
  const { identity } = useTeamEditor();
  const chips = [
    identity.logoUrl ? "Logo école" : "Logo école — non déposé",
    `Surnom : ${identity.nickname.toUpperCase()}`,
    "Couleurs (3) + accent clair dérivé",
    `${identity.teamName} · ${identity.division || "—"} · ${identity.genre || "—"}`,
    identity.headCoachName ? `Entraîneur-chef : ${identity.headCoachName}` : "Entraîneur-chef — aucun au staff",
  ];

  return (
    <section className="sec">
      <div className="sech"><span className="num">1</span><h2>Identité — héritée de l&apos;école</h2><span className="tag auto">AUTO</span></div>
      <div className="cols">
        <div className="panel">
          <div className="pt">UNE IDENTITÉ, TOUTES TES ÉQUIPES</div>
          <div className="auto">
            {chips.map((c) => <span key={c} className="achip"><b>✓</b>{c}</span>)}
          </div>
          <a className="autolink" href="/editeur-test" target="_blank" rel="noopener noreferrer">
            Modifier l&apos;identité dans « Ma page » →
          </a>
          <div className="note">
            La 4<sup>e</sup> teinte (accent clair) est <b>calculée</b> depuis la Principale — rien à configurer.
          </div>
        </div>
        <div className="pv"><div className="panel">
          <div className="pvhead">POURQUOI</div>
          <div className="empty">
            Une école = une marque. Toutes les pages équipes partagent le mur, le logo et les couleurs —
            zéro config en double, impossible d&apos;être incohérent.
          </div>
        </div></div>
      </div>
    </section>
  );
}
