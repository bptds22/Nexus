"use client";

import { useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check, ChevronDown } from "lucide-react";
import MarketingNav from "@/components/marketing/MarketingNav";
import PlaybookBackground from "@/app/components/PlaybookBackground";
import { useTranslation } from "@/lib/i18n/useTranslation";
import SectionsRecruteur from "@/components/marketing/recruteurs/SectionsRecruteur";

/* ═══════════════════════════════════════════════════════════════
   Pour les recruteurs — B2B landing page
   Identity: Stripe/Linear-style SaaS, outcome-driven, vouvoiement.
   Distinct from athlete (emotional) and coach (reputation) pages.
═══════════════════════════════════════════════════════════════ */

/* ── Pricing visual config (order matches dictionary tiers) ──── */

type PricingVisual = {
  priceColor: string;
  checkColor: string;
  highlighted?: boolean;
  buttonVariant: "outline-red" | "filled-red" | "outline-amber";
  borderClass: string;
};

const PRICING_VISUALS: PricingVisual[] = [
  {
    priceColor: "text-[#22C55E]",
    checkColor: "text-[#22C55E] bg-[#22C55E]/15",
    buttonVariant: "outline-red",
    borderClass: "border border-white/[0.06]",
  },
  {
    priceColor: "text-white",
    checkColor: "text-[#E63946] bg-[#E63946]/15",
    highlighted: true,
    buttonVariant: "filled-red",
    borderClass: "border-2 border-[#E63946]",
  },
  {
    priceColor: "text-white",
    checkColor: "text-[#F59E0B] bg-[#F59E0B]/15",
    buttonVariant: "outline-amber",
    borderClass: "border border-[#F59E0B]/40",
  },
];

/* ── Atoms ──────────────────────────────────────────────────── */

function RedLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] sm:text-[14px] font-bold tracking-[0.25em] uppercase text-[#E63946]">
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="nx-display text-[26px] sm:text-[32px] font-extrabold text-white leading-tight tracking-tight mt-3">
      {children}
    </h2>
  );
}

/* ── FAQ accordion item ─────────────────────────────────────── */

