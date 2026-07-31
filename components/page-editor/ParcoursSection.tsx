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
import { ENC, UNIS } from "./fixture";
import { useEditor } from "./editorContext";
import { VisibilityToggle, SectionHidden } from "./SectionVisibility";

const toNum = (s: string): number | null => { const n = parseInt(s, 10); return Number.isFinite(n) ? n : null; };

// #2b : le vrai ParcoursRoute rend en largeur desktop ; dans la colonne étroite
// de l'éditeur il déborde (cercles sur le texte). On le rend à sa largeur de
// design puis on le met à l'échelle (zoom) pour tenir la colonne — comme le mur.
function ScaleToFit({ designWidth, children }: { designWidth: number; children: React.ReactNode }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = React.useState(1);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      const cw = el.clientWidth;
      if (cw > 0) setZoom(Math.min(1, cw / designWidth));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [designWidth]);
  return (
    <div ref={ref} style={{ overflow: "hidden" }}>
      <div style={{ width: designWidth, zoom }}>{children}</div>
    </div>
  );
}

export default function ParcoursSection({
  nick, init, nbath, slog,
}: { nick: string; init: string; nbath: string; slog: string }) {
  const { initial, school, recrutedCount, report, hiddenSections } = useEditor();
  const hidden = hiddenSections.includes("parcours");
  // catalogue ENC + extras venus de la DB (encadrement libre déjà saisi ailleurs).
  const encCatalog = React.useMemo(
    () => [...ENC, ...initial.encOn.filter((e) => !ENC.includes(e))], [initial.encOn],
  );
  const [pniv, setPniv] = React.useState(initial.pniv);
  const [enc, setEnc] = React.useState<boolean[]>(() => encCatalog.map((t) => initial.encOn.includes(t)));
  const [pus, setPus] = React.useState(initial.pus);
  const [pdip, setPdip] = React.useState(initial.pdip);
  const [pusa, setPusa] = React.useState(initial.pusa);
  const [unis, setUnis] = React.useState<{ u: string; on: boolean }[]>(() => [
    ...UNIS.map((u) => ({ u, on: initial.universities.includes(u) })),
    ...initial.universities.filter((u) => !UNIS.includes(u)).map((u) => ({ u, on: true })),
  ]);
  const [ucustom, setUcustom] = React.useState("");

  const addUni = () => {
    const v = ucustom.trim();
    if (!v) return;
    setUnis((s) => [...s, { u: v, on: true }]);
    setUcustom("");
  };

  const selectedEnc = encCatalog.filter((_, i) => enc[i]);
  const selectedUnis = unis.filter((u) => u.on).map((u) => u.u);
  React.useEffect(() => {
    report("content.parcours", {
      niveau: pniv, encadrement: selectedEnc,
      stat_usports: toNum(pus), stat_diplomation: toNum(pdip), stat_usa: toNum(pusa),
      universities: selectedUnis,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pniv, pus, pdip, pusa, JSON.stringify(selectedEnc), JSON.stringify(selectedUnis), report]);

  // Identité et compteur RÉELS : l'aperçu doit être ce que le public verra.
  // `recrutedCount` vient de count_recruited_by_school, la RPC de la page
  // publique — à 0, la bande Nexus disparaît ici comme là-bas.
  const props = parcoursProps({
    pniv, nbath,
    enc: selectedEnc,
    recrutes: recrutedCount,
    pus, pusa, pdip,
    universities: selectedUnis,
    initials: init,
    slogan: slog,
    schoolName: school.name,
    nickname: nick,
  });
  const debKey = useDebounced(JSON.stringify(props));
  const preview = React.useMemo(() => <RealParcoursRoute {...JSON.parse(debKey)} />, [debKey]);

  return (
    <section className="sec">
      <div className="sech"><span className="num">6</span><h2>Parcours</h2><span className="tag man">MANUEL</span><VisibilityToggle sectionKey="parcours" /></div>
      {hidden ? <SectionHidden sectionKey="parcours" /> : (
      <div className="cols">
        <div>
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="pt"><span className="n">1</span>INTRO — NIVEAU &amp; ENCADREMENT</div>
            <label className="fl">Niveau / division</label>
            <input className="ti" maxLength={30} value={pniv} onChange={(e) => setPniv(e.target.value)} />
            <label className="fl">Encadrement sport-études — catalogue (compose l'étape 2 du parcours)</label>
            <div className="cklist">
              {encCatalog.map((t, i) => (
                <div key={t} className={"ck" + (enc[i] ? " on" : "")} onClick={() => setEnc((s) => s.map((v, k) => (k === i ? !v : v)))}>
                  <span className="box">{enc[i] ? "✓" : ""}</span><span>{t}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="pt"><span className="n">2</span>LES STATS &amp; LES UNIVERSITÉS</div>
            <div className="auto" style={{ marginBottom: 12 }}><span className="achip"><b>✓</b>Recrutés cette saison — AUTO (engagés + lettres signées, tous sports)</span></div>
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
          <PreviewShell contentKey={debKey}><ScaleToFit designWidth={720}>{preview}</ScaleToFit></PreviewShell>
        </div>
      </div>
      )}
    </section>
  );
}
