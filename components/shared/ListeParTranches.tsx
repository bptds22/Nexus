"use client";

/* ═══════════════════════════════════════════════════════════════
   ListeParTranches — rend une longue liste par tranches, au défilement
   (correctif 2026-10-16, décision BP : Mon processus des Lauréats — 953
   cartes — s'ouvre en moins de 2 secondes sur mobile).

   Seul le RENDU est découpé : la liste reçue est complète (toutes les cartes
   chargées, comptées, filtrées et triées par l'appelant). Les 20 premières
   s'affichent tout de suite (un écran en montre ~6) ; 50 de plus arrivent quand on approche
   du bas (IntersectionObserver, bien avant d'y être). Changer de liste
   (onglet, filtre, tri) : l'appelant change la `key`, on repart du haut.
═══════════════════════════════════════════════════════════════ */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { tailleSuivante, TRANCHE_AFFICHAGE, PREMIERE_TRANCHE } from "@/lib/pipeline/tranches";

interface Props<T> {
  items: T[];
  rendre: (item: T) => ReactNode;
  tranche?: number;
  premiere?: number;
  className?: string;
}

export default function ListeParTranches<T>({ items, rendre, tranche = TRANCHE_AFFICHAGE, premiere = PREMIERE_TRANCHE, className }: Props<T>) {
  const [n, setN] = useState(premiere);
  const sentinelle = useRef<HTMLDivElement>(null);
  const reste = items.length > n;

  useEffect(() => {
    const el = sentinelle.current;
    if (!el || !reste) return;
    const io = new IntersectionObserver(
      (entrees) => { if (entrees.some((e) => e.isIntersecting)) setN((v) => tailleSuivante(v, items.length, tranche)); },
      { rootMargin: "1200px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reste, items.length, tranche]);

  return (
    <div className={className}>
      {items.slice(0, n).map(rendre)}
      {reste && (
        <div ref={sentinelle} role="status" className="py-4 text-center text-[12px] text-[#6B7280]">
          {/* C2 (1.4.5) : aucun compte de joueurs — plus de « N autres ». */}
          Afficher plus…
        </div>
      )}
    </div>
  );
}
