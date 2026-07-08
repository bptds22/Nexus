"use client";

/* ═══════════════════════════════════════════════════════════════
   TierCard — premium subscription tier card.

   Three states (iter 7.40 §3) :
   - current  : red border + glow + "Actuel" green pill
   - upgrade  : default card + subtle "Bientôt disponible" CTA strip
   - below    : muted card (lower opacity + grey text), no CTA

   Identity-agnostic ; consumers pass their role's features list.
   Recruiter renders 3 (Free/Pro/All Star) ; coach renders 2 (Free/Pro).
═══════════════════════════════════════════════════════════════ */

import { triggerHaptic, IS_CAPACITOR, type TierStatus } from "./utils";

export function TierCard({
  name, price, period, features, status, accentDot,
  onUpgrade, upgradeLabel = "Passer à Pro",
}: {
  name: string;
  price: string;
  period: string;
  features: string[];
  status: TierStatus;
  accentDot?: string;
  /** When provided AND status === "upgrade", renders an actionable red
   *  CTA instead of the read-only "Bientôt disponible" strip. Lets each
   *  role decide whether its upgrade is live (coach Pro) or stub
   *  (recruiter still has it gated behind Stripe wiring, so it omits
   *  this prop and keeps the legacy strip). */
  onUpgrade?: () => void;
  upgradeLabel?: string;
}) {
  const isCurrent = status === "current";
  const isBelow = status === "below";
  const cardClass = isCurrent
    ? "rounded-2xl border border-[#E63946]/45 bg-[#1A1D24] shadow-[0_0_18px_rgba(230,57,70,0.18)] p-4"
    : isBelow
      ? "rounded-2xl border border-white/[0.04] bg-[#1A1D24]/60 p-4"
      : "rounded-2xl border border-white/[0.06] bg-[#1A1D24] p-4";

  return (
    <div className={cardClass}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          {accentDot && (
            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: accentDot }} aria-hidden />
          )}
          <p className={`text-[16px] font-semibold ${isBelow ? "text-[#9CA3AF]" : "text-white"} truncate`}>{name}</p>
          {isCurrent && (
            <span className="px-2 py-0.5 rounded-full bg-[#22C55E]/15 text-[#22C55E] text-[9px] font-black uppercase tracking-wider shrink-0">
              Actuel
            </span>
          )}
        </div>
        <div className="flex items-baseline gap-1 shrink-0">
          <span className={`text-[16px] font-bold ${isBelow ? "text-[#6b7280]" : "text-white"}`}>{price}</span>
          {period && <span className="text-[12px] text-[#6b7280]">{period}</span>}
        </div>
      </div>
      <ul className="mt-3 space-y-1.5">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isBelow ? "#4a4d56" : "#22C55E"} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span className={`text-[12.5px] leading-snug ${isBelow ? "text-[#6b7280]" : "text-[#e0e0e0]"}`}>{f}</span>
          </li>
        ))}
      </ul>
      {status === "upgrade" && (
        <div className="mt-3 pt-3 border-t border-white/[0.05]">
          {IS_CAPACITOR ? (
            /* iOS/natif (Apple IAP 3.1.1) : pas de CTA d'achat in-app. Texte
               informatif PUR — pas de onClick, pas de lien cliquable. La
               gestion d'un abo existant reste via le portail (hors TierCard). */
            <div className="flex items-center justify-center h-9 rounded-2xl bg-white/[0.04] text-[12px] font-semibold text-[#9CA3AF] text-center px-3">
              Gère ton abonnement sur nexussports.ca
            </div>
          ) : onUpgrade ? (
            <button
              type="button"
              onClick={() => { triggerHaptic("Light"); onUpgrade(); }}
              className="w-full h-10 rounded-2xl bg-[#E63946] text-white text-[13px] font-semibold active:bg-[#D42B22] transition-colors shadow-[0_4px_12px_rgba(230,57,70,0.25)]"
            >
              {upgradeLabel}
            </button>
          ) : (
            <div className="flex items-center justify-center h-9 rounded-2xl bg-white/[0.04] text-[12px] font-semibold text-[#9CA3AF] italic">
              Bientôt disponible
            </div>
          )}
        </div>
      )}
    </div>
  );
}
