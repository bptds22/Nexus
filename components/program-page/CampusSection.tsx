"use client";

// components/program-page/CampusSection.tsx
// S — CAMPUS (v8.3). Fiche (3 tiles: LANGUE · STATUT · RÉGION, unchanged) +
// FULL-WIDTH map (z=12, no mappin) + horizontal scroll-snap carousel of campus
// cards. No .cgrid, no .facts icons, no .mappin (removed this ticket).
// Cards = campusCards (photo {image,titre,legende} + optional video card).
// image null → neutral gradient fallback (no invented image; upload = Bloc 2).
// NOTE: the map iframe is often blocked in sandboxed previews — EXPECTED; it
// loads in a normal browser / the app. loading="lazy".

import * as React from "react";
import GhostLayer from "./GhostLayer";
import { languageLabel, type ProgramPageContent } from "./content";

export default function CampusSection({
  content,
}: {
  content: ProgramPageContent;
}) {
  // z=12 (less zoomed) per spec; grayscale filter kept via CSS.
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(content.mapQuery)}&z=12&output=embed`;

  const caraRef = React.useRef<HTMLDivElement>(null);
  const scrollCara = (dir: number) =>
    caraRef.current?.scrollBy({ left: dir * 316, behavior: "smooth" });

  const cards = content.campusCards ?? [];

  return (
    <section id="campus">
      <GhostLayer section="campus" />
      <div className="sec-in">
        <div className="kick">L&apos;ESSENTIEL</div>
        <h2 className="sec-h">Le campus</h2>
        <div className="pbar" />

        {/* fiche : les 3 réponses avant tout (inchangé) */}
        <div className="fiche">
          <div className="itile rv"><div className="il">LANGUE</div><div className="iv">{languageLabel(content.language)}</div></div>
          <div className="itile hot rv"><div className="il">STATUT</div><div className="iv">{content.schoolType}</div></div>
          <div className="itile rv"><div className="il">RÉGION</div><div className="iv">{content.region}</div></div>
        </div>

        {/* map — pleine largeur, moins zoomée, sans mappin */}
        <div className="mapwrap rv">
          <iframe
            title="Carte du campus"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            src={mapSrc}
          />
        </div>

        {/* carousel — rendu seulement s'il y a des cards (jamais un strip vide) */}
        {cards.length > 0 && (
          <>
            <div className="cara-head">
              <div className="cara-kick">LE CAMPUS EN IMAGES</div>
              <div className="cara-nav">
                <button type="button" onClick={() => scrollCara(-1)} aria-label="Précédent">‹</button>
                <button type="button" onClick={() => scrollCara(1)} aria-label="Suivant">›</button>
              </div>
            </div>

            <div className="cara" ref={caraRef}>
              {cards.map((card, i) => {
                if ("type" in card && card.type === "video") {
                  return (
                    <article className="ccard rv" key={i}>
                      {card.youtubeUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="cimg" src={`https://img.youtube.com/vi/${ytId(card.youtubeUrl)}/hqdefault.jpg`} alt="Vidéo du campus" loading="lazy" />
                      ) : (
                        <div className="ph" />
                      )}
                      <div className="grad" />
                      <div className="cc-play"><span>▶</span></div>
                      <div className="cc-t">Vidéo du campus</div>
                    </article>
                  );
                }
                return (
                  <article className="ccard rv" key={i}>
                    {card.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img className="cimg" src={card.image} alt={card.titre} loading="lazy" />
                    ) : (
                      <div className="ph" />
                    )}
                    <div className="grad" />
                    <div className="cc-cap">
                      <span className="t">{card.titre}</span>
                      <span className="c">{card.legende}</span>
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

/** Extract a YouTube id from a watch/share/embed URL (best-effort; Bloc 2 may
 *  store the raw id). Returns the input unchanged if no pattern matches. */
function ytId(url: string): string {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([\w-]{11})/);
  return m ? m[1] : url;
}
