"use client";

// components/team-editor/HeroSection.tsx — S2 « Hero de l'équipe » (MANUEL)
// Photo + cadrage (point focal % + zoom), record & playoffs pré-remplis RSEQ
// (le collège garde le dernier mot), réseaux hérités ou propres.
// Aperçu = le VRAI TeamHero.

import * as React from "react";
import TeamHero from "@/components/team-page/TeamHero";
import TeamPreviewShell, { useDebounced } from "./PreviewShell";
import { previewTeam } from "./teamBridge";
import { useTeamEditor } from "./teamEditorContext";
import { useToast } from "@/components/page-editor/toast";
import type { SocialPlatform } from "@/components/marketing/SocialIcons";

const PLATFORMS: { key: SocialPlatform; label: string; ph: string }[] = [
  { key: "instagram", label: "Instagram", ph: "https://instagram.com/…" },
  { key: "tiktok", label: "TikTok", ph: "https://tiktok.com/@…" },
  { key: "youtube", label: "YouTube", ph: "https://youtube.com/@…" },
  { key: "facebook", label: "Facebook", ph: "https://facebook.com/…" },
  { key: "x", label: "X", ph: "https://x.com/…" },
  { key: "website", label: "Site web", ph: "https://…" },
];
const MAX_SOCIALS = 5;
interface SocialRow { uid: string; type: SocialPlatform; url: string }
const newUid = () => Math.random().toString(36).slice(2);

