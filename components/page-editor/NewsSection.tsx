"use client";

// components/page-editor/NewsSection.tsx — S7 « Actualités » (MANUEL)
// Inputs à gauche ; preview = le VRAI NewsSection (0 news → section nulle).

import * as React from "react";
import RealNewsSection from "@/components/program-page/NewsSection";
import PreviewShell, { useDebounced } from "./PreviewShell";
import { newsItems } from "./pageBridge";
import { useEditor } from "./editorContext";
import { MAX_SCHOOL_NEWS } from "@/lib/queries/schoolPage/schoolPageData";
import { VisibilityToggle, SectionHidden } from "./SectionVisibility";
import { useToast } from "./toast";

interface News { uid: string; t: string; u: string }
const newUid = () => Math.random().toString(36).slice(2);

export default function NewsSection() {
  const toast = useToast();
  const { initial, report, hiddenSections } = useEditor();
  const hidden = hiddenSections.includes("news");
  const [news, setNews] = React.useState<News[]>(initial.news.map((n) => ({ ...n, uid: newUid() })));
  React.useEffect(() => {
    report("news", news.map((n) => ({ titre: n.t, url: n.u })));
  }, [news, report]);

  const addNews = () => {
    if (news.length >= MAX_SCHOOL_NEWS) { toast(`Maximum ${MAX_SCHOOL_NEWS} nouvelles`); return; }
    setNews((n) => [...n, { uid: newUid(), t: "", u: "" }]);
  };

  const items = newsItems(news);
  const key = JSON.stringify(items);
  const debKey = useDebounced(key);
  const preview = React.useMemo(
    () => <RealNewsSection news={JSON.parse(debKey)} />,
    [debKey],
  );
  const hasNews = items.length > 0;

  return (
    <section className="sec">
      <div className="sech"><span className="num">7</span><h2>Actualités</h2><span className="tag man">MANUEL</span><VisibilityToggle sectionKey="news" /></div>
      {hidden ? <SectionHidden sectionKey="news" /> : (
      <div className="cols">
        <div className="panel">
          <div className="pt"><span className="n">1</span>TES NOUVELLES — TITRE + LIEN (max {MAX_SCHOOL_NEWS})</div>
          <div>
            {news.map((n, i) => (
              <div className="nrow" key={n.uid}>
                <input className="ti" maxLength={80} placeholder="Titre" value={n.t} onChange={(e) => setNews((s) => s.map((x, k) => (k === i ? { ...x, t: e.target.value } : x)))} />
                <input className="ti" placeholder="Lien https://…" value={n.u} onChange={(e) => setNews((s) => s.map((x, k) => (k === i ? { ...x, u: e.target.value } : x)))} />
                <button className="xbtn" onClick={() => setNews((s) => s.filter((_, k) => k !== i))}>✕</button>
              </div>
            ))}
          </div>
          <button className="addbtn" onClick={addNews}>+ Ajouter une nouvelle</button>
          <div className="note">La source (domaine) est dérivée du lien automatiquement.</div>
        </div>
        <div className="pv">
          <div className="pvhead">APERÇU LIVE — RENDU RÉEL</div>
          {hasNews
            ? <PreviewShell>{preview}</PreviewShell>
            : <div className="empty">0 nouvelle → la section n'apparaît pas sur la page (comportement réel). Ajoute un titre pour la voir.</div>}
        </div>
      </div>
      )}
    </section>
  );
}
