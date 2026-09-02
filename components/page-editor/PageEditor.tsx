"use client";

// components/page-editor/PageEditor.tsx
//
// Éditeur « Ma page » CÉGEP — Bloc 2 étape 4a : câblage RÉEL. Charge l'école du
// compte connecté (SchoolPageEditorProvider → useCurrentUser), chaque section
// s'initialise depuis la DB et reporte son slice ; « Enregistrer » = saveAll
// (UPDATE/INSERT/DELETE via le client authentifié, la RLS fait le contrôle),
// « Aperçu » ouvre la page publique avec l'état sauvé. Badge dirty/saved réel.
// 8 sections, previews live sticky à droite, topbar sticky. CSS scopé sous .pe.
// Aucune police réimportée : Outfit/Anton/Bebas Neue viennent de la route de test.

import * as React from "react";
import { ToastProvider, useToast } from "./toast";
import { PREVIEW_CSS } from "./PreviewShell";
import { SchoolPageEditorProvider, useEditor } from "./editorContext";
import IdentityWall from "./IdentityWall";
import SportsAffiche from "./SportsAffiche";
import SaisonEnCoursSection from "./SaisonEnCoursSection";
import CampusSection from "./CampusSection";
import AboutSell from "./AboutSell";
import ProgramsSection from "./ProgramsSection";
import ParcoursSection from "./ParcoursSection";
import NewsSection from "./NewsSection";
import PlatformSection from "./PlatformSection";

function Topbar() {
  const toast = useToast();
  const { schoolId, schoolName, saveAll, dirty, saving } = useEditor();

  const onSave = async () => {
    try {
      await saveAll();
      toast("Page enregistrée");
    } catch (e) {
      toast("Échec de l'enregistrement : " + (e instanceof Error ? e.message : "erreur"));
    }
  };
  // Aperçu = page publique réelle avec l'état SAUVÉ (nouvel onglet). Si brouillon
  // → mini-confirm pour rappeler que l'aperçu ne montre pas les modifs non sauvées.
  const onPreview = () => {
    if (dirty && !window.confirm("Modifications non enregistrées — l'aperçu montrera la dernière sauvegarde. Continuer ?")) return;
    // LA VRAIE page publique, pas /page-test : cette route-la vit dans app/(dev)
    // et rend 404 des NODE_ENV=production. L'editeur, lui, tourne desormais dans
    // le portail admin, qui fonctionne EN production — le lien y serait mort.
    window.open(`/college/${schoolId}`, "_blank", "noopener");
  };

  const saved = !dirty;
  return (
    <div className="topbar"><div className="tb">
      <span className="kick">MA PAGE</span>
      <h1>{schoolName}</h1>
      <span className={"status" + (saved ? " saved" : "")}>{saving ? "…" : saved ? "ENREGISTRÉ" : "BROUILLON"}</span>
      <span className="sp"></span>
      <span className="tb-hint">👁 L'aperçu montre la version <b>enregistrée</b></span>
      <button className="btn ghost" onClick={onPreview} title="Ouvre la page publique telle qu'elle est ENREGISTRÉE">👁 Aperçu</button>
      <button className="btn prim" onClick={onSave} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</button>
    </div></div>
  );
}

