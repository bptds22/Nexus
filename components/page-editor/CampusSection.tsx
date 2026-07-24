"use client";

// components/page-editor/CampusSection.tsx — S3 « Campus » v3 (MANUEL)
// Inputs à gauche (cartes + suggestions ; hébergement = une suggestion-carte,
// plus de panneau dédié). Preview = le VRAI CampusSection (fiche + map +
// carousel). Fiche/adresse/map = fixture.

import * as React from "react";
import RealCampusSection from "@/components/program-page/CampusSection";
import PreviewShell, { useDebounced } from "./PreviewShell";
import { campusContent } from "./pageBridge";
import { SUGG, FICHE, ADDRESS, GRASSET } from "./fixture";
import { useToast } from "./toast";

interface Card { t: string; x: string }

export default function CampusSection() {
  const toast = useToast();
  const [cards, setCards] = React.useState<Card[]>([{ ...GRASSET.campusCard }]);
  const [yt, setYt] = React.useState("");

  const addCard = () => {
    if (cards.length >= 5) { toast("Maximum 5 cartes"); return; }
    setCards((c) => [...c, { t: "", x: "" }]);
  };
  const addSugg = (t: string) => {
    if (cards.length >= 5) { toast("Maximum 5 cartes"); return; }
    setCards((c) => [...c, { t, x: "" }]);
    toast("Carte « " + t + " » créée — ajoute photo + description");
  };

  const n = cards.filter((c) => c.t).length;
  const budget = Math.round(n * 25);

  // débounce les cartes+yt bruts (inclut la carte vidéo), reconstruit le content.
  const debKey = useDebounced(JSON.stringify({ cards, yt }));
  const preview = React.useMemo(() => {
    const s = JSON.parse(debKey) as { cards: Card[]; yt: string };
    return <RealCampusSection content={campusContent(s.cards, s.yt)} />;
  }, [debKey]);

  return (
    <section className="sec">
      <div className="sech"><span className="num">3</span><h2>Campus</h2><span className="tag man">MANUEL</span></div>
      <div className="cols">
        <div>
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="pt"><span className="n">0</span>FICHE — AUTOMATIQUE, RIEN À FAIRE</div>
            <div className="auto">
              {FICHE.map(([k, v]) => <span key={k} className="achip"><b>✓</b>{k} : {v}</span>)}
            </div>
            <div className="fact" style={{ padding: "11px 13px", display: "block", marginTop: 12 }}><b style={{ fontSize: 13 }}>{ADDRESS.line1}</b><span>{ADDRESS.line2}</span></div>
            <div className="note" style={{ marginTop: 8 }}>Fiche + carte affichées dans l'aperçu → rendu réel. Une erreur ? → <a href="mailto:info@nexussports.ca" style={{ color: "var(--warn)", fontWeight: 700, textDecoration: "none" }}>info@nexussports.ca</a></div>
          </div>

          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="pt"><span className="n">1</span>LES CARTES DU CAMPUS (max 5 + 1 vidéo)</div>
            <div>
              {cards.map((c, i) => (
                <div key={i} style={{ border: "1px solid var(--line)", borderRadius: 11, padding: 12, marginBottom: 10 }}>
                  <div className="drop" style={{ marginBottom: 8 }} onClick={() => toast("Upload photo (câblage Bloc 2)")}><b>Photo {i + 1}</b>16:9 · JPG/PNG · aucun mineur identifiable</div>
                  <div className="nrow" style={{ gridTemplateColumns: "1fr 1.6fr auto" }}>
                    <input className="ti" maxLength={24} placeholder="Titre ≤ 24" value={c.t} onChange={(e) => setCards((cs) => cs.map((x, k) => (k === i ? { ...x, t: e.target.value } : x)))} />
                    <input className="ti" maxLength={90} placeholder="Description ≤ 90" value={c.x} onChange={(e) => setCards((cs) => cs.map((x, k) => (k === i ? { ...x, x: e.target.value } : x)))} />
                    <button className="xbtn" title="Retirer" onClick={() => setCards((cs) => cs.filter((_, k) => k !== i))}>✕</button>
                  </div>
                </div>
              ))}
            </div>
            <button className="addbtn" onClick={addCard}>+ Ajouter une carte (photo + titre + description)</button>
            <label className="fl">Carte vidéo (YouTube, optionnel)</label>
            <input className="ti" placeholder="https://youtube.com/watch?v=…" value={yt} onChange={(e) => setYt(e.target.value)} />
            <div className="mod">⚠ Modéré · AUCUN mineur identifiable (Loi 25).</div>
          </div>

          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="pt"><span className="n">2</span>PANNE D'IDÉES ? — CLIQUE, ÇA PART UNE CARTE</div>
            <div className="uwrap">
              {SUGG.map((t) => <span key={t} className="uchip" onClick={() => addSugg(t)}>{t}</span>)}
            </div>
            <div className="note">Suggestions Nexus (« Résidences &amp; hébergement » incluse) : le clic crée une carte pré-titrée.</div>
          </div>

          <div className="budget">⏱ Temps estimé : <b>{budget} s</b> · cartes : <b>{n}</b></div>
        </div>

        <div className="pv">
          <div className="pvhead">APERÇU LIVE — RENDU RÉEL <span style={{ color: "#5A616D" }}>(carte Maps souvent bloquée en dev — normal)</span></div>
          <PreviewShell>{preview}</PreviewShell>
        </div>
      </div>
    </section>
  );
}
