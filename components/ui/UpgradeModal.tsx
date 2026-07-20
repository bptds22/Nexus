"use client";

import Link from "next/link";
import { Check, X as XIcon } from "lucide-react";
import {
  type Persona,
  getTiersForPersona,
} from "@/lib/config/pricing";

const IS_CAPACITOR = process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true";

/* ═══════════════════════════════════════════════════════════════
   UpgradeModal — generic Pro/All Star upgrade prompt

   Renders an overlay modal with:
   - A contextual headline naming the locked feature
   - Top 4 features from the target tier
   - One primary CTA to /tarifs?role=X&returnTo=Y for context return
   - A secondary "Voir tous les forfaits" link

   Pricing data is sourced from lib/config/pricing.ts (single source
   of truth). The modal pulls the named tier (e.g. "rec_pro") and
   shows monthly + annual-monthly-eq prices.
═══════════════════════════════════════════════════════════════ */

export interface UpgradeModalProps {
  /** Whether the modal is visible. */
  open: boolean;
  /** Called when the user dismisses the modal (X, backdrop, or Esc). */
  onClose: () => void;
  /** Which persona's pricing tiers to read. */
  role: Persona;
  /** Which tier id within the persona to upgrade to (e.g. "rec_pro"). */
  tierId: string;
  /**
   * Short headline naming the locked feature, in French. Shown as the
   * modal title to give the user context for why this prompt appeared.
   * Example: "Le pipeline de recrutement"
   */
  lockedFeatureTitle: string;
  /**
   * URL to return to after the user finishes the upgrade flow on
   * /tarifs. Passed as ?returnTo=... query param. The /tarifs page
   * (and eventually the post-Stripe-checkout redirect) honors it.
   */
  returnTo?: string;
}

export default function UpgradeModal({
  open,
  onClose,
  role,
  tierId,
  lockedFeatureTitle,
  returnTo,
}: UpgradeModalProps) {
  if (!open) return null;

  const tiers = getTiersForPersona(role);
  const tier = tiers.find((t) => t.id === tierId);

  if (!tier) {
    // Defensive — bad tierId shouldn't crash the page. Log + render nothing.
    console.error(`[UpgradeModal] Unknown tierId "${tierId}" for role "${role}"`);
    return null;
  }

  // Top 4 feature items from the tier (skip section headers if any)
  const topFeatures = tier.features
    .filter((f) => f.kind === "item" && f.included)
    .slice(0, 4);

  // Build CTA URL with returnTo param so the user comes back here
  // after upgrading.
  const tarifsUrl = (() => {
    const params = new URLSearchParams({ role });
    if (returnTo) params.set("returnTo", returnTo);
    return `/tarifs?${params.toString()}`;
  })();

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center px-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="upgrade-modal-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal card */}
      <div
        className="relative bg-[#1A1D24] border border-[#E63946]/30 rounded-2xl shadow-[0_0_40px_rgba(230,57,70,0.15)] w-full max-w-[480px] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-4 right-4 text-[#6b7280] hover:text-white transition-colors z-10"
        >
          <XIcon size={20} strokeWidth={2.5} />
        </button>

        <div className="p-6 sm:p-8">
          {/* Pro/All Star badge */}
          <span
            className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
              tier.id.includes("allstar")
                ? "bg-[#E63946] text-white"
                : "bg-[#F59E0B] text-black"
            }`}
          >
            {tier.name}
          </span>

          {/* Headline — locked feature */}
          <h2
            id="upgrade-modal-title"
            className="font-head text-[22px] sm:text-[26px] font-black text-white uppercase leading-tight tracking-tight mt-3"
          >
            {lockedFeatureTitle}
          </h2>
          <p className="text-[13px] text-[#9CA3AF] mt-2 leading-relaxed">
            Cette fonctionnalité est réservée aux membres {tier.name}. Découvre tout ce que tu obtiens.
          </p>

          {/* Pricing block — masqué sur iOS (3.1.1 : aucun prix ni achat) */}
          {!IS_CAPACITOR && (
            <div className="mt-5 pb-5 border-b border-white/[0.06]">
              <div className="flex items-baseline gap-1.5">
                <span className="font-head text-[32px] font-black text-white leading-none">
                  ${tier.monthly.toFixed(2)}
                </span>
                <span className="text-[14px] text-[#9CA3AF]">/mois</span>
              </div>
              {tier.annualMonthlyEq !== null && (
                <p className="text-[12px] text-[#c8c8cc] mt-1.5">
                  ou{" "}
                  <span className="font-bold text-white">
                    ${tier.annualMonthlyEq.toFixed(2)}/mois
                  </span>{" "}
                  facturé annuellement
                </p>
              )}
            </div>
          )}

          {/* Top features */}
          <ul className="space-y-2.5 mt-5">
            {topFeatures.map((f, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="shrink-0 mt-0.5 w-[16px] h-[16px] rounded-full bg-[#10B981]/15 text-[#10B981] flex items-center justify-center">
                  <Check size={11} strokeWidth={3} />
                </span>
                <span className="text-[13px] leading-relaxed text-white/85">
                  {f.label}
                </span>
              </li>
            ))}
          </ul>

          {/* CTA d'achat — masqués sur iOS (3.1.1) ; modale = info seule */}
          {!IS_CAPACITOR && (
            <>
              <Link
                href={tarifsUrl}
                className="mt-6 inline-flex items-center justify-center w-full h-12 rounded-lg bg-[#E63946] hover:bg-[#D42B22] text-white font-head font-black text-[13px] uppercase tracking-widest transition-colors"
              >
                Passer à {tier.name} →
              </Link>

              <Link
                href={tarifsUrl}
                className="mt-3 block text-center text-[12px] font-bold uppercase tracking-wider text-[#9CA3AF] hover:text-white transition-colors"
              >
                Voir tous les forfaits
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
