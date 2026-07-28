"use client";

// components/cegep-search/MapPane.tsx
//
// Carte Leaflet + tuiles Carto (données OSM) : aucune clé, aucun compte.
// Leaflet touche `window` à l'import → chargé dynamiquement, jamais au SSR.
//
// TROIS ÉTATS DE PIN, même famille et même taille :
//   1. dans mes cibles → cercle rouge avec un GLYPHE BLANC au centre
//   2. page Nexus      → cercle rouge, halo qui pulse
//   3. fiche de base   → cercle gris
// L'état 1 se met à jour LIVE (le point porte `cible`).
//
// Fond et glyphe sont FIGÉS (A/B tranché le 28 juillet 2026) : Dark Matter
// rehaussé, étoile blanche dans le cercle pour « dans mes cibles ».

import * as React from "react";
import type { Map as LeafletMap, Layer, TileLayer } from "leaflet";

export interface MapPoint {
  id: string;
  nom: string;
  lat: number;
  lng: number;
  riche: boolean;
  cible: boolean;
}

export interface MapFocus {
  token: number;
  type: "fly" | "bounds";
  ids: string[];
}

const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";

// Fond figé après A/B : Carto Dark Matter rehaussé par filtre CSS
// (cf. `.cs .cs-tile-dark .leaflet-tile`), pins sobres en gris moyen.
const TUILES_URL = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const COULEUR_SOBRE = "#5A616D";

/** Étoile blanche dessinée DANS le cercle rouge (choix figé après A/B).
 *  Tracé volontairement simple : à ~7 px de haut, tout détail devient bouillie. */
const ETOILE = "M10 6.2l1.15 2.5 2.7.33-2 1.85.53 2.68L10 12.27l-2.38 1.29.53-2.68-2-1.85 2.7-.33z";

function iconeCible(taille: number): string {
  // Le cercle reprend exactement la géométrie d'un circleMarker (r + anneau
  // blanc) : à distance, la famille est identique — seul le glyphe distingue.
  const r = taille / 2;
  return `<svg width="${taille}" height="${taille}" viewBox="0 0 20 20" aria-hidden>
    <circle cx="10" cy="10" r="${r > 10 ? 7.6 : 7.2}" fill="#E63946" stroke="#ffffff" stroke-width="2.4"/>
    <path d="${ETOILE}" fill="#ffffff"/>
  </svg>`;
}

export default function MapPane({
  points, selectedId, hoveredId, focus, onSelect,
}: {
  points: MapPoint[];
  selectedId: string | null;
  hoveredId: string | null;
  focus: MapFocus | null;
  onSelect: (id: string) => void;
}) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const mapRef = React.useRef<LeafletMap | null>(null);
  const tileRef = React.useRef<TileLayer | null>(null);
  const layersRef = React.useRef<Map<string, Layer>>(new Map());
  const pointsRef = React.useRef<MapPoint[]>(points);
  pointsRef.current = points;
  const [pret, setPret] = React.useState(false);

  React.useEffect(() => {
    if (document.querySelector(`link[href="${LEAFLET_CSS}"]`)) return;
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = LEAFLET_CSS;
    document.head.appendChild(l);
  }, []);

  React.useEffect(() => {
    let annule = false;
    (async () => {
      const L = await import("leaflet");
      if (annule || !hostRef.current || mapRef.current) return;
      const map = L.map(hostRef.current, { zoomControl: true, attributionControl: true })
        .setView([46.8, -71.9], 6);
      mapRef.current = map;
      setPret(true);
    })();
    return () => {
      annule = true;
      mapRef.current?.remove();
      mapRef.current = null;
      tileRef.current = null;
      layersRef.current.clear();
    };
  }, []);

  // Couche de tuiles.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !pret) return;
    let annule = false;
    (async () => {
      const L = await import("leaflet");
      if (annule) return;
      tileRef.current?.remove();
      tileRef.current = L.tileLayer(TUILES_URL, {
        maxZoom: 19,
        subdomains: "abcd",
        className: "cs-tile-dark",
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(map);
      tileRef.current.bringToBack();
    })();
    return () => { annule = true; };
  }, [pret]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !pret) return;
    let annule = false;
    (async () => {
      const L = await import("leaflet");
      if (annule) return;
      layersRef.current.forEach((m) => m.remove());
      layersRef.current.clear();

      for (const p of points) {
        const layer: Layer = p.cible
          ? L.marker([p.lat, p.lng], {
              icon: L.divIcon({
                className: "pin-cible-wrap",
                html: iconeCible(20),
                iconSize: [20, 20],
                iconAnchor: [10, 10],
              }),
              zIndexOffset: 1000,
            })
          : L.circleMarker([p.lat, p.lng], {
              radius: 6.5,
              color: "#ffffff",
              weight: 2.5,
              fillColor: p.riche ? "#E63946" : COULEUR_SOBRE,
              fillOpacity: 1,
              className: p.riche ? "pin-rich" : "pin-sober",
            });
        layer.addTo(map);
        layer.bindTooltip(p.nom, { direction: "right", offset: [10, 0], opacity: 0.95 });
        layer.on("click", () => onSelect(p.id));
        layersRef.current.set(p.id, layer);
      }
    })();
    return () => { annule = true; };
  }, [points, pret, onSelect]);

  // Sélection / survol : les cercles grossissent par leur rayon, les marqueurs
  // à glyphe par une classe CSS — même perception, deux natures techniques.
  React.useEffect(() => {
    layersRef.current.forEach((layer, id) => {
      const sel = id === selectedId;
      const hov = id === hoveredId;
      const c = layer as unknown as {
        setRadius?: (r: number) => void;
        setStyle?: (s: Record<string, unknown>) => void;
        getElement?: () => HTMLElement | undefined;
        bringToFront?: () => void;
      };
      if (typeof c.setRadius === "function") {
        c.setRadius(sel ? 11 : hov ? 9 : 6.5);
        c.setStyle?.({ weight: sel ? 3.5 : hov ? 3 : 2.5 });
      } else {
        const el = c.getElement?.();
        if (el) el.className = "pin-cible-wrap" + (sel ? " sel" : hov ? " hov" : "");
      }
      if (sel || hov) c.bringToFront?.();
    });
  }, [selectedId, hoveredId, points]);

  React.useEffect(() => {
    const map = mapRef.current;
    if (!map || !focus || !pret) return;
    let annule = false;
    (async () => {
      const L = await import("leaflet");
      if (annule) return;
      const cibles = pointsRef.current.filter((p) => focus.ids.includes(p.id));
      if (!cibles.length) return;
      if (focus.type === "fly" && cibles.length === 1) {
        map.flyTo([cibles[0].lat, cibles[0].lng], Math.max(map.getZoom(), 11), { duration: 0.8 });
      } else {
        map.fitBounds(L.latLngBounds(cibles.map((c) => [c.lat, c.lng] as [number, number])), {
          padding: [60, 60], maxZoom: 12, animate: true,
        });
      }
    })();
    return () => { annule = true; };
  }, [focus, pret]);

  return <div className="mapcanvas" ref={hostRef} aria-label="Carte des cégeps" />;
}
