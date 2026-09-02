"use client";

// components/team-page/TeamHero.tsx
// Section 1 — Hero page équipe v2 « full-bleed Texas » : l'image est le FOND
// pleine largeur du hero, qui fond (gradient left→right) vers le sombre du côté
// du contenu (colonne à droite). Aucun panneau séparé. Sans photo → fallback
// dégradé thémé couleur école (jamais un hero cassé). Contenu inchangé.
// Cœur cibles = state partagé avec la box besoins (R3). Icônes = SocialIcons.

import * as React from "react";
import Image from "next/image";
import { Heart } from "lucide-react";
import SocialIcons from "@/components/marketing/SocialIcons";
import type { TeamData } from "./content";

export default function TeamHero({
  team, cible, onToggleCible,
}: {
  team: TeamData;
  cible: boolean;
  onToggleCible: () => void;
}) {
  const nameLines = team.nom.split("\n");
  // La photo peut manquer (fichier absent / pas encore saisie) → fallback thémé.
  const [imgOk, setImgOk] = React.useState(true);
  const hasPhoto = !!team.heroImage && imgOk;

  return (
    <div className={`hero${hasPhoto ? "" : " nophoto"}`}>
      {/* fond : fallback thémé (toujours présent) + photo par-dessus si dispo */}
      <div className="hero-fallback" />
      {team.heroImage && (
        <Image
          className="hero-bg"
          src={team.heroImage}
          alt=""
          width={1024}
          height={683}
          sizes="(max-width: 720px) 100vw, 66vw"
          priority
          onError={() => setImgOk(false)}
        />
      )}
      {/* fade Texas : left→right vers le sombre + léger fade bas (enchaînement) */}
      <div className="hero-fade" />

      {/* accent école + blanc, bord gauche pleine hauteur */}
      <div className="accent" />
      {/* crest coin haut-gauche — vrai logo si dispo, sinon monogramme */}
      {team.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="logo-img" src={team.logoUrl} alt={team.schoolName} />
      ) : (
        <div className="logo">{team.schoolInitial}</div>
      )}
      {/* réseaux bas-gauche */}
      <div className="soc">
        <SocialIcons links={team.socials} size={21} />
      </div>

      {/* contenu — colonne à droite, posée SUR le fade */}
      <div className="pnl">
        <div className="eyebrow">
          {team.nickname.toUpperCase()} · {team.schoolName.toUpperCase()}
        </div>
        <div className="name">
          {nameLines.map((line, i) => (
            <React.Fragment key={i}>
              {line}
              {i < nameLines.length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>
        <div className="meta">
          <span className="chip solid">{team.division}</span>
          <span className="chip out">{team.genre}</span>
        </div>
        <div className="stats">
          <div className="stat">
            <div className="v">{team.recordSaison}</div>
            <div className="l">{team.recordLabel}</div>
          </div>
          <div className="stat">
            <div className="v">{team.playoffResult}</div>
            <div className="l">{team.playoffLabel}</div>
          </div>
          <div className="stat pers">
            <div className="v">{team.coachName}</div>
            <div className="l">Entraîneur-chef</div>
          </div>
        </div>
        {/* Cibles — state partagé avec la box besoins (R3). Rouge Nexus = plateforme. */}
        <button type="button" className={`cibles${cible ? " on" : ""}`} onClick={onToggleCible}>
          <Heart size={17} fill="currentColor" aria-hidden />
          {cible ? "Dans tes cibles" : "Rajouter à mes cibles"}
        </button>
      </div>
    </div>
  );
}