// Corps de l'éditeur — DANS le provider (sections lisent ctx.initial). Les
// valeurs S1 partagées (nick/init/nbath/slog) sont remontées ici depuis l'init
// DB et passées à S1 (IdentityWall) + S6 (ParcoursSection : route + marker).
function EditorBody() {
  const { initial } = useEditor();
  const [nick, setNick] = React.useState(initial.nick);
  const [init, setInit] = React.useState(initial.init);
  const [nbath, setNbath] = React.useState(initial.nbath);
  const [slog, setSlog] = React.useState(initial.slog);

  return (
    <>
      <Topbar />
      <div className="wrap">
        <div className="head">
          <div className="cap">ÉDITEUR « MA PAGE » · desktop · recruteur / gestionnaire du collège (comptes validés)</div>
          <div className="sub">L'éditeur suit <b>l'ordre exact de la page publique</b>. Tu édites ce qui t'appartient (badge <b style={{ color: "var(--nexus)" }}>MANUEL</b>), le reste est automatique (badge <b style={{ color: "var(--ok)" }}>AUTO</b>) — visible mais verrouillé, jamais un mystère. Budget total : <b>~5 minutes</b>.</div>
        </div>

        <IdentityWall nick={nick} setNick={setNick} slog={slog} setSlog={setSlog} init={init} setInit={setInit} nbath={nbath} setNbath={setNbath} />
        <SportsAffiche />
        <SaisonEnCoursSection />
        <CampusSection />
        <AboutSell />
        <ProgramsSection />
        <ParcoursSection nick={nick} init={init} nbath={nbath} slog={slog} />
        <NewsSection />
        <PlatformSection />
      </div>
    </>
  );
}

/** `schoolIdParam` : le college de la fiche admin ouverte. Honore uniquement
 *  pour un admin plateforme — voir SchoolPageEditorProvider. */
export default function PageEditor({ schoolIdParam }: { schoolIdParam?: string }) {
  return (
    <div className="pe">
      <style dangerouslySetInnerHTML={{ __html: PE_CSS }} />
      {/* CSS scopé .pp (DNA_CSS + PP_CSS) injecté UNE fois — partagé par tous les
          previews « vrai composant » (voir PreviewShell). */}
      <style dangerouslySetInnerHTML={{ __html: PREVIEW_CSS }} />
      <ToastProvider>
        <SchoolPageEditorProvider schoolIdParam={schoolIdParam}>
          <EditorBody />
        </SchoolPageEditorProvider>
      </ToastProvider>
    </div>
  );
}

