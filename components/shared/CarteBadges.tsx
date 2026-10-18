"use client";

/* ═══════════════════════════════════════════════════════════════
   CarteBadges — LE rendu des badges sur une carte (1.4.5, demande BP).

   MAX_BADGES_CARTE (5) badges au total, coach et partenaire confondus, puis
   « +N ». Priorité : badge personnalisé du partenaire, autres badges du
   partenaire, puis ceux du coach (badgesDeCarte). Composant partagé : recherche
   (grille et ligne), favoris, listes, processus, carte-joueur de la fiche, web
   et mobile. Aucune surface ne dessine ses propres pastilles.

   `variante="ligne"` ne passe JAMAIS à la ligne suivante : la rangée est
   rognée (overflow-hidden) et chaque pastille est tronquée — une carte en
   ligne ne déborde plus. `variante="grille"` passe à la ligne (flex-wrap).
   Les badges partenaire viennent du contexte PartenaireCartesProvider
   (lecture groupée) — ou de la prop `partenaire` si l'appelant les a déjà.
═══════════════════════════════════════════════════════════════ */

import NxIcon from "@/components/ui/NxIcon";
import { badgesDeCarte, type BadgeCarte, type BadgeCoachCarte } from "@/lib/badges/carteBadges";
import type { BadgePartenaire } from "@/lib/badges/partenaire";
import { useBadgesPartenairesDe, useDeclarerCarteVisible } from "@/components/shared/PartenaireCartesProvider";

function Pastille({ b }: { b: BadgeCarte }) {
  if (b.genre === "coach") {
    return (
      <span title={b.label} className="inline-flex items-center gap-1 max-w-[150px] px-2 py-0.5 rounded-full bg-[#E63946]/15 border border-[#E63946]/30 text-[10px] font-bold text-[#E63946]">
        {b.icon && <NxIcon name={b.icon} size={10} className="text-[#E63946] shrink-0" />}
        <span className="truncate">{b.label}</span>
      </span>
    );
  }
  return (
    <span title={`${b.label} — par ${b.organisation}`} data-badge-partenaire className="inline-flex items-center gap-1 max-w-[150px] px-2 py-0.5 rounded-full bg-[#3B82F6]/15 border border-[#3B82F6]/30 text-[10px] font-bold text-[#93C5FD]">
      {b.iconeUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.iconeUrl} alt="" width={12} height={12} className="w-3 h-3 rounded-sm object-contain shrink-0" />
      )}
      <span className="truncate">{b.label}</span>
    </span>
  );
}

export default function CarteBadges({
  athleteId,
  coach,
  partenaire,
  variante = "grille",
  className = "",
}: {
  /** Pour retrouver les badges partenaire du lot (contexte). */
  athleteId?: string | null;
  coach?: readonly BadgeCoachCarte[] | null;
  /** Prioritaire sur le contexte, si l'appelant a déjà ses badges partenaire. */
  partenaire?: readonly BadgePartenaire[] | null;
  variante?: "grille" | "ligne";
  className?: string;
}) {
  const duLot = useBadgesPartenairesDe(athleteId);
  /* La carte se déclare à l'approche de l'écran : ses badges partenaire sont lus avec
     son paquet d'environ 50 (PartenaireCartesProvider), jamais tous d'un coup. */
  const ref = useDeclarerCarteVisible(athleteId);
  const { visibles, reste } = badgesDeCarte(coach, partenaire ?? duLot);
  if (visibles.length === 0) return <div ref={ref} aria-hidden className="h-0" />;
  const disposition = variante === "ligne" ? "flex-nowrap overflow-hidden" : "flex-wrap";
  return (
    <div ref={ref} className={`flex items-center gap-1.5 min-w-0 ${disposition} ${className}`} data-testid="carte-badges">
      {visibles.map((b) => <Pastille key={b.cle} b={b} />)}
      {reste.length > 0 && (
        <span
          title={reste.map((b) => b.label).join(", ")}
          className="inline-flex items-center shrink-0 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-[#9CA3AF]"
        >
          +{reste.length}
        </span>
      )}
    </div>
  );
}
