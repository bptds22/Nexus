"use client";

// components/page-editor/SectionVisibility.tsx
// Visibilité par section (Round 3 #3) : un switch dans le header de section
// (« Afficher sur ma page ») + un état de repli grisé quand la section est
// masquée. Piloté par le contexte éditeur (hiddenSections / toggleSection).

import * as React from "react";
import { useEditor } from "./editorContext";

/** Switch à poser dans le `.sech` de la section (à côté du titre). */
export function VisibilityToggle({ sectionKey }: { sectionKey: string }) {
  const { hiddenSections, toggleSection } = useEditor();
  const visible = !hiddenSections.includes(sectionKey);
  return (
    <button
      type="button"
      className={"vistoggle" + (visible ? " on" : "")}
      onClick={() => toggleSection(sectionKey)}
      title={visible ? "Masquer cette section sur ta page publique" : "Afficher cette section sur ta page publique"}
    >
      <span className="vt-track"><span className="vt-knob" /></span>
      <span className="vt-lab">Afficher sur ma page</span>
    </button>
  );
}

/** Corps de repli quand la section est masquée — rien à remplir, c'est clair. */
export function SectionHidden({ sectionKey }: { sectionKey: string }) {
  const { toggleSection } = useEditor();
  return (
    <div className="sec-hidden">
      <span>🚫 Section <b>masquée</b> sur ta page publique — rien à remplir ici.</span>
      <button type="button" className="btn ghost" onClick={() => toggleSection(sectionKey)}>Réactiver</button>
    </div>
  );
}
