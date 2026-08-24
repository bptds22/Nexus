"use client";

/* ═══════════════════════════════════════════════════════════════
   useGrilles — accès React au référentiel de grilles.

   Vit à part pour que lib/evaluations/grilles.ts reste sans
   dépendance framework : la résolution y est pure, donc testable en
   Node sans React ni base.

   Le chargement est mémorisé AU NIVEAU MODULE dans grilles.ts : N
   composants montés en même temps ne déclenchent qu'un aller-retour.
   Ce hook ne fait qu'exposer la promesse déjà en vol.

   Avant résolution, il rend un GrilleSet vide (`ok: false`) plutôt que
   null : les fonctions de rendu marchent dessus et livrent les 14
   libellés de repli, donc AUCUN écran n'a besoin d'un état de
   chargement pour les critères. Pas de flash de libellé, pas de garde
   `if (!set) return null` à écrire 11 fois.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useState } from "react";
import { loadGrilles, EMPTY_GRILLE_SET, type GrilleSet } from "./grilles";

export function useGrilles(): GrilleSet {
  const [set, setSet] = useState<GrilleSet>(EMPTY_GRILLE_SET);

  useEffect(() => {
    let alive = true;
    loadGrilles().then((s) => { if (alive) setSet(s); });
    return () => { alive = false; };
  }, []);

  return set;
}
