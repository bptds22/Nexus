"use client";

// components/program-wall/ProgramWallMenu.tsx
//
// The menu bar UNDER the collage — ported 1:1 from wall-final-FREEZE.html.
// Brand (logo img or monogram chip + school name) · section nav · powered-by +
// Vidéo + red CTA. The wall itself stays pure art; this is the only UI.

import * as React from "react";
import { deriveWallTheme } from "./theme";
import type { SchoolProgramIdentity } from "./slots";

export interface ProgramWallMenuProps {
  school: SchoolProgramIdentity;
}

export default function ProgramWallMenu({ school }: ProgramWallMenuProps) {
  const theme = deriveWallTheme(
    school.colorPrimary,
    school.colorDarker,
    school.colorNeutral,
  );
  const rootStyle = {
    "--red": theme.red,
    "--cream": theme.cream,
  } as React.CSSProperties;

  return (
    <div className="pw7menu" style={rootStyle}>
      <style dangerouslySetInnerHTML={{ __html: MENU_CSS }} />
      <div className="menubar">
        <div className="brand">
          {school.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={school.logoUrl} alt="" />
          ) : (
            <span className="chip">{school.initials}</span>
          )}
          {school.schoolName}
        </div>
        <nav>
          <a className="on" href="#">Aperçu</a>
          <a href="#">Sports</a>
          <a href="#">Campus</a>
          <a href="#">Académique</a>
          <a href="#">Débouchés</a>
        </nav>
        <div className="right">
          <span className="pw">⚡ propulsé par Nexus</span>
          <button className="btn btn-2">▶ Vidéo</button>
          <button className="btn btn-1">Découvrir nos sports →</button>
        </div>
      </div>
    </div>
  );
}

const MENU_CSS = `
.pw7menu .menubar{background:#14161B;border:1px solid #23262E;border-top:0;border-radius:0 0 12px 12px;
  padding:14px 22px;display:flex;align-items:center;gap:18px;font-family:'Outfit'}
.pw7menu .brand{display:flex;align-items:center;gap:10px;font-weight:700;font-size:15px;color:#fff}
.pw7menu .brand img{width:34px;background:var(--cream);border-radius:7px;padding:3px}
.pw7menu .brand .chip{width:34px;height:34px;background:var(--red);color:#fff;border-radius:7px;
  display:inline-flex;align-items:center;justify-content:center;font-family:'Outfit';font-weight:800}
.pw7menu nav{display:flex;gap:4px;margin-left:6px}
.pw7menu nav a{color:#c9ccd4;text-decoration:none;font-size:13.5px;font-weight:600;padding:8px 13px;border-radius:8px;transition:.15s}
.pw7menu nav a:hover{background:#ffffff10;color:#fff}
.pw7menu nav a.on{background:var(--red);color:#fff}
.pw7menu .right{margin-left:auto;display:flex;align-items:center;gap:10px}
.pw7menu .pw{font-size:12px;color:#8a8f99;font-weight:600;margin-right:6px}
.pw7menu .btn{font-family:'Outfit';font-weight:700;font-size:13.5px;padding:10px 16px;border-radius:9px;border:0;cursor:pointer;transition:transform .28s cubic-bezier(0.34,1.56,0.64,1)}
.pw7menu .btn:hover{transform:translateY(-2px)}
.pw7menu .btn-1{background:var(--red);color:#fff}
.pw7menu .btn-2{background:#ffffff12;color:#fff;border:1px solid #ffffff2a}
`;
