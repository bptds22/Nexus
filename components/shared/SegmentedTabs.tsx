"use client";

/* ═══════════════════════════════════════════════════════════════
   SegmentedTabs — le sélecteur d'onglets à pilule glissante.

   ── CE QU'IL REMPLACE ───────────────────────────────────────────
   Trois libellés posés côte à côte, l'actif en rouge, et un trait de
   2px sous lui. Aucun conteneur, aucun fond, aucune bordure : rien
   ne disait que c'était un contrôle. L'affordance reposait entièrement
   sur la couleur d'un mot — et un mot coloré, sur une fiche qui en
   contient déjà beaucoup, ne se distingue pas d'un titre.

   Ici, un conteneur encadré et une pilule pleine qui glisse sous
   l'onglet actif. L'ensemble se lit comme un objet manipulable.

   ── GÉOMÉTRIE ──────────────────────────────────────────────────
   Conteneur 48px = pilule 40px + 4px de marge intérieure de chaque
   côté (p-1). La pilule fait exactement une fraction de la largeur
   utile, donc `translateX(index * 100%)` la déplace d'une case pile —
   vrai tant que les segments sont d'égale largeur, ce que `flex-1`
   garantit.

   La transition de 280ms cubic-bezier(0.4, 0, 0.2, 1) est REPRISE
   telle quelle de l'ancien trait : le mouvement était juste, seul
   l'objet qui bouge change.

   ── PARTAGÉ, MAIS BRANCHÉ UNE SEULE FOIS ────────────────────────
   Six autres fichiers bricolent leurs propres onglets. Ce composant
   existe pour eux, mais 1.4.1 ne le branche QUE sur la fiche athlète
   mobile : un train gelé n'est pas le moment de toucher six surfaces.
   Leur migration est un fast-follow.
═══════════════════════════════════════════════════════════════ */

import { triggerHaptic } from "@/lib/haptics";

export interface SegmentedTab<K extends string> {
  key: K;
  label: string;
}

export default function SegmentedTabs<K extends string>({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: readonly SegmentedTab<K>[];
  active: K;
  onChange: (k: K) => void;
  className?: string;
}) {
  const activeIndex = Math.max(0, tabs.findIndex((t) => t.key === active));

  return (
    <div
      role="tablist"
      className={`relative flex rounded-2xl border border-white/[0.06] bg-[#1A1D24] p-1 ${className ?? ""}`}
    >
      {/* La pilule, DERRIÈRE les libellés (z-0 contre z-10). Posée en
          absolu sur la zone utile — les 4px de p-1 sont retranchés une
          fois, puis partagés entre les segments. */}
      <div
        aria-hidden
        className="absolute top-1 bottom-1 left-1 rounded-xl bg-[#E63946]"
        style={{
          width: `calc((100% - 0.5rem) / ${tabs.length})`,
          transform: `translateX(${activeIndex * 100}%)`,
          transition: "transform 280ms cubic-bezier(0.4, 0.0, 0.2, 1)",
        }}
      />

      {tabs.map((t) => {
        const isActive = t.key === active;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => { void triggerHaptic("Light"); onChange(t.key); }}
            className={`relative z-10 flex-1 h-10 flex items-center justify-center text-[12px] font-bold uppercase tracking-[0.12em] transition-colors ${
              isActive ? "text-white" : "text-[#9CA3AF]"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
