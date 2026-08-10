"use client";

// components/team-editor/CropControl.tsx
// ============================================================================
// Contrôle de cadrage — point focal (x/y en %) + zoom. Extrait tel quel de
// HeroSection, sans la moindre retouche visuelle : mêmes classes (.crop,
// .cropimg, .grid9, .dot, .zoomrow), même imbrication, même drag, mêmes bornes.
//
// Le CSS n'est PAS ici : il vit dans la feuille scopée `.te` de TeamEditor.tsx
// (`.te .crop`, `.te .crop .cropimg`, …). Ce composant ne fait qu'émettre les
// classes attendues, donc il n'est utilisable que sous la racine `.te`.
//
// Contrôlé : le parent garde l'état, parce que c'est lui qui le remonte au
// contexte via report(). Ce composant n'appelle jamais report() lui-même.
// ============================================================================

import * as React from "react";

const ZOOM_MIN = 100;
const ZOOM_MAX = 220;

interface CropControlProps {
  /** URL de l'image à cadrer. Absente = boîte vide (dégradé + grille + point). */
  url: string | null;
  fx: number;
  fy: number;
  zoom: number;
  /** Appelé au clic et pendant le glissé, avec les % déjà bornés et arrondis. */
  onFocal: (x: number, y: number) => void;
  onZoom: (z: number) => void;
}

export default function CropControl({ url, fx, fy, zoom, onFocal, onZoom }: CropControlProps) {
  // ── cadrage : le point suit la souris dans la boîte, comme le mock ──
  const cropRef = React.useRef<HTMLDivElement>(null);
  const dragging = React.useRef(false);

  // onFocal passe par une ref : le parent peut la redéfinir à chaque rendu sans
  // que l'effet ci-dessous re-branche ses écouteurs window à chaque frappe.
  const onFocalRef = React.useRef(onFocal);
  React.useEffect(() => { onFocalRef.current = onFocal; }, [onFocal]);

  const setFromEvent = React.useCallback((clientX: number, clientY: number) => {
    const r = cropRef.current?.getBoundingClientRect();
    if (!r) return;
    onFocalRef.current(
      Math.round(Math.min(100, Math.max(0, ((clientX - r.left) / r.width) * 100))),
      Math.round(Math.min(100, Math.max(0, ((clientY - r.top) / r.height) * 100))),
    );
  }, []);

  React.useEffect(() => {
    const move = (e: MouseEvent) => { if (dragging.current) setFromEvent(e.clientX, e.clientY); };
    const up = () => { dragging.current = false; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, [setFromEvent]);

  return (
    <>
      <div
        className="crop" ref={cropRef}
        onMouseDown={(e) => { dragging.current = true; setFromEvent(e.clientX, e.clientY); }}
      >
        {/* la photo vit dans une couche à part : le zoom l'agrandit autour
            du point focal, exactement comme le rendu public le fera */}
        {url && (
          <div
            className="cropimg"
            style={{
              backgroundImage: `url(${url})`,
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
        🔍 <input type="range" min={ZOOM_MIN} max={ZOOM_MAX} value={zoom} onChange={(e) => onZoom(+e.target.value)} />
        <span>{zoom}%</span>
      </div>
    </>
  );
}
