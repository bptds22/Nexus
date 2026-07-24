"use client";

// components/page-editor/ProgramsSection.tsx — S5 « Programmes & diplôme » v3 (MANUEL)
// Cocher / ajouter / supprimer, POINT. Le ★ « EN VEDETTE » est SUPPRIMÉ : la
// vraie planche (AcademicPlanche) fait du perfect-match piloté par le programme
// visé de l'ATHLÈTE, pas par un ★ du recruteur. Preview = vrai AcademicPlanche
// avec viewerProgrammeVise mocké (badge « vue athlète simulée »).
// Bloc 2 : `featured` disparaît du schéma.

import * as React from "react";
import RealAcademicPlanche from "@/components/program-page/AcademicPlanche";
import PreviewShell, { useDebounced } from "./PreviewShell";
import { academicProps, MOCK_VISE } from "./pageBridge";
import { DEC, GRASSET } from "./fixture";
import { useToast } from "./toast";

interface Prog { n: string; on: boolean; manual: boolean }
const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
const norm = (s: string) => s.normalize("NFD").replace(DIACRITICS, "").toLowerCase();

export default function ProgramsSection() {
  const toast = useToast();
  const [progs, setProgs] = React.useState<Prog[]>(
    DEC.map((n, i) => ({ n, on: GRASSET.programsOn.includes(i), manual: false })),
  );
  const [q, setQ] = React.useState("");
  const [pman, setPman] = React.useState("");

  const addProg = () => {
    const v = pman.trim();
    if (!v) return;
    setProgs((p) => [...p, { n: v, on: true, manual: true }]);
    setPman("");
  };
  const toggleOn = (idx: number) => setProgs((p) => p.map((x, k) => (k === idx ? { ...x, on: !x.on } : x)));
  const removeProg = (idx: number) => setProgs((p) => p.filter((_, k) => k !== idx));

  const nq = norm(q);
  const checked = progs.filter((p) => p.on).map((p) => p.n);
  const debKey = useDebounced(JSON.stringify(checked));
  const preview = React.useMemo(
    () => <RealAcademicPlanche {...academicProps(JSON.parse(debKey))} />,
    [debKey],
  );

  return (
    <section className="sec">
      <div className="sech"><span className="num">5</span><h2>Programmes &amp; diplôme</h2><span className="tag man">MANUEL</span></div>
      <div className="cols">
        <div className="panel">
          <div className="pt"><span className="n">1</span>TES PROGRAMMES — SEEDÉS PAR NEXUS</div>
          <div className="auto" style={{ marginBottom: 10 }}><span className="achip"><b>✓</b>Liste pré-chargée depuis le catalogue officiel de ton collège (SRAM/SRACQ)</span></div>
          <input className="ti" placeholder="Rechercher dans le catalogue…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 10 }} />
          <div className="plist">
            {progs.map((p, i) => {
              if (nq && !norm(p.n).includes(nq)) return null;
              return (
                <div key={i} className={"prog" + (p.on ? " on" : "")} onClick={() => toggleOn(i)}>
                  <span className="box">{p.on ? "✓" : ""}</span>
                  <span>{p.n}{p.manual && <i style={{ color: "#5A616D", fontSize: 11 }}> (manuel)</i>}</span>
                  <button className="xbtn" style={{ width: 30, height: 30, borderRadius: 8 }} title="Retirer de la liste" onClick={(e) => { e.stopPropagation(); removeProg(i); }}>✕</button>
                </div>
              );
            })}
          </div>
          <label className="fl">Programme absent du catalogue ? Ajout manuel</label>
          <div className="nrow" style={{ gridTemplateColumns: "1fr auto auto" }}>
            <input className="ti" maxLength={60} placeholder="Nom exact du programme" value={pman} onChange={(e) => setPman(e.target.value)} />
            <button className="btn ghost" onClick={addProg}>Ajouter</button>
            <button className="btn ghost" onClick={() => toast("Import CSV (câblage Bloc 2) — une colonne : nom du programme")}>⇪ CSV</button>
          </div>
          <div className="note">Coche = affiché sur ta page · ✕ = retirer de la liste · Le <b>match parfait</b> avec le programme visé de l'athlète est automatique (recherche accent-insensible).</div>
        </div>
        <div className="pv">
          <div className="pvhead">APERÇU LIVE — RENDU RÉEL <span style={{ color: "var(--warn)" }}>· vue athlète simulée (visé : « {MOCK_VISE} »)</span></div>
          <PreviewShell contentKey={debKey}>{preview}</PreviewShell>
        </div>
      </div>
    </section>
  );
}
