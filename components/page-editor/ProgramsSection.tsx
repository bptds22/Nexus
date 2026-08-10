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
import { useEditor, friendlyDbError } from "./editorContext";
import { VisibilityToggle, SectionHidden } from "./SectionVisibility";
import { useToast } from "./toast";

interface Prog { id?: string; n: string; on: boolean; manual: boolean; code: string | null; type: "preuniversitaire" | "technique" }
const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
const norm = (s: string) => s.normalize("NFD").replace(DIACRITICS, "").toLowerCase();

// S5 : ops DB IMMÉDIATES (pas de saveAll) — ajout=INSERT, ✕=MASQUE
// (is_displayed=false, AUCUN delete : les seedés sont irremplaçables à la main),
// restaurer=is_displayed=true. Optimiste + rollback sur erreur.
export default function ProgramsSection() {
  const toast = useToast();
  const { initial, client, school, schoolId, hiddenSections } = useEditor();
  const hidden = hiddenSections.includes("programs");
  const [progs, setProgs] = React.useState<Prog[]>(() =>
    initial.programs.map((p) => ({ id: p.id, n: p.name, on: p.is_displayed, manual: p.source === "manuel", code: p.code, type: p.type })),
  );
  const [q, setQ] = React.useState("");
  const [pman, setPman] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [showBank, setShowBank] = React.useState(false);

  const addProg = async () => {
    const v = pman.trim();
    if (!v || busy) return;
    setBusy(true);
    try {
      const { data, error } = await client.from("school_programs")
        .insert({ school_id: schoolId, name: v, code: null, type: "preuniversitaire", is_displayed: true, source: "manuel", position: progs.length })
        .select("id").single();
      if (error) throw error;
      setProgs((p) => [...p, { id: data.id as string, n: v, on: true, manual: true, code: null, type: "preuniversitaire" }]);
      setPman("");
    } catch (e) { toast(friendlyDbError(e).message); }
    finally { setBusy(false); }
  };

  // ✕ = masque (is_displayed=false) ; restaurer = is_displayed=true. Aucun DELETE.
  const setDisplayed = async (id: string | undefined, next: boolean) => {
    if (!id) return;
    setProgs((s) => s.map((x) => (x.id === id ? { ...x, on: next } : x))); // optimiste
    const { error } = await client.from("school_programs").update({ is_displayed: next }).eq("id", id);
    if (error) {
      setProgs((s) => s.map((x) => (x.id === id ? { ...x, on: !next } : x))); // rollback
      toast(friendlyDbError(error).message);
    }
  };

  const nq = norm(q);
  const hiddenCount = progs.filter((p) => !p.on).length;
  const checked = progs.filter((p) => p.on).map((p) => p.n);
  const debKey = useDebounced(JSON.stringify(checked));
  const preview = React.useMemo(
    () => <RealAcademicPlanche {...academicProps(JSON.parse(debKey), school.name)} />,
    [debKey, school.name],
  );

  return (
    <section className="sec">
      <div className="sech"><span className="num">5</span><h2>Programmes &amp; diplôme</h2><span className="tag man">MANUEL</span><VisibilityToggle sectionKey="programs" /></div>
      {hidden ? <SectionHidden sectionKey="programs" /> : (
      <div className="cols">
        <div className="panel">
          <div className="pt"><span className="n">1</span>TES PROGRAMMES — SEEDÉS PAR NEXUS</div>
          <div className="auto" style={{ marginBottom: 10 }}><span className="achip"><b>✓</b>Liste pré-chargée depuis le catalogue officiel de ton collège (SRAM/SRACQ)</span></div>
          <input className="ti" placeholder="Rechercher dans le catalogue…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 10 }} />
          <div className="plist">
            {progs.filter((p) => p.on && (!nq || norm(p.n).includes(nq))).map((p) => (
              <div key={p.id ?? p.n} className="prog on">
                <span className="box">✓</span>
                <span>{p.n}{p.manual && <i style={{ color: "#5A616D", fontSize: 11 }}> (manuel)</i>}</span>
                <button className="xbtn" style={{ width: 30, height: 30, borderRadius: 8 }} title="Masquer (va dans la banque)" onClick={() => setDisplayed(p.id, false)}>✕</button>
              </div>
            ))}
            {progs.filter((p) => p.on).length === 0 && <div className="empty" style={{ padding: 14 }}>Aucun programme affiché. Restaure depuis la banque ou ajoute-en un.</div>}
          </div>

          {/* Banque des masqués — repliée. ✕ y envoie, « restaurer » ramène. */}
          {hiddenCount > 0 && (
            <div style={{ marginTop: 8 }}>
              <button className="btn ghost" style={{ width: "100%", fontSize: 12 }} onClick={() => setShowBank((v) => !v)}>
                {showBank ? "▾" : "▸"} Masqués (banque) · {hiddenCount}
              </button>
              {showBank && (
                <div className="plist" style={{ marginTop: 8, opacity: 0.85 }}>
                  {progs.filter((p) => !p.on).map((p) => (
                    <div key={p.id ?? p.n} className="prog">
                      <span className="box"></span>
                      <span>{p.n}{p.manual && <i style={{ color: "#5A616D", fontSize: 11 }}> (manuel)</i>}</span>
                      <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 11 }} title="Réafficher sur la page" onClick={() => setDisplayed(p.id, true)}>↺ Restaurer</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <label className="fl">Programme absent du catalogue ? Ajout manuel</label>
          <div className="nrow" style={{ gridTemplateColumns: "1fr auto" }}>
            <input className="ti" maxLength={60} placeholder="Nom exact du programme" value={pman} onChange={(e) => setPman(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addProg(); }} />
            <button className="btn ghost" onClick={addProg} disabled={busy}>Ajouter</button>
          </div>
          <div className="note">✕ = <b>masque</b> (rien n'est supprimé, ça part dans la banque) · <b>Restaurer</b> = réaffiche · Chaque geste est <b>enregistré aussitôt</b>. Le <b>match parfait</b> avec le programme visé de l'athlète est automatique (accent-insensible).</div>
        </div>
        <div className="pv">
          <div className="pvhead">APERÇU LIVE — RENDU RÉEL <span style={{ color: "var(--warn)" }}>· vue athlète simulée (visé : « {MOCK_VISE} »)</span></div>
          <PreviewShell contentKey={debKey}>{preview}</PreviewShell>
        </div>
      </div>
      )}
    </section>
  );
}
