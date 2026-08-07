"use client";

// components/team-editor/TeamEditor.tsx
//
// Éditeur « Page équipe » CÉGEP — le jumeau de « Ma page », une page d'édition
// PAR équipe. Port 1:1 de docs/reference/editeur-page-equipe-mock.html
// (sha256 271f6734…), avec les VRAIS composants team-page en aperçu.
// « Enregistrer » = saveAll (RLS can_edit_team_page) ; « Aperçu » ouvre la page
// publique telle qu'elle est ENREGISTRÉE. CSS scopé sous .te.

import * as React from "react";
import { ToastProvider, useToast } from "@/components/page-editor/toast";
import { TEAM_PREVIEW_CSS } from "./PreviewShell";
import { TeamPageEditorProvider, useTeamEditor } from "./teamEditorContext";
import HeritageSection from "./HeritageSection";
import HeroSection from "./HeroSection";
import CalendarCampsSection from "./CalendarCampsSection";
import PresentationEditorSection from "./PresentationEditorSection";
import BesoinsSection from "./BesoinsSection";
import EngageesSection from "./EngageesSection";

function Topbar() {
  const toast = useToast();
  const { identity, saveAll, dirty, saving } = useTeamEditor();

  const onSave = async () => {
    try { await saveAll(); toast("Page équipe enregistrée"); }
    catch (e) { toast("Échec de l'enregistrement : " + (e instanceof Error ? e.message : "erreur")); }
  };
  const onPreview = () => {
    if (dirty && !window.confirm("Modifications non enregistrées — l'aperçu montrera la dernière sauvegarde. Continuer ?")) return;
    // LA VRAIE page publique. /team-test vit dans app/(dev) et rend 404 des
    // NODE_ENV=production, alors que l'editeur tourne maintenant dans le
    // portail admin, qui fonctionne en production.
    window.open(`/college/${identity.schoolId}/${identity.teamId}`, "_blank", "noopener");
  };

  const saved = !dirty;
  return (
    <div className="topbar"><div className="tb">
      <span className="kick">PAGE ÉQUIPE</span>
      <h1>{identity.schoolName}</h1>
      <span className="teamchip">
        {[identity.sportNom, identity.division, identity.genre].filter(Boolean).join(" · ").toUpperCase()}
      </span>
      <span className={"status" + (saved ? " saved" : "")}>{saving ? "…" : saved ? "ENREGISTRÉ" : "BROUILLON"}</span>
      <span className="actions">
        <span className="tb-hint">👁 L&apos;aperçu montre la version <b>enregistrée</b></span>
        <button className="btn ghost" onClick={onPreview}>👁 Aperçu</button>
        <button className="btn prim" onClick={onSave} disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</button>
      </span>
    </div></div>
  );
}

function EditorBody() {
  return (
    <>
      <Topbar />
      <div className="wrap">
        <div className="head">
          <div className="cap">ÉDITEUR « PAGE ÉQUIPE » · desktop · une page par équipe · recruteurs + gestionnaires du collège</div>
          <div className="sub">
            Même logique que « Ma page » : tu édites le <b style={{ color: "var(--nexus)" }}>MANUEL</b>, le reste est{" "}
            <b style={{ color: "var(--ok)" }}>AUTO</b> (identité école, calendrier RSEQ) ou{" "}
            <b style={{ color: "#3B82F6" }}>PLATEFORME</b> (engagements). L&apos;aperçu de la page publique montre la
            version <b>enregistrée</b>.
          </div>
        </div>
        <HeritageSection />
        <HeroSection />
        <CalendarCampsSection />
        <PresentationEditorSection />
        <BesoinsSection />
        <EngageesSection />
      </div>
    </>
  );
}

export default function TeamEditor({ teamId }: { teamId: string }) {
  return (
    <div className="te">
      <style dangerouslySetInnerHTML={{ __html: TE_CSS }} />
      {/* CSS scopé .tp (DNA + TeamPage) injecté UNE fois — partagé par tous les aperçus. */}
      <style dangerouslySetInnerHTML={{ __html: TEAM_PREVIEW_CSS }} />
      <ToastProvider>
        <TeamPageEditorProvider teamId={teamId}>
          <EditorBody />
        </TeamPageEditorProvider>
      </ToastProvider>
    </div>
  );
}

