"use client";

// components/program-wall/ProgramWallMenu.tsx
//
// v7 menu (mb2) — under the collage, sticky top:0. The wall just said the school
// name/logo, so no chip here. Section anchors + the red CTA as the sole Sports
// entry. Returned as the bare .mb2 element (no wrapper) so its sticky context is
// the .frame, exactly like the reference.

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

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: MENU_CSS }} />
      <div className="mb2" style={{ "--red": theme.red } as React.CSSProperties}>
        <nav className="mnav">
          <a className="on" href="#apercu">Aperçu</a>
          <a href="#campus">Campus</a>
          <a href="#apropos">À propos</a>
          <a href="#academique">Académique</a>
          <a href="#parcours">Débouchés</a>
        </nav>
        <div className="mright">
          <span className="pw">⚡ propulsé par Nexus</span>
          <a className="mcta" href="#sports">Découvre nos sports →</a>
        </div>
      </div>
    </>
  );
}

const MENU_CSS = `
.mb2{position:sticky;top:0;z-index:80;display:flex;align-items:center;justify-content:space-between;gap:16px;
  background:#14161B;border:1px solid #23262E;border-top:0;border-radius:0 0 12px 12px;padding:12px 22px;font-family:'Outfit'}
.mb2 .mnav{display:flex;gap:4px}
.mb2 .mnav a{color:#C9CCD4;text-decoration:none;font-size:13.5px;font-weight:600;padding:8px 14px;border-radius:9px}
.mb2 .mnav a:hover{background:#ffffff0d}
.mb2 .mnav a.on{background:#ffffff12;color:#fff}
.mb2 .mright{display:flex;align-items:center;gap:16px}
.mb2 .pw{font-size:11.5px;color:#8A909C;font-weight:600}
.mb2 .mcta{font-weight:700;font-size:13.5px;color:#fff;background:var(--red);padding:10px 18px;border-radius:10px;text-decoration:none;
  transition:transform .25s cubic-bezier(0.34,1.56,0.64,1)}
.mb2 .mcta:hover{transform:translateY(-2px)}
`;
