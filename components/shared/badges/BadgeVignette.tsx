"use client";

/* ═══════════════════════════════════════════════════════════════
   BadgeVignette — l'image d'un badge du CATALOGUE, rien de plus.

   POURQUOI PAS DistinctionBadge : ce dernier exige BADGE_CONFIG[code],
   qui ne contient que les 7 ANCIENS codes. Pour les 16 nouveaux il rend
   `null` et journalise — ce qui est le bon comportement là où il est
   branché (les surfaces qui lisent encore evaluations.distinctions), mais
   le rendrait inutilisable partout où l'on part du catalogue.

   Les fichiers sont servis en <img> depuis public/badges/ : chaque SVG vit
   dans un document isolé, donc aucune collision d'identifiants entre deux
   instances, fût-ce le même badge répété.
═══════════════════════════════════════════════════════════════ */

import { badgeSvgPath } from "@/lib/config/badges";
import "@/components/badges/distinction-badges.css";

export interface BadgeVignetteProps {
  /** Code du catalogue (capitaine, mvp…) ou ancien code : badgeSvgPath
   *  accepte les deux. */
  code: string;
  /** Libellé affiché sous l'image. Omis : aucune étiquette. */
  libelle?: string;
  taille?: "xs" | "sm" | "lg";
  /** Rendu « à viser » : estompé, sans filtre CSS — une opacité suffit et
   *  ne déclenche pas de repeinture, contrairement à grayscale(). */
  attenue?: boolean;
  className?: string;
}

const BOITE: Record<NonNullable<BadgeVignetteProps["taille"]>, string> = {
  xs: "w-7 h-7",
  sm: "w-14 h-14",
  lg: "w-[72px] h-[72px]",
};

export default function BadgeVignette({
  code, libelle, taille = "sm", attenue = false, className = "",
}: BadgeVignetteProps) {
  const svg = badgeSvgPath(code);
  if (!svg) return null;

  return (
    <div className={`flex flex-col items-center gap-1.5 ${className}`}>
      {/* Enveloppe position:relative — elle n'existait pas. Le picker n'avait
          AUCUNE lueur : les SVG portaient la leur, et elle suffisait. Depuis
          qu'ils sont plats, sans cette enveloppe les tuiles du sélecteur
          seraient les seules à le rester. */}
      <span className="relative inline-grid place-items-center" style={attenue ? { opacity: 0.35 } : undefined}>
        <span className="nx-badge__glow" aria-hidden="true" />
        <span className={`nx-badge ${BOITE[taille]}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={svg} alt="" className="nx-badge__img" draggable={false} />
        </span>
      </span>
      {libelle && (
        <span
          className={`text-[10px] font-bold tracking-[0.06em] uppercase text-center leading-tight ${
            attenue ? "text-white/35" : "text-[#E0E0E0]"
          }`}
        >
          {libelle}
        </span>
      )}
    </div>
  );
}
