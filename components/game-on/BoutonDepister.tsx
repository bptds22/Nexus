"use client";

/* « Dépister ce match » (BP 2026-10-18) — sur la fiche d'un match de la carte des matchs et sur
   un match du calendrier. Ouvre le Dépistage avec le match et ses deux équipes déjà connus :
   il ne reste qu'à choisir la couleur des chandails. Libellé : lib/gameOn/libelles. */

import Link from "next/link";
import { DEPISTAGE, lienDepister, type ModeDepistage } from "@/lib/gameOn/libelles";
import { triggerHaptic } from "@/lib/haptics";

export default function BoutonDepister({ gameId, equipeA, equipeB, lieu, className, onClick, mode = "recruteur" }: {
  gameId: string;
  equipeA: string;
  equipeB: string;
  lieu?: string | null;
  className?: string;
  onClick?: () => void;
  mode?: ModeDepistage;
}) {
  return (
    <Link
      href={lienDepister({ gameId, equipeA, equipeB, lieu }, mode)}
      data-testid="depister-ce-match"
      onClick={(e) => { e.stopPropagation(); triggerHaptic("Light"); onClick?.(); }}
      className={className ?? "inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-[#E63946] px-4 text-[14px] font-bold text-white active:bg-[#D42B22] hover:bg-[#D42B22]"}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="9" /><polygon points="10 8.5 16 12 10 15.5" fill="currentColor" />
      </svg>
      {DEPISTAGE.bouton}
    </Link>
  );
}
