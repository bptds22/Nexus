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

   ── TROIS PAR RANGÉE, RETROUVÉS PAR LA GOUTTIÈRE ────────────────
   La version précédente était tombée à 2 par rangée, et le raisonnement
   tenait — mais il n'avait fait varier qu'UNE des trois grandeurs :

       3 × 136 px + 2 × 24 px de gouttière = 456 px  > 343 px   → débordait
       3 × 110 px + 2 ×  6 px              = 342 px ≤ 343 px    → tient

   La largeur utile la plus étroite est 343 px (375 px d'écran − 32 px de
   `px-4`). On a resserré la gouttière d'abord, la cellule ensuite : 5 badges
   se lisent en 3+2 sur deux rangées, au lieu de 1+2+2 sur trois.

   ── UNE SEULE BRANCHE ───────────────────────────────────────────
   Les cas n=1, 2/3, 4, 5 et ≥6 étaient taillés à la main, chacun avec ses
   gouttières. `repartirEnRangees` couvre tout : plus de branches, plus de
   dispositions qui divergent en silence.

   Révélation échelonnée optionnelle :
   - mounted=false OU i >= badgesRevealed  → opacity 0, scale 0.4
   - révélé                                → opacity 1, scale 1

   Générique sur T : l'appelant fournit `renderItem` (un DistinctionBadge pour
   la fiche athlète, un ReputationBadgeCell pour Ma Réputation). Le composant
   ne possède que l'enveloppe de révélation.

   PUR — aucun fetch, aucun état.
═══════════════════════════════════════════════════════════════ */

import type { ReactNode } from "react";

/** Maximum de badges par rangée. Fixé par la largeur de `lg` (110 px) et la
 *  gouttière (6 px) face à 343 px de contenu mobile — voir le calcul en tête. */
export const MAX_PAR_RANGEE = 3;

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
        /* items-START, pas center : à 110 px les libellés longs passent sur
           deux lignes. Centrés, deux badges de hauteurs différentes auraient
           décalé leurs pictos verticalement ; alignés en haut, la rangée de
           pictos reste droite et seul le texte descend. */
        <div key={r} className="flex items-start justify-center gap-x-1.5">
          {list.slice(debut, debut + taille).map((d, i) => renderWrapped(d, debut + i))}
        </div>
      ))}
    </div>
  );
}

/**
 * Découpe n badges en rangées de `parRangee` au plus, RELIQUAT EN QUEUE.
 *
 * ── LE RELIQUAT REDESCEND EN BAS ────────────────────────────────
 * La version précédente le remontait EN TÊTE (5 → 1+2+2). C'était la parade
 * juste au mauvais problème : avec un maximum de 2, un nombre impair laissait
 * forcément une rangée de 1, et un badge seul pendu sous deux rangées pleines
 * se lit mal. À 3 par rangée le cas ne se pose presque plus, et la lecture
 * naturelle — les rangées pleines d'abord, le reste dessous — reprend ses
 * droits. 5 badges se lisent 3 en haut, 2 dessous.
 *
 * ── L'ORPHELINE DE 1 EST RÉÉQUILIBRÉE, PAS DÉPLACÉE ─────────────
 * Reste le cas `n % parRangee === 1` : la dernière rangée n'aurait qu'un
 * badge, isolé sous des rangées pleines. Plutôt que de le remonter — ce qui
 * ferait réapparaître la pyramide qu'on vient d'abandonner — on emprunte un
 * badge à la rangée précédente : deux rangées de 2 valent mieux qu'une de 3
 * et une de 1. C'est la même intention qu'avant (jamais de badge seul en
 * bas), obtenue sans casser l'ordre de lecture.
 *
 *   1 → 1        2 → 2        3 → 3
 *   4 → 2+2      5 → 3+2      6 → 3+3
 *   7 → 3+2+2    8 → 3+3+2    10 → 3+3+2+2
 *
 * `n = 1` reste une rangée de 1 : il n'y a rien au-dessus, donc rien dont il
 * puisse être orphelin.
 */
export function repartirEnRangees(n: number, parRangee: number = MAX_PAR_RANGEE): number[] {
  if (n <= 0) return [];
  const rangees: number[] = [];
  for (let reste = n; reste > 0; reste -= parRangee) rangees.push(Math.min(parRangee, reste));

  /* Dernière rangée à 1 badge : on lui en cède un de la précédente.
     Garde `parRangee > 2` — à 2 par rangée l'échange donnerait 1+1, pire que
     2+1. Garde `rangees.length > 1` — un unique badge n'est orphelin de
     rien. */
  const derniere = rangees.length - 1;
  if (parRangee > 2 && rangees.length > 1 && rangees[derniere] === 1) {
    rangees[derniere - 1] -= 1;
    rangees[derniere] += 1;
  }
  return rangees;
}