function FaqItem({
  q,
  a,
  open,
  onToggle,
}: {
  q: string;
  a: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="bg-[#1A1D24] border border-white/[0.06] rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-white/[0.02] transition-colors"
        aria-expanded={open ? "true" : "false"}
      >
        <span className="text-[15px] sm:text-[16px] font-bold text-white leading-snug">
          {q}
        </span>
        <ChevronDown
          size={20}
          className={`shrink-0 text-white/55 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      {open && (
        <div className="px-6 pb-6 text-[14px] text-white/75 leading-relaxed border-t border-white/[0.04]">
          <p className="pt-5">{a}</p>
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Page
══════════════════════════════════════════════════════════════ */

export default function PourLesRecruteursPage() {
  // Mobile build (Capacitor): page exclue.
  if (process.env.NEXT_PUBLIC_CAPACITOR_BUILD === "true") notFound();
  const { t } = useTranslation();
  const T = t.recruiterLanding;
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="hero-playbook min-h-screen bg-[#111317] text-white font-sans scroll-smooth relative">
      <PlaybookBackground />
      <div className="relative z-10">
        <MarketingNav />

        {/* Page recruteur v2 (BP 2026-10-20) : héros + une section par fonction. */}
        <SectionsRecruteur />

        {/* ─── SECTION 8 — TARIFICATION ─────────────────────── */}
        <section id="tarification" className="border-b border-white/[0.06]">
          <div className="max-w-[1200px] mx-auto px-6 py-20">
            <div className="text-center">
              <RedLabel>{T.pricing.eyebrow}</RedLabel>
              <SectionTitle>{T.pricing.title}</SectionTitle>
              <p className="text-[14px] sm:text-[15px] text-white/75 leading-relaxed mt-5 max-w-[640px] mx-auto">
                {T.pricing.lede}
              </p>
            </div>

            <div className="mt-14 mx-auto max-w-[1000px] flex flex-col md:flex-row items-stretch gap-4">
              {T.pricing.tiers.map((tier, i) => {
                const v = PRICING_VISUALS[i];
                const btnClass =
                  v.buttonVariant === "filled-red"
                    ? "bg-[#E63946] text-white hover:bg-[#D42B22] border border-[#E63946]"
                    : v.buttonVariant === "outline-amber"
                    ? "border border-[#F59E0B] text-[#F59E0B] hover:bg-[#F59E0B]/10"
                    : "border border-[#E63946] text-[#E63946] hover:bg-[#E63946]/10";
                return (
                  <div
                    key={tier.name}
                    className={`relative flex-1 bg-[#1A1D24] rounded-xl flex flex-col min-h-[640px] p-8 ${v.borderClass}`}
                  >
                    {tier.badge && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 inline-flex px-3 py-1 rounded-full bg-[#E63946] text-white text-[10px] font-bold uppercase tracking-wider">
                        {tier.badge}
                      </span>
                    )}

                    <h3 className="text-[20px] font-bold text-white">{tier.name}</h3>

                    <div className="mt-4 flex items-baseline gap-1.5 flex-wrap">
                      <span className={`nx-display text-[32px] sm:text-[36px] font-extrabold leading-none ${v.priceColor}`}>
                        {tier.price}
                      </span>
                      {tier.priceSuffix && (
                        <span className="text-[15px] text-white/55 font-semibold">{tier.priceSuffix}</span>
                      )}
                    </div>
                    <p className="text-[12px] text-white/55 mt-2">{tier.subtitle}</p>

                    <div className="h-px bg-white/[0.06] my-6" />

                    <div className="flex-1">
                      {tier.subheader && (
                        <p className="text-[13px] text-white/55 mb-3">{tier.subheader}</p>
                      )}
                      <ul className="space-y-2.5">
                        {tier.bullets.map((b) => (
                          <li
                            key={b}
                            className="flex items-start gap-3 text-[14px] text-white/85 leading-snug"
                          >
                            <span
                              className={`shrink-0 mt-0.5 w-[18px] h-[18px] rounded-full flex items-center justify-center ${v.checkColor}`}
                            >
                              <Check size={11} strokeWidth={3} />
                            </span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Link
                      href="/inscription"
                      className={`mt-8 inline-flex items-center justify-center w-full rounded-lg font-bold uppercase tracking-wider text-[13px] py-3 px-5 transition-colors ${btnClass}`}
                    >
                      {tier.buttonLabel}
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── SECTION 9 — FAQ ──────────────────────────────── */}
        <section id="faq" className="border-b border-white/[0.06]">
          <div className="max-w-[860px] mx-auto px-6 py-20">
            <div className="text-center">
              <RedLabel>{T.faq.eyebrow}</RedLabel>
              <SectionTitle>{T.faq.title}</SectionTitle>
            </div>

            <div className="space-y-3 mt-12">
              {T.faq.items.map((item, i) => (
                <FaqItem
                  key={item.q}
                  q={item.q}
                  a={item.a}
                  open={openFaq === i}
                  onToggle={() => setOpenFaq(openFaq === i ? null : i)}
                />
              ))}
            </div>
          </div>
        </section>

        {/* ─── SECTION 10 — FINAL CTA ───────────────────────── */}
        <section id="cta" className="bg-[#0d0f12] border-t border-white/[0.06]">
          <div className="max-w-[820px] mx-auto px-6 py-24 text-center">
            <span className="inline-block w-10 h-[2px] bg-[#E63946] mb-8" />

            <h2 className="nx-display text-[38px] sm:text-[52px] font-extrabold text-white leading-[1.05] tracking-tight">
              {T.cta.title1}<span className="text-[#E63946]">{T.cta.title2}</span>{T.cta.title3}
            </h2>

            <p className="text-[15px] sm:text-[17px] text-white/75 leading-relaxed mt-6 max-w-[560px] mx-auto">
              {T.cta.body}
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/inscription"
                className="inline-flex items-center justify-center rounded-lg bg-[#E63946] text-white font-bold uppercase tracking-wider hover:bg-[#D42B22] transition-colors text-[15px] px-9 py-[15px]"
              >
                {T.cta.button}
              </Link>
            </div>

            <p className="text-[13px] text-white/55 mt-8">
              {T.cta.footer}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
