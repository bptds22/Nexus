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

import type React from "react";
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
  /** Rang dans la rangée. Sert UNIQUEMENT au décalage du reflet : sans lui
   *  les vignettes d'une même grille s'allument toutes ensemble, ce qui se
   *  lit comme un clignotement. Même pas de 80 ms que DistinctionBadge. */
  index?: number;
  /** Badge ACQUIS. Contrairement à DistinctionBadge, cette vignette sert aussi
   *  à montrer ce qu'on n'a PAS : elle doit donc qu'on le lui dise.
   *  Règle produit : obtenu = vivant (cycle de reflet), à viser = mat. */
  obtenu?: boolean;
}

const BOITE: Record<NonNullable<BadgeVignetteProps["taille"]>, string> = {
  xs: "w-7 h-7",
  sm: "w-14 h-14",
  lg: "w-[72px] h-[72px]",
};

export default function BadgeVignette({
  code, libelle, taille = "sm", attenue = false, className = "", index, obtenu = false,
}: BadgeVignetteProps) {
  const svg = badgeSvgPath(code);
  if (!svg) return null;

  return (
    <div className={`flex flex-col items-center gap-1.5 ${className}`}>
      {/* L'enveloppe et sa lueur CSS sont retirées : les SVG portent de
          nouveau leur halo à l'intérieur. On revient donc à la forme simple
          d'avant, sans niveau intermédiaire. */}
      <span
        className={`nx-badge ${BOITE[taille]}${obtenu ? " is-metal" : ""}`}
        /* --nx-mask CONFINE le reflet à la silhouette. Sans elle,
           `.nx-badge::after` n'a pas de masque et son dégradé balaie le CARRÉ
           entier : c'est la bande diagonale vue sur mon-parcours et sur le
           picker en tuiles. Le défaut existait déjà, mais restait invisible
           tant que le reflet ne jouait que sur `.is-fresh` et `.group:hover`
           — deux états qu'une vignette n'atteint jamais. Il est devenu
           visible quand le reflet est passé en animation DE MONTAGE, portée
           par la règle de base.
           Même URL que le <img> juste en dessous : aucune requête de plus. */
        style={{
          "--nx-mask": `url("${svg}")`,
          "--nx-delay": `${(index ?? 0) * 80}ms`,
          "--nx-cycle-delay": `${(index ?? 0) * 1100}ms`,
          ...(attenue ? { opacity: 0.35 } : null),
        } as React.CSSProperties}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={svg} alt="" className="nx-badge__img" draggable={false} />
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