export default function HeroSection() {
  const toast = useToast();
  const {
    identity, initial, report, uploadAsset, assetUrl, recordHint,
    pennantsPreview, campsPreview, needsPreview, positions, games, commits, hiddenSections,
  } = useHeroDeps();

  const [heroPath, setHeroPath] = React.useState(initial.hero_image_path);
  const [fx, setFx] = React.useState(initial.hero_focal_x);
  const [fy, setFy] = React.useState(initial.hero_focal_y);
  const [zoom, setZoom] = React.useState(initial.hero_zoom);
  const [rec, setRec] = React.useState(initial.record_saison);
  const [po, setPo] = React.useState(initial.playoff_result);
  const [inherit, setInherit] = React.useState(initial.use_school_socials);
  const [socials, setSocials] = React.useState<SocialRow[]>(
    () => initial.socials.map((s) => ({ uid: newUid(), type: s.type as SocialPlatform, url: s.url })),
  );

  const cleanSocials = React.useCallback(
    (rows: SocialRow[]) => rows.filter((s) => s.url.trim()).slice(0, MAX_SOCIALS).map((s) => ({ type: s.type, url: s.url.trim() })),
    [],
  );

  React.useEffect(() => {
    report("content.hero", {
      hero_image_path: heroPath,
      hero_focal_x: fx, hero_focal_y: fy, hero_zoom: zoom,
      record_saison: rec || null,
      playoff_result: po || null,
      use_school_socials: inherit,
      socials: cleanSocials(socials),
    });
  }, [heroPath, fx, fy, zoom, rec, po, inherit, socials, report, cleanSocials]);

  // ── cadrage : le point suit la souris dans la boîte, comme le mock ──
  const cropRef = React.useRef<HTMLDivElement>(null);
  const dragging = React.useRef(false);
  const setFromEvent = React.useCallback((clientX: number, clientY: number) => {
    const r = cropRef.current?.getBoundingClientRect();
    if (!r) return;
    setFx(Math.round(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100))));
    setFy(Math.round(Math.min(100, Math.max(0, ((clientY - r.top) / r.height) * 100))));
  }, []);
  React.useEffect(() => {
    const move = (e: MouseEvent) => { if (dragging.current) setFromEvent(e.clientX, e.clientY); };
    const up = () => { dragging.current = false; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, [setFromEvent]);

  const pickPhoto = () => {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        setHeroPath(await uploadAsset("hero", file));
        toast("Photo hero téléversée");
      } catch (e) { toast(e instanceof Error ? e.message : "Échec de l'upload"); }
    };
    input.click();
  };

  const heroUrl = assetUrl(heroPath);
  const debKey = useDebounced(JSON.stringify({ heroPath, fx, fy, zoom, rec, po, inherit, socials }));
  const preview = React.useMemo(() => {
    const st = JSON.parse(debKey) as {
      heroPath: string | null; fx: number; fy: number; zoom: number;
      rec: string; po: string; inherit: boolean; socials: SocialRow[];
    };
    const team = previewTeam(identity, {
      content: {
        ...initial,
        hero_image_path: st.heroPath, hero_focal_x: st.fx, hero_focal_y: st.fy, hero_zoom: st.zoom,
        record_saison: st.rec, playoff_result: st.po,
        use_school_socials: st.inherit,
        socials: cleanSocials(st.socials),
      },
      pennants: pennantsPreview, camps: campsPreview, needs: needsPreview, positions,
      games, commits, hiddenSections,
      heroUrl: assetUrl(st.heroPath), coachPhotoUrl: assetUrl(initial.headcoach_photo_path),
    });
    return <TeamHero team={team} cible={false} onToggleCible={() => {}} />;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debKey, identity, assetUrl, cleanSocials]);

  return (
    <section className="sec">
      <div className="sech"><span className="num">2</span><h2>Hero de l&apos;équipe</h2><span className="tag man">MANUEL</span></div>
      <div className="cols">
        <div>
          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="pt"><span className="n">1</span>PHOTO HERO + CADRAGE</div>
            <div className="drop" onClick={pickPhoto}>
              <b>{heroPath ? "Photo de l'équipe ✓ — remplacer" : "Photo de l'équipe / action"}</b>
              Large · JPG/PNG · AUCUN mineur identifiable sans consentement (Loi 25)
            </div>
            <label className="fl">Cadrage — glisse le point sur le sujet, ajuste le zoom</label>
            <div
              className="crop" ref={cropRef}
              onMouseDown={(e) => { dragging.current = true; setFromEvent(e.clientX, e.clientY); }}
            >
              {/* la photo vit dans une couche à part : le zoom l'agrandit autour
                  du point focal, exactement comme le hero public le fera */}
              {heroUrl && (
                <div
                  className="cropimg"
                  style={{
                    backgroundImage: `url(${heroUrl})`,
                    backgroundPosition: `${fx}% ${fy}%`,
                    transform: `scale(${zoom / 100})`,
                    transformOrigin: `${fx}% ${fy}%`,
                  }}
                />
              )}
              <div className="grid9" />
              <div className="dot" style={{ left: `${fx}%`, top: `${fy}%` }} />
            </div>
            <div className="zoomrow">
              🔍 <input type="range" min={100} max={220} value={zoom} onChange={(e) => setZoom(+e.target.value)} />
              <span>{zoom}%</span>
            </div>
            <div className="note">
              Stocké en <b>focal x/y % + zoom</b> — le hero recadre exactement là où t&apos;as pointé, à toutes les tailles.
            </div>
          </div>

          <div className="panel" style={{ marginBottom: 14 }}>
            <div className="pt"><span className="n">2</span>RECORD &amp; PLAYOFFS — PRÉ-REMPLIS RSEQ, TOI T&apos;AS LE DERNIER MOT</div>
            <div className="row2">
              <div>
                <label className="fl">Record de saison</label>
                <input className="ti" maxLength={7} value={rec} onChange={(e) => setRec(e.target.value)} placeholder="8-2" />
                {recordHint ? (
                  <div className="hint" onClick={() => { setRec(recordHint); toast("Record RSEQ appliqué — tu peux le corriger librement"); }}>
                    <b>RSEQ calcule : {recordHint}</b> (matchs joués en DB) — cliquer pour appliquer
                  </div>
                ) : (
                  <div className="note">Aucun match joué avec score en DB pour cette saison — saisis ton record.</div>
                )}
              </div>
              <div>
                <label className="fl">Résultat séries (libre)</label>
                <input className="ti" maxLength={30} value={po} onChange={(e) => setPo(e.target.value)} placeholder="Finalistes Bol d'Or" />
              </div>
            </div>
            <div className="note">
              Pré-rempli depuis les <b>matchs RSEQ en DB</b> (W-L des scores, forfaits exclus). Un doute ? Corrige : <b>ta valeur gagne</b>.
            </div>
          </div>

          <div className="panel">
            <div className="pt"><span className="n">3</span>RÉSEAUX DE L&apos;ÉQUIPE</div>
            <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}>
              <input type="checkbox" checked={inherit} onChange={(e) => setInherit(e.target.checked)} />
              Utiliser les réseaux de l&apos;école
            </label>
            {!inherit && (
              <div style={{ marginTop: 12 }}>
                {socials.map((s, i) => (
                  <div key={s.uid} className="nrow" style={{ gridTemplateColumns: ".8fr 2fr auto" }}>
                    <select
                      className="ti" value={s.type}
                      onChange={(e) => setSocials((rs) => rs.map((x, k) => (k === i ? { ...x, type: e.target.value as SocialPlatform } : x)))}
                    >
                      {PLATFORMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
                    </select>
                    <input
                      className="ti" placeholder={PLATFORMS.find((p) => p.key === s.type)?.ph ?? "https://…"}
                      value={s.url}
                      onChange={(e) => setSocials((rs) => rs.map((x, k) => (k === i ? { ...x, url: e.target.value } : x)))}
                    />
                    <button className="xbtn" title="Retirer" onClick={() => setSocials((rs) => rs.filter((_, k) => k !== i))}>✕</button>
                  </div>
                ))}
                <button
                  className="addbtn"
                  onClick={() => {
                    if (socials.length >= MAX_SOCIALS) { toast(`Maximum ${MAX_SOCIALS} liens`); return; }
                    setSocials((rs) => [...rs, { uid: newUid(), type: "instagram", url: "" }]);
                  }}
                >+ Ajouter un lien</button>
              </div>
            )}
            <div className="note">
              {inherit
                ? <>L&apos;école n&apos;a pas encore de champ « réseaux » : tant qu&apos;il n&apos;existe pas, l&apos;héritage n&apos;affiche <b>aucune</b> icône — jamais un lien inventé.</>
                : <>Jusqu&apos;à <b>{MAX_SOCIALS}</b> liens, dans l&apos;ordre où tu les ranges. Une ligne sans URL n&apos;est pas enregistrée.</>}
            </div>
          </div>
        </div>

        <div className="pv">
          <div className="pvhead">APERÇU LIVE — LE VRAI HERO</div>
          <TeamPreviewShell focal={`${fx}% ${fy}%`} zoom={zoom}>{preview}</TeamPreviewShell>
        </div>
      </div>
    </section>
  );
}

/** Les aperçus ont besoin des slices des autres sections (elles vivent dans le
 *  contexte, pas dans le state local) — un petit hook pour ne pas répéter. */
function useHeroDeps() {
  const ctx = useTeamEditor();
  return {
    ...ctx,
    pennantsPreview: ctx.initialPennants,
    campsPreview: ctx.initialCamps,
    needsPreview: ctx.initialNeeds,
  };
}
