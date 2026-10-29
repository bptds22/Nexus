"use client";

// components/page-editor/UniversityProgramsSection.tsx — S5 « Programmes d'études » de l'UNIVERSITÉ (lot D5b).
// Les programmes de premier cycle sont PRÉ-REMPLIS par Nexus depuis le site officiel de l'université (lot D5a,
// source 'seed', relevé du 2026-10-28) ; l'université ajoute, modifie, masque, restaure, et supprime ses ajouts.
// Table public.university_programs : RLS can_edit_school_page (admin, ou le recruteur universitaire de SA
// université sous ON — D5a étape 1). Gestes IMMÉDIATS, optimistes, défaits en cas d'erreur, comme la section DEC.
// Une ligne pré-remplie modifiée devient 'manuel' (c'est désormais le texte de l'université).
// Cycles (lot E4, base E3) : baccalauréat, certificat, maîtrise, doctorat, ou « autre » avec un libellé libre.
// « Doctorat de 1er cycle » (médecine, pharmacie, JD…) : base 20261029200000.

import * as React from "react";
import RealAcademicPlanche from "@/components/program-page/AcademicPlanche";
import PreviewShell, { useDebounced } from "./PreviewShell";
import { MOCK_VISE } from "./pageBridge";
import { useEditor, friendlyDbError } from "./editorContext";
import { VisibilityToggle, SectionHidden } from "./SectionVisibility";
import { useToast } from "./toast";

type Cycle = "baccalaureat" | "certificat" | "maitrise" | "doctorat" | "doctorat_1er_cycle" | "autre";
interface Prog { id: string; name: string; cycle: Cycle; cycleLibelle: string | null; faculte: string | null; lien: string | null; on: boolean; manual: boolean; position: number }
const CYCLES: { v: Cycle; l: string }[] = [
  { v: "baccalaureat", l: "Baccalauréat" }, { v: "certificat", l: "Certificat" }, { v: "maitrise", l: "Maîtrise" },
  { v: "doctorat_1er_cycle", l: "Doctorat de 1er cycle" }, { v: "doctorat", l: "Doctorat" },
  { v: "autre", l: "Autre (préciser)" },
];
const cycleLabel = (c: Cycle, libelle: string | null) =>
  c === "autre" ? (libelle || "Autre") : (CYCLES.find((x) => x.v === c)?.l ?? c);
const LIBELLE_MAX = 60;
const DIACRITICS = new RegExp("[\\u0300-\\u036f]", "g");
const norm = (s: string) => s.normalize("NFD").replace(DIACRITICS, "").toLowerCase();
const lienValide = (v: string) => v === "" || /^https:\/\//.test(v);
const COLS = "id, name, cycle, cycle_libelle, faculte, lien, is_displayed, source, position";
type Row = { id: string; name: string; cycle: Cycle; cycle_libelle: string | null; faculte: string | null; lien: string | null; is_displayed: boolean; source: string; position: number };
const versProg = (r: Row): Prog => ({ id: r.id, name: r.name, cycle: r.cycle, cycleLibelle: r.cycle_libelle, faculte: r.faculte, lien: r.lien, on: r.is_displayed, manual: r.source === "manuel", position: r.position });
/** Le libellé n'existe que pour « autre » (contrainte de la base, lot E3). */
const libellePour = (c: Cycle, l: string) => (c === "autre" ? l.trim() || null : null);

