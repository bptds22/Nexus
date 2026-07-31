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

/** UN seul dessin de pin, taille ÉCRAN fixe (20px) à tous les zooms. Tous les
 *  pins sont des L.divIcon (pane marqueurs) — jamais de circleMarker/circle,
 *  dont le pane SVG scale pendant l'animation de zoom. Cercle + anneau blanc
 *  identique pour les 3 états ; l'étoile ne s'ajoute que pour « dans mes cibles ». */
function iconePin(taille: number, fill: string, etoile: boolean): string {
  const r = taille / 2;
  return `<svg width="${taille}" height="${taille}" viewBox="0 0 20 20" aria-hidden>
    <circle cx="10" cy="10" r="${r > 10 ? 7.6 : 7.2}" fill="${fill}" stroke="#ffffff" stroke-width="2.4"/>
    ${etoile ? `<path d="${ETOILE}" fill="#ffffff"/>` : ""}
  </svg>`;
}

export default function MapPane({
  points, selectedId, hoveredId, focus, onSelect,
  zoomControl = true, attributionCompact = false, resizeToken, className = "mapcanvas",
}: {
  points: MapPoint[];
  selectedId: string | null;
  hoveredId: string | null;
  focus: MapFocus | null;
  onSelect: (id: string) => void;
  /* ── props ADDITIVES (mobile) — défauts = comportement web actuel, à l'octet.
     Le web (CegepSearch.tsx) ne les passe pas et ne bouge pas d'un pixel. ── */
  /** Contrôles +/− de Leaflet. Mobile plein écran → false (on pince pour zoomer). */
  zoomControl?: boolean;
  /** Attribution en encart court (préfixe Leaflet retiré + classe `cs-attr-compact`
   *  sur le conteneur, que l'appelant stylise pour la faire remonter avec sa sheet). */
  attributionCompact?: boolean;
  /** Toute NOUVELLE valeur déclenche un invalidateSize(). Indispensable quand la
   *  carte est montée dans un conteneur masqué puis révélé (bascule liste↔carte) :
   *  Leaflet a alors mesuré 0×0 et ne se corrige jamais tout seul. */
  resizeToken?: number;
  /** Classe du conteneur. Défaut `mapcanvas` = ce que le CSS `.cs` cible déjà. */
  className?: string;
}) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  // Options lues À LA CRÉATION de la carte (l'effet de montage est en deps []).
  // Passées par ref pour ne pas dépendre d'une closure périmée.
  const optsRef = React.useRef({ zoomControl, attributionCompact });
  optsRef.current = { zoomControl, attributionCompact };
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
      const { zoomControl: zc, attributionCompact: ac } = optsRef.current;
      const map = L.map(hostRef.current, { zoomControl: zc, attributionControl: true })
        .setView([46.8, -71.9], 6);
      // Encart compact : on garde l'attribution (obligation OSM/CARTO) mais on
      // retire le préfixe « Leaflet » et on marque le conteneur pour le CSS.
      if (ac) {
        map.attributionControl.setPrefix(false);
        hostRef.current.classList.add("cs-attr-compact");
      }
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
        // Anti-flash gris au pan/zoom : garder plus de tuiles hors écran en
        // mémoire (keepBuffer) et rendre pendant le geste (updateWhenIdle:false)
        // plutôt qu'à l'arrêt seulement → moins de fond de conteneur visible.
        keepBuffer: 4,
        updateWhenIdle: false,
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
        // Tous les états sont des divIcon 20px (taille écran fixe). La classe
        // porte l'état : `pin-cible-wrap` (base + sélection), + `pin-rich`
        // (halo pulsé) ou `pin-sober`. La couleur/étoile sont dans le SVG.
        const fill = p.cible || p.riche ? "#E63946" : COULEUR_SOBRE;
        const cls = "pin-cible-wrap " + (p.cible ? "pin-cible" : p.riche ? "pin-rich" : "pin-sober");
        const layer: Layer = L.marker([p.lat, p.lng], {
          icon: L.divIcon({
            className: cls,
            // Le SVG est enveloppé dans `.pd` : tout transform (scale de
            // sélection web, transition) vit sur CET enfant, JAMAIS sur la
            // racine du marqueur — que Leaflet positionne via translate3d.
            // Sans ça, une transition:transform sur la racine interpole la
            // position à chaque frame du zoom → le pin dérive puis saute.
            html: `<span class="pd">${iconePin(20, fill, p.cible)}</span>`,
            iconSize: [20, 20],
            iconAnchor: [10, 10],
          }),
          zIndexOffset: p.cible ? 1000 : 0,
        });
        layer.addTo(map);
        layer.bindTooltip(p.nom, { direction: "right", offset: [10, 0], opacity: 0.95 });
        layer.on("click", () => onSelect(p.id));
        layersRef.current.set(p.id, layer);
      }
    })();
    return () => { annule = true; };
  }, [points, pret, onSelect]);

  // Sélection / survol : tous les pins sont des marqueurs divIcon → on bascule
  // les classes `sel`/`hov` sur l'élément (le CSS décide de l'effet — le web
  // grossit, le mobile garde l'anneau blanc sans scale). La taille de base ne
  // change jamais avec le zoom (pane marqueurs). La classe de base est
  // préservée (classList.toggle, pas de réécriture).
  React.useEffect(() => {
    layersRef.current.forEach((layer, id) => {
      const sel = id === selectedId;
      const hov = id === hoveredId;
      const m = layer as unknown as {
        getElement?: () => HTMLElement | undefined;
        setZIndexOffset?: (z: number) => void;
      };
      const el = m.getElement?.();
      if (el) {
        el.classList.toggle("sel", sel);
        el.classList.toggle("hov", hov && !sel);
      }
      const cible = pointsRef.current.find((p) => p.id === id)?.cible;
      m.setZIndexOffset?.(sel ? 1200 : hov ? 1100 : cible ? 1000 : 0);
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

  // Re-mesure après un changement de taille du conteneur (bascule liste↔carte,
  // sheet qui monte). Sans ça la carte reste sur ses dimensions de montage.
  React.useEffect(() => {
    if (resizeToken === undefined || !pret) return;
    const map = mapRef.current;
    if (!map) return;
    const t = window.setTimeout(() => map.invalidateSize(), 0);
    return () => window.clearTimeout(t);
  }, [resizeToken, pret]);

  return <div className={className} ref={hostRef} aria-label="Carte des cégeps" />;
}
