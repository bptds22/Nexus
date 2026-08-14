"use client";

// components/page-editor/CampusSection.tsx — S3 « Campus » v3 (MANUEL)
// Inputs à gauche (cartes + suggestions ; hébergement = une suggestion-carte,
// plus de panneau dédié). Preview = le VRAI CampusSection (fiche + map +
// carousel).
//
// FICHE ET ADRESSE : lues dans `schools` de l'école connectée, jamais devinées.
// Elles affichaient les constantes Grasset de fixture.ts (« Francophone · Privé
// · Montréal », « 1001, boul. Crémazie Est ») à TOUS les collèges. Même
// normalisation que la page publique — langueDeSchool / reseauDeSchool.

import * as React from "react";
import RealCampusSection from "@/components/program-page/CampusSection";
import PreviewShell, { useDebounced } from "./PreviewShell";
import { campusContent } from "./pageBridge";
import { SUGG } from "./fixture";
import { langueDeSchool, reseauDeSchool } from "@/lib/queries/schoolPage/dbToProgramPage";
import { useEditor } from "./editorContext";
import { MAX_SCHOOL_CARDS } from "@/lib/queries/schoolPage/schoolPageData";
import { VisibilityToggle, SectionHidden } from "./SectionVisibility";
import { useToast } from "./toast";

interface Card { id?: string; uid: string; t: string; x: string; image_path: string | null }
const newUid = () => Math.random().toString(36).slice(2);

export default function CampusSection() {
  const toast = useToast();
  const { initial, school, report, uploadAsset, assetUrl, hiddenSections } = useEditor();
  const hidden = hiddenSections.includes("campus");

  // Fiche AUTO : uniquement les valeurs réellement présentes en base. Une tuile
  // sans source n'est pas rendue ; les trois absentes → pas de fiche du tout.
  const langue = langueDeSchool(school.langue);
  const reseau = reseauDeSchool(school.reseau);
  const region = school.region?.trim() ? school.region : null;
  const fiche: [string, string][] = [
    ...(langue ? [["Langue", langue === "EN" ? "Anglophone" : langue === "BILINGUE" ? "Bilingue" : "Francophone"] as [string, string]] : []),
    ...(reseau ? [["Statut", reseau === "PRIVÉ" ? "Privé" : "Public"] as [string, string]] : []),
    ...(region ? [["Région", region] as [string, string]] : []),
  ];
  // `schools.address` est renseignée pour 52 cégeps sur 69 ; sans elle, on
  // n'affiche AUCUNE adresse plutôt que celle d'un autre collège.
  const adresse = school.address?.trim() ? school.address.trim() : null;
  const ligne2 = [school.city, school.postal_code].filter((v) => v && v.trim()).join(" ");
  const [cards, setCards] = React.useState<Card[]>(() => initial.cards.map((c) => ({ ...c, uid: c.id ?? newUid() })));
  const [yt, setYt] = React.useState(initial.yt);

  React.useEffect(() => {
    report("cards", cards.filter((c) => c.t).map((c) => ({ id: c.id, titre: c.t, legende: c.x, image_path: c.image_path })));
    report("content.campus", { campus_video_url: yt });
  }, [cards, yt, report]);

  // Upload réel → bucket campus-photos, chemin {school_id}/… (policies ma_page).
  const pickPhoto = (i: number) => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const path = await uploadAsset("campus-photos", file);
        setCards((cs) => cs.map((x, k) => (k === i ? { ...x, image_path: path } : x)));
        toast("Photo téléversée");
      } catch (e) { toast(e instanceof Error ? e.message : "Échec de l'upload"); }
    };
    input.click();
  };

  const addCard = () => {
    if (cards.length >= MAX_SCHOOL_CARDS) { toast(`Maximum ${MAX_SCHOOL_CARDS} cartes`); return; }
    setCards((c) => [...c, { uid: newUid(), t: "", x: "", image_path: null }]);
  };
  const addSugg = (t: string) => {
    if (cards.length >= MAX_SCHOOL_CARDS) { toast(`Maximum ${MAX_SCHOOL_CARDS} cartes`); return; }
    setCards((c) => [...c, { uid: newUid(), t, x: "", image_path: null }]);
    toast("Carte « " + t + " » créée — ajoute photo + description");
  };

  const n = cards.filter((c) => c.t).length;
  const budget = Math.round(n * 25);

  // débounce les cartes+yt bruts (inclut la carte vidéo), reconstruit le content.
  // #5 : résout image_path → URL storage (même consommation que la page publique).
  const debKey = useDebounced(JSON.stringify({ cards, yt }));
  const preview = React.useMemo(() => {
    const s = JSON.parse(debKey) as { cards: Card[]; yt: string };
    const resolved = s.cards.map((c) => ({ t: c.t, x: c.x, image: assetUrl(c.image_path, "campus-photos") }));
    // L'aperçu rend le VRAI composant : il doit recevoir la fiche RÉELLE de
    // l'école, sinon il affiche la carte et le statut d'un autre collège.
    return <RealCampusSection content={campusContent(resolved, s.yt, {
      language: langue, schoolType: reseau, region,
      mapQuery: `${school.name}, ${school.city || "Québec"}`,
    })} />;
  }, [debKey, assetUrl, langue, reseau, region, school.name, school.city]);

  return (
    <section className="sec">
      <div className="sech"><span className="num">3</span><h2>Campus</h2><span className="tag man">MANUEL</span><VisibilityToggle sectionKey="campus" /></div>
      {hidden ? <SectionHidden sectionKey="campus" /> : (
      <div className="cols">
        <div>
          {(fiche.length > 0 || adresse) && (
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="pt"><span className="n">0</span>FICHE — AUTOMATIQUE, RIEN À FAIRE</div>
            {fiche.length > 0 && (
              <div className="auto">
                {fiche.map(([k, v]) => <span key={k} className="achip"><b>✓</b>{k} : {v}</span>)}
              </div>
            )}
            {adresse && (
              <div className="fact" style={{ padding: "11px 13px", display: "block", marginTop: 12 }}>
                <b style={{ fontSize: 13 }}>{adresse}</b>
                {ligne2 && <span>{ligne2}</span>}
              </div>
            )}
            <div className="note" style={{ marginTop: 8 }}>Fiche + carte affichées dans l'aperçu → rendu réel. Une erreur ? → <a href="mailto:info@nexussports.ca" style={{ color: "var(--warn)", fontWeight: 700, textDecoration: "none" }}>info@nexussports.ca</a></div>
          </div>
          )}

          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="pt"><span className="n">1</span>LES CARTES DU CAMPUS (max {MAX_SCHOOL_CARDS} + 1 vidéo)</div>
            <div>
              {cards.map((c, i) => (
                <div key={c.uid} style={{ border: "1px solid var(--line)", borderRadius: 11, padding: 12, marginBottom: 10 }}>
                  <div className="drop" style={{ marginBottom: 8 }} onClick={() => pickPhoto(i)}><b>{c.image_path ? `Photo ${i + 1} ✓ — remplacer` : `Photo ${i + 1}`}</b>16:9 · JPG/PNG · aucun mineur identifiable</div>
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
            <div className="mod">⚠ AUCUN mineur identifiable dans les images (Loi 25).</div>
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
      )}
    </section>
  );
}