/* ---------------------------------------- scoped CSS (port 1:1, préfixe .te) - */
const TE_CSS = `
.te{--red:#A6192E;--redD:#5A0E1B;--redL:#E8C7CD;--bg:#111317;--card:#1A1D24;--card2:#20242D;--in:#171A20;--line:#2A2F3A;--txt:#EDEFF3;--mut:#8A909C;--nexus:#E63946;--ok:#22C55E;--warn:#F59E0B;background:var(--bg);color:var(--txt);font-family:'Outfit';padding-bottom:80px;min-height:100vh}
.te *{box-sizing:border-box;margin:0;padding:0}
.te .wrap{width:min(1240px,100%);margin:0 auto;padding:0 16px}
.te .te-load{min-height:60vh;display:flex;align-items:center;justify-content:center;color:var(--mut);font-family:'Bebas Neue';letter-spacing:.18em;font-size:16px;text-align:center;padding:40px}
.te .te-load.te-err{color:var(--warn)}
.te .btn:disabled{opacity:.6;cursor:default}
/* topbar */
.te .topbar{position:sticky;top:0;z-index:50;background:rgba(17,19,23,.92);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
/* La barre ENVELOPPE : sans ça, les items non sécables (nom du collège, chip
   sport, hint) poussaient « Enregistrer » hors du viewport sous ~835 px utiles
   — bouton invisible, donc « le save ne marche pas ». Les actions restent
   toujours atteignables, quitte à passer sur une 2e ligne. */
.te .tb{width:min(1240px,100%);margin:0 auto;padding:12px 16px;display:flex;align-items:center;gap:14px;flex-wrap:wrap}
.te .tb .kick{font-family:'Bebas Neue';letter-spacing:.22em;font-size:12px;color:var(--mut);flex:0 0 auto}
.te .tb h1{font-size:16px;font-weight:800;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:38ch}
.te .tb .actions{display:flex;align-items:center;gap:10px;margin-left:auto;flex:0 0 auto}
.te .teamchip{font-family:'Bebas Neue';letter-spacing:.12em;font-size:12px;color:#fff;background:var(--red);padding:4px 12px;border-radius:99px;white-space:nowrap}
@media(max-width:1080px){.te .tb-hint{display:none}}
.te .status{font-family:'Bebas Neue';letter-spacing:.14em;font-size:11px;color:var(--warn);border:1px solid var(--warn);padding:3px 10px;border-radius:99px}
.te .status.saved{color:var(--ok);border-color:var(--ok)}
.te .tb .sp{flex:1}
.te .tb-hint{font-size:11px;color:var(--mut);white-space:nowrap}
.te .tb-hint b{color:#B9BFC9}
.te .btn{font-family:'Outfit';font-weight:700;font-size:13px;border-radius:10px;padding:10px 18px;cursor:pointer;transition:.15s}
.te .btn.ghost{background:none;border:1.5px solid var(--line);color:var(--txt)}
.te .btn.ghost:hover{border-color:#3A404D}
.te .btn.prim{background:var(--nexus);border:1.5px solid var(--nexus);color:#fff}
/* header */
.te .head{padding:26px 0 6px}
.te .cap{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#6a6f78;font-weight:700;margin-bottom:10px}
.te .sub{color:var(--mut);font-size:13px;margin:4px 0 0;max-width:780px}
.te .sub b{color:#B9BFC9}
/* sections */
.te .sec{margin-top:34px}
.te .sech{display:flex;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap}
.te .sech .num{font-family:'Anton';font-size:26px;color:#2E333E}
.te .sech h2{font-family:'Anton';font-size:20px;letter-spacing:.02em;text-transform:uppercase}
.te .tag{font-family:'Bebas Neue';letter-spacing:.14em;font-size:11px;padding:3px 10px;border-radius:99px}
.te .tag.man{color:var(--nexus);border:1px solid var(--nexus)}
.te .tag.auto{color:var(--ok);border:1px solid var(--ok)}
.te .tag.plat{color:#3B82F6;border:1px solid #3B82F6}
/* toggle visibilité */
.te .sech .vistoggle{margin-left:auto;display:inline-flex;align-items:center;gap:8px;background:none;border:0;cursor:pointer;font-family:'Outfit';font-weight:600;font-size:11.5px;color:var(--mut);padding:2px 0}
.te .vistoggle .vt-track{width:34px;height:19px;border-radius:99px;background:#2A2F3A;position:relative;transition:.18s;flex:0 0 auto}
.te .vistoggle .vt-knob{position:absolute;top:2px;left:2px;width:15px;height:15px;border-radius:50%;background:#8A909C;transition:.18s}
.te .vistoggle.on .vt-track{background:var(--ok)}
.te .vistoggle.on .vt-knob{left:17px;background:#fff}
.te .vistoggle.on .vt-lab{color:#B9BFC9}
.te .sec-hidden{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;background:var(--card);border:1.5px dashed var(--line);border-radius:16px;padding:20px 22px;color:#6A6F78;font-size:13px}
.te .sec-hidden b{color:#8A909C}
.te .cols{display:grid;grid-template-columns:1fr 1fr;gap:18px;align-items:start}
.te .panel{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:18px}
.te .pt{font-family:'Bebas Neue';letter-spacing:.2em;font-size:13px;color:var(--mut);margin-bottom:12px;display:flex;align-items:center;gap:8px}
.te .pt .n{background:var(--nexus);color:#fff;font-family:'Outfit';font-weight:800;font-size:11px;width:20px;height:20px;border-radius:6px;display:inline-flex;align-items:center;justify-content:center}
.te .note{font-size:11.5px;color:var(--mut);margin-top:10px}
.te .note b{color:#B9BFC9}
.te .mod{font-size:11px;color:var(--warn);margin-top:8px}
.te label.fl{display:block;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--mut);font-weight:700;margin:14px 0 6px}
.te .ti{width:100%;background:var(--in);border:1.5px solid var(--line);border-radius:9px;padding:10px 12px;font-family:'Outfit';font-size:12.5px;color:var(--txt);outline:none}
.te .ti:focus{border-color:var(--nexus)}
.te textarea.ti{resize:vertical;min-height:84px}
.te .cnt{font-size:10.5px;color:var(--mut);text-align:right;margin-top:3px}
.te .row2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
/* Bloc « un événement » — pile verticale. La rangée à trois champs ne tenait
   pas dans la colonne de gauche (~286px de panneau) : input[type=date] refuse
   de descendre sous ~135px en Chrome, et comme .ti est en width:100% les deux
   champs texte encaissaient toute la perte, à ~26px chacun. */
.te .evrow{border:1.5px solid var(--line);border-radius:12px;padding:12px 12px 14px;margin-bottom:10px}
.te .evhead{display:flex;align-items:center;justify-content:space-between;gap:8px;
  font-family:'Bebas Neue';letter-spacing:.16em;font-size:12px;color:var(--mut)}
.te .evhead .xbtn{height:28px;width:32px;font-size:13px;line-height:1}
.te .evrow label.fl{margin-top:10px}
/* Date + lieu côte à côte quand la place le permet, empilés sinon. Le 140px
   couvre le minimum incompressible du sélecteur de date. */
.te .evduo{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}
.te select.ti{appearance:none}
.te .auto{display:flex;gap:8px;flex-wrap:wrap}
.te .achip{display:inline-flex;align-items:center;gap:8px;font-size:12px;font-weight:600;color:#B9BFC9;background:var(--card2);border:1px solid var(--line);padding:7px 12px;border-radius:99px}
.te .achip b{color:#6EE7A0;margin-right:5px}
.te .autolink{font-size:12.5px;font-weight:700;color:var(--ok);margin-top:12px;display:inline-block;cursor:pointer;text-decoration:none}
.te .hint{display:inline-flex;align-items:center;gap:8px;font-size:11.5px;color:#B9BFC9;background:#16221B;border:1px solid #1E4230;border-radius:9px;padding:7px 11px;margin-top:8px;cursor:pointer}
.te .hint b{color:var(--ok)}
.te .hint:hover{border-color:var(--ok)}
.te .drop{border:1.5px dashed #3A404D;border-radius:11px;padding:16px;text-align:center;color:#5A616D;font-size:12px;cursor:pointer}
.te .drop:hover{border-color:var(--nexus);color:var(--mut)}
.te .drop b{display:block;color:#8A909C;font-size:12.5px;margin-bottom:3px}
/* cadrage hero */
.te .crop{position:relative;height:150px;border-radius:11px;overflow:hidden;border:1.5px solid var(--line);margin-top:10px;background:linear-gradient(135deg,#3A2226 0%,#1A1D24 40%,#232A38 70%,#14171D 100%);cursor:grab}
.te .crop .cropimg{position:absolute;inset:0;background-size:cover;background-repeat:no-repeat;will-change:transform}
.te .crop .grid9{position:absolute;inset:0;background:linear-gradient(#ffffff14 1px,transparent 1px) 0 0/100% 33.4%,linear-gradient(90deg,#ffffff14 1px,transparent 1px) 0 0/33.4% 100%}
.te .crop .dot{position:absolute;width:26px;height:26px;border-radius:50%;border:3px solid var(--nexus);background:#E6394633;transform:translate(-50%,-50%);cursor:grab}
.te .zoomrow{display:flex;align-items:center;gap:10px;margin-top:10px;font-size:11.5px;color:var(--mut)}
.te .zoomrow input[type=range]{flex:1;accent-color:var(--nexus)}
/* listes éditables */
.te .nrow{display:grid;grid-template-columns:1fr 1fr auto;gap:8px;margin-bottom:8px}
.te .xbtn{border:1.5px solid var(--line);background:none;color:#5A616D;border-radius:9px;width:38px;cursor:pointer;font-size:15px}
.te .xbtn:hover{color:var(--nexus);border-color:var(--nexus)}
.te .addbtn{margin-top:4px;background:none;border:1.5px dashed var(--line);color:var(--mut);font-family:'Outfit';font-weight:700;font-size:12.5px;border-radius:10px;padding:9px 14px;cursor:pointer;width:100%}
.te .addbtn:hover{border-color:var(--nexus);color:var(--txt)}
/* calendrier AUTO */
.te .aff{opacity:.72}
.te .calrow{display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--line);padding:10px 4px;font-size:12.5px}
.te .calrow:last-of-type{border-bottom:0}
.te .calrow .d{font-family:'Bebas Neue';letter-spacing:.1em;color:var(--mut);width:92px}
.te .calrow .vs{flex:1;font-weight:600}
.te .calrow .sc{font-family:'Anton';font-size:15px}
.te .calrow .sc.w{color:var(--ok)}
.te .calrow .sc.l{color:var(--nexus)}
/* besoins builder */
.te .ftabs{display:flex;gap:8px;margin-bottom:12px}
.te .ftab{font-family:'Bebas Neue';letter-spacing:.14em;font-size:12px;padding:6px 16px;border-radius:99px;border:1.5px solid var(--line);color:var(--mut);cursor:pointer;user-select:none}
.te .ftab.on{border-color:var(--nexus);color:#fff;background:#241A1E}
.te .prow{border:1px solid var(--line);border-radius:11px;margin-bottom:8px;overflow:visible}
.te .prow .sum{display:flex;align-items:center;gap:12px;padding:11px 13px;cursor:pointer;user-select:none}
.te .prow .sum:hover{background:#1E222B}
.te .prow .sum .a{font-family:'Anton';font-size:17px;color:var(--red);min-width:38px;text-align:center}
.te .prow .sum b{font-size:13px;flex:1}
/* Badge de niveau — MÊME échelle que le terrain public (éteint → neutre →
   ambre → rouge), pour que l'éditeur ne mente pas sur ce que voit l'athlète. */
.te .lvlb{font-family:'Bebas Neue';letter-spacing:.1em;font-size:10.5px;padding:3px 10px;border-radius:99px;border:1px solid #2E333E;color:#5A616D;background:#191C22;white-space:nowrap}
.te .lvlb.l1{color:#C9CED8;border-color:#5A616D;background:#20242D}
.te .lvlb.l2{color:#F59E0B;border-color:#F59E0B;background:#241D0E;font-weight:700}
.te .lvlb.l3{color:#fff;border-color:var(--nexus);background:var(--nexus);font-weight:700;box-shadow:0 0 12px -2px rgba(230,57,70,.55)}
/* la ligne entière porte le niveau : repérable sans lire le badge */
.te .prow:has(.lvlb.l2){border-color:rgba(245,158,11,.45)}
.te .prow:has(.lvlb.l3){border-color:var(--nexus);box-shadow:0 0 0 1px rgba(230,57,70,.25)}
.te .prow .chev{color:#5A616D;font-size:12px}
.te .prow .body{display:none;padding:0 13px 13px;border-top:1px solid var(--line)}
.te .prow.open .body{display:block}
.te .lvlseg{display:flex;gap:6px;margin-top:6px}
.te .lvlseg span{flex:1;text-align:center;font-size:11.5px;font-weight:700;padding:8px 4px;border:1.5px solid var(--line);border-radius:9px;color:var(--mut);cursor:pointer;user-select:none}
.te .lvlseg span.on{border-color:var(--nexus);color:#fff;background:#241A1E}
.te .helper{font-size:11px;color:#8A909C;margin-top:6px;line-height:1.5}
.te .helper b{color:#B9BFC9}
.te .ti.acro{text-align:center;font-family:'Anton';text-transform:uppercase}
.te .posrow{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px;align-items:center}
.te .poschip{font-size:11px;font-weight:600;color:#B9BFC9;background:var(--card2);border:1.5px solid var(--line);padding:4px 10px;border-radius:99px;cursor:pointer;user-select:none}
.te .poschip.on{border-color:var(--nexus);color:#fff;background:#241A1E}
.te .poschip .rm{margin-left:6px;color:#5A616D;font-weight:800}
.te .poschip:hover .rm{color:var(--nexus)}
.te .posadd{position:relative}
.te .posadd>button{background:none;border:1.5px dashed var(--line);color:var(--mut);font-family:'Outfit';font-weight:700;font-size:11.5px;border-radius:99px;padding:5px 12px;cursor:pointer}
.te .posadd>button:hover{border-color:var(--nexus);color:#fff}
.te .posmenu{position:absolute;top:110%;left:0;z-index:20;background:#20242D;border:1px solid var(--line);border-radius:11px;padding:6px;min-width:210px;max-height:240px;overflow-y:auto;overscroll-behavior:contain;display:none;box-shadow:0 10px 30px #0008}
.te .posmenu.open{display:block}
.te .posmenu div{padding:8px 11px;border-radius:8px;font-size:12px;font-weight:600;color:#B9BFC9;cursor:pointer}
.te .posmenu div:hover{background:#241A1E;color:#fff}
.te .bank{margin-top:12px;border:1.5px dashed var(--line);border-radius:11px;padding:12px;font-size:12px;color:#5A616D}
.te .bank .rest{display:inline-flex;align-items:center;gap:6px;margin:4px 8px 0 0;border:1px solid var(--line);border-radius:99px;padding:4px 11px;cursor:pointer;color:#8A909C;font-weight:600;font-size:11.5px}
.te .bank .rest:hover{border-color:var(--ok);color:var(--ok)}
/* previews */
.te .pv{position:sticky;top:74px;align-self:start}
.te .pvhead{font-family:'Bebas Neue';letter-spacing:.24em;font-size:12px;color:var(--mut);margin-bottom:12px}
.te .empty{border:1.5px dashed var(--line);border-radius:12px;padding:18px;text-align:center;font-size:12px;color:#5A616D;line-height:1.6}
/* toast (composant partagé avec « Ma page ») */
.te .pe-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%) translateY(20px);background:#20242D;border:1px solid var(--line);color:var(--txt);font-size:13px;font-weight:600;padding:12px 20px;border-radius:12px;opacity:0;transition:.25s;pointer-events:none;z-index:99}
.te .pe-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}
`;
