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
// Décision YouTube partagée avec VideoEmbed : ici (WEB) l'iframe reste inline,
// mais via getEmbedUrl → youtube-nocookie + ?origin. Le device, lui, ne peut PAS
// iframer (origin capacitor:// refusée) — c'est CampusMobile qui gère ce cas.
import { getEmbedUrl, getYouTubeId } from "@/components/ui/VideoEmbed";

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
  const langue = languageLabel(content.language);
  // Carte vidéo : clic → embed YouTube inline (lecture DANS la carte, aucune
  // redirection). `playing` null au SSR → rendu identique (non-régression) ;
  // l'iframe (style inline) n'apparaît qu'après clic, jamais dans le HTML SSR.
  const [playing, setPlaying] = React.useState<number | null>(null);

  return (
    <section id="campus">
      <GhostLayer section="campus" />
      <div className="sec-in">
        <div className="kick">L&apos;ESSENTIEL</div>
        <h2 className="sec-h">Le campus</h2>
        <div className="pbar" />

        {/* fiche : les 3 réponses avant tout. Chaque tuile lit une colonne RÉELLE
            de public.schools (langue / reseau / region) ; une colonne nulle fait
            disparaître SA tuile — plus de « FRANCOPHONE »/« PRIVÉ » en dur, qui
            affirmaient du faux sur 54 des 69 cégeps. Les trois nulles → aucune
            fiche. La grille est en auto-fit : elle se resserre d'elle-même. */}
        {(langue || content.schoolType || content.region) && (
          <div className="fiche">
            {langue && <div className="itile rv"><div className="il">LANGUE</div><div className="iv">{langue}</div></div>}
            {content.schoolType && <div className="itile hot rv"><div className="il">STATUT</div><div className="iv">{content.schoolType}</div></div>}
            {content.region && <div className="itile rv"><div className="il">RÉGION</div><div className="iv">{content.region}</div></div>}
          </div>
        )}

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
                  const vid = card.youtubeUrl ? getYouTubeId(card.youtubeUrl) : null;
                  if (playing === i && vid) {
                    return (
                      <article className="ccard rv" key={i}>
                        <iframe
                          title="Vidéo du campus"
                          src={`${getEmbedUrl(card.youtubeUrl!) ?? ""}&autoplay=1&rel=0`}
                          loading="lazy"
                          allow="autoplay; encrypted-media; picture-in-picture"
                          allowFullScreen
                          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0, borderRadius: "inherit" }}
                        />
                      </article>
                    );
                  }
                  return (
                    <article className="ccard rv" key={i} onClick={() => vid && setPlaying(i)}>
                      {vid ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img className="cimg" src={`https://img.youtube.com/vi/${vid}/hqdefault.jpg`} alt="Vidéo du campus" loading="lazy" />
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

