"use client";

/* ═══════════════════════════════════════════════════════════════
   AdaptiveBadgesRow — disposition des badges d'un athlète en rangées.

   ── UNE SEULE TAILLE, QUEL QUE SOIT LE NOMBRE ───────────────────
   Avant : `sizeHint = n === 1 ? "lg" : "sm"`. Un badge seul s'affichait en
   136 px, deux badges tombaient à 96 px. Le même badge changeait donc de
   taille selon ses voisins — un athlète qui en gagnait un second voyait le
   premier rapetisser. Décision : la taille du badge SEUL devient LA taille.
   `sizeHint` vaut désormais toujours "lg", et il ne reste dans la signature
   de `renderItem` que pour ne pas casser les appelants.

   ── CONSÉQUENCE : DEUX PAR RANGÉE, PAS TROIS ────────────────────
   La règle « jamais plus de 3 par rangée » était calibrée sur `sm`. Elle ne
   survit pas au passage à `lg` :

       3 × 136 px + 2 × 24 px de gouttière = 456 px
       largeur de contenu mobile courante   = 343-379 px   → débordement

       2 × 136 px + 1 × 24 px               = 296 px       → tient

   C'est le même calcul que celui qui avait fait passer n=4 de 4-en-ligne à
   2+2 (4 × 88 + 3 × 20 = 412 px, la 4e étiquette se faisait rogner) ; seule
   la largeur du badge a changé. Le coût est vertical : cinq badges occupent
   trois rangées au lieu de deux. C'est le prix d'une taille constante.

   ── UNE SEULE BRANCHE ───────────────────────────────────────────
   Les cas n=1, 2/3, 4, 5 et ≥6 étaient taillés à la main, chacun avec ses
   gouttières. Avec un maximum uniforme de 2, `repartirEnRangees` couvre tout :
   plus de branches, plus de dispositions qui divergent en silence.

   Révélation échelonnée optionnelle :
   - mounted=false OU i >= badgesRevealed  → opacity 0, scale 0.4
   - révélé                                → opacity 1, scale 1

   Générique sur T : l'appelant fournit `renderItem` (un DistinctionBadge pour
   la fiche athlète, un ReputationBadgeCell pour Ma Réputation). Le composant
   ne possède que l'enveloppe de révélation.

   PUR — aucun fetch, aucun état.
═══════════════════════════════════════════════════════════════ */

import type { ReactNode } from "react";

/** Maximum de badges par rangée. Fixé par la largeur de `lg` (136 px) face à
 *  une largeur de contenu mobile de 343-379 px — voir le calcul en tête. */
export const MAX_PAR_RANGEE = 2;

export interface AdaptiveBadgesRowProps<T> {
  items: T[];
  /** `sizeHint` vaut TOUJOURS "lg" depuis le passage à la taille unique.
   *  Conservé dans la signature pour ne pas casser les appelants. */
  renderItem: (item: T, index: number, sizeHint: "lg" | "sm") => ReactNode;
  /** Maximum d'éléments rendus (tronque au-delà). */
  maxBadges?: number;
  /** Grille de révélation. À false, tout est masqué (opacity 0). */
  mounted?: boolean;
  /** Révèle jusqu'à N éléments (i < badgesRevealed). Défaut : tous. */
  badgesRevealed?: number;
}

export function AdaptiveBadgesRow<T>({
  items,
  renderItem,
  maxBadges = 5,
  mounted = true,
  badgesRevealed,
}: AdaptiveBadgesRowProps<T>) {
  if (!items.length) return null;
  const list = items.slice(0, maxBadges);
  const n = list.length;
  const revealedCount = badgesRevealed ?? n;

  /* Taille CONSTANTE — ne plus la faire dépendre de `n`. C'était tout le bug. */
  const sizeHint = "lg" as const;

  const renderWrapped = (item: T, i: number) => {
    const revealed = mounted && i < revealedCount;
    return (
      <div
        key={i}
        className="flex-shrink-0"
        style={{
          opacity: revealed ? 1 : 0,
          transform: revealed ? "scale(1)" : "scale(0.4)",
          transformOrigin: "center",
          transition: "opacity 200ms ease-out, transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {renderItem(item, i, sizeHint)}
      </div>
    );
  };

  /* Tranches PRÉCALCULÉES (début + taille) plutôt qu'un curseur muté dans le
     `map`. L'ancienne version portait un `let curseur` réassigné pendant le
     rendu — que `react-hooks` refuse, à raison : sous rendu concurrent, un
     rendu interrompu puis repris laisserait le curseur à mi-chemin et les
     rangées se découperaient de travers. */
  const tranches = repartirEnRangees(n).reduce<{ debut: number; taille: number }[]>(
    (acc, taille) => {
      const precedente = acc[acc.length - 1];
      acc.push({ debut: precedente ? precedente.debut + precedente.taille : 0, taille });
      return acc;
    },
    [],
  );

  return (
    <div className="flex flex-col items-center gap-y-3">
      {tranches.map(({ debut, taille }, r) => (
        <div key={r} className="flex items-center justify-center gap-x-6">
          {list.slice(debut, debut + taille).map((d, i) => renderWrapped(d, debut + i))}
        </div>
      ))}
    </div>
  );
}

/**
 * Découpe n badges en rangées de `parRangee` au plus, SANS rangée orpheline
 * en bas.
 *
 * Avec un maximum de 2, un nombre impair produit forcément une rangée de 1
 * quelque part. On la met EN TÊTE, jamais en queue : un badge seul suspendu
 * sous deux rangées pleines pend dans le vide (c'est ce que l'ancienne règle
 * des rangées de 3 évitait déjà), alors qu'en tête il se lit comme une
 * pyramide. L'ordre de lecture est préservé — badge 1 en haut, puis 2-3,
 * puis 4-5 — ce qui compte, les badges étant ordonnés.
 *
 *   1 → 1        2 → 2        3 → 1+2
 *   4 → 2+2      5 → 1+2+2    7 → 1+2+2+2
 */
export function repartirEnRangees(n: number, parRangee: number = MAX_PAR_RANGEE): number[] {
  if (n <= 0) return [];
  const rangees: number[] = [];
  let reste = n;

  /* Le reliquat part en PREMIER. Sans ça il finirait en dernière rangée —
     l'orpheline qu'on refuse. */
  const reliquat = n % parRangee;
  if (parRangee > 1 && n > parRangee && reliquat !== 0) {
    rangees.push(reliquat);
    reste -= reliquat;
  }

  for (; reste > 0; reste -= parRangee) rangees.push(Math.min(parRangee, reste));
  return rangees;
}
