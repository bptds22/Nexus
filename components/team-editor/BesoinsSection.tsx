"use client";

// components/team-editor/BesoinsSection.tsx — S5 « Besoins par position »
// (MANUEL, dans le layout du sport). Les slots sont FIXES : on peut renommer,
// choisir les initiales, ancrer des positions, régler le niveau, écrire le pitch
// et masquer une plaque — mais JAMAIS en ajouter une. Aperçu = le VRAI
// BesoinsWidget (terrain + plaques + bandeau match parfait).

import * as React from "react";
import BesoinsWidget from "@/components/team-page/BesoinsWidget";
import TeamPreviewShell, { useDebounced } from "./PreviewShell";
import { previewTeam } from "./teamBridge";
import { useTeamEditor } from "./teamEditorContext";
import { VisibilityToggle, SectionHidden } from "./SectionVisibility";
import { useToast } from "@/components/page-editor/toast";
import { SPORT_CONFIGS, type Niveau } from "@/components/team-page/content";
import type { EditorNeed } from "@/lib/queries/teamPage/teamPageData";

const NIVEAUX: { v: Niveau; label: string; cls: string }[] = [
  { v: "complet", label: "COMPLET", cls: "l0" },
  { v: "moyen", label: "BESOIN MOYEN", cls: "l1" },
  { v: "eleve", label: "BESOIN ÉLEVÉ", cls: "l2" },
  { v: "urgent", label: "URGENT", cls: "l3" },
];

