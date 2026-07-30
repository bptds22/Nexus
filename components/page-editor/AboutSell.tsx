"use client";

// components/page-editor/AboutSell.tsx — S4 « À propos » (MANUEL)
// Inputs à gauche ; preview = le VRAI composant program-page AboutSell.

import * as React from "react";
import RealAboutSell from "@/components/program-page/AboutSell";
import PreviewShell, { useDebounced } from "./PreviewShell";
import { useEditor } from "./editorContext";
import { VisibilityToggle, SectionHidden } from "./SectionVisibility";

export default function AboutSell() {
  const { initial, report, hiddenSections } = useEditor();
  const hidden = hiddenSections.includes("about");
  const [abt, setAbt] = React.useState(initial.about_title);
  const [abx, setAbx] = React.useState(initial.sell_text);
  React.useEffect(() => { report("content.about", { about_title: abt, sell_text: abx }); }, [abt, abx, report]);
  const debAbt = useDebounced(abt);
  const debAbx = useDebounced(abx);
  const preview = React.useMemo(
    () => <RealAboutSell title={debAbt || "—"} sellText={debAbx} />,
    [debAbt, debAbx],
  );

  return (
    <section className="sec">
      <div className="sech"><span className="num">4</span><h2>À propos</h2><span className="tag man">MANUEL</span><VisibilityToggle sectionKey="about" /></div>
      {hidden ? <SectionHidden sectionKey="about" /> : (
      <div className="cols">
        <div className="panel">
          <div className="pt"><span className="n">1</span>LE TEXTE VENDEUR — 2 CHAMPS (modérés)</div>
          <label className="fl">Titre</label>
          <input className="ti" maxLength={40} value={abt} onChange={(e) => setAbt(e.target.value)} />
          <label className="fl">Texte (≤ 280)</label>
          <textarea className="ti" maxLength={280} value={abx} onChange={(e) => setAbx(e.target.value)} />
          <div className="cnt">{abx.length}/280</div>
          <div className="mod">⚠ File de modération Nexus avant publication.</div>
        </div>
        <div className="pv">
          <div className="pvhead">APERÇU LIVE — RENDU RÉEL</div>
          <PreviewShell>{preview}</PreviewShell>
        </div>
      </div>
      )}
    </section>
  );
}