export default function UniversityProgramsSection() {
  const toast = useToast();
  const { client, school, schoolId, hiddenSections } = useEditor();
  const hidden = hiddenSections.includes("programs");
  const [progs, setProgs] = React.useState<Prog[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [q, setQ] = React.useState("");
  const [showBank, setShowBank] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [neuf, setNeuf] = React.useState<{ name: string; cycle: Cycle; libelle: string; faculte: string; lien: string }>({ name: "", cycle: "baccalaureat", libelle: "", faculte: "", lien: "" });
  const [edition, setEdition] = React.useState<{ id: string; name: string; cycle: Cycle; libelle: string; faculte: string; lien: string } | null>(null);

  React.useEffect(() => {
    let annule = false;
    (async () => {
      const { data, error } = await client.from("university_programs").select(COLS)
        .eq("school_id", schoolId).order("position").order("name");
      if (annule) return;
      if (error) { setErr(friendlyDbError(error).message); return; }
      setProgs(((data ?? []) as Row[]).map(versProg));
    })();
    return () => { annule = true; };
  }, [client, schoolId]);

  const liste = progs ?? [];
  const nq = norm(q);
  const affiches = liste.filter((p) => p.on);
  const masques = liste.filter((p) => !p.on);
  const debKey = useDebounced(JSON.stringify(affiches.map((p) => p.name)));
  const preview = React.useMemo(
    () => <RealAcademicPlanche programs={JSON.parse(debKey)} viewerProgrammeVise={MOCK_VISE} schoolName={school.name} etablissement="universite" />,
    [debKey, school.name],
  );

  const setDisplayed = async (id: string, next: boolean) => {
    setProgs((s) => (s ?? []).map((x) => (x.id === id ? { ...x, on: next } : x)));
    const { error } = await client.from("university_programs").update({ is_displayed: next }).eq("id", id);
    if (error) {
      setProgs((s) => (s ?? []).map((x) => (x.id === id ? { ...x, on: !next } : x)));
      toast(friendlyDbError(error).message);
    }
  };

  const ajouter = async () => {
    const name = neuf.name.trim(), faculte = neuf.faculte.trim(), lien = neuf.lien.trim();
    if (!name || busy) return;
    if (!lienValide(lien)) { toast("Le lien doit commencer par https://"); return; }
    if (neuf.cycle === "autre" && !neuf.libelle.trim()) { toast("Précise le cycle (ex. « Microprogramme »)."); return; }
    setBusy(true);
    try {
      const position = liste.reduce((m, p) => Math.max(m, p.position), -1) + 1;
      const { data, error } = await client.from("university_programs")
        .insert({ school_id: schoolId, name, cycle: neuf.cycle, cycle_libelle: libellePour(neuf.cycle, neuf.libelle), faculte: faculte || null, lien: lien || null, is_displayed: true, source: "manuel", position })
        .select(COLS).single();
      if (error) throw error;
      setProgs((s) => [...(s ?? []), versProg(data as Row)]);
      setNeuf({ name: "", cycle: neuf.cycle, libelle: neuf.libelle, faculte: "", lien: "" });
    } catch (e) { toast(friendlyDbError(e).message); }
    finally { setBusy(false); }
  };

  const enregistrer = async () => {
    if (!edition || busy) return;
    const name = edition.name.trim(), faculte = edition.faculte.trim(), lien = edition.lien.trim();
    if (!name) { toast("Le nom du programme est obligatoire."); return; }
    if (!lienValide(lien)) { toast("Le lien doit commencer par https://"); return; }
    if (edition.cycle === "autre" && !edition.libelle.trim()) { toast("Précise le cycle (ex. « Microprogramme »)."); return; }
    setBusy(true);
    try {
      const { data, error } = await client.from("university_programs")
        .update({ name, cycle: edition.cycle, cycle_libelle: libellePour(edition.cycle, edition.libelle), faculte: faculte || null, lien: lien || null, source: "manuel" })
        .eq("id", edition.id).select(COLS).single();
      if (error) throw error;
      const maj = versProg(data as Row);
      setProgs((s) => (s ?? []).map((x) => (x.id === maj.id ? maj : x)));
      setEdition(null);
    } catch (e) { toast(friendlyDbError(e).message); }
    finally { setBusy(false); }
  };

  // Supprimer : seulement un ajout manuel jamais pré-rempli ; un programme pré-rempli se masque (banque).
  const supprimer = async (p: Prog) => {
    if (!p.manual || busy) return;
    setBusy(true);
    try {
      const { error } = await client.from("university_programs").delete().eq("id", p.id);
      if (error) throw error;
      setProgs((s) => (s ?? []).filter((x) => x.id !== p.id));
    } catch (e) { toast(friendlyDbError(e).message); }
    finally { setBusy(false); }
  };

  const ligne = (p: Prog, dansBanque: boolean) => (
    <div key={p.id} className={dansBanque ? "prog" : "prog on"} style={{ alignItems: "flex-start" }}>
      <span className="box">{dansBanque ? "" : "✓"}</span>
      {edition?.id === p.id ? (
        <span style={{ display: "grid", gap: 6 }}>
          <input className="ti" maxLength={200} value={edition.name} onChange={(e) => setEdition({ ...edition, name: e.target.value })} />
          <select className="ti" value={edition.cycle} onChange={(e) => setEdition({ ...edition, cycle: e.target.value as Cycle })}>
            {CYCLES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
          </select>
          {edition.cycle === "autre" && (
            <input className="ti" maxLength={LIBELLE_MAX} placeholder="Cycle (ex. Microprogramme)" value={edition.libelle} onChange={(e) => setEdition({ ...edition, libelle: e.target.value })} />
          )}
          <input className="ti" maxLength={150} placeholder="Faculté (facultatif)" value={edition.faculte} onChange={(e) => setEdition({ ...edition, faculte: e.target.value })} />
          <input className="ti" maxLength={500} placeholder="Lien https:// (facultatif)" value={edition.lien} onChange={(e) => setEdition({ ...edition, lien: e.target.value })} />
          <span style={{ display: "flex", gap: 6 }}>
            <button className="btn" onClick={enregistrer} disabled={busy}>Enregistrer</button>
            <button className="btn ghost" onClick={() => setEdition(null)}>Annuler</button>
          </span>
        </span>
      ) : (
        <span>
          {p.name}
          <i style={{ display: "block", color: "#5A616D", fontSize: 11, fontStyle: "normal" }}>
            {cycleLabel(p.cycle, p.cycleLibelle)}{p.faculte ? ` · ${p.faculte}` : ""}{p.manual ? " · (manuel)" : ""}
          </i>
        </span>
      )}
      {edition?.id !== p.id && (
        <span style={{ display: "flex", gap: 6, flex: "0 0 auto" }}>
          <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 11 }} title="Modifier" onClick={() => setEdition({ id: p.id, name: p.name, cycle: p.cycle, libelle: p.cycleLibelle ?? "", faculte: p.faculte ?? "", lien: p.lien ?? "" })}>✎</button>
          {dansBanque ? (
            <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 11 }} title="Réafficher sur la page" onClick={() => setDisplayed(p.id, true)}>↺ Restaurer</button>
          ) : (
            <button className="xbtn" style={{ width: 30, height: 30, borderRadius: 8 }} title="Masquer (va dans la banque)" onClick={() => setDisplayed(p.id, false)}>✕</button>
          )}
          {p.manual && dansBanque && (
            <button className="btn ghost" style={{ padding: "4px 10px", fontSize: 11 }} title="Supprimer cet ajout" onClick={() => supprimer(p)}>Supprimer</button>
          )}
        </span>
      )}
    </div>
  );

  return (
    <section className="sec">
      <div className="sech"><span className="num">5</span><h2>Programmes d&apos;études</h2><span className="tag man">MANUEL</span><VisibilityToggle sectionKey="programs" /></div>
      {hidden ? <SectionHidden sectionKey="programs" /> : (
      <div className="cols">
        <div className="panel">
          <div className="pt"><span className="n">1</span>TES PROGRAMMES — PREMIER CYCLE PRÉ-REMPLI PAR NEXUS</div>
          <div className="auto" style={{ marginBottom: 10 }}><span className="achip"><b>✓</b>Baccalauréats et certificats relevés sur le site officiel de ton université — corrige, masque, ou ajoute tes maîtrises, doctorats et autres</span></div>
          {err ? <div className="empty" style={{ padding: 14 }}>{err}</div> : progs === null ? (
            <div className="empty" style={{ padding: 14 }}>Chargement…</div>
          ) : (
            <>
              <input className="ti" placeholder="Rechercher un programme…" value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 10 }} />
              <div className="plist">
                {affiches.filter((p) => !nq || norm(p.name).includes(nq) || norm(p.faculte ?? "").includes(nq)).map((p) => ligne(p, false))}
                {affiches.length === 0 && <div className="empty" style={{ padding: 14 }}>Aucun programme affiché. Restaure depuis la banque ou ajoute-en un.</div>}
              </div>
              {masques.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <button className="btn ghost" style={{ width: "100%", fontSize: 12 }} onClick={() => setShowBank((v) => !v)}>
                    {showBank ? "▾" : "▸"} Masqués (banque) · {masques.length}
                  </button>
                  {showBank && <div className="plist" style={{ marginTop: 8, opacity: 0.85 }}>{masques.map((p) => ligne(p, true))}</div>}
                </div>
              )}
            </>
          )}

          <label className="fl">Programme absent ? Ajout manuel</label>
          <div style={{ display: "grid", gap: 6 }}>
            <input className="ti" maxLength={200} placeholder="Nom exact du programme" value={neuf.name} onChange={(e) => setNeuf({ ...neuf, name: e.target.value })} />
            <select className="ti" value={neuf.cycle} onChange={(e) => setNeuf({ ...neuf, cycle: e.target.value as Cycle })}>
              {CYCLES.map((c) => <option key={c.v} value={c.v}>{c.l}</option>)}
            </select>
            {neuf.cycle === "autre" && (
              <input className="ti" maxLength={LIBELLE_MAX} placeholder="Cycle (ex. Microprogramme, DESS)" value={neuf.libelle} onChange={(e) => setNeuf({ ...neuf, libelle: e.target.value })} />
            )}
            <input className="ti" maxLength={150} placeholder="Faculté (facultatif)" value={neuf.faculte} onChange={(e) => setNeuf({ ...neuf, faculte: e.target.value })} />
            <input className="ti" maxLength={500} placeholder="Lien vers la page du programme, https:// (facultatif)" value={neuf.lien} onChange={(e) => setNeuf({ ...neuf, lien: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") ajouter(); }} />
            <button className="btn ghost" onClick={ajouter} disabled={busy || !neuf.name.trim()}>Ajouter</button>
          </div>
          <div className="note">✕ = <b>masque</b> (le programme part dans la banque) · <b>Restaurer</b> = réaffiche · ✎ = corrige le nom, la faculté ou le lien · Un ajout manuel masqué peut être <b>supprimé</b>. Chaque geste est <b>enregistré aussitôt</b>.</div>
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