/* ---------------------------------------- scoped CSS (port 1:1, préfixe .pe) - */
const PE_CSS = `
.pe{--red:#A6192E;--redD:#7A1222;--redL:#E8C7CD;--bg:#111317;--card:#1A1D24;--card2:#20242D;--in:#171A20;--line:#2A2F3A;--txt:#EDEFF3;--mut:#8A909C;--nexus:#E63946;--ok:#22C55E;--warn:#F59E0B;background:var(--bg);color:var(--txt);font-family:'Outfit';padding-bottom:80px;min-height:100vh}
.pe *{box-sizing:border-box;margin:0;padding:0}
.pe .wrap{width:min(1240px,100%);margin:0 auto;padding:0 16px}
.pe .pe-load{min-height:60vh;display:flex;align-items:center;justify-content:center;color:var(--mut);font-family:'Bebas Neue';letter-spacing:.18em;font-size:16px;text-align:center;padding:40px}
.pe .pe-load.pe-err{color:var(--warn)}
.pe .btn:disabled{opacity:.6;cursor:default}
/* topbar */
.pe .topbar{position:sticky;top:0;z-index:50;background:rgba(17,19,23,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.pe .tb{width:min(1240px,100%);margin:0 auto;padding:12px 16px;display:flex;align-items:center;gap:14px}
.pe .tb .kick{font-family:'Bebas Neue';letter-spacing:.22em;font-size:12px;color:var(--mut)}
.pe .tb h1{font-size:17px;font-weight:800}
.pe .status{font-family:'Bebas Neue';letter-spacing:.14em;font-size:11px;color:var(--warn);border:1px solid var(--warn);padding:3px 10px;border-radius:99px}
.pe .status.saved{color:var(--ok);border-color:var(--ok)}
.pe .tb .sp{flex:1}
.pe .tb-hint{font-size:11px;color:var(--mut);margin-right:2px;white-space:nowrap}
.pe .tb-hint b{color:#B9BFC9}
.pe .btn{font-family:'Outfit';font-weight:700;font-size:13px;border-radius:10px;padding:10px 18px;cursor:pointer;transition:.15s}
.pe .btn.ghost{background:none;border:1.5px solid var(--line);color:var(--txt)}
.pe .btn.ghost:hover{border-color:#3A404D}
.pe .btn.prim{background:var(--nexus);border:1.5px solid var(--nexus);color:#fff}
.pe .btn.prim:hover{filter:brightness(1.08)}
/* header */
.pe .head{padding:26px 0 6px}
.pe .cap{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6a6f78;font-weight:700;margin-bottom:10px}
.pe .sub{color:var(--mut);font-size:13px;margin:4px 0 0;max-width:760px}
.pe .sub b{color:#B9BFC9}
/* sections */
.pe .sec{margin-top:34px}
.pe .sech{display:flex;align-items:baseline;gap:12px;margin-bottom:14px}
.pe .sech .num{font-family:'Anton';font-size:26px;color:#2E333E}
.pe .sech h2{font-family:'Anton';font-size:20px;letter-spacing:.02em;text-transform:uppercase}
.pe .sech .tag{font-family:'Bebas Neue';letter-spacing:.14em;font-size:11px;padding:3px 10px;border-radius:99px}
.pe .tag.man{color:var(--nexus);border:1px solid var(--nexus)}
.pe .tag.auto{color:var(--ok);border:1px solid var(--ok)}
/* toggle visibilité section (R3 #3) */
.pe .sech .vistoggle{margin-left:auto;display:inline-flex;align-items:center;gap:8px;background:none;border:0;cursor:pointer;font-family:'Outfit';font-weight:600;font-size:11.5px;color:var(--mut);padding:2px 0}
.pe .vistoggle .vt-track{width:34px;height:19px;border-radius:99px;background:#2A2F3A;position:relative;transition:.18s;flex:0 0 auto}
.pe .vistoggle .vt-knob{position:absolute;top:2px;left:2px;width:15px;height:15px;border-radius:50%;background:#8A909C;transition:.18s}
.pe .vistoggle.on .vt-track{background:var(--ok)}
.pe .vistoggle.on .vt-knob{left:17px;background:#fff}
.pe .vistoggle.on .vt-lab{color:#B9BFC9}
.pe .sec-hidden{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;background:var(--card);border:1.5px dashed var(--line);border-radius:16px;padding:20px 22px;color:#6A6F78;font-size:13px}
.pe .sec-hidden b{color:#8A909C}
.pe .cols{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.pe .panel{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px}
.pe .pt{font-family:'Bebas Neue';letter-spacing:.2em;font-size:13px;color:var(--mut);margin-bottom:12px;display:flex;align-items:center;gap:8px}
.pe .pt .n{background:var(--nexus);color:#fff;font-family:'Outfit';font-weight:800;font-size:11px;width:20px;height:20px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center}
.pe .note{font-size:11.5px;color:var(--mut);margin-top:10px}
.pe .note b{color:#B9BFC9}
.pe .mod{font-size:11px;color:var(--warn);margin-top:8px}
.pe label.fl{display:block;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--mut);font-weight:700;margin:14px 0 6px}
.pe label.fl:first-of-type{margin-top:2px}
.pe .ti{width:100%;background:var(--in);border:1.5px solid var(--line);border-radius:9px;padding:10px 12px;font-family:'Outfit';font-size:12.5px;color:var(--txt);outline:none}
.pe .ti:focus{border-color:var(--nexus)}
.pe textarea.ti{resize:vertical;min-height:84px}
.pe .cnt{font-size:10.5px;color:var(--mut);text-align:right;margin-top:3px}
.pe .row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.pe select.ti{appearance:none}
/* auto chips */
.pe .auto{display:flex;gap:8px;flex-wrap:wrap}
.pe .achip{position:relative;display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:#B9BFC9;background:var(--card2);border:1px solid var(--line);padding:7px 12px;border-radius:99px}
.pe .achip b{color:#6EE7A0;margin-right:5px}
.pe .flag{cursor:pointer;color:#5A616D;font-size:12px;border:0;background:none;padding:0}
.pe .flag:hover{color:var(--warn)}
.pe .achip.flagged{border-color:var(--warn)}
.pe .achip.flagged .fl-t{color:var(--warn);font-size:10.5px;font-weight:700}
/* checklists / radios */
.pe .cklist{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:4px}
.pe .ck{display:flex;align-items:center;gap:10px;background:var(--card2);border:1.5px solid var(--line);border-radius:11px;padding:10px 12px;cursor:pointer;user-select:none;transition:.15s}
.pe .ck:hover{border-color:#3A404D}
.pe .ck.on{border-color:var(--nexus);background:#241A1E}
.pe .ck .box{width:20px;height:20px;border-radius:6px;border:2px solid #3A404D;flex:0 0 auto;display:flex;align-items:center;justify-content:center;font-size:12px;color:#fff}
.pe .ck.on .box{background:var(--nexus);border-color:var(--nexus)}
.pe .ck .ic{font-size:16px}
.pe .ck span{font-size:12.5px;font-weight:600}
.pe .det{grid-column:1/-1;display:none;margin:-2px 0 4px}
.pe .det.show{display:block}
.pe .det input{width:100%;background:var(--in);border:1.5px solid var(--line);border-radius:9px;padding:9px 12px;font-family:'Outfit';font-size:12px;color:var(--txt);outline:none}
.pe .det input:focus{border-color:var(--nexus)}
.pe .radios{display:flex;flex-direction:column;gap:8px}
.pe .rad{display:flex;align-items:center;gap:10px;background:var(--card2);border:1.5px solid var(--line);border-radius:11px;padding:10px 12px;cursor:pointer}
.pe .rad.on{border-color:var(--nexus);background:#241A1E}
.pe .rad .dot{width:18px;height:18px;border-radius:50%;border:2px solid #3A404D;display:flex;align-items:center;justify-content:center}
.pe .rad.on .dot::after{content:"";width:9px;height:9px;border-radius:50%;background:var(--nexus)}
.pe .rad span{font-size:12.5px;font-weight:600}
/* swatches + contraste */
.pe .sw3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
.pe .sw{background:var(--card2);border:1.5px solid var(--line);border-radius:11px;padding:10px}
.pe .sw label{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--mut);font-weight:700;display:block;margin-bottom:8px}
.pe .sw input[type=color]{width:100%;height:44px;border:0;border-radius:8px;background:none;cursor:pointer}
.pe .sw .pip{margin-top:7px;width:100%;background:var(--in);border:1.5px solid var(--line);color:var(--mut);font-family:'Outfit';font-weight:700;font-size:11px;border-radius:8px;padding:6px 4px;cursor:pointer;transition:.15s}
.pe .sw .pip:hover{border-color:var(--nexus);color:var(--txt)}
.pe .cmeter{margin-top:10px;background:#16181D;border:1px solid var(--line);border-radius:11px;padding:10px 12px;font-size:12px;display:flex;align-items:center;gap:10px}
.pe .cmeter .val{font-family:'Anton';font-size:16px}
.pe .cmeter.ok .val{color:var(--ok)}
.pe .cmeter.bad .val{color:var(--warn)}
.pe .cbadge{font-family:'Bebas Neue';letter-spacing:.12em;font-size:11px;padding:2px 9px;border-radius:99px}
.pe .cmeter.ok .cbadge{color:var(--ok);border:1px solid var(--ok)}
.pe .cmeter.bad .cbadge{color:var(--warn);border:1px solid var(--warn)}
/* upload zones */
.pe .drop{border:1.5px dashed #3A404D;border-radius:11px;padding:16px;text-align:center;color:#5A616D;font-size:12px;cursor:pointer}
.pe .drop:hover{border-color:var(--nexus);color:var(--mut)}
.pe .drop b{display:block;color:#8A909C;font-size:12.5px;margin-bottom:3px}
/* budget */
.pe .budget{margin-top:16px;background:#16181D;border:1px solid var(--line);border-radius:12px;padding:12px 14px;font-size:12px;color:var(--mut)}
.pe .budget b{color:#6EE7A0}
/* previews */
.pe .pv{position:sticky;top:74px;align-self:start}
.pe .pvhead{font-family:'Bebas Neue';letter-spacing:.24em;font-size:12px;color:var(--mut);margin-bottom:12px}
.pe .facts{display:flex;flex-direction:column;gap:12px}
.pe .fact{display:flex;gap:14px;align-items:flex-start;background:#1A1D24;border:1.5px solid #262A33;border-radius:12px;padding:15px 16px}
.pe .fact .fi{width:38px;height:38px;border-radius:50%;background:var(--red);border:2.5px solid #F2F3F6;flex:0 0 auto;display:flex;align-items:center;justify-content:center;transform:rotate(-5deg);font-size:16px}
.pe .fact b{font-weight:700;font-size:14.5px;color:#EDEFF3;display:block}
.pe .fact span{font-size:12.5px;color:#8A909C}
.pe .fact.hf{border-color:var(--red)}
.pe .hbdg{display:inline-block;font-family:'Bebas Neue';letter-spacing:.16em;font-size:10.5px;background:var(--red);color:#fff;padding:3px 9px;border-radius:99px;margin-bottom:5px;transform:rotate(-1.5deg)}
.pe .empty{border:1.5px dashed var(--line);border-radius:12px;padding:18px;text-align:center;font-size:12px;color:#5A616D}
/* preview mur */
.pe .wallpv{border-radius:14px;overflow:hidden;border:1px solid var(--line)}
.pe .wp-card{padding:26px 22px;text-align:center}
.pe .wp-name{font-family:'Anton';font-size:38px;letter-spacing:.04em;line-height:1}
.pe .wp-slog{font-size:12.5px;font-style:italic;margin-top:8px;opacity:.85}
.pe .wp-tag{display:inline-block;font-family:'Bebas Neue';letter-spacing:.2em;font-size:12px;margin-top:10px;padding:2px 12px;border:1.5px solid currentColor;border-radius:99px}
.pe .wp-words{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;padding:14px;background:var(--bg)}
.pe .wp-w{font-family:'Bebas Neue';letter-spacing:.14em;font-size:13px;color:#3B414D;border:1px dashed #2A2F3A;padding:3px 10px;border-radius:6px}
.pe .wp-tick{font-family:'Bebas Neue';letter-spacing:.18em;font-size:11.5px;color:#B9BFC9;background:#0B0C0E;padding:8px 12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
/* affiche AUTO */
.pe .aff{opacity:.55;pointer-events:none}
.pe .affrow{display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--line);padding:12px 4px}
.pe .affrow:last-child{border-bottom:0}
.pe .affrow .s{font-family:'Anton';font-size:19px;letter-spacing:.02em;flex:1}
.pe .pill{font-family:'Bebas Neue';letter-spacing:.12em;font-size:11px;color:#B9BFC9;border:1px solid var(--line);padding:2px 9px;border-radius:99px}
.pe .autolink{font-size:12.5px;font-weight:700;color:var(--ok);margin-top:12px;display:inline-block;cursor:pointer}
/* programmes */
.pe .prog{display:flex;align-items:center;gap:10px;background:var(--card2);border:1.5px solid var(--line);border-radius:11px;padding:9px 12px;cursor:pointer;user-select:none}
.pe .prog.on{border-color:var(--nexus);background:#241A1E}
.pe .prog .box{width:18px;height:18px;border-radius:5px;border:2px solid #3A404D;flex:0 0 auto;display:flex;align-items:center;justify-content:center;font-size:11px;color:#fff}
.pe .prog.on .box{background:var(--nexus);border-color:var(--nexus)}
.pe .prog span{font-size:12.5px;font-weight:600;flex:1}
.pe .star{border:0;background:none;font-size:15px;color:#3A404D;cursor:pointer;padding:0 2px}
.pe .prog.on .star{color:#4A5160}
.pe .prog.on .star.on{color:var(--warn)}
.pe .plist{display:flex;flex-direction:column;gap:7px;max-height:280px;overflow:auto;padding-right:4px}
.pe .vchip{display:inline-flex;align-items:center;gap:6px;background:var(--card2);border:1px solid var(--warn);color:#EDEFF3;font-size:12px;font-weight:700;padding:6px 11px;border-radius:99px}
.pe .vchip i{color:var(--warn);font-style:normal}
/* universités picker */
.pe .uwrap{display:flex;gap:8px;flex-wrap:wrap}
.pe .uchip{font-size:12px;font-weight:600;color:#B9BFC9;background:var(--card2);border:1.5px solid var(--line);padding:7px 12px;border-radius:99px;cursor:pointer;user-select:none}
.pe .uchip.on{border-color:var(--nexus);color:#fff;background:#241A1E}
/* parcours preview */
.pe .route{display:flex;align-items:center;gap:10px;justify-content:center;font-family:'Bebas Neue';letter-spacing:.14em;font-size:14px;color:#B9BFC9;padding:6px 0 14px}
.pe .route .arrow{color:#3B414D}
.pe .route .hot{color:var(--red)}
.pe .pstats{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
.pe .pstat{background:#1A1D24;border:1.5px solid #262A33;border-radius:12px;padding:12px;text-align:center}
.pe .pstat .v{font-family:'Anton';font-size:26px}
.pe .pstat .l{font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:var(--mut);margin-top:2px}
.pe .upills{display:flex;gap:7px;flex-wrap:wrap;justify-content:center;margin-top:12px}
.pe .upill{font-size:11.5px;font-weight:700;color:#EDEFF3;border:1px solid #3A404D;padding:4px 11px;border-radius:99px}
/* news */
.pe .nrow{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;margin-bottom:8px}
.pe .xbtn{border:1.5px solid var(--line);background:none;color:#5A616D;border-radius:9px;width:38px;cursor:pointer;font-size:15px}
.pe .xbtn:hover{color:var(--nexus);border-color:var(--nexus)}
.pe .addbtn{margin-top:4px;background:none;border:1.5px dashed var(--line);color:var(--mut);font-family:'Outfit';font-weight:700;font-size:12.5px;border-radius:10px;padding:9px 14px;cursor:pointer;width:100%}
.pe .addbtn:hover{border-color:var(--nexus);color:var(--txt)}
.pe .newspv b{display:block;font-size:13.5px}
.pe .newspv .dom{font-family:'Bebas Neue';letter-spacing:.1em;font-size:10.5px;color:var(--mut);border:1px solid var(--line);padding:1px 8px;border-radius:99px;margin-top:4px;display:inline-block}
/* plateforme recap */
.pe .pfgrid{display:flex;gap:10px;flex-wrap:wrap}
.pe .pfchip{font-size:12px;font-weight:600;color:#8A909C;background:var(--card2);border:1px dashed var(--line);padding:8px 13px;border-radius:99px}
.pe .pfchip b{color:#B9BFC9}
/* preview S1 — hôte du VRAI ProgramWall + Ticker.tsx (câblage éditeur) */
.pe .pe-wallhost{border-radius:14px;overflow:hidden;border:1px solid var(--line)}
.pe .ticker{overflow:hidden;background:#0C0E11;border-top:1px solid #1E2129}
.pe .ticker-in{display:flex;align-items:center;width:max-content;animation:petick 26s linear infinite;padding:10px 0}
.pe .ticker span{font-family:'Bebas Neue';letter-spacing:.22em;font-size:14px;white-space:nowrap;padding:0 18px;color:#C9CCD4}
.pe .ticker span.g{color:var(--red);filter:brightness(1.45)}
.pe .ticker i{color:#3A404D;font-style:normal}
@keyframes petick{to{transform:translateX(-50%)}}
@media(prefers-reduced-motion:reduce){.pe .ticker-in{animation:none}}
/* toast */
.pe .pe-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);background:#20242D;border:1px solid var(--line);color:var(--txt);font-size:13px;font-weight:600;padding:12px 20px;border-radius:12px;opacity:0;transition:.25s;pointer-events:none;z-index:99}
.pe .pe-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
.pe .pe-toast.error{background:#2A1416;border-color:#E63946;color:#FCA5A5;max-width:min(560px,92vw);white-space:pre-wrap;text-align:left}
`;