export default function BesoinsSection() {
  const toast = useToast();
  const ctx = useTeamEditor();
  const {
    identity, initial, initialNeeds, initialPennants, initialCamps,
    positions, games, commits, report, assetUrl, hiddenSections,
  } = ctx;
  const hidden = hiddenSections.includes("besoins");
  const cfg = identity.sportKey ? SPORT_CONFIGS[identity.sportKey] : null;

  const [needs, setNeeds] = React.useState<EditorNeed[]>(initialNeeds);
  const [facette, setFacette] = React.useState(cfg?.facettes[0]?.key ?? "main");
  const [open, setOpen] = React.useState<string | null>(null);
  const [menu, setMenu] = React.useState<string | null>(null);

  React.useEffect(() => { report("needs", needs); }, [needs, report]);
  // Fermeture du menu : on écoute `mousedown` et on teste l'appartenance au
  // conteneur. Le `click` + stopPropagation d'avant refermait le menu dans le
  // même geste que celui qui l'ouvrait (React 18 délègue à la racine : le
  // listener document se déclenchait quand même).
  const menuHostRef = React.useRef<HTMLElement>(null);
  React.useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const host = menuHostRef.current;
      if (host && !host.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const patch = (slot: string, p: Partial<EditorNeed>) =>
    setNeeds((ns) => ns.map((n) => (n.slot_key === slot ? { ...n, ...p } : n)));

  const debKey = useDebounced(JSON.stringify(needs));
  const preview = React.useMemo(() => {
    const live = JSON.parse(debKey) as EditorNeed[];
    const team = previewTeam(identity, {
      content: initial, pennants: initialPennants, camps: initialCamps,
      needs: live, positions, games, commits, hiddenSections,
      heroUrl: assetUrl(initial.hero_image_path), coachPhotoUrl: assetUrl(initial.headcoach_photo_path),
    });
    return <BesoinsWidget team={team} cible={false} onToggleCible={() => {}} />;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debKey, identity, positions]);

  if (!cfg) {
    return (
      <section className="sec">
        <div className="sech"><span className="num">5</span><h2>Besoins par position</h2><span className="tag auto">NON COUVERT</span></div>
        <div className="panel">
          <div className="empty">
            Aucun terrain Nexus pour <b>{identity.sportNom || "ce sport"}</b> — la section besoins n&apos;apparaît pas
            sur la page publique. Rien à remplir ici.
          </div>
        </div>
      </section>
    );
  }

  const bySlot = new Map(needs.map((n) => [n.slot_key, n]));
  const visible = needs.filter((n) => !n.is_hidden && n.facette === facette);
  const bank = needs.filter((n) => n.is_hidden);
  const unanchored = needs.filter((n) => !n.is_hidden && n.position_ids.length === 0);
  const hasTabs = cfg.facettes.length > 1;

  return (
    <section className="sec">
      <div className="sech">
        <span className="num">5</span><h2>Besoins par position</h2>
        <span className="tag man">MANUEL — DANS LE LAYOUT DU SPORT</span>
        <VisibilityToggle sectionKey="besoins" />
      </div>
      {hidden ? <SectionHidden sectionKey="besoins" /> : (
        <div className="cols">
          <div>
            <div className="panel">
              <div className="pt"><span className="n">1</span>TES PLAQUES — {identity.sportNom.toUpperCase()} (LAYOUT NEXUS, SLOTS FIXES)</div>
              <div className="auto" style={{ marginBottom: 12 }}>
                <span className="achip"><b>✓</b>Terrain, facettes et slots = design Nexus du sport (automatique)</span>
              </div>

              {hasTabs && (
                <div className="ftabs">
                  {cfg.facettes.map((f) => (
                    <span key={f.key} className={"ftab" + (facette === f.key ? " on" : "")} onClick={() => setFacette(f.key)}>
                      {(f.label || "Terrain").toUpperCase()}
                    </span>
                  ))}
                </div>
              )}

              {visible.map((n) => {
                const isOpen = open === n.slot_key;
                const niv = NIVEAUX.find((x) => x.v === n.niveau) ?? NIVEAUX[0];
                const anchored = positions.filter((p) => n.position_ids.includes(p.id));
                const rest = positions.filter((p) => !n.position_ids.includes(p.id));
                return (
                  <div key={n.slot_key} className={"prow" + (isOpen ? " open" : "")}>
                    <div className="sum" onClick={() => setOpen(isOpen ? null : n.slot_key)}>
                      <span className="a">{n.acronym || "—"}</span>
                      <b>{n.label || "—"}</b>
                      <span className={"lvlb " + niv.cls}>{niv.label}</span>
                      <button
                        className="xbtn" style={{ width: 30, height: 30 }} title="Masquer cette plaque"
                        onClick={(e) => { e.stopPropagation(); patch(n.slot_key, { is_hidden: true }); }}
                      >✕</button>
                      <span className="chev">{isOpen ? "▲" : "▼"}</span>
                    </div>
                    <div className="body">
                      <div className="row2">
                        <div>
                          <label className="fl">Initiales — SUR la plaque (≤3)</label>
                          <input
                            className="ti acro" maxLength={3} value={n.acronym}
                            onChange={(e) => patch(n.slot_key, { acronym: e.target.value.toUpperCase() })}
                          />
                        </div>
                        <div>
                          <label className="fl">Nom du groupe</label>
                          <input className="ti" maxLength={24} value={n.label} onChange={(e) => patch(n.slot_key, { label: e.target.value })} />
                        </div>
                      </div>

                      <label className="fl">Positions couvertes — l&apos;ancrage du match parfait</label>
                      <div className="posrow">
                        {anchored.map((p) => (
                          <span
                            key={p.id} className="poschip on"
                            onClick={() => patch(n.slot_key, { position_ids: n.position_ids.filter((x) => x !== p.id) })}
                          >
                            {p.nom}<span className="rm">✕</span>
                          </span>
                        ))}
                        <span className="posadd" ref={menu === n.slot_key ? menuHostRef : undefined}>
                          <button onClick={() => setMenu(menu === n.slot_key ? null : n.slot_key)}>
                            + Ajouter une position ▾
                          </button>
                          <div className={"posmenu" + (menu === n.slot_key ? " open" : "")}>
                            {rest.length === 0
                              ? <div style={{ cursor: "default", color: "#5A616D" }}>Toutes les positions sont ancrées</div>
                              : rest.map((p) => (
                                <div
                                  key={p.id}
                                  onClick={() => patch(n.slot_key, { position_ids: [...n.position_ids, p.id] })}
                                >
                                  {p.nom}{p.abreviation ? ` (${p.abreviation})` : ""}
                                </div>
                              ))}
                          </div>
                        </span>
                      </div>
                      <div className="helper">
                        L&apos;athlète dont la position est ancrée ici « matche » cette plaque. Ta plaque, tes mots —
                        mais l&apos;ancrage reste réel.
                      </div>

                      <label className="fl">Niveau de besoin</label>
                      <div className="lvlseg">
                        {NIVEAUX.map((x) => (
                          <span key={x.v} className={n.niveau === x.v ? "on" : ""} onClick={() => patch(n.slot_key, { niveau: x.v })}>
                            {x.label}
                          </span>
                        ))}
                      </div>

                      <label className="fl">Message diffusé à l&apos;athlète</label>
                      <input
                        className="ti" maxLength={80} value={n.pitch}
                        placeholder="Suggéré : « 3 finissants · 2 postes ouverts en 2027 »"
                        onChange={(e) => patch(n.slot_key, { pitch: e.target.value })}
                      />
                      <div className="helper">
                        Dès <b>BESOIN MOYEN</b> et si la position de l&apos;athlète est ancrée → ce message s&apos;affiche
                        en <b>MATCH PARFAIT</b> sur SA vue de la page. C&apos;est ton pitch de recrutement.
                      </div>
                    </div>
                  </div>
                );
              })}

              {bank.length > 0 && (
                <div className="bank">
                  <b style={{ color: "#8A909C" }}>Plaques masquées</b> — clique pour réafficher :
                  <div>
                    {bank.map((n) => (
                      <span
                        key={n.slot_key} className="rest"
                        onClick={() => { patch(n.slot_key, { is_hidden: false }); setFacette(n.facette); }}
                      >↩ {n.acronym} — {n.label}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="note">
                Clique une plaque pour l&apos;ouvrir. Tu peux renommer, choisir les initiales, ancrer les positions,
                régler le niveau, masquer (✕) — mais <b>pas ajouter</b> : le layout par sport est fixe.
              </div>
              {unanchored.length > 0 && (
                <div className="mod">
                  ⚠ {unanchored.length} plaque{unanchored.length > 1 ? "s" : ""} sans position ancrée
                  ({unanchored.map((n) => n.acronym || n.slot_key).join(", ")}) — aucun match parfait possible dessus.
                </div>
              )}
              <div className="note">
                Rien n&apos;est écrit en base tant que tu n&apos;enregistres pas : ce que tu vois est le
                <b> défaut du sport</b> ({bySlot.size} plaques).
              </div>
            </div>
          </div>

          <div className="pv">
            <div className="pvhead">APERÇU LIVE — CE QUE L&apos;ATHLÈTE VOIT</div>
            <TeamPreviewShell>{preview}</TeamPreviewShell>
            <div className="note">
              Le bandeau vert « ✓ Match parfait » s&apos;affiche à l&apos;athlète dont la position est ancrée sur une
              plaque de niveau ≥ <b>BESOIN MOYEN</b> — ici, l&apos;aperçu montre la page sans athlète connecté.
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
