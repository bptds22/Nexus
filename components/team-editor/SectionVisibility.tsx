"use client";

// components/team-editor/SectionVisibility.tsx
// Visibilité par section (camps / présentation / besoins / engagées) : switch
// dans le header + repli grisé quand la section est masquée. Même contrat que
// page-editor, branché sur le contexte équipe. La page publique SAUTE la
// section masquée — elle ne la grise pas.

import * as React from "react";
import { useTeamEditor } from "./teamEditorContext";

export function VisibilityToggle({ sectionKey, label = "Afficher sur ma page" }: { sectionKey: string; label?: string }) {
  const { hiddenSections, toggleSection } = useTeamEditor();
  const visible = !hiddenSections.includes(sectionKey);
  return (
    <button
      type="button"
      className={"vistoggle" + (visible ? " on" : "")}
      onClick={() => toggleSection(sectionKey)}
      title={visible ? "Masquer cette section sur la page publique" : "Afficher cette section sur la page publique"}
    >
      <span className="vt-track"><span className="vt-knob" /></span>
      <span className="vt-lab">{label}</span>
    </button>
  );
}

export function SectionHidden({ sectionKey }: { sectionKey: string }) {
  const { toggleSection } = useTeamEditor();
  return (
    <div className="sec-hidden">
      <span>🚫 Section <b>masquée</b> sur la page publique — rien à remplir ici.</span>
      <button type="button" className="btn ghost" onClick={() => toggleSection(sectionKey)}>Réactiver</button>
    </div>
  );
}
