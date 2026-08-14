"use client";

// components/team-editor/PresentationEditorSection.tsx — S4 « Présentation &
// palmarès » (MANUEL). Accroche ≤280, championnats, staff depuis, photo
// + bio de l'entraîneur-chef (nom & rôle restent AUTO), fanions (max 8) dont le
// TYPE pilote la couleur. Aperçu = le VRAI PresentationSection.

import * as React from "react";
import RealPresentation from "@/components/team-page/PresentationSection";
import TeamPreviewShell, { useDebounced } from "./PreviewShell";
import CropControl from "./CropControl";
import { previewTeam } from "./teamBridge";
import { useTeamEditor } from "./teamEditorContext";
import { VisibilityToggle, SectionHidden } from "./SectionVisibility";
import { useToast } from "@/components/page-editor/toast";
import type { EditorPennant } from "@/lib/queries/teamPage/teamPageData";
import type { PennantType } from "@/components/team-page/content";

const KINDS: { v: PennantType; label: string }[] = [
  { v: "championnat", label: "Championnat" },
  { v: "coupe", label: "Coupe" },
  { v: "banniere", label: "Bannière" },
];
const newUid = () => Math.random().toString(36).slice(2);

export default function PresentationEditorSection() {
  const toast = useToast();
  const ctx = useTeamEditor();
  const { identity, initial, initialPennants, initialCamps, initialNeeds, positions, schoolCoaches, games, commits, report, uploadAsset, assetUrl, hiddenSections } = ctx;
  const hidden = hiddenSections.includes("presentation");

  const [lead, setLead] = React.useState(initial.presentation_text);
  const [champs, setChamps] = React.useState(initial.championships == null ? "" : String(initial.championships));
  const [since, setSince] = React.useState(initial.staff_since == null ? "" : String(initial.staff_since));
  const [bio, setBio] = React.useState(initial.headcoach_bio);
  const [photo, setPhoto] = React.useState(initial.headcoach_photo_path);
  const [cfx, setCfx] = React.useState(initial.headcoach_focal_x);
  const [cfy, setCfy] = React.useState(initial.headcoach_focal_y);
  const [czoom, setCzoom] = React.useState(initial.headcoach_zoom);
  const setCoachFocal = React.useCallback((x: number, y: number) => { setCfx(x); setCfy(y); }, []);
  const [hcUser, setHcUser] = React.useState(initial.headcoach_user_id ?? "");
  const [hcName, setHcName] = React.useState(initial.headcoach_name);
  const [pens, setPens] = React.useState<(EditorPennant & { uid: string })[]>(
    () => initialPennants.map((p) => ({ ...p, uid: p.id ?? newUid() })),
  );

  const intOrNull = (s: string) => (s.trim() === "" ? null : Number.parseInt(s, 10) || null);

  React.useEffect(() => {
    report("content.presentation", {
      presentation_text: lead || null,
      championships: intOrNull(champs),
      staff_since: intOrNull(since),
      headcoach_bio: bio || null,
      headcoach_photo_path: photo,
      headcoach_focal_x: cfx, headcoach_focal_y: cfy, headcoach_zoom: czoom,
      headcoach_user_id: hcUser || null,
      headcoach_name: hcName.trim() || null,
    });
    report("pennants", pens.map(({ id, titre, annee, type }) => ({ id, titre, annee, type })));
  }, [lead, champs, since, bio, photo, cfx, cfy, czoom, hcUser, hcName, pens, report]);

  const pickPhoto = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try { setPhoto(await uploadAsset("coach", file)); toast("Photo du coach téléversée"); }
      catch (e) { toast(e instanceof Error ? e.message : "Échec de l'upload"); }
    };
    input.click();
  };

  const addPen = () => {
    if (pens.length >= 8) { toast("Maximum 8 fanions"); return; }
    setPens((p) => [...p, { uid: newUid(), titre: "", annee: null, type: "championnat" }]);
  };
  const patchPen = (i: number, p: Partial<EditorPennant>) =>
    setPens((ps) => ps.map((x, k) => (k === i ? { ...x, ...p } : x)));

  // Nom affiché = compte désigné → nom manuel → staff (team_coaches). Même
  // arbitrage que la page publique (resolveHeadCoachName), calculé ici pour que
  // l'aperçu ne mente pas.
  const designatedName = schoolCoaches.find((c) => c.id === hcUser)?.nom ?? "";
  const resolvedCoachName = designatedName || hcName.trim() || identity.headCoachName;

  const coachUrl = assetUrl(photo);
  const debKey = useDebounced(JSON.stringify({ lead, champs, since, bio, photo, cfx, cfy, czoom, pens, resolvedCoachName }));
  const preview = React.useMemo(() => {
    const st = JSON.parse(debKey) as { lead: string; champs: string; since: string; bio: string; photo: string | null; cfx: number; cfy: number; czoom: number; pens: EditorPennant[]; resolvedCoachName: string };
    const team = previewTeam(identity, {
      content: {
        ...initial,
        presentation_text: st.lead,
        championships: intOrNull(st.champs), staff_since: intOrNull(st.since),
        headcoach_bio: st.bio, headcoach_photo_path: st.photo,
        headcoach_focal_x: st.cfx, headcoach_focal_y: st.cfy, headcoach_zoom: st.czoom,
      },
      pennants: st.pens, camps: initialCamps, needs: initialNeeds, positions,
      games, commits, hiddenSections,
      heroUrl: assetUrl(initial.hero_image_path), coachPhotoUrl: assetUrl(st.photo),
      headCoachName: st.resolvedCoachName,
    });
    return <RealPresentation team={team} />;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debKey, identity, assetUrl]);

  return (
    <section className="sec">
      <div className="sech">
        <span className="num">4</span><h2>Présentation &amp; palmarès</h2><span className="tag man">MANUEL</span>
        <VisibilityToggle sectionKey="presentation" />
      </div>
      {hidden ? <SectionHidden sectionKey="presentation" /> : (
        <div className="cols">
          <div>
            <div className="panel" style={{ marginBottom: 14 }}>
              <div className="pt"><span className="n">1</span>L&apos;ACCROCHE</div>
              <textarea className="ti" maxLength={280} value={lead} onChange={(e) => setLead(e.target.value)} />
              <div className="cnt">{lead.length}/280</div>
              <div className="row2" style={{ marginTop: 12 }}>
                <div>
                  <label className="fl">Championnats</label>
                  <input className="ti" maxLength={2} inputMode="numeric" value={champs} onChange={(e) => setChamps(e.target.value.replace(/\D/g, ""))} />
                  <div className="note">Astuce : = ton nombre de fanions.</div>
                </div>
                <div>
                  <label className="fl">Staff en place depuis</label>
                  <input className="ti" maxLength={4} inputMode="numeric" value={since} onChange={(e) => setSince(e.target.value.replace(/\D/g, ""))} />
                </div>
              </div>
            </div>

            <div className="panel" style={{ marginBottom: 14 }}>
              <div className="pt"><span className="n">2</span>ENTRAÎNEUR-CHEF — PHOTO &amp; BIO</div>
              {/* Désignation — un compte réel d'abord (zéro faute de frappe),
                  la saisie manuelle juste à côté pour les coachs sans compte,
                  qui sont la majorité au lancement. */}
              <div className="row2">
                <div>
                  <label className="fl">Compte du collège</label>
                  <select className="ti" value={hcUser} onChange={(e) => setHcUser(e.target.value)}>
                    <option value="">— Aucun compte —</option>
                    {schoolCoaches.map((c) => <option key={c.id} value={c.id}>{c.nom}</option>)}
                  </select>
                  {schoolCoaches.length === 0 && (
                    <div className="note" style={{ marginTop: 6 }}>
                      Aucun compte coach rattaché à {identity.schoolName} — utilise la saisie manuelle.
                    </div>
                  )}
                </div>
                <div>
                  <label className="fl">…ou nom saisi (sans compte)</label>
                  <input
                    className="ti" maxLength={60} value={hcName} placeholder="Ex. Jean Tremblay"
                    disabled={!!hcUser}
                    onChange={(e) => setHcName(e.target.value)}
                  />
                  {hcUser
                    ? <div className="note" style={{ marginTop: 6 }}>Ignoré : un compte est désigné.</div>
                    : <div className="note" style={{ marginTop: 6 }}>Pour un coach qui n&apos;a pas encore de compte Nexus.</div>}
                </div>
              </div>
              <div className="auto" style={{ margin: "12px 0 10px" }}>
                <span className="achip">
                  <b>✓</b>Nom affiché : {resolvedCoachName || "aucun — seuls la photo et la bio s'afficheront"}
                </span>
                {identity.headCoachName && !designatedName && !hcName.trim() && (
                  <span className="achip"><b>✓</b>Source : staff de l&apos;équipe</span>
                )}
              </div>
              <div className="note" style={{ marginTop: 0, marginBottom: 10 }}>
                Ordre retenu : <b>compte désigné</b> → <b>nom saisi</b> → <b>staff de l&apos;équipe</b>.
                Désigner quelqu&apos;un ici est <b>purement éditorial</b> : ça n&apos;ouvre aucun droit sur le roster,
                la messagerie ou les diffusions.
              </div>
              <div className="drop" onClick={pickPhoto}>
                <b>{photo ? "Photo du coach ✓ — remplacer" : "Photo du coach"}</b>portrait · JPG/PNG
              </div>
              <label className="fl">Cadrage — glisse le point sur le visage, ajuste le zoom</label>
              <CropControl url={coachUrl} fx={cfx} fy={cfy} zoom={czoom} onFocal={setCoachFocal} onZoom={setCzoom} />
              <div className="note">
                La vignette n&apos;a pas le même cadre partout — <b>16:10 sur le web</b>, <b>portrait sur mobile</b>.
                Le point focal reste au même endroit de la photo dans les deux.
              </div>
              <label className="fl">Bio courte</label>
              <textarea className="ti" maxLength={200} value={bio} onChange={(e) => setBio(e.target.value)} />
              <div className="cnt">{bio.length}/200</div>
            </div>

            <div className="panel">
              <div className="pt"><span className="n">3</span>PALMARÈS — LES FANIONS (max 8)</div>
              <div className="note" style={{ marginTop: 0, marginBottom: 10 }}>
                Le type pilote la COULEUR (même forme fanion, 3 habits) : <b>Championnat</b> = Principale ·
                <b> Coupe</b> = Foncée/Claire · <b>Bannière</b> = rectangle sombre liseré (style « retirée au plafond »).
              </div>
              {pens.map((p, i) => (
                <div key={p.uid} className="nrow" style={{ gridTemplateColumns: "1.4fr .6fr 1fr auto" }}>
                  <input className="ti" maxLength={30} placeholder="Titre (ex. BOL D'OR)" value={p.titre} onChange={(e) => patchPen(i, { titre: e.target.value })} />
                  <input className="ti" maxLength={4} inputMode="numeric" placeholder="Année" value={p.annee ?? ""} onChange={(e) => patchPen(i, { annee: intOrNull(e.target.value.replace(/\D/g, "")) })} />
                  <select className="ti" value={p.type} onChange={(e) => patchPen(i, { type: e.target.value as PennantType })}>
                    {KINDS.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}
                  </select>
                  <button className="xbtn" title="Retirer" onClick={() => setPens((ps) => ps.filter((_, k) => k !== i))}>✕</button>
                </div>
              ))}
              <button className="addbtn" onClick={addPen}>+ Ajouter un fanion</button>
            </div>
          </div>

          <div className="pv">
            <div className="pvhead">APERÇU LIVE — LA VRAIE SECTION</div>
            <TeamPreviewShell>{preview}</TeamPreviewShell>
          </div>
        </div>
      )}
    </section>
  );
}
