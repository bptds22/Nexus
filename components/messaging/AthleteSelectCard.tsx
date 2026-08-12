"use client";

/* ═══════════════════════════════════════════════════════════════
   AthleteSelectCard — condensed, tappable athlete card for the
   compose flows ("à propos de quel athlète ?"). Reuses the visual
   pattern of AthleteInfoCard / TransfertAthletesMobile in a compact
   row : AthletePhotoFill (initials fallback) + nom + "sport · position"
   + 5 étoiles (cote_globale_entraineur, gold #F59E0B / vide #4a4d56).

   Selected state mirrors TransfertAthletesMobile :
     bordure #E63946 + fond #E63946]/10.

   Works web + mobile (both compose pages import the same composers).
═══════════════════════════════════════════════════════════════ */

import type { ReactNode } from "react";
import AthletePhotoFill from "@/components/shared/AthletePhotoFill";

const STAR_PATH = "M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27l7.1-1.01L12 2z";

interface AthleteSelectCardProps {
  firstName?: string | null;
  lastName?: string | null;
  /** Fallback combined name when first/last are not provided. */
  name?: string;
  photoUrl?: string | null;
  sport?: string | null;
  position?: string | null;
  /** cote_globale_entraineur (0–5). Stars hidden when ≤ 0. */
  stars?: number;
  /** #EN_ATTENTE : athlète en attente de consentement → liseré « En attente ». */
  isPending?: boolean;
  selected?: boolean;
  disabled?: boolean;
  busy?: boolean;
  /** Optional extra line under the subtitle (e.g. ❤ favori marker). */
  meta?: ReactNode;
  onClick: () => void;
}

export default function AthleteSelectCard({
  firstName,
  lastName,
  name,
  photoUrl,
  sport,
  position,
  stars = 0,
  isPending = false,
  selected = false,
  disabled = false,
  busy = false,
  meta,
  onClick,
}: AthleteSelectCardProps) {
  // Derive first/last (for the initials fallback) from a combined name when
  // the caller only has one.
  const parts = (name ?? `${firstName ?? ""} ${lastName ?? ""}`).trim().split(/\s+/);
  const fn = firstName ?? parts[0] ?? "";
  const ln = lastName ?? parts.slice(1).join(" ");
  const displayName = (name ?? `${fn} ${ln}`).trim() || "Athlète";
  const subtitle = [sport, position].filter(Boolean).join(" · ");
  const full = Math.round(Math.max(0, Math.min(5, stars)));

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`text-left rounded-xl p-3 flex items-center gap-3 transition-colors disabled:opacity-50 ${
        selected
          ? "bg-[#E63946]/10 border border-[#E63946]"
          : "bg-[#1A1D24] border border-[#2D3748] hover:border-[#E63946]/60"
      }`}
    >
      <div className="w-11 h-11 rounded-full overflow-hidden bg-[#2F3440] shrink-0 relative">
        <AthletePhotoFill photoUrl={photoUrl} firstName={fn} lastName={ln} initialsFontSize={15} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="text-[14px] font-bold text-white truncate">{displayName}</p>
          {isPending && <span className="shrink-0 rounded-full bg-[#F59E0B]/15 border border-[#F59E0B]/30 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#F59E0B]">En attente</span>}
        </div>
        {subtitle && <p className="text-[12px] text-[#6b7280] truncate">{subtitle}</p>}
        {stars > 0 && (
          <span className="inline-flex items-center gap-[2px] mt-1">
            {Array.from({ length: 5 }, (_, i) => (
              <svg key={i} width="13" height="13" viewBox="0 0 24 24" className="shrink-0">
                <path d={STAR_PATH} fill={i < full ? "#F59E0B" : "#4a4d56"} />
              </svg>
            ))}
          </span>
        )}
        {meta}
      </div>
      {busy && <div className="w-4 h-4 border-2 border-[#E63946] border-t-transparent rounded-full animate-spin shrink-0" />}
    </button>
  );
}
