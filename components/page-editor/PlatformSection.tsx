"use client";

// components/page-editor/PlatformSection.tsx — S8 « Généré par Nexus » (PLATEFORME)
// Éléments runtime appartenant à la plateforme — statique, rien à éditer.

import * as React from "react";
import { PLATFORM } from "./fixture";

export default function PlatformSection() {
  return (
    <section className="sec">
      <div className="sech"><span className="num">8</span><h2>Généré par Nexus</h2><span className="tag auto">PLATEFORME</span></div>
      <div className="panel">
        <div className="pfgrid">
          {PLATFORM.map((p, i) => (
            <span className="pfchip" key={i}>{p.ic} <b>{p.b}</b> — {p.t}</span>
          ))}
        </div>
        <div className="note">Ces éléments vivent sur ta page mais appartiennent à la plateforme — ils se mettent à jour tout seuls, et c'est ce qui rend ta page crédible.</div>
      </div>
    </section>
  );
}
