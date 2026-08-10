"use client";

// components/team-page/PresentationSection.tsx
// Section « Présentation » (sous le hero, avant le widget besoins). Même langage
// que la page école : kick + h2 Anton + prose Outfit, aucune boîte englobante,
// mot fantôme subtil. 2 colonnes (programme | staff) top-alignées : le header
// vit dans la colonne gauche → la photo coach s'aligne avec le titre.
// Fanions de palmarès (clip-path) sous les stats. Champ vide → élément absent.

import * as React from "react";
import { GhostWords, PlaybookDecor } from "@/components/shared/dna";
import type { TeamData } from "./content";
import { coachPhotoStyle } from "./content";

export default function PresentationSection({ team }: { team: TeamData }) {
  const c = team.content;
  if (!c) return null; // pas de contenu → pas de section
  const hc = c.headCoach;
  const hasStats = c.championships > 0 || c.staffSince > 0;

  return (
    <section className="present rv">
      {/* mot fantôme subtil — ADN partagé (même vocabulaire que la page école) */}
      <GhostWords
        items={[{
          variant: "word",
          text: (team.wallWords[1] ?? team.nickname).toUpperCase(),
          right: "-1%",
          top: "6px",
          fontSize: "clamp(66px,10vw,148px)",
        }]}
      />
      {/* craie playbook — MÊMES assets que la page école, zéro redessin */}
      <PlaybookDecor preset="spine" style={{ right: 0, top: 50, width: 320 }} />

      {/* .sec-in = le contenant 1180px de la page école (parité de rythme) */}
      <div className="sec-in">
      <div className="p-cols">
        {/* GAUCHE — le programme (header inclus → aligne la colonne droite) */}
        <div className="p-left">
          <div className="p-head">
            <div className="kick">L&apos;ÉQUIPE</div>
            <div className="h2">Plus qu&apos;une <em>équipe</em></div>
            <div className="pbar" />
          </div>

          {/* .lead = le slot d'accroche de la page école, alimenté par le SEUL
              contenu réel dont dispose l'équipe (texte coach). Vide → rien. */}
          {c.presentationText && <p className="lead">{c.presentationText}</p>}

          {hasStats && (
            <div className="stats p-stats">
              {c.championships > 0 && (
                <div className="stat">
                  <div className="v">{c.championships}</div>
                  <div className="l">Championnats</div>
                </div>
              )}
              {c.staffSince > 0 && (
                <div className="stat">
                  <div className="v">Depuis {c.staffSince}</div>
                  <div className="l">Staff en place</div>
                </div>
              )}
            </div>
          )}

          {/* fanions de palmarès — bannières suspendues (clip-path). [] → rien */}
          {c.palmares.length > 0 && (
            <div className="pennants" aria-label="Palmarès">
              <div className="pen-string" />
              <div className="pen-row">
                {c.palmares.map((p, i) => (
                  <div key={i} className={`pennant ${p.type}`}>
                    <span className="pen-t">{p.titre.toUpperCase()}</span>
                    <span className="pen-y">{p.annee}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* DROITE — le staff (top-alignée avec le titre) */}
        <div className="p-right">
          {hc && (
            <div className="coach">
              <div className="cphoto">
                {hc.photoUrl ? (
                  // Même modèle que le hero : point focal en `object-position`,
                  // zoom en `scale` de même origine. Au zoom 100 (donc pour
                  // toute photo déjà en ligne), `coachPhotoStyle` n'émet aucun
                  // transform — le rendu est celui d'avant, à l'identique.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={hc.photoUrl} alt="" style={coachPhotoStyle(hc)} />
                ) : (
                  <span className="cph-tag">Photo</span>
                )}
              </div>
              {/* Le nom vient du staff de l'équipe (team_coaches) : absent tant
                  qu'aucun entraîneur-chef n'y est rattaché. La photo et la bio,
                  elles, sont saisies — elles s'affichent quand même. */}
              {hc.nom && <div className="cname">{hc.nom}</div>}
              <div className="crole">Entraîneur-chef</div>
              {hc.bio && <p className="cbio">{hc.bio}</p>}
            </div>
          )}

          {c.staff.length > 0 && (
            <div className="sList">
              {c.staff.map((s, i) => (
                <div key={i} className="sRow">
                  <span className="sName">{s.nom}</span>
                  <span className="sRole">{s.role}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    </section>
  );
}
