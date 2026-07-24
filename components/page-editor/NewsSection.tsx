"use client";

// components/page-editor/NewsSection.tsx — S7 « Actualités » (MANUEL)
// Inputs à gauche ; preview = le VRAI NewsSection (0 news → section nulle).

import * as React from "react";
import RealNewsSection from "@/components/program-page/NewsSection";
import PreviewShell, { useDebounced } from "./PreviewShell";
import { newsItems } from "./pageBridge";
import { GRASSET } from "./fixture";
import { useToast } from "./toast";

interface News { t: string; u: string }

export default function NewsSection() {
  const toast = useToast();
  const [news, setNews] = React.useState<News[]>(GRASSET.news.map((n) => ({ ...n })));

  const addNews = () => {
    if (news.length >= 5) { toast("Maximum 5 nouvelles"); return; }
    setNews((n) => [...n, { t: "", u: "" }]);
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
      <div className="sech"><span className="num">7</span><h2>Actualités</h2><span className="tag man">MANUEL</span></div>
      <div className="cols">
        <div className="panel">
          <div className="pt"><span className="n">1</span>TES NOUVELLES — TITRE + LIEN (max 5)</div>
          <div>
            {news.map((n, i) => (
              <div className="nrow" key={i}>
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
    </section>
  );
}
