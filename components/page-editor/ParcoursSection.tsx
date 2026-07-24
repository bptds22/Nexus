"use client";

// components/page-editor/ParcoursSection.tsx — S6 « Parcours » v3 (MANUEL)
// Preview = le VRAI ParcoursRoute (route TOI→AG→U.S. + compteurs animés +
// pilules unis + marker slogan). stop2 COMPOSÉ côté éditeur depuis pniv + nbath
// + enc (route.stop2 est déjà un prop → aucun amendement de composant). stats →
// route.stop3.stats. universités (picker + persos) → universities. initiales +
// slogan viennent de S1. `pfree` (mot du programme) SUPPRIMÉ (pas de slot).

import * as React from "react";
import RealParcoursRoute from "@/components/program-page/ParcoursRoute";
import PreviewShell, { useDebounced } from "./PreviewShell";
import { parcoursProps } from "./pageBridge";
import { ENC, UNIS, GRASSET } from "./fixture";

export default function ParcoursSection({
  init, nbath, slog,
}: { nick: string; init: string; nbath: string; slog: string }) {
  const g = GRASSET.parcours;
  const [pniv, setPniv] = React.useState(g.pniv);
  const [enc, setEnc] = React.useState<boolean[]>(ENC.map((_, i) => g.enc.includes(i)));
  const [pus, setPus] = React.useState(g.pus);
  const [pdip, setPdip] = React.useState(g.pdip);
  const [pusa, setPusa] = React.useState(g.pusa);
  const [unis, setUnis] = React.useState<{ u: string; on: boolean }[]>(
    UNIS.map((u, i) => ({ u, on: g.unis.includes(i) })),
  );
  const [ucustom, setUcustom] = React.useState("");

  const addUni = () => {
    const v = ucustom.trim();
    if (!v) return;
    setUnis((s) => [...s, { u: v, on: true }]);
    setUcustom("");
  };

  const props = parcoursProps({
    pniv, nbath,
    enc: ENC.filter((_, i) => enc[i]),
    recrutes: g.recrutes,
    pus, pusa, pdip,
    universities: unis.filter((u) => u.on).map((u) => u.u),
    initials: init,
    slogan: slog,
  });
  const debKey = useDebounced(JSON.stringify(props));
  const preview = React.useMemo(() => <RealParcoursRoute {...JSON.parse(debKey)} />, [debKey]);

  return (
    <section className="sec">
      <div className="sech"><span className="num">6</span><h2>Parcours</h2><span className="tag man">MANUEL</span></div>
      <div className="cols">
        <div>
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="pt"><span className="n">1</span>INTRO — NIVEAU &amp; ENCADREMENT</div>
            <label className="fl">Niveau / division</label>
            <input className="ti" maxLength={30} value={pniv} onChange={(e) => setPniv(e.target.value)} />
            <label className="fl">Encadrement sport-études — catalogue (compose l'étape 2 du parcours)</label>
            <div className="cklist">
              {ENC.map((t, i) => (
                <div key={t} className={"ck" + (enc[i] ? " on" : "")} onClick={() => setEnc((s) => s.map((v, k) => (k === i ? !v : v)))}>
                  <span className="box">{enc[i] ? "✓" : ""}</span><span>{t}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="pt"><span className="n">2</span>LES STATS &amp; LES UNIVERSITÉS</div>
            <div className="auto" style={{ marginBottom: 12 }}><span className="achip"><b>✓</b>Recrutés cette saison : {g.recrutes} — AUTO (engagés + lettres signées, tous sports)</span></div>
            <div className="row2">
              <div><label className="fl">Passés en U SPORTS</label><input className="ti" maxLength={4} value={pus} onChange={(e) => setPus(e.target.value)} /></div>
              <div><label className="fl">Taux de diplomation (%)</label><input className="ti" maxLength={3} value={pdip} onChange={(e) => setPdip(e.target.value)} /></div>
            </div>
            <div className="row2">
              <div><label className="fl">Partis aux États-Unis (NCAA/NJCAA)</label><input className="ti" maxLength={4} value={pusa} onChange={(e) => setPusa(e.target.value)} /></div>
              <div></div>
            </div>
            <label className="fl">Universités où tes athlètes sont rendus — picker + persos</label>
            <div className="uwrap">
              {unis.map((u, i) => (
                <span key={u.u + i} className={"uchip" + (u.on ? " on" : "")} onClick={() => setUnis((s) => s.map((x, k) => (k === i ? { ...x, on: !x.on } : x)))}>{u.u}</span>
              ))}
            </div>
            <div className="nrow" style={{ gridTemplateColumns: "1fr auto", marginTop: 10 }}>
              <input className="ti" maxLength={40} placeholder="Autre (ex. « Michigan State »…)" value={ucustom} onChange={(e) => setUcustom(e.target.value)} />
              <button className="btn ghost" onClick={addUni}>Ajouter</button>
            </div>
          </div>
        </div>
        <div className="pv">
          <div className="pvhead">APERÇU LIVE — RENDU RÉEL (compteurs animés)</div>
          <PreviewShell contentKey={debKey}>{preview}</PreviewShell>
        </div>
      </div>
    </section>
  );
}
