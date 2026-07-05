// components/program-page/CampusSection.tsx
// S — CAMPUS (v8.3, moved before À propos). Fiche (3 tiles: LANGUE · STATUT ·
// RÉGION) + map iframe + facts (installations · encadrement · housing) +
// degraded video strip.
// NOTE: the map iframe is often blocked in sandboxed previews — that is EXPECTED;
// it loads in a normal browser / the app. loading="lazy".

import * as React from "react";
import GhostLayer from "./GhostLayer";
import { languageLabel, type ProgramPageContent } from "./content";

const FACT_ICONS = [
  <svg key="b" viewBox="0 0 24 24" fill="currentColor"><path d="M4 5h16v12H4zM2 19h20v2H2z" /></svg>,
  <svg key="g" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3l9 5-9 5-9-5 9-5Zm-6 8.5V16c0 1.7 2.7 3 6 3s6-1.3 6-3v-4.5l-6 3.3-6-3.3Z" /></svg>,
];
const HOUSE_ICON = (
  <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3 2 11h3v9h6v-6h2v6h6v-9h3L12 3Z" /></svg>
);

export default function CampusSection({
  content,
}: {
  content: ProgramPageContent;
}) {
  const mapSrc = `https://www.google.com/maps?q=${encodeURIComponent(content.mapQuery)}&z=13&output=embed`;

  return (
    <section id="campus">
      <GhostLayer section="campus" />
      <div className="sec-in">
        <div className="kick">L&apos;ESSENTIEL</div>
        <h2 className="sec-h">Le campus</h2>
        <div className="pbar" />

        {/* fiche : les 3 réponses avant tout */}
        <div className="fiche">
          <div className="itile rv"><div className="il">LANGUE</div><div className="iv">{languageLabel(content.language)}</div></div>
          <div className="itile hot rv"><div className="il">STATUT</div><div className="iv">{content.schoolType}</div></div>
          <div className="itile rv"><div className="il">RÉGION</div><div className="iv">{content.region}</div></div>
        </div>

        <div className="cgrid">
          <div className="mapwrap rvy">
            <iframe
              title="Carte du campus"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              src={mapSrc}
            />
            <div className="mappin">📍 {content.address}</div>
          </div>

          <div className="facts">
            {content.facts.map((f, i) => (
              <div className="fact rvy" key={i}>
                <div className="fi">{FACT_ICONS[i] ?? FACT_ICONS[0]}</div>
                <div><b>{f.title}</b><span>{f.text}</span></div>
              </div>
            ))}
            {content.housing.type !== "none" && (
              <div className="fact hfact rvy">
                <div className="fi">{HOUSE_ICON}</div>
                <div>
                  <span className="hbdg">TU VIENS DE LOIN ?</span>
                  <b>Résidences &amp; hébergement</b>
                  <span>{content.housing.note}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {content.videoUrl ? (
          <a className="vstrip rv" href={content.videoUrl} target="_blank" rel="noreferrer">
            <span className="vp">▶</span> Vidéo du campus — <b>voir</b>
          </a>
        ) : (
          <div className="vstrip rv">
            <span className="vp">▶</span> Vidéo du campus — <b>à venir</b> · le collège pourra ajouter un lien YouTube
          </div>
        )}
      </div>
    </section>
  );
}
